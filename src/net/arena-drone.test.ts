// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TICK } from '../sim/clock';
import type { PlayerCommand } from '../sim/command';
import { createRng } from '../sim/rng';
import type { Vec3 } from '../sim/vec';
import { ArenaDrone, ARENA_DRONE, DRONE_ID, markedEnemies, type DronePlayer } from './arena-drone';
import { ArenaSim, type MatchFields, type SimPlayer } from './arena-sim';
import type { DroneEventMsg, KillFeedEvent, ShotMsg } from './feed';
import type { HackDrone } from './hack-objectives';
import { getMap, type NetMap } from './maps';
import { DEFAULT_RULES } from './match';

const cmd = (over: Partial<PlayerCommand> = {}): PlayerCommand => ({ seq: 1, moveX: 0, moveZ: 0, jump: false, sprint: false, yaw: 0, pitch: 0, fire: false, alt: false, ...over });
const look = (from: Vec3, to: Vec3) => {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
};
const ticks = (seconds: number) => Math.round(seconds / TICK);

function setupSim(map = 'arena') {
  const players = new Map<string, SimPlayer>();
  const drones = new Map<string, HackDrone>();
  const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
  const sim = new ArenaSim({ map: getMap(map), rules: { ...DEFAULT_RULES, killLimit: 50, timeLimit: 600, invulnTime: 0 }, players, drones, state, rng: createRng(7), now: () => 0, create: p => p, botNav: map !== 'arena' });
  const events: DroneEventMsg[] = [], kills: KillFeedEvent[] = [], shots: ShotMsg[] = [];
  sim.on(e => { if (e.type === 'drone') events.push(e.msg); else if (e.type === 'kill') kills.push(e.msg); else if (e.type === 'shot') shots.push(e.msg); });
  return { sim, players, drones, events, kills, shots };
}

/** Põe `id` a 3 m do drone, mirando nele (olho na altura certa). */
function faceDrone(sim: ArenaSim, id: string, d: Vec3, side = 1) {
  const at = { x: d.x, y: d.y - 1.8 + 0.86, z: d.z + 3 * side };
  sim.teleport(id, at);
  return look({ x: at.x, y: at.y + 0.65, z: at.z }, d);
}

describe('drone da OTIMIZA na Arena (FFA)', () => {
  it('aparece 30 s depois do início, livre e com 80 de vida', () => {
    const { sim, drones, events } = setupSim();
    sim.join('a', 'A');
    for (let i = 0; i < ticks(ARENA_DRONE.firstDelay) - 2; i++) sim.tick(TICK);
    expect(drones.has(DRONE_ID)).toBe(false);
    for (let i = 0; i < 3; i++) sim.tick(TICK);
    const d = drones.get(DRONE_ID)!;
    expect(d).toMatchObject({ kind: 'otimiza', phase: 'free', hp: ARENA_DRONE.hp, owner: '' });
    expect(events.map(e => e.kind)).toEqual(['spawn']);
    expect(d.y).toBeCloseTo(1.8);
  });

  it('nasce numa zona do mapa competitivo, acima de piso alcançável', () => {
    const { sim, drones, events } = setupSim('lapa');
    sim.arenaDrone!.skipWait();
    sim.tick(TICK);
    const d = drones.get(DRONE_ID)!;
    expect(getMap('lapa').data!.zones.map(z => z.name)).toContain(events[0].zone);
    expect(d.y).toBeGreaterThan(1.7);
  });

  it('segurar E mirando por 2 s hackeia; dano interrompe; dois canalizando = contestado', () => {
    const { sim, drones, events } = setupSim();
    sim.join('a', 'A'); sim.join('b', 'B');
    sim.arenaDrone!.skipWait(); sim.tick(TICK);
    const d = drones.get(DRONE_ID)!;
    const aimA = faceDrone(sim, 'a', d, 1);
    sim.teleport('b', { x: d.x + 15, y: 0.86, z: d.z + 15 });
    const step = (aimB?: { yaw: number; pitch: number }) => {
      sim.command('a', cmd({ alt: true, ...aimA }), TICK);
      sim.command('b', cmd(aimB ? { alt: true, ...aimB } : {}), TICK);
      sim.tick(TICK);
    };
    for (let i = 0; i < ticks(1); i++) step();
    expect(d.hackerId).toBe('a');
    expect(d.progress).toBeCloseTo(0.5, 1);
    // Levou dano: zera e recomeça
    sim['o'].players.get('a')!.hp -= 10;
    step();
    expect(d.progress).toBeLessThan(0.05);
    // B chega e também segura E: contestado, não avança
    const aimB = faceDrone(sim, 'b', d, -1);
    for (let i = 0; i < 30; i++) step(aimB);
    expect(d.contested).toBe(true);
    const frozen = d.progress;
    for (let i = 0; i < 30; i++) step(aimB);
    expect(d.progress).toBe(frozen);
    // B solta: A termina
    for (let i = 0; i < ticks(2.1); i++) step();
    expect(d).toMatchObject({ phase: 'ally', owner: 'a', hp: ARENA_DRONE.hp });
    expect(events.at(-1)).toMatchObject({ kind: 'hacked', owner: 'a', ownerName: 'A' });
  });

  it('abate do aliado vai para o dono com arma drone; dono não leva tiro', () => {
    const { sim, drones, kills, shots, players } = setupSim();
    sim.join('a', 'A'); sim.join('b', 'B');
    sim.arenaDrone!.skipWait(); sim.tick(TICK);
    const d = drones.get(DRONE_ID)!;
    const aim = faceDrone(sim, 'a', d);
    for (let i = 0; i < ticks(2.1); i++) { sim.command('a', cmd({ alt: true, ...aim }), TICK); sim.tick(TICK); }
    expect(d.owner).toBe('a');
    const a = players.get('a')!;
    sim.teleport('b', { x: a.x + 4, y: a.y, z: a.z });
    players.get('b')!.hp = 20;
    for (let i = 0; i < ticks(4) && players.get('b')!.hp > 0; i++) { sim.idle('a', TICK); sim.idle('b', TICK); sim.tick(TICK); }
    const droneShots = shots.filter(s => s.weapon === 'drone');
    expect(droneShots.length).toBeGreaterThan(0);
    expect(droneShots.every(s => s.by === 'a' && s.t !== 'a')).toBe(true);
    expect(droneShots.filter(s => s.t === 'b').every(s => s.dmg === ARENA_DRONE.damage)).toBe(true);
    expect(kills.at(-1)).toMatchObject({ killerId: 'a', victimId: 'b', weapon: 'drone', headshot: false });
    expect(a.kills).toBe(1);
    expect(a.hp).toBe(100);
  });

  it('qualquer outro jogador derruba o drone; o ciclo recomeça 45 s depois', () => {
    const { sim, drones, events, shots, players } = setupSim();
    sim.join('a', 'A'); sim.join('b', 'B');
    sim.arenaDrone!.skipWait(); sim.tick(TICK);
    const d = drones.get(DRONE_ID)!;
    const aim = faceDrone(sim, 'b', d);
    sim.teleport('a', { x: d.x + 20, y: 0.86, z: d.z - 20 });
    for (let i = 0; i < 200 && drones.has(DRONE_ID); i++) {
      const b = players.get('b')!; b.cooldown = 0; b.recoil = 0; b.ammo = 30;
      sim.command('b', cmd({ fire: true, ...aim }), TICK);
      sim.tick(TICK);
    }
    expect(drones.has(DRONE_ID)).toBe(false);
    expect(events.at(-1)).toMatchObject({ kind: 'down', by: 'b', byName: 'B' });
    expect(shots.some(s => s.t === DRONE_ID && s.k)).toBe(true);
    for (let i = 0; i < ticks(ARENA_DRONE.cycle) - 2; i++) sim.tick(TICK);
    expect(drones.has(DRONE_ID)).toBe(false);
    for (let i = 0; i < 3; i++) sim.tick(TICK);
    expect(drones.get(DRONE_ID)?.phase).toBe('free');
  });

  it('aliado volta para a OTIMIZA depois de 12 s e outro drone vem 45 s depois', () => {
    const { sim, drones, events } = setupSim();
    sim.join('a', 'A');
    sim.arenaDrone!.skipWait(); sim.tick(TICK);
    const d = drones.get(DRONE_ID)!;
    const aim = faceDrone(sim, 'a', d);
    for (let i = 0; i < ticks(2.1); i++) { sim.command('a', cmd({ alt: true, ...aim }), TICK); sim.tick(TICK); }
    for (let i = 0; i < ticks(ARENA_DRONE.allyLife); i++) { sim.idle('a', TICK); sim.tick(TICK); }
    expect(d.phase).toBe('leaving');
    expect(events.at(-1)).toMatchObject({ kind: 'leave', owner: 'a' });
    for (let i = 0; i < ticks(ARENA_DRONE.leaveTime + 0.1); i++) sim.tick(TICK);
    expect(drones.has(DRONE_ID)).toBe(false);
    for (let i = 0; i < ticks(ARENA_DRONE.cycle); i++) sim.tick(TICK);
    expect(drones.get(DRONE_ID)?.phase).toBe('free');
  });

  it('bot vai até o drone livre e hackeia', () => {
    const { sim, drones, events } = setupSim('lapa');
    sim.setBotTarget(1);
    sim.arenaDrone!.skipWait();
    for (let i = 0; i < ticks(60) && !events.some(e => e.kind === 'hacked'); i++) sim.tick(TICK);
    expect(events.find(e => e.kind === 'hacked')?.owner).toBe('bot-1');
    expect(drones.get(DRONE_ID)?.phase).toBe('ally');
  });

  it('só existe no FFA', () => {
    for (const mode of ['tdm', 'duel', 'hack'] as const) {
      const sim = new ArenaSim({ map: getMap('arena'), rules: { ...DEFAULT_RULES, mode }, players: new Map(), state: { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 }, rng: createRng(1), now: () => 0, create: p => p, botNav: false });
      expect(sim.arenaDrone).toBeNull();
    }
  });
});

describe('aliado da OTIMIZA (regras puras)', () => {
  const wall = { min: { x: 4, y: 0, z: -2 }, max: { x: 5, y: 4, z: 2 } };
  const map = { id: 'teste', blocks: [], solids: [wall], shotBlockers: [wall], spawns: [], bounds: { x0: -50, z0: -50, x1: 50, z1: 50 } } as NetMap;
  const player = (x: number, z: number, over: Partial<DronePlayer> = {}): DronePlayer => ({ x, y: 0.86, z, yaw: 0, pitch: 0, vx: 0, vz: 0, hp: 100, name: 'P', invuln: false, crouchAmount: 0, sliding: false, ...over });

  function allyDrone() {
    const store = new Map<string, HackDrone>();
    const shots: { msg: ShotMsg; dmg: number }[] = [];
    const drone = new ArenaDrone(map, store, createRng(3), { shot: (msg, dmg) => shots.push({ msg, dmg }), event: () => {} });
    drone.skipWait();
    const players = new Map<string, DronePlayer>([['dono', player(0, 0)]]);
    drone.tick(TICK, players, map.shotBlockers);
    Object.assign(store.get(DRONE_ID)!, { phase: 'ally', owner: 'dono', timer: 12, x: 0, y: 2.2, z: 0 });
    return { drone, store, shots, players };
  }

  it('só atira em inimigo visível a até 30 m', () => {
    const { drone, store, shots, players } = allyDrone();
    players.set('atras', player(8, 0)); // atrás da parede
    players.set('longe', player(0, -40));
    for (let i = 0; i < ticks(2); i++) drone.tick(TICK, players, map.shotBlockers);
    expect(shots).toHaveLength(0);
    expect(store.get(DRONE_ID)!.target).toBe('');
    players.set('visivel', player(-6, 0));
    for (let i = 0; i < ticks(2); i++) drone.tick(TICK, players, map.shotBlockers);
    expect(shots.length).toBeGreaterThanOrEqual(3);
    expect(shots.every(s => s.msg.weapon === 'drone' && s.msg.by === 'dono')).toBe(true);
    expect(shots.filter(s => s.msg.t).every(s => s.msg.t === 'visivel' && s.dmg === ARENA_DRONE.damage)).toBe(true);
    expect(store.get(DRONE_ID)!.target).toBe('visivel');
  });

  it('ignora protegidos e mortos; dono morto manda o drone embora', () => {
    const { drone, store, shots, players } = allyDrone();
    players.set('nasceu', player(-6, 0, { invuln: true }));
    players.set('morto', player(-5, 2, { hp: 0 }));
    for (let i = 0; i < ticks(1); i++) drone.tick(TICK, players, map.shotBlockers);
    expect(shots).toHaveLength(0);
    players.get('dono')!.hp = 0;
    drone.tick(TICK, players, map.shotBlockers);
    expect(store.get(DRONE_ID)!.phase).toBe('leaving');
  });

  it('dono não acerta o próprio drone; marca inimigos a até 25 m', () => {
    const { drone, store, players } = allyDrone();
    expect(drone.props('dono')).toEqual([]);
    expect(drone.props('outro')).toHaveLength(1);
    expect(drone.damage('dono', 'Dono', 500)).toBe(false);
    players.set('perto', player(10, 10));
    players.set('longe', player(30, 30));
    expect(markedEnemies(store.get(DRONE_ID)!, players)).toEqual(['perto']);
  });
});
