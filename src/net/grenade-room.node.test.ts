// @vitest-environment node
// Exercita comandos reais do SDK: golpes, projétil/coleta e slide passam pelo servidor.
import { matchMaker } from '@colyseus/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ArenaRoom } from '../../server/arena-room';
import { createServer } from '../../server/server';
import type { PlayerCommand } from '../sim/command';
import { ARSENAL } from '../sim/weapons';
import { connectOnline, type OnlineSession } from './client';
import { MSG, type ShotMsg } from './feed';
import type { LagOptions } from './lag';
import { writeWire } from './protocol';

const PORT = 28100 + Math.floor(Math.random() * 200);
const server = createServer({ limits: { maxRooms: 1000, roomsPerIp: 1000, connectionsPerIp: 1000 }, debug: false });
const sessions: OnlineSession[] = [];
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const idle = (): PlayerCommand => ({ seq: 0, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: -Math.PI / 2, pitch: 0, fire: false, alt: false });

async function join(roomId: string | null = null, lag: LagOptions | null = null) {
  const s = await connectOnline({ roomId, name: `Teste ${sessions.length}`, endpoint: `ws://localhost:${PORT}`, lag,
    mode: 'duel', map: 'arena', bots: 0, killLimit: 100, minutes: 10 });
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

describe('HE e reserva do duelo pela rede real', () => {
  it('replica estoque/projétil, impede spam e informa explosão; respawn restaura HE e reserva', async () => {
    const { a, b, room, still } = await pair();
    const shots: ShotMsg[] = [];
    b.room.onMessage(MSG.shot, (m: ShotMsg) => shots.push(m));
    expect(a.self.reserve0).toBe(150); expect(a.me.state.reserve0).toBe(150);
    await play([{ s: a, cmd: () => ({ ...idle(), grenade: true }) }, still[1]], 220);
    expect(a.self.grenadeReady).toBe(false); expect(a.me.state.grenadeReady).toBe(false);
    expect(b.room.state.grenades.size).toBe(1);
    const g = [...room.state.grenades.values()][0];
    const target = room.state.players.get(b.room.sessionId)!;
    Object.assign(g, { x: target.x, y: target.y, z: target.z, vx: 0, vy: 0, vz: 0, age: 1.48 });
    await play([{ s: a, cmd: () => ({ ...idle(), grenade: true }) }, still[1]], 300);
    expect(b.self.hp).toBe(0);
    expect(shots.filter(m => m.grenadePhase === 'throw')).toHaveLength(1);
    expect(shots.filter(m => m.grenadePhase === 'explode')).toHaveLength(1);
    expect(shots.some(m => m.t === b.room.sessionId && m.dmg! >= 100)).toBe(true);
    expect(b.room.state.grenades.size).toBe(0);
    await play(still, 3400);
    expect(b.self.grenadeReady).toBe(true);
    for (const [i, spec] of ARSENAL.entries()) {
      expect(b.self[`reserve${i}` as 'reserve0']).toBe(spec.reserveAmmo + spec.magazineSize);
      expect(b.me.state[`reserve${i}` as 'reserve0']).toBe(spec.reserveAmmo + spec.magazineSize);
    }
  }, 12000);
});
