// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emptyCommand } from '../sim/command';
import { createRng } from '../sim/rng';
import { ARSENAL } from '../sim/weapons';
import { ArenaSim, type MatchFields, type SimPlayer } from './arena-sim';
import { resolveShot, groupVolleyHits } from './combat';
import { DEFAULT_RULES } from './match';
import { commandFromWire, flatAt, FLAT_FIELDS, stepNet, writeWire, type WireInput } from './protocol';
import { NetPlayer } from './schema';
import { gunMessages } from './gun-combat';

const spawn = { x: 0, y: 0.8501, z: 0 }, DT = 1 / 60;
const floor = { min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } };

describe('arsenal autoritativo', () => {
  it.each([0, 1, 2, 3])('arma %i reconcilia todos os campos mesmo com RNGs diferentes', index => {
    const server = Object.assign(new NetPlayer(), flatAt(spawn, index));
    const predicted = flatAt(spawn, index);
    const secret = createRng(3), local = createRng(99), wire = {} as WireInput;
    for (let i = 0; i < 240; i++) {
      const cmd = { ...emptyCommand(i), moveZ: i < 20 ? 1 : 0, aim: i > 15 && i < 90, fire: i % 20 < 10, reload: i === 100 };
      writeWire(wire, cmd);
      const sanitized = commandFromWire(wire, i);
      stepNet(server, sanitized, DT, [floor], spawn, secret);
      stepNet(predicted, sanitized, DT, [floor], spawn, local);
      for (const key of FLAT_FIELDS) expect(predicted[key], `${i}: ${key}`).toBe(server[key]);
    }
  });

  it('selecionar não troca arma nem repõe munição; renascer aplica a escolha validada', () => {
    const players = new Map<string, SimPlayer>();
    const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
    const sim = new ArenaSim({ players, state, create: p => ({ ...p }), now: () => 0,
      rng: createRng(9), rules: DEFAULT_RULES,
      map: { id: 'test', blocks: [], solids: [floor], shotBlockers: [floor], spawns: [spawn], bounds: { x0: -50, z0: -50, x1: 50, z1: 50 } } });
    const p = sim.join('a', 'Arsenal'); p.ammo = 7;
    expect(sim.selectLoadout('a', 2)).toBe(true);
    expect(p.weaponIndex).toBe(0); expect(p.ammo).toBe(7);
    for (const bad of [-1, 999, 0.5, NaN, '2', null]) expect(sim.selectLoadout('a', bad)).toBe(false);
    expect(p.selectedWeapon).toBe(2);
    p.hp = 0; p.respawnIn = DT;
    sim.tick(DT);
    expect(p.weaponIndex).toBe(2); expect(p.ammo).toBe(5); expect(p.reserveAmmo).toBe(20);
    expect(p.aimAmount).toBe(0); expect(p.selectedWeapon).toBe(2);
  });

  it('dano e alcance usam a arma equipada; parede bloqueia a salva', () => {
    const target = { id: 'b', pose: { ...flatAt({ ...spawn, z: -4 }), yaw: 0 } };
    const origin = { x: 0, y: 1.35, z: 0 }, dir = { x: 0, y: 0, z: -1 };
    const pellet = resolveShot(origin, dir, [], [target], ARSENAL[3], 45);
    expect(pellet.hit?.damage).toBe(14);
    expect(groupVolleyHits(Array(8).fill(pellet))[0].damage).toBe(112);
    expect(resolveShot(origin, dir, [], [target], ARSENAL[2], 200).hit?.damage).toBe(105);
    const wall = { min: { x: -1, y: 0, z: -2 }, max: { x: 1, y: 3, z: -1 } };
    expect(groupVolleyHits(Array(8).fill(resolveShot(origin, dir, [wall], [target], ARSENAL[3], 45)))).toEqual([]);
    expect(resolveShot(origin, dir, [], [target], ARSENAL[3], 2).hit).toBeNull();
    const shot = { type: 'shot' as const, origin, dir, end: { ...origin, z: -45 }, hit: 'none' as const };
    const messages = gunMessages('a', 1, 3, { ...shot, pellets: Array(8).fill(shot) }, [], [target]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ weapon: 'shotgun', t: 'b', dmg: 112 });
    expect(messages[0].pellets).toHaveLength(8);
  });
});
