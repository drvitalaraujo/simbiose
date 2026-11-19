// @vitest-environment node
// Prova de que a simulação roda sem navegador (como vai rodar no servidor): só importa
// src/sim/**, sem Three.js, sem DOM e sem Math.random.
import { describe, expect, it } from 'vitest';
import type { PlayerCommand } from './command';
import { EventBus, type SimEvent } from './events';
import type { Box } from './physics';
import { createPlayer, hurtPlayer, type PlayerState, stepPlayer } from './player';
import { rayBox } from './ray';
import { createRng } from './rng';
import { createWeapon, type ShotTargets, stepWeapon } from './weapon';

const DT = 1 / 60;
const floor: Box = { min: { x: -40, y: -1, z: -40 }, max: { x: 40, y: 0, z: 40 } };
const crate: Box = { min: { x: 4, y: 0, z: -1 }, max: { x: 5, y: 0.4, z: 1 } }; // degrau
const wall: Box = { min: { x: -3, y: 0, z: -12 }, max: { x: 3, y: 4, z: -11 } };
const SOLIDS = [floor, crate, wall];

/** Alvos de teste: caixas com vida (no jogo, drones/jogadores). */
function boxTargets(list: { box: Box; hp: number }[]): ShotTargets {
  return {
    raycast(origin, dir, far) {
      let best: { id: number; t: number } | null = null;
      list.forEach((tg, id) => {
        if (tg.hp <= 0) return;
        const t = rayBox(origin, dir, tg.box, far);
        if (t !== null && (!best || t < best.t)) best = { id, t };
      });
      return best;
    },
    damage(id) {
      list[id].hp -= 1;
      return list[id].hp <= 0;
    },
  };
}

function cmd(t: number, yaw: number, pitch: number): PlayerCommand {
  return {
    seq: t,
    moveX: t % 200 < 100 ? 1 : -1, // vai e volta de lado (atirando em movimento)
    moveZ: 0,
    sprint: t % 300 > 150,
    jump: t % 120 === 60,
    yaw,
    pitch,
    fire: t % 90 < 60, // rajadas
    alt: false,
  };
}

function run(seed: number) {
  const events = new EventBus();
  const rng = createRng(seed);
  const p = createPlayer({ x: 0, y: 0.86, z: 0 });
  const w = createWeapon();
  // Um alvo na frente (+x, longe) e um atrás da parede (-z): o de trás nunca pode ser atingido
  const targets = [
    { box: { min: { x: 20, y: 0, z: -15 }, max: { x: 21, y: 3, z: 15 } }, hp: 1e9 },
    { box: { min: { x: -1, y: 0, z: -20 }, max: { x: 1, y: 3, z: -19 } }, hp: 1e9 },
  ];
  const shotTargets = boxTargets(targets);
  const log: SimEvent[] = [];
  for (let t = 0; t < 600; t++) {
    // primeira metade mira o alvo da frente; segunda mira o de trás da parede
    const aimFront = t < 300;
    stepPlayer(p, cmd(t, aimFront ? -Math.PI / 2 : 0, 0), DT, SOLIDS);
    stepWeapon(w, p, cmd(t, 0, 0).fire, DT, { solids: SOLIDS, rng, events, targets: shotTargets });
    if (t === 400) hurtPlayer(p, 30, events);
    log.push(...events.drain());
  }
  return { p, log, targets };
}

function snapshot(p: PlayerState) {
  return JSON.stringify(p);
}

describe('simulação no node (sem navegador)', () => {
  it('roda 600 ticks de jogador + tiros, determinística com a mesma semente', () => {
    const a = run(7);
    const b = run(7);
    expect(snapshot(a.p)).toBe(snapshot(b.p));
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(b.log));

    const shots = a.log.filter((e) => e.type === 'shot');
    const hits = a.log.filter((e) => e.type === 'hit');
    expect(shots.length).toBeGreaterThan(40);
    expect(hits.length).toBeGreaterThan(10);
    // Todo acerto é no alvo da frente: a parede bloqueia o de trás
    expect(hits.every((e) => e.type === 'hit' && e.target === 0)).toBe(true);
    expect(a.targets[1].hp).toBe(1e9);
    expect(shots.some((e) => e.type === 'shot' && e.hit === 'world')).toBe(true);
    expect(a.log.find((e) => e.type === 'hurt')).toMatchObject({ amount: 30, hp: 70, fatal: false });
    // O jogador continua no mapa e em pé
    expect(a.p.pos.y).toBeGreaterThan(0.8);
    expect(Number.isFinite(a.p.pos.x + a.p.pos.z)).toBe(true);
  });

  it('semente diferente muda o espalhamento', () => {
    const a = run(7).log.filter((e) => e.type === 'shot');
    const b = run(8).log.filter((e) => e.type === 'shot');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('tiro mata o alvo e sai o evento kill', () => {
    const events = new EventBus();
    const p = createPlayer({ x: 0, y: 0.86, z: 0 });
    const w = createWeapon();
    const targets = [{ box: { min: { x: -1, y: 0, z: -8 }, max: { x: 1, y: 3, z: -7 } }, hp: 3 }];
    const ctx = { solids: [floor], rng: createRng(1), events, targets: boxTargets(targets) };
    const types: string[] = [];
    for (let t = 0; t < 60; t++) {
      stepPlayer(p, { ...cmd(t, 0, 0), moveX: 0, jump: false }, DT, [floor]);
      stepWeapon(w, p, true, DT, ctx);
      for (const e of events.drain()) if (e.type !== 'shot') types.push(e.type);
    }
    expect(types.slice(0, 3)).toEqual(['hit', 'hit', 'kill']);
    expect(targets[0].hp).toBe(0);
  });
});

// Arquivos da sim como texto (Vite junta na hora do teste), para checar as importações.
const sources = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('src/sim é puro', () => {
  const files = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts'));

  it('encontra os arquivos da sim', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files)('%s não usa Three.js, DOM, Math.random nem src/game', (_path, code) => {
    expect(code).not.toMatch(/from ['"]three/);
    expect(code).not.toMatch(/from ['"]\.\.\//); // nada de fora de src/sim
    expect(code).not.toMatch(/\b(document|window|performance|requestAnimationFrame)\./);
    expect(code).not.toMatch(/Math\.random\(/);
  });
});
