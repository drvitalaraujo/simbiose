// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ArenaSim, type MatchFields, type SimPlayer } from './arena-sim';
import { getMap } from './maps';
import { DEFAULT_RULES } from './match';
import { createRng } from '../sim/rng';
import { TICK } from '../sim/clock';
import { emptyCommand } from '../sim/command';
import { ARSENAL, weaponDamage } from '../sim/weapons';
import { commandFromWire, flatAt, FLAT_FIELDS, stepNet, writeWire } from './protocol';
import { MoveInput, NetPlayer } from './schema';
import type { ShotMsg } from './feed';
import { switchWeapon } from '../sim/inventory';
function setup(mode: 'ffa' | 'duel' | 'tdm' = 'duel', arenaDrone = false) {
  const players = new Map<string, SimPlayer>();
  const state = {} as MatchFields;
  const sim = new ArenaSim({ map: { ...getMap('arena'), solids: [], shotBlockers: [] }, rules: { ...DEFAULT_RULES, mode, invulnTime: 0 }, players, state, rng: createRng(42), now: () => 0, create: p => p, arenaDrone, botNav: false });
  const a = sim.join('a', 'A'), b = sim.join('b', 'B');
  return { sim, a, b, players, state };
}
describe('HE online e balanceamento autorizado', () => {
  it('servidor consome uma HE, dano após fusível, mata e credita sem índice de arma', () => {
    const { sim, a, b } = setup();
    sim.teleport('a', { x: 0, y: 1, z: 0 });
    sim.teleport('b', { x: 0, y: 1, z: -8 });
    const shots: ShotMsg[] = []; const kills: string[] = [];
    sim.on(e => { if (e.type === 'shot') shots.push(e.msg); if (e.type === 'kill') kills.push(e.msg.weapon); });
    sim.command('a', { ...emptyCommand(), grenade: true }, TICK);
    for (let i = 0; i < 20; i++) sim.command('a', { ...emptyCommand(), grenade: i % 2 === 0 }, TICK);
    expect([...sim.grenadeCombat.projectiles]).toHaveLength(1);
    expect(a.grenadeReady).toBe(false);
    const g = [...sim.grenadeCombat.projectiles][0][1];
    Object.assign(g, { x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, age: 1.5 - TICK });
    sim.tick(TICK);
    expect(b.hp).toBe(0); expect(a.kills).toBe(1); expect(kills).toEqual(['grenade']);
    expect(shots.filter(m => m.grenadePhase === 'explode')).toHaveLength(1);
    expect([...sim.grenadeCombat.projectiles]).toHaveLength(0);
    sim.tick(DEFAULT_RULES.respawnDelay);
    expect(b.grenadeReady).toBe(true);
  });
  it('explosão respeita oclusão, proteção, equipe e dano próprio', () => {
    const { sim, a, b } = setup('tdm');
    a.team = b.team = 'a';
    const c = sim.join('c', 'C'); c.team = 'b';
    Object.assign(a, { x: 0, y: 1, z: 0 }); Object.assign(b, { x: 0, y: 1, z: 0 }); Object.assign(c, { x: 0, y: 1, z: 0, invuln: true });
    sim.grenadeCombat.projectiles.set('test', { owner: 'a', x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, age: 1.5, seq: 0 });
    sim.tick(TICK);
    expect(a.hp).toBe(0); expect(a.kills).toBe(0); expect(b.hp).toBe(100); expect(c.hp).toBe(100);
  });
  it('HE também derruba o drone da Arena sem criar abate de personagem', () => {
    const { sim, a } = setup('ffa', true);
    sim.arenaDrone!.skipWait(); sim.tick(TICK);
    const d = sim.arenaDrone!.drone!;
    sim.grenadeCombat.projectiles.set('drone-hit', { owner: 'a', x: d.x, y: d.y, z: d.z, vx: 0, vy: 0, vz: 0, age: 1.49, seq: 0 });
    const shots: ShotMsg[] = []; sim.on(e => { if (e.type === 'shot') shots.push(e.msg); });
    sim.tick(TICK);
    expect(shots.some(m => m.weapon === 'grenade' && m.t === 'otimiza' && m.k)).toBe(true);
    expect(a.kills).toBe(0);
  });
  it('cobertura impede dano; morte do dono não apaga HE e saída/reinício limpam', () => {
    const { sim, a, b } = setup();
    Object.assign(a, { x: -10, y: 1, z: 0 }); Object.assign(b, { x: 1, y: 1, z: 0 });
    (sim.map.shotBlockers as import('../sim/physics').Box[]).push({ min: { x: 0.5, y: 0, z: -2 }, max: { x: 0.6, y: 3, z: 2 } });
    const grenade = { owner: 'a', x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, age: 1.49, seq: 0 };
    sim.grenadeCombat.projectiles.set('cover', { ...grenade }); sim.tick(TICK); expect(b.hp).toBe(100);
    (sim.map.shotBlockers as import('../sim/physics').Box[]).length = 0;
    a.hp = 0; a.respawnIn = 3;
    sim.grenadeCombat.projectiles.set('after-death', { ...grenade }); sim.tick(TICK); expect(b.hp).toBe(0); expect(a.kills).toBe(1);
    sim.grenadeCombat.projectiles.set('reset', { ...grenade }); sim.restart(); expect([...sim.grenadeCombat.projectiles]).toHaveLength(0);
    sim.grenadeCombat.projectiles.set('leave', { ...grenade }); sim.leave('a'); expect([...sim.grenadeCombat.projectiles]).toHaveLength(0);
  });
  it('estoque previsto e schema coincidem com comando transmitido, inclusive morto', () => {
    const spawn = { x: 0, y: 1, z: 0 }, server = Object.assign(new NetPlayer(), flatAt(spawn)), predicted = flatAt(spawn), wire = new MoveInput();
    for (let i = 0; i < 100; i++) {
      const cmd = { ...emptyCommand(i), grenade: i % 3 === 0 };
      writeWire(wire, cmd);
      stepNet(server, commandFromWire(wire, i), TICK, [], spawn, createRng(1));
      stepNet(predicted, cmd, TICK, [], spawn, createRng(2));
      for (const f of FLAT_FIELDS) expect(predicted[f] === server[f], f).toBe(true);
    }
    expect(server.grenadeReady).toBe(false);
  });
  it.each(['ffa', 'duel', 'tdm'] as const)('%s: reserva por arma no nascimento, respawn e reinício sem acumular', mode => {
    const { sim, a } = setup(mode);
    const check = () => {
      for (const [i, spec] of ARSENAL.entries()) {
        switchWeapon(a, i);
        expect(a.ammo).toBe(spec.magazineSize);
        expect(a.reserveAmmo).toBe(spec.reserveAmmo + (mode === 'duel' ? spec.magazineSize : 0));
      }
    };
    check(); a.hp = 0; a.respawnIn = 0; sim.tick(TICK); check(); sim.restart(); check();
  });
  it('sniper mata tronco até 100 m, pernas sobrevivem; ciclo de 1,45 s e precisão parada preservada', () => {
    const s = ARSENAL[2];
    expect(weaponDamage(s, 'torso', 30)).toBe(105);
    expect(weaponDamage(s, 'torso', 100)).toBe(105);
    expect(weaponDamage(s, 'legs', 1)).toBeCloseTo(68.25);
    expect(s).toMatchObject({ fireInterval: 1.45, recoilKick: 0.045, aimSpread: 0.01, zoom: 4 });
  });
});
