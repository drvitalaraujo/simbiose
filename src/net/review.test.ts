// @vitest-environment node
// Regressões da revisão do Codex (docs/reviews/2026-10-02-codex-revisao-combate.md), sem rede.
// Os casos que precisam do servidor de verdade estão em room.node.test.ts.
import { describe, expect, it } from 'vitest';
import type { PlayerCommand } from '../sim/command';
import type { Box } from '../sim/physics';
import { EYE_HEIGHT } from '../sim/player';
import { createRng } from '../sim/rng';
import { SPREAD } from '../sim/weapon';
import { ArenaSim, type MatchFields, type SimPlayer, type ViewLookup } from './arena-sim';
import { type Pose, poseOf } from './combat';
import type { KillFeedEvent, ShotMsg } from './feed';
import { ViewClock, VIEW_JUMP_MS, VIEW_TOLERANCE_MS } from './lagcomp';
import { debugAllowed, debugMisconfigured, Quota } from './limits';
import { getMap, type NetMap } from './maps';
import { DEFAULT_RULES } from './match';
import { InputPacer, STARVE } from './pacer';
import { commandFromWire, flatAt, INTERP_DELAY_MS, stepNet, type WireInput, writeWire } from './protocol';
import { PITCH_LIMIT } from '../sim/player';
import { NetPlayer } from './schema';

const DT = 1 / 60;
const FEET = 0.86;
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });
const FLOOR = box(-60, -1, -60, 60, 0, 60);

function setup(seed: number, extra: Box[] = []) {
  const map: NetMap = { id: `rev-${extra.length}`, blocks: [], solids: [FLOOR, ...extra], shotBlockers: [FLOOR, ...extra], spawns: [{ x: -20, y: FEET, z: 20 }, { x: 20, y: FEET, z: -20 }], bounds: { x0: -60, z0: -60, x1: 60, z1: 60 } };
  const players = new Map<string, SimPlayer>();
  const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
  const sim = new ArenaSim({ map, rules: { ...DEFAULT_RULES, invulnTime: 0 }, rng: createRng(seed), state, players, create: (p) => ({ ...p }), now: () => 0, botNav: false });
  const shots: ShotMsg[] = [];
  const kills: KillFeedEvent[] = [];
  sim.on((e) => {
    if (e.type === 'shot') shots.push(e.msg);
    if (e.type === 'kill') kills.push(e.msg);
  });
  return { sim, players, shots, kills };
}

let seq = 0;
const cmd = (over: Partial<PlayerCommand> = {}): PlayerCommand => ({
  seq: ++seq, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0, pitch: 0, fire: false, alt: false, ...over,
});

/** Direções dos tiros de quem atira sempre igual (mesmos comandos públicos). */
function fireSeries(serverSeed: number, n = 20) {
  const s = setup(serverSeed);
  s.sim.join('a', 'A');
  s.sim.teleport('a', { x: 0, y: FEET, z: 0 }, 0);
  for (let t = 0; t < 7 * n; t++) s.sim.command('a', { ...cmd({ fire: true }), seq: 1000 + t }, DT);
  return s.shots.map((m) => {
    const d = [m.e[0] - m.o[0], m.e[1] - m.o[1], m.e[2] - m.o[2]];
    const l = Math.hypot(d[0], d[1], d[2]);
    return d.map((v) => v / l);
  });
}

describe('achado 1: espalhamento imprevisível para o cliente', () => {
  it('nada do espalhamento vai no estado público', () => {
    const p = new NetPlayer();
    expect('seed' in p).toBe(false);
  });

  it('mesmos comandos públicos (seq, mira) com segredos diferentes do servidor dão tiros diferentes', () => {
    const a = fireSeries(1);
    const b = fireSeries(2);
    expect(a.length).toBe(20);
    const differ = a.filter((d, i) => Math.hypot(d[0] - b[i][0], d[1] - b[i][1], d[2] - b[i][2]) > 1e-4).length;
    expect(differ).toBeGreaterThanOrEqual(19);
  });

  it('o tiro continua espalhado: o desvio médio do centro fica na escala do SPREAD', () => {
    const dirs = fireSeries(7, 40);
    // O coice agora persiste em y; x isola a dispersão aleatória da subida vertical.
    const mean = dirs.reduce((s, d) => s + Math.abs(d[0]), 0) / dirs.length;
    expect(mean).toBeGreaterThan(SPREAD * 0.15);
    expect(mean).toBeLessThan(SPREAD);
  });
});

describe('achado 2: rewind pela estimativa do servidor, não pelo carimbo', () => {
  it('carimbo honesto passa; sem carimbo usa a estimativa', () => {
    const v = new ViewClock();
    v.observeRtt(40);
    const expected = v.expectedDepth();
    expect(expected).toBeCloseTo(INTERP_DELAY_MS + 40 + 16, 6);
    expect(10_000 - v.resolve(10_000, 10_000 - expected - 15)).toBeCloseTo(expected + 15, 6);
    const w = new ViewClock();
    w.observeRtt(40);
    expect(10_000 - w.resolve(10_000, 0)).toBeCloseTo(expected, 6);
  });

  it('carimbo forjado no fundo da janela (350 ms) é puxado para perto da estimativa', () => {
    const v = new ViewClock();
    v.observeRtt(10); // ping baixo de verdade
    const depth = 10_000 - v.resolve(10_000, 10_000 - 350);
    expect(depth).toBeCloseTo(v.expectedDepth() + VIEW_TOLERANCE_MS, 6);
    expect(depth).toBeLessThan(200);
  });

  it('a profundidade não salta mais que o limite entre tiros seguidos', () => {
    const v = new ViewClock();
    v.observeRtt(100);
    const first = 10_000 - v.resolve(10_000, 10_000 - v.expectedDepth() + VIEW_TOLERANCE_MS); // carimbo raso
    const second = 10_100 - v.resolve(10_100, 10_100 - v.expectedDepth() - VIEW_TOLERANCE_MS); // e logo depois fundo
    expect(second - first).toBeLessThanOrEqual(VIEW_JUMP_MS + 1e-9);
  });

  it('com ping baixo, carimbo antigo não acerta quem já virou a esquina', () => {
    // Alvo corre de x = -6 (à vista) para trás da parede (x > 1) a 7 m/s; atirador em z = 15
    const wall = box(1, 0, -1, 30, 4, 1);
    const s = setup(3, [wall]);
    s.sim.join('a', 'A');
    s.sim.join('b', 'B');
    s.sim.teleport('a', { x: -2, y: FEET, z: 15 }, 0);
    s.sim.teleport('b', { x: -6, y: FEET, z: -3 }, 0);
    const a = s.players.get('a')!;
    const b = s.players.get('b')!;
    const history: { t: number; pose: Pose }[] = [];
    const v = new ViewClock();
    v.observeRtt(10);
    const at = (time: number) => history.reduce((best, h) => (Math.abs(h.t - time) < Math.abs(best.t - time) ? h : best)).pose;
    let hits = 0;
    let ms = 0;
    for (let t = 0; t < 120; t++) {
      ms += 1000 / 60;
      s.sim.command('b', cmd({ moveX: 1 }), DT);
      history.push({ t: ms, pose: poseOf(b) });
      b.hp = 100;
      if (b.x < 3) continue; // espera o alvo sumir atrás da parede
      // Trapaça: carimbo de 350 ms atrás e mira onde o alvo estava lá (ainda à vista)
      const forged = at(ms - 350);
      const view: ViewLookup = () => {
        const time = v.resolve(ms, ms - 350);
        return () => at(time);
      };
      const dx = forged.x - a.x;
      const dz = forged.z - a.z;
      const before = s.shots.length;
      s.sim.command('a', cmd({ yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(forged.y + 0.3 - (a.y + EYE_HEIGHT), Math.hypot(dx, dz)), fire: true }), DT, view);
      if (s.shots[before]?.t === 'b') hits += 1;
    }
    expect(s.shots.filter((m) => m.by === 'a').length).toBeGreaterThan(3);
    expect(hits).toBe(0);
  });
});

describe('achado 3: limites de tráfego e salas', () => {
  it('cota por chave respeita o teto e libera ao sair', () => {
    const q = new Quota();
    expect(q.tryAdd('1.2.3.4', 2)).toBe(true);
    expect(q.tryAdd('1.2.3.4', 2)).toBe(true);
    expect(q.tryAdd('1.2.3.4', 2)).toBe(false);
    expect(q.tryAdd('5.6.7.8', 2)).toBe(true);
    q.remove('1.2.3.4');
    expect(q.tryAdd('1.2.3.4', 2)).toBe(true);
    expect(q.count('1.2.3.4')).toBe(2);
  });
});

describe('achado 4: sem comando, a física continua', () => {
  it('ritmo: fluxo normal = 1 passo por tick; parado = passos vazios depois de ~100 ms', () => {
    const p = new InputPacer();
    for (let t = 0; t < 30; t++) expect(p.plan(1)).toEqual({ skip: 0, steps: 1, idle: false });
    const idle = Array.from({ length: 30 }, () => p.plan(0).idle);
    expect(idle.slice(0, STARVE).every((i) => !i)).toBe(true);
    expect(idle.slice(STARVE + 1).every((i) => i)).toBe(true);
  });

  it('comandos atrasados que chegam juntos não dão passos a mais que o tempo real', () => {
    const p = new InputPacer();
    let steps = 0;
    let queued = 0;
    const TICKS = 300;
    for (let t = 0; t < TICKS; t++) {
      // Cliente manda 1 por tick, mas a rede segura 40 ticks e entrega tudo de uma vez
      if (t >= 100 && t < 140) {
        // nada chega
      } else if (t === 140) queued += 41;
      else queued += 1;
      const plan = p.plan(queued);
      queued -= plan.skip + plan.steps;
      steps += plan.steps + (plan.idle ? 1 : 0);
    }
    expect(steps).toBeLessThanOrEqual(TICKS);
    expect(queued).toBeLessThanOrEqual(2); // a fila esvaziou (sem atraso permanente)
  });

  it('quem pula e para de mandar comando cai no chão (sala com ritmo do servidor)', () => {
    const s = setup(5);
    s.sim.join('a', 'A');
    const a = s.players.get('a')!;
    s.sim.teleport('a', { x: 0, y: FEET, z: 0 }, 0);
    for (let t = 0; t < 10; t++) s.sim.command('a', cmd(), DT);
    s.sim.command('a', cmd({ jump: true }), DT);
    for (let t = 0; t < 5; t++) s.sim.command('a', cmd(), DT);
    expect(a.y).toBeGreaterThan(FEET + 0.3); // no ar
    const pacer = new InputPacer();
    for (let t = 0; t < 120; t++) {
      const plan = pacer.plan(0); // cliente parou de mandar
      if (plan.idle) s.sim.idle('a', DT);
      s.sim.tick(DT);
    }
    expect(a.y).toBeLessThan(FEET + 0.01);
    expect(a.onGround).toBe(true);
    expect(a.vy).toBe(0);
  });
});

describe('revisão da main, item 10: entrada já no formato do fio', () => {
  it('yaw/pitch saem em float32 exato e dentro dos limites do servidor (inclusive nas bordas)', () => {
    const rng = createRng(11);
    const w = {} as WireInput;
    const angles = [Math.PI, -Math.PI, Math.PI * 3 - 1e-9, 7.1, -0.3456789123, 1.4999999, 2.2, -9];
    for (let i = 0; i < 500; i++) angles.push((rng() - 0.5) * 20);
    for (const a of angles) {
      writeWire(w, cmd({ yaw: a, pitch: a / 4 }));
      expect(Math.fround(w.yaw)).toBe(w.yaw);
      expect(Math.fround(w.pitch)).toBe(w.pitch);
      expect(w.yaw).toBeGreaterThanOrEqual(-Math.PI);
      expect(w.yaw).toBeLessThanOrEqual(Math.PI);
      expect(Math.abs(w.pitch)).toBeLessThanOrEqual(PITCH_LIMIT);
    }
  });

  it('predição com a entrada do fio = servidor, bit a bit, andando com mira variando', () => {
    const map = getMap('arena');
    const spawn = map.spawns[0];
    const client = flatAt(spawn);
    const server = flatAt(spawn);
    const w = {} as WireInput;
    for (let t = 1; t <= 600; t++) {
      writeWire(w, cmd({ moveZ: 1, moveX: t % 90 < 45 ? 1 : 0, yaw: 0.345678912345 + Math.sin(t / 37) * 2.5, pitch: 0.123456789123 }));
      // O servidor recebe pelo fio (float32) e passa pelo sanitizador; o cliente usa `w` direto
      const wire = { ...w, yaw: Math.fround(w.yaw), pitch: Math.fround(w.pitch) };
      stepNet(client, commandFromWire(w, t), DT, map.solids, spawn, createRng(1));
      stepNet(server, commandFromWire(wire, t), DT, map.solids, spawn, createRng(2));
    }
    expect(client).toEqual(server);
  });
});

describe('achados 5 a 7', () => {
  it('sair ferido no meio do combate conta como abate de quem feriu', () => {
    const s = setup(9);
    s.sim.join('a', 'A');
    s.sim.join('b', 'B');
    s.sim.teleport('a', { x: 0, y: FEET, z: 0 }, 0);
    s.sim.teleport('b', { x: 0, y: FEET, z: -12 }, 0);
    for (let t = 0; t < 10; t++) {
      s.sim.command('a', cmd(), DT);
      s.sim.command('b', cmd(), DT);
    }
    const a = s.players.get('a')!;
    const b = s.players.get('b')!;
    const aim = { yaw: 0, pitch: Math.atan2(b.y + 0.3 - (a.y + EYE_HEIGHT), 12) };
    for (let t = 0; t < 7 && b.hp === 100; t++) s.sim.command('a', cmd({ ...aim, fire: true }), DT);
    expect(b.hp).toBeLessThan(100);
    s.sim.leave('b');
    expect(s.kills).toEqual([expect.objectContaining({ killerId: 'a', victimId: 'b' })]);
    expect(a.kills).toBe(1);
  });

  it('sair sem estar em combate não dá abate a ninguém', () => {
    const s = setup(10);
    s.sim.join('a', 'A');
    s.sim.join('b', 'B');
    s.sim.leave('b');
    expect(s.kills).toHaveLength(0);
  });

  it('teleporte de teste só em desenvolvimento: precisa da variável E de NODE_ENV fora de produção', () => {
    expect(debugAllowed({ SIMBIOSE_DEBUG: '1' })).toBe(true);
    expect(debugAllowed({ SIMBIOSE_DEBUG: '1', NODE_ENV: 'development' })).toBe(true);
    expect(debugAllowed({ SIMBIOSE_DEBUG: '1', NODE_ENV: 'production' })).toBe(false);
    expect(debugAllowed({ NODE_ENV: 'development' })).toBe(false);
    expect(debugMisconfigured({ SIMBIOSE_DEBUG: '1', NODE_ENV: 'production' })).toBe(true);
    expect(debugMisconfigured({ NODE_ENV: 'production' })).toBe(false);
  });

  it('nome de mapa herdado do protótipo ou inválido cai no mapa padrão', () => {
    for (const bad of ['__proto__', 'toString', 'constructor', 'hasOwnProperty', '', 42, null, undefined]) {
      const m = getMap(bad);
      expect(m.id).toBe('pelourinho');
      expect(Array.isArray(m.solids)).toBe(true);
    }
    expect(getMap('arena').id).toBe('arena');
  });
});
