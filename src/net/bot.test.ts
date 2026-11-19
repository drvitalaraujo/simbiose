// @vitest-environment node
// Bots nos mapas de verdade: andam pela grade de navegação, se encontram, atiram e
// morrem, sem custar caro por tick no servidor.
import { describe, expect, it } from 'vitest';
import { createRng } from '../sim/rng';
import { ArenaSim, type MatchFields, type SimPlayer } from './arena-sim';
import { botNavFor } from './bot-nav';
import { getMap } from './maps';
import { DEFAULT_RULES } from './match';

describe('ferramenta de teste: nascer perto de alguém', () => {
  it('acha um ponto livre e à vista perto de qualquer spawn do Pelourinho', () => {
    const map = getMap('pelourinho');
    const players = new Map<string, SimPlayer>();
    const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
    const sim = new ArenaSim({ map, rules: { ...DEFAULT_RULES }, rng: createRng(5), state, players, create: (p) => ({ ...p }), now: () => 0, botNav: false });
    sim.join('a', 'A');
    sim.join('b', 'B');
    for (const s of map.spawns) {
      sim.teleport('b', s, 0);
      expect(sim.placeNear('a', 'b'), `perto de ${s.x},${s.z}`).toBe(true);
    }
  });
});

describe('bots nos mapas competitivos', () => {
  it.each(['pelourinho', 'favela', 'lapa'])('%s: andam, atiram e morrem numa sala só de bots', (mapId) => {
    const map = getMap(mapId);
    const t0 = performance.now();
    botNavFor(map);
    const navMs = performance.now() - t0;

    const players = new Map<string, SimPlayer>();
    const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
    let ms = 0;
    const sim = new ArenaSim({
      map, rules: { ...DEFAULT_RULES }, rng: createRng(99), state, players, create: (p) => ({ ...p }), now: () => ms,
    });
    let shots = 0;
    let kills = 0;
    sim.on((e) => {
      if (e.type === 'shot') shots += 1;
      if (e.type === 'kill') kills += 1;
    });
    sim.setBotTarget(6);
    const start = new Map([...players].map(([id, p]) => [id, { x: p.x, z: p.z }]));
    const travelled = new Map<string, number>();
    const last = new Map(start);
    const t1 = performance.now();
    const TICKS = 60 * 90; // 90 s de jogo
    for (let t = 0; t < TICKS; t++) {
      sim.tick(1 / 60);
      ms += 1000 / 60;
      if (t % 30 === 0) {
        for (const [id, p] of players) {
          const l = last.get(id)!;
          const d = Math.hypot(p.x - l.x, p.z - l.z);
          if (d < 20) travelled.set(id, (travelled.get(id) ?? 0) + d); // ignora teleporte do renascer
          last.set(id, { x: p.x, z: p.z });
        }
      }
    }
    const tickMs = (performance.now() - t1) / TICKS;
    console.info(`[bots:${mapId}] nav ${navMs.toFixed(0)} ms, ${tickMs.toFixed(3)} ms/tick, ${shots} tiros, ${kills} abates`, [...travelled.values()].map((d) => d.toFixed(0)));
    for (const d of travelled.values()) expect(d).toBeGreaterThan(60); // cada bot andou bastante
    expect(shots).toBeGreaterThan(20);
    expect(kills).toBeGreaterThan(0);
    expect(tickMs).toBeLessThan(4); // folga para 60 Hz (o tick tem ~16.7 ms)
  }, 60000);
});
