// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ArenaSim, ABANDON_WINDOW, type MatchFields, type SimPlayer } from './arena-sim';
import { getMap } from './maps';
import { DEFAULT_RULES } from './match';
import { createRng } from '../sim/rng';
import { TICK } from '../sim/clock';
import type { ArenaEvent } from './modes-arena-types';

function setup(mode: 'duel' | 'ffa' | 'tdm' = 'duel', killLimit = 10, reverse = false) {
  const players = new Map<string, SimPlayer>(), state = {} as MatchFields, events: ArenaEvent[] = [];
  const sim = new ArenaSim({ map: { ...getMap('arena'), solids: [], shotBlockers: [] }, rules: { ...DEFAULT_RULES, mode, killLimit, invulnTime: 0 }, players, state, rng: createRng(1), now: () => 0, create: p => p, botNav: false, arenaDrone: false });
  for (const id of reverse ? ['b', 'a'] : ['a', 'b']) sim.join(id, id);
  const a = players.get('a')!, b = players.get('b')!;
  Object.assign(a, { x: 20, y: 1, z: 0, team: 'a' }); Object.assign(b, { x: 0, y: 1, z: 0, team: 'b' });
  sim.on(e => events.push(e));
  const plant = (id: string, owner: string, x: number) => sim.grenadeCombat.projectiles.set(id, { owner, x, y: 1, z: 0, vx: 0, vy: 0, vz: 0, age: 1.49, seq: 0 });
  const explode = (owner: string, x: number) => { plant('he', owner, x); sim.tick(TICK); };
  return { sim, a, b, players, state, events, plant, explode };
}
describe('regressões Opus: crédito e explosão atômica', () => {
  it.each(['duel', 'ffa', 'tdm'] as const)('%s credita suicídio ao inimigo recente e não ao próprio', mode => {
    const s = setup(mode); s.explode('a', 4.5); expect(s.b.hp).toBeLessThan(100);
    s.explode('b', 0);
    expect(s.a.kills).toBe(1); expect(s.b.kills).toBe(0); expect(s.b.deaths).toBe(1);
    expect(s.events.filter(e => e.type === 'kill')).toEqual([expect.objectContaining({ msg: expect.objectContaining({ killerId: 'a', victimId: 'b' }) })]);
    if (mode === 'tdm') expect(s.state.scoreA).toBe(1);
  });
  it('dano próprio não estende o prazo do agressor, inclusive ao abandonar', () => {
    for (const leaving of [false, true]) {
      const s = setup(); s.explode('a', 4.5);
      s.sim.idle('b', ABANDON_WINDOW - 0.1); Object.assign(s.b, { x: 0, y: 1, z: 0 });
      s.explode('b', 5.5); // dano próprio pequeno antes de vencer o prazo
      s.sim.idle('b', 0.11); Object.assign(s.b, { x: 0, y: 1, z: 0 });
      if (leaving) s.sim.leave('b'); else s.explode('b', 0);
      expect(s.a.kills).toBe(0); expect(s.b.kills).toBe(0);
    }
  });
  it('suicídio puro não pontua; agressor ausente ou agora aliado não recebe crédito', () => {
    for (const condition of ['none', 'left', 'ally']) {
      const s = setup('tdm');
      if (condition !== 'none') s.explode('a', 4.5);
      if (condition === 'left') s.sim.leave('a');
      if (condition === 'ally') s.a.team = s.b.team;
      s.explode('b', 0);
      expect(s.a.kills).toBe(0); expect(s.b.kills).toBe(0); expect(s.state.scoreA).toBe(0); expect(s.state.scoreB).toBe(0);
    }
  });
  it.each(['ffa', 'tdm'] as const)('%s resolve todas as vítimas antes do fim e não detona HE já limpa', mode => {
    for (const reverse of [false, true]) {
      const s = setup(mode, 1, reverse);
      const c = s.sim.join('c', 'C'); Object.assign(c, { x: 0, y: 1, z: 0, team: 'b' });
      s.plant('first', 'a', 0); s.plant('later', 'a', 20);
      s.sim.tick(TICK);
      expect(s.b.hp).toBe(0); expect(c.hp).toBe(0); expect(s.a.hp).toBe(100);
      expect(s.a.kills).toBe(2); expect(s.state.phase).toBe('ended');
      if (mode === 'tdm') expect(s.state.scoreA).toBe(2);
      const relevant = s.events.filter(e => e.type === 'kill' || e.type === 'end').map(e => e.type);
      expect(relevant).toEqual(['kill', 'kill', 'end']);
      expect(s.events.filter(e => e.type === 'shot' && e.msg.grenadePhase === 'explode')).toHaveLength(1);
      expect([...s.sim.grenadeCombat.projectiles]).toHaveLength(0);
    }
  });
});
