// @vitest-environment node
// Exercita comandos reais do SDK: golpes, projétil/coleta e slide passam pelo servidor.
import { matchMaker } from '@colyseus/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ArenaRoom } from '../../server/arena-room';
import { createServer } from '../../server/server';
import type { PlayerCommand } from '../sim/command';
import { SLIPPER } from '../sim/slipper';
import { connectOnline, type OnlineSession } from './client';
import { MSG, type ShotMsg } from './feed';
import type { LagOptions } from './lag';
import { writeWire } from './protocol';

const PORT = 26100 + Math.floor(Math.random() * 200);
const server = createServer({ limits: { maxRooms: 1000, roomsPerIp: 1000, connectionsPerIp: 1000 }, debug: false });
const sessions: OnlineSession[] = [];
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const idle = (): PlayerCommand => ({ seq: 0, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: -Math.PI / 2, pitch: 0, fire: false, alt: false });

async function join(roomId: string | null = null, lag: LagOptions | null = null) {
  const s = await connectOnline({ roomId, name: `Teste ${sessions.length}`, endpoint: `ws://localhost:${PORT}`, lag,
    map: 'arena', bots: 0, killLimit: 100, minutes: 10 });
  s.room.onMessage(MSG.shot, () => {});
  s.room.onMessage(MSG.kill, () => {});
  sessions.push(s);
  return s;
}
function authoritative(s: OnlineSession) {
  return matchMaker.getLocalRoomById(s.room.roomId) as unknown as ArenaRoom;
}
async function play(list: { s: OnlineSession; cmd: () => PlayerCommand }[], ms: number, observe?: () => void) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    for (const { s, cmd } of list) {
      s.pumpLag();
      for (let i = s.predict.tick(performance.now()); i > 0; i--) {
        writeWire(s.input.data, cmd());
        s.input.send();
      }
    }
    observe?.();
    await sleep(8);
  }
}
async function pair() {
  const a = await join();
  const b = await join(a.room.roomId);
  const room = authoritative(a);
  room.sim.teleport(a.room.sessionId, { x: -17, y: 0.86, z: 18 }, -Math.PI / 2);
  room.sim.teleport(b.room.sessionId, { x: -15.5, y: 0.86, z: 18 }, Math.PI / 2);
  const still = [{ s: a, cmd: idle }, { s: b, cmd: () => ({ ...idle(), yaw: Math.PI / 2 }) }];
  await play(still, 1800); // proteção de nascimento e reconciliação do teleporte
  return { a, b, room, still };
}
beforeAll(async () => { await server.listen(PORT); });
afterEach(async () => {
  for (const s of sessions.splice(0)) {
    if (s.room.connection.isOpen) await Promise.race([s.leave().catch(() => {}), sleep(1000)]);
  }
});
afterAll(async () => { await server.gracefullyShutdown(false); });

describe('Chinelada e slide pela rede real', () => {
  it('agachar parado e levantar convergem com 150 ms de lag', async () => {
    const a = await join(null, { lag: 150, jitter: 10, loss: 0 });
    await play([{ s: a, cmd: idle }], 500);
    const y = a.self.y;
    await play([{ s: a, cmd: () => ({ ...idle(), crouch: true }) }], 900);
    expect(a.me.state.crouching).toBe(true);
    expect(a.self.crouching).toBe(true);
    expect(a.me.state.crouchAmount).toBe(1);
    expect(a.self.crouchAmount).toBe(1);
    expect(a.self.y).toBeCloseTo(y);
    await play([{ s: a, cmd: idle }], 1100);
    expect(a.self.crouching).toBe(false);
    expect(a.me.state.crouchAmount).toBe(0);
    expect(a.self.crouchAmount).toBe(0);
    expect(a.me.lastCorrectionMag).toBeLessThan(0.01);
  }, 10000);
  it('golpe aplica dano, respeita cooldown e registra morte/renascimento', async () => {
    const { a, b, room, still } = await pair();
    const shots: ShotMsg[] = [];
    a.room.onMessage(MSG.shot, (m: ShotMsg) => shots.push(m));
    const melee = [{ s: a, cmd: () => ({ ...idle(), melee: true }) }, still[1]];
    const life = b.self.life;
    await play(melee, 180);
    expect(b.self.hp).toBe(100 - SLIPPER.meleeDamage);
    expect(shots.filter(m => m.weapon === 'chinelo')).toHaveLength(1);
    expect(a.self.slipperReady).toBe(true);
    await play(still, 50);
    await play(melee, 100); // nova borda, ainda durante cooldown: sem segundo golpe
    expect(b.self.hp).toBe(100 - SLIPPER.meleeDamage);
    expect(shots.filter(m => m.weapon === 'chinelo')).toHaveLength(1);
    await play(still, 650);
    await play(melee, 180);
    expect(b.self.hp).toBe(0);
    expect(a.self.kills).toBe(1);
    expect(b.self.deaths).toBe(1);
    expect(room.state.players.get(b.room.sessionId)!.hp).toBe(0);
    await play(still, 3300);
    expect(b.self.life).toBe(life + 1);
    expect(b.self.hp).toBe(100);
    expect(b.self.slipperReady).toBe(true);
  }, 12000);

  it('arremesso sincroniza projétil; cliente não forja pose ou recarga; só dono coleta', async () => {
    const { a, b, room, still } = await pair();
    room.sim.teleport(b.room.sessionId, { x: -10, y: 0.86, z: 18 }, Math.PI / 2);
    await play(still, 200);
    const shots: ShotMsg[] = [];
    b.room.onMessage(MSG.shot, (m: ShotMsg) => shots.push(m));
    await play([{ s: a, cmd: () => ({ ...idle(), pitch: -0.08, throwSlipper: true }) }, still[1]], 100);
    expect(a.self.slipperReady).toBe(false);
    expect(a.room.state.slippers.size).toBe(1);
    expect(b.room.state.slippers.size).toBe(1);
    const projectile = [...a.room.state.slippers.values()][0];
    expect(projectile.owner).toBe(a.room.sessionId);
    expect(projectile.life).toBe(a.self.life);
    expect(projectile.vx).toBeGreaterThan(0);
    await play(still, 900);
    expect(shots.some(m => m.weapon === 'chinelo-arremesso' && m.t === b.room.sessionId && m.dmg === SLIPPER.throwDamage)).toBe(true);
    const [pid, landed] = [...room.state.slippers][0];
    expect(landed.resting).toBe(true);
    const ownerX = room.state.players.get(a.room.sessionId)!.x;
    for (const type of ['pos', 'state', 'pickup', 'slipper']) {
      a.room.send(type, { x: landed.x, y: landed.y, z: landed.z, slipperReady: true, slipperCooldown: 0 });
    }
    await play([{ s: a, cmd: () => ({ ...idle(), throwSlipper: true }) }, still[1]], 200);
    expect(a.self.slipperReady).toBe(false);
    expect(room.state.players.get(a.room.sessionId)!.x).toBe(ownerX);
    expect(room.state.slippers.size).toBe(1);
    room.sim.teleport(b.room.sessionId, { x: landed.x, y: 0.86, z: landed.z });
    await play(still, 150);
    expect(room.state.slippers.has(pid)).toBe(true);
    room.sim.teleport(a.room.sessionId, { x: landed.x, y: 0.86, z: landed.z });
    await play(still, 350);
    expect(room.state.slippers.size).toBe(0);
    expect(a.room.state.slippers.size).toBe(0);
    expect(b.room.state.slippers.size).toBe(0);
    expect(a.self.slipperReady).toBe(true);
  }, 10000);

  it('caminhada silenciosa e agachamento com 150 ms de lag convergem à autoridade', async () => {
    const a = await join(null, { lag: 150, jitter: 10, loss: 0 });
    const room = authoritative(a);
    room.sim.teleport(a.room.sessionId, { x: -20, y: 0.86, z: 18 }, 0);
    const stop = () => ({ ...idle(), yaw: 0 });
    const run = () => ({ ...stop(), moveZ: 1, sprint: true });
    await play([{ s: a, cmd: stop }], 600);
    await play([{ s: a, cmd: run }], 700);
    expect(Math.hypot(a.me.state.vx, a.me.state.vz)).toBeCloseTo(3);
    expect(a.me.state.walking).toBe(true);
    expect(room.state.players.get(a.room.sessionId)!.walking).toBe(true);
    let predictedSlide = false;
    let confirmedSlide = false;
    await play([{ s: a, cmd: () => ({ ...run(), crouch: true }) }], 450, () => {
      predictedSlide ||= a.me.state.sliding;
      confirmedSlide ||= room.state.players.get(a.room.sessionId)!.sliding;
    });
    expect(predictedSlide).toBe(false);
    expect(confirmedSlide).toBe(false);
    await play([{ s: a, cmd: stop }], 1000);
    expect(a.me.state.sliding).toBe(false);
    expect(a.self.sliding).toBe(false);
    expect(a.me.state.x).toBeCloseTo(a.self.x, 6);
    expect(a.me.state.z).toBeCloseTo(a.self.z, 6);
    expect(a.me.state.slideCooldown).toBeCloseTo(a.self.slideCooldown, 6);
    expect(a.me.lastCorrectionMag).toBeLessThan(0.01);
  }, 10000);
});
