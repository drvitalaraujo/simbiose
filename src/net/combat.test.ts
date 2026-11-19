// @vitest-environment node
// Combate do modo online sem rede (regras puras de src/net/arena-sim.ts): lag compensation,
// paredes, cadência, dano por parte do corpo, morte/renascimento, fim de partida e bots.
import { describe, expect, it } from 'vitest';
import type { PlayerCommand } from '../sim/command';
import type { Box } from '../sim/physics';
import { EYE_HEIGHT } from '../sim/player';
import { createRng } from '../sim/rng';
import type { Vec3 } from '../sim/vec';
import { ArenaSim, type ArenaEvent, type MatchFields, type SimPlayer, type ViewLookup } from './arena-sim';
import { damageFor, type Pose, poseOf, resolveShot } from './combat';
import type { KillFeedEvent, ShotMsg } from './feed';
import type { NetMap } from './maps';
import { DEFAULT_RULES, type MatchRules, pickSpawn, rulesFrom } from './match';
import { flatAt, stepNet } from './protocol';

const DT = 1 / 60;
const FEET = 0.86;

function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box {
  return { min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } };
}

const FLOOR = box(-60, -1, -60, 60, 0, 60);

function testMap(extra: Box[] = [], spawns: Vec3[] = [{ x: -20, y: FEET, z: 20 }, { x: 20, y: FEET, z: -20 }]): NetMap {
  return { id: `teste-${extra.length}`, blocks: [], solids: [FLOOR, ...extra], shotBlockers: [FLOOR, ...extra], spawns, bounds: { x0: -60, z0: -60, x1: 60, z1: 60 } };
}

function setup(opts: { map?: NetMap; rules?: Partial<MatchRules> } = {}) {
  const players = new Map<string, SimPlayer>();
  const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
  let ms = 0;
  const sim = new ArenaSim({
    map: opts.map ?? testMap(),
    rules: { ...DEFAULT_RULES, invulnTime: 0, ...opts.rules },
    rng: createRng(1234),
    state,
    players,
    create: (init) => ({ ...init }),
    now: () => ms,
    botNav: false,
  });
  const events: ArenaEvent[] = [];
  sim.on((e) => events.push(e));
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.tick(DT);
      ms += DT * 1000;
    }
  };
  const shots = () => events.filter((e): e is { type: 'shot'; msg: ShotMsg } => e.type === 'shot').map((e) => e.msg);
  const kills = () => events.filter((e): e is { type: 'kill'; msg: KillFeedEvent } => e.type === 'kill').map((e) => e.msg);
  return { sim, players, state, events, tick, shots, kills };
}

let seq = 0;
function cmd(over: Partial<PlayerCommand> = {}): PlayerCommand {
  return { seq: ++seq, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0, pitch: 0, fire: false, alt: false, ...over };
}

/** Mira (yaw, pitch) do olho de `p` até um ponto. */
function aimAt(p: SimPlayer, at: Vec3) {
  const dx = at.x - p.x;
  const dy = at.y - (p.y + EYE_HEIGHT);
  const dz = at.z - p.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/** Assenta os dois no chão (alguns ticks parados). */
function settle(s: ReturnType<typeof setup>, ids: string[], n = 10) {
  for (let i = 0; i < n; i++) for (const id of ids) s.sim.command(id, cmd({ yaw: s.players.get(id)!.yaw }), DT);
}

describe('acerto e dano por parte do corpo', () => {
  for (const solid of [false, true]) for (const shoot of [false, true]) {
    it(`tiro autoritativo e predito respeitam solid=${solid}, shoot=${shoot}`, () => {
      const wall = box(-3, 0, -6, 3, 4, -5);
      const map = testMap(solid ? [wall] : []);
      map.shotBlockers = shoot ? [FLOOR, wall] : [FLOOR];
      const s = setup({ map });
      s.sim.join('a', 'A');
      s.sim.join('b', 'B');
      s.sim.teleport('a', { x: 0, y: FEET, z: 0 }, 0);
      s.sim.teleport('b', { x: 0, y: FEET, z: -10 }, 0);
      settle(s, ['a', 'b']);
      s.sim.command('a', cmd({ fire: true }), DT);
      expect(s.players.get('b')!.hp < 100).toBe(!shoot);
      const predicted = stepNet(flatAt({ x: 0, y: FEET, z: 0 }), cmd({ fire: true }), DT, map.solids, { x: 0, y: FEET, z: 0 }, () => 0.5, map.shotBlockers);
      expect(predicted?.hit).toBe(shoot ? 'world' : 'none');
    });
  }

  const target: Pose = { x: 0, y: FEET, z: -10, yaw: 0, pitch: 0, vx: 0, vz: 0 };
  const origin = { x: 0, y: FEET + EYE_HEIGHT, z: 0 };
  const dirTo = (y: number) => {
    const d = { x: 0, y: y - origin.y, z: -10 };
    const l = Math.hypot(d.x, d.y, d.z);
    return { x: d.x / l, y: d.y / l, z: d.z / l };
  };
  const feet = FEET - 0.85;

  it('MK-2 perto: cabeça 40 (×2), tronco 20, pernas 15 (×0.75)', () => {
    expect(resolveShot(origin, dirTo(feet + 1.64), [FLOOR], [{ id: 'b', pose: target }]).hit).toMatchObject({ part: 'head', damage: 40 });
    expect(resolveShot(origin, dirTo(feet + 1.2), [FLOOR], [{ id: 'b', pose: target }]).hit).toMatchObject({ part: 'torso', damage: 20 });
    expect(resolveShot(origin, dirTo(feet + 0.5), [FLOOR], [{ id: 'b', pose: target }]).hit).toMatchObject({ part: 'legs', damage: 15 });
  });

  it('dano cai a partir de 18 m (60% aos 40 m ou mais)', () => {
    expect(damageFor('torso', 10)).toBe(20);
    expect(damageFor('torso', 18)).toBe(20);
    expect(damageFor('torso', 29)).toBeCloseTo(16, 6);
    expect(damageFor('head', 40)).toBeCloseTo(24, 6);
    expect(damageFor('torso', 90)).toBeCloseTo(12, 6);
    const far: Pose = { ...target, z: -30 };
    const d = { x: 0, y: feet + 1.2 - origin.y, z: -30 };
    const l = Math.hypot(d.x, d.y, d.z);
    const hit = resolveShot(origin, { x: 0, y: d.y / l, z: d.z / l }, [FLOOR], [{ id: 'b', pose: far }]).hit!;
    expect(hit.part).toBe('torso');
    expect(hit.damage).toBeLessThan(20);
    expect(hit.damage).toBeGreaterThan(12);
  });

  it('parede na frente bloqueia o tiro', () => {
    const wall = box(-3, 0, -6, 3, 4, -5);
    const r = resolveShot(origin, dirTo(feet + 1.2), [FLOOR, wall], [{ id: 'b', pose: target }]);
    expect(r.hit).toBeNull();
    expect(r.wall).toBe(true);
    expect(r.end.z).toBeCloseTo(-5, 3);
  });

  it('na sala: 3 tiros na cabeça (40 cada) matam e o killfeed marca headshot', () => {
    const s = setup();
    s.sim.join('a', 'A');
    s.sim.join('b', 'B');
    s.sim.teleport('a', { x: 0, y: FEET, z: 0 }, 0);
    s.sim.teleport('b', { x: 0, y: FEET, z: -12 }, 0);
    settle(s, ['a', 'b']);
    const a = s.players.get('a')!;
    const b = s.players.get('b')!;
    for (let t = 0; t < 30 && b.hp > 0; t++) {
      const aim = aimAt(a, { x: b.x, y: b.y - 0.85 + 1.64, z: b.z });
      // O atirador acompanha a cabeça e compensa o coice que resta no próximo tick.
      aim.pitch -= a.recoil * Math.exp(-5 * DT);
      s.sim.command('a', cmd({ ...aim, fire: true }), DT);
    }
    const mine = s.shots().filter((m) => m.by === 'a');
    expect(mine.map((m) => [m.part, m.dmg])).toEqual([['head', 40], ['head', 40], ['head', 40]]);
    expect(mine.at(-1)?.k).toBe(true);
    expect(s.kills()[0]).toEqual({
      killer: 'A', victim: 'B', killerId: 'a', victimId: 'b', weapon: 'mk2', headshot: true, killerIsBot: false, victimIsBot: false,
    });
    expect(b.hp).toBe(0);
    expect(a.kills).toBe(1);
    expect(b.deaths).toBe(1);
  });
});

describe('lag compensation (rewind)', () => {
  /**
   * B corre de lado (7 m/s, troca de sentido a cada 40 ticks); A, parado a 15 m, mira em
   * onde VÊ B: `delay` ticks no passado (0 = sem atraso; 15 ≈ 150 ms de ping + 100 ms de
   * interpolação). Devolve a fração de tiros que acertou.
   */
  function duel(delay: number, rewind: boolean, wall?: Box) {
    const s = setup({ map: testMap(wall ? [wall] : []) });
    s.sim.join('a', 'A');
    s.sim.join('b', 'B');
    s.sim.teleport('a', { x: -15, y: FEET, z: 0 }, -Math.PI / 2);
    s.sim.teleport('b', { x: 0, y: FEET, z: 0 }, -Math.PI / 2); // de frente para A: anda de lado em z
    settle(s, ['a', 'b']);
    const a = s.players.get('a')!;
    const b = s.players.get('b')!;
    const history: Pose[] = [];
    const seen = (t: number) => history[Math.max(0, t - delay)];
    let hits = 0;
    let fired = 0;
    // Janela maior inclui a pausa de recarga e conserva uma amostra de >50 tiros.
    for (let t = 0; t < 600; t++) {
      s.sim.command('b', cmd({ yaw: -Math.PI / 2, moveX: Math.floor(t / 40) % 2 ? 1 : -1 }), DT);
      history.push(poseOf(b));
      b.hp = 100; // alvo de treino: não morre
      const view = seen(t);
      const lookup: ViewLookup = () => (_id, p) => (rewind ? view : poseOf(p));
      const before = s.shots().length;
      s.sim.command('a', cmd({ ...aimAt(a, { x: view.x, y: view.y + 0.3, z: view.z }), fire: true }), DT, lookup);
      const shot = s.shots()[before];
      if (shot) {
        fired += 1;
        if (shot.t === 'b') hits += 1;
      }
    }
    return { ratio: hits / fired, fired, b };
  }

  it('atirador a ~150 ms acerta o alvo em movimento como a 0 ms', () => {
    const now = duel(0, true);
    const lagged = duel(15, true);
    expect(now.fired).toBeGreaterThan(50);
    expect(now.ratio).toBeGreaterThan(0.95);
    expect(lagged.ratio).toBeGreaterThan(0.95);
    // Sem rewind, o mesmo atirador com atraso erra quase tudo (prova que o rewind é que acerta)
    expect(duel(15, false).ratio).toBeLessThan(0.35);
  });

  it('alvo atrás de parede não toma dano, mesmo com rewind', () => {
    const wall = box(-8, 0, -6, -7, 4, 6);
    const r = duel(15, true, wall);
    expect(r.fired).toBeGreaterThan(50);
    expect(r.ratio).toBe(0);
  });
});

describe('cadência', () => {
  it('ninguém atira mais rápido que a arma, nem soltando e apertando a cada tick', () => {
    for (const pattern of [(_t: number) => true, (t: number) => t % 2 === 0]) {
      const s = setup();
      s.sim.join('a', 'A');
      const fireTicks: number[] = [];
      for (let t = 0; t < 140; t++) {
        const before = s.shots().length;
        s.sim.command('a', cmd({ fire: pattern(t) }), DT);
        if (s.shots().length > before) fireTicks.push(t);
      }
      const gaps = fireTicks.slice(1).map((t, i) => t - fireTicks[i]);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(7); // 1/9 s a 60 Hz
      expect(fireTicks.length).toBeLessThanOrEqual(20);
    }
  });
});

describe('morte, renascimento e partida', () => {
  function killOnce(s: ReturnType<typeof setup>, killer = 'a', victim = 'b') {
    const a = s.players.get(killer)!;
    const b = s.players.get(victim)!;
    s.sim.teleport(killer, { x: 0, y: FEET, z: 0 }, 0);
    s.sim.teleport(victim, { x: 0, y: FEET, z: -12 }, 0);
    settle(s, [killer, victim]);
    for (let i = 0; i < 60 && b.hp > 0; i++) {
      s.sim.command(killer, cmd({ ...aimAt(a, { x: b.x, y: b.y + 0.3, z: b.z }), fire: true }), DT);
    }
    expect(b.hp).toBe(0);
  }

  it('morto renasce em 3 s, com proteção curta, e o placar conta', () => {
    const s = setup({ rules: { invulnTime: 1.5 } });
    s.sim.join('a', 'A');
    s.sim.join('b', 'B');
    s.tick(100); // passa a proteção inicial
    killOnce(s);
    const b = s.players.get('b')!;
    const life = b.life;
    expect(b.respawnIn).toBeCloseTo(3, 5);
    s.tick(170);
    expect(b.hp).toBe(0);
    s.tick(15);
    expect(b.hp).toBe(100);
    expect(b.life).toBe(life + 1);
    expect(b.invuln).toBe(true);
    // Protegido: tiro acerta mas não tira vida
    const a = s.players.get('a')!;
    s.sim.teleport('a', { x: b.x + 10, y: b.y, z: b.z }, 0);
    settle(s, ['a'], 5);
    for (let i = 0; i < 8; i++) s.sim.command('a', cmd({ ...aimAt(a, { x: b.x, y: b.y + 0.3, z: b.z }), fire: true }), DT);
    expect(s.shots().at(-1)).toMatchObject({ t: 'b', dmg: 0 });
    expect(b.hp).toBe(100);
    s.tick(95);
    expect(b.invuln).toBe(false);
    expect(a.kills).toBe(1);
    expect(b.deaths).toBe(1);
  });

  it('nasce longe de inimigos e fora da linha de visão deles', () => {
    const wall = box(10, 0, -5, 11, 4, 5);
    const near = { x: 0, y: FEET, z: 8 }; // perto e à vista
    const farSeen = { x: -30, y: FEET, z: 0 }; // longe mas à vista
    const hidden = { x: 20, y: FEET, z: 0 }; // atrás da parede
    const threats = [{ eye: { x: 0, y: FEET + EYE_HEIGHT, z: 0 } }];
    for (let k = 0; k < 20; k++) {
      expect(pickSpawn([near, farSeen, hidden], threats, [FLOOR, wall], createRng(k))).toBe(hidden);
    }
  });

  it('fim por abates, tiro sem dano na tela de fim e reinício rápido na mesma sala', () => {
    const s = setup({ rules: { killLimit: 2, endScreen: 5 } });
    s.sim.join('a', 'A');
    s.sim.join('b', 'B');
    killOnce(s);
    s.tick(200);
    killOnce(s);
    expect(s.state.phase).toBe('ended');
    expect(s.state.winnerId).toBe('a');
    expect(s.state.winnerName).toBe('A');
    s.tick(200); // B renasce durante a tela de fim
    const b = s.players.get('b')!;
    const a = s.players.get('a')!;
    expect(b.hp).toBe(100);
    s.sim.teleport('b', { x: 0, y: FEET, z: -12 }, 0);
    s.sim.teleport('a', { x: 0, y: FEET, z: 0 }, 0);
    settle(s, ['a', 'b']);
    for (let i = 0; i < 20; i++) s.sim.command('a', cmd({ ...aimAt(a, { x: b.x, y: b.y + 0.3, z: b.z }), fire: true }), DT);
    expect(b.hp).toBe(100);
    s.tick(110); // 5 s de tela de fim no total
    expect(s.state.phase).toBe('playing');
    expect(s.state.match).toBe(2);
    expect(a.kills).toBe(0);
    expect(b.deaths).toBe(0);
    expect(s.events.some((e) => e.type === 'start')).toBe(true);
  });

  it('fim por tempo', () => {
    const s = setup({ rules: { timeLimit: 2 } });
    s.sim.join('a', 'A');
    s.tick(60);
    expect(s.state.phase).toBe('playing');
    expect(s.state.timeLeft).toBe(1);
    s.tick(61);
    expect(s.state.phase).toBe('ended');
  });

  it('limites da URL ficam dentro de faixas', () => {
    expect(rulesFrom({ abates: '5', tempo: '2' })).toMatchObject({ killLimit: 5, timeLimit: 120 });
    expect(rulesFrom({ abates: 'x', tempo: -1 })).toMatchObject({ killLimit: 25, timeLimit: 480 });
    expect(rulesFrom({ abates: 9999 }).killLimit).toBe(100);
  });
});

describe('bots', () => {
  function botDuel(wall: Box | null) {
    const s = setup({ map: testMap(wall ? [wall] : []) });
    s.sim.join('h', 'Humano');
    s.sim.join('bot-x', 'Saci', true);
    s.sim.teleport('bot-x', { x: 0, y: FEET, z: 10 }, 0); // olhando para -z
    s.sim.teleport('h', { x: 0, y: FEET, z: -10 }, 0);
    const h = s.players.get('h')!;
    for (let t = 0; t < 240; t++) {
      s.sim.command('h', cmd(), DT);
      s.tick();
      if (h.hp <= 0) break;
    }
    return { shots: s.shots().filter((m) => m.by === 'bot-x'), h, s };
  }

  it('não atira através de parede', () => {
    const r = botDuel(box(-10, 0, -1, 10, 4, 1));
    expect(r.shots).toHaveLength(0);
    expect(r.h.hp).toBe(100);
  });

  it('com o caminho livre, vê, reage com atraso e acerta', () => {
    const r = botDuel(null);
    expect(r.shots.length).toBeGreaterThan(0);
    expect(r.shots.some((m) => m.t === 'h')).toBe(true);
    expect(r.h.hp).toBeLessThan(100);
  });

  it('completam a sala até o total e saem quando entra gente', () => {
    const s = setup();
    s.sim.setBotTarget(4);
    expect([...s.players.values()].filter((p) => p.bot)).toHaveLength(4);
    s.sim.join('h1', 'Gente 1');
    s.sim.balanceBots();
    s.sim.join('h2', 'Gente 2');
    s.sim.balanceBots();
    const bots = [...s.players.values()].filter((p) => p.bot);
    expect(bots).toHaveLength(2);
    expect(new Set(bots.map((b) => b.name)).size).toBe(2);
    s.sim.leave('h1');
    s.sim.balanceBots();
    expect(s.players.size).toBe(4);
  });
});
