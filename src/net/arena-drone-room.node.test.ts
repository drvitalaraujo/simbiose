// @vitest-environment node
// Ciclo do drone da OTIMIZA no servidor de verdade (porta aleatória): aparece para todos,
// o cliente hackeia só mandando comandos (E + mira) e o abate do aliado chega no killfeed.
import { matchMaker } from '@colyseus/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ArenaRoom } from '../../server/arena-room';
import { createServer } from '../../server/server';
import type { PlayerCommand } from '../sim/command';
import { DRONE_ID } from './arena-drone';
import { connectOnline, type OnlineSession } from './client';
import { type DroneEventMsg, type KillFeedEvent, MSG } from './feed';
import { writeWire } from './protocol';

const PORT = 26100 + Math.floor(Math.random() * 200);
const server = createServer({ limits: { maxRooms: 1000, roomsPerIp: 1000, connectionsPerIp: 1000 }, debug: true });
const sessions: OnlineSession[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const idle = (): PlayerCommand => ({ seq: 0, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0, pitch: 0, fire: false, alt: false });

async function waitFor(check: () => boolean, ms = 3000) {
  const deadline = performance.now() + ms;
  while (!check() && performance.now() < deadline) await sleep(10);
  expect(check()).toBe(true);
}

async function play(list: { s: OnlineSession; cmd: () => PlayerCommand }[], ms: number, until: () => boolean = () => false) {
  const end = performance.now() + ms;
  while (performance.now() < end && !until()) {
    for (const { s, cmd } of list) {
      s.pumpLag();
      const n = s.predict.tick(performance.now());
      for (let i = 0; i < n; i++) { writeWire(s.input.data, cmd()); s.input.send(); }
    }
    await sleep(8);
  }
}

beforeAll(async () => { await server.listen(PORT); });
afterAll(async () => {
  for (const s of sessions) if (s.room.connection.isOpen) await Promise.race([s.leave().catch(() => {}), sleep(1000)]);
  await server.gracefullyShutdown(false);
});

describe('drone da OTIMIZA pelo servidor real', () => {
  it('aparece para todos, é hackeado por comando e o abate dele vai para o dono', async () => {
    const join = async (name: string, roomId: string | null) => {
      const s = await connectOnline({ mode: 'ffa', roomId, name, endpoint: `ws://localhost:${PORT}`, map: 'arena', bots: 0, minutes: null, killLimit: null, lag: null });
      s.room.onMessage(MSG.shot, () => {});
      sessions.push(s);
      return s;
    };
    const a = await join('Dono', null);
    const b = await join('Rival', a.room.roomId);
    const events: DroneEventMsg[] = [];
    const kills: KillFeedEvent[] = [];
    a.room.onMessage(MSG.drone, (e: DroneEventMsg) => events.push(e));
    b.room.onMessage(MSG.kill, (e: KillFeedEvent) => kills.push(e));
    a.room.onMessage(MSG.kill, () => {});
    const room = matchMaker.getLocalRoomById(a.room.roomId) as unknown as ArenaRoom;

    a.room.send('debug-drone');
    await waitFor(() => events.some(e => e.kind === 'spawn') && b.room.state.drones.has(DRONE_ID));
    const d = b.room.state.drones.get(DRONE_ID)!;
    expect(d).toMatchObject({ kind: 'otimiza', phase: 'free', hp: 80 });

    // Dono a 3 m do drone, mirando nele; rival longe
    const at = { x: d.x, y: d.y - 1.8 + 0.86, z: d.z + 3 };
    room.sim.teleport(a.room.sessionId, at, 0);
    room.sim.teleport(b.room.sessionId, { x: d.x + 18, y: at.y, z: d.z - 18 }, 0);
    const pitch = Math.atan2(d.y - (at.y + 0.65), 3);
    await play([{ s: a, cmd: () => ({ ...idle(), alt: true, pitch }) }, { s: b, cmd: idle }], 4000, () => events.some(e => e.kind === 'hacked'));
    expect(events.find(e => e.kind === 'hacked')).toMatchObject({ owner: a.room.sessionId, ownerName: 'Dono' });
    await waitFor(() => b.room.state.drones.get(DRONE_ID)?.owner === a.room.sessionId);

    // Rival perto e fraco: o aliado derruba e o crédito vai para o dono com arma "drone"
    const owner = room.state.players.get(a.room.sessionId)!;
    room.sim.teleport(b.room.sessionId, { x: owner.x + 5, y: owner.y, z: owner.z }, 0);
    room.state.players.get(b.room.sessionId)!.hp = 15;
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 4000, () => kills.length > 0);
    expect(kills[0]).toMatchObject({ killerId: a.room.sessionId, victimId: b.room.sessionId, weapon: 'drone' });
  }, 20000);
});
