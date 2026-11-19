// @vitest-environment node
import { matchMaker } from '@colyseus/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArenaRoom } from '../../server/arena-room';
import { createServer } from '../../server/server';
import { connectOnline, type OnlineSession, SpectatorSeat } from './client';
import { SPECTATOR_SLOTS } from './spectate';
import { MSG } from './feed';
import type { MatchMode } from './modes';

const PORT = 25900 + Math.floor(Math.random() * 100);
const server = createServer({ limits: { maxRooms: 1000, roomsPerIp: 1000, connectionsPerIp: 1000 }, debug: false });
const sessions: OnlineSession[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check: () => boolean) {
  const deadline = performance.now() + 3000;
  while (!check() && performance.now() < deadline) await sleep(10);
  expect(check()).toBe(true);
}
beforeAll(async () => { await server.listen(PORT); });
afterAll(async () => {
  for (const s of sessions) if (s.room.connection.isOpen) await Promise.race([s.leave().catch(() => {}), sleep(1000)]);
  await server.gracefullyShutdown(false);
});

async function join(mode: MatchMode, roomId: string | null = null) {
  const s = await connectOnline({ mode, roomId, name: 'Teste', endpoint: `ws://localhost:${PORT}`, map: 'arena', bots: null, minutes: null, killLimit: null, lag: null });
  s.room.onMessage(MSG.shot, () => {}); s.room.onMessage(MSG.kill, () => {});
  sessions.push(s);
  return s;
}

describe('modos sincronizados pelo servidor real', () => {
  it('duelo espera rival, limita a dois e transmite modo', async () => {
    const a = await join('duel');
    expect(a.room.state.mode).toBe('duel'); expect(a.room.state.phase).toBe('waiting');
    const b = await join('ffa', a.room.roomId);
    await waitFor(() => a.room.state.phase === 'playing');
    expect(b.room.state.mode).toBe('duel'); expect(a.room.state.phase).toBe('playing');
    // Dois jogando; quem sobra assiste (Modo Live) em vez de ser recusado
    expect((matchMaker.getLocalRoomById(a.room.roomId) as ArenaRoom).maxClients).toBe(2 + SPECTATOR_SLOTS);
    const third = await join('duel', a.room.roomId).catch((e: unknown) => e);
    expect(third).toBeInstanceOf(SpectatorSeat);
    expect(a.room.state.players.size).toBe(2);
    await (third as SpectatorSeat).room.leave();
  });
  it('TDM sincroniza dois times de três, Hack sincroniza drones e progresso', async () => {
    const tdm = await join('tdm');
    expect(tdm.room.state.mode).toBe('tdm');
    expect(tdm.room.state.players.size).toBe(6);
    expect([...tdm.room.state.players.values()].filter(p => p.team === 'a')).toHaveLength(3);
    expect([...tdm.room.state.players.values()].filter(p => p.team === 'b')).toHaveLength(3);
    const hack = await join('hack');
    expect(hack.room.state.mode).toBe('hack');
    expect(hack.room.state.drones.size).toBe(3);
    const room = matchMaker.getLocalRoomById(hack.room.roomId) as ArenaRoom;
    const drone = room.state.drones.get('drone-1')!;
    drone.team = 'a'; drone.hackerId = 'Teste'; drone.progress = 0.5;
    // Estado serializado inclui ownership e progresso, sem dados visuais Three.js.
    expect(room.state.drones.toJSON()['drone-1']).toMatchObject({ team: 'a', progress: 0.5 });
    await waitFor(() => hack.room.state.drones.get('drone-1')!.team === 'a');
    expect(hack.room.state.drones.get('drone-1')!.team).toBe('a');
  });
});
