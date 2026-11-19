// @vitest-environment node
// Papel autoritativo (Modo Live) no servidor de verdade: a troca jogador ↔ fila não depende de
// uma mensagem única nem de "ver o jogador sumir" — o servidor reenvia o papel ao reconectar e
// cada participação tem geração própria (`seat`). E o preditor descartado não volta a anexar.
import { matchMaker } from '@colyseus/core';
import type { Predict, Room } from '@colyseus/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ArenaRoom } from '../../server/arena-room';
import { createServer } from '../../server/server';
import { connectOnline, joinRoom, type OnlineParams, type OnlineSession, waitForRole } from './client';
import { MSG } from './feed';
import type { MatchMode } from './modes';
import { PATCH_MS } from './protocol';
import { roleOf } from './role';
import type { ArenaState } from './schema';
import { type AudienceMsg, SPECTATE_MSG } from './spectate';

const PORT = 26400 + Math.floor(Math.random() * 200);
const server = createServer({ limits: { maxRooms: 1000, roomsPerIp: 1000, connectionsPerIp: 1000, messagesPerSecond: 1000 }, debug: true });
const rooms: Room<unknown, ArenaState>[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(check: () => boolean, ms = 4000) {
  const deadline = performance.now() + ms;
  while (!check() && performance.now() < deadline) await sleep(10);
  expect(check()).toBe(true);
}

function params(mode: MatchMode, roomId: string | null, name: string): OnlineParams {
  return { mode, roomId, name, endpoint: `ws://localhost:${PORT}`, map: 'arena', bots: 0, minutes: null, killLimit: null, lag: null };
}

/** Mensagens que este teste não confere + reconexão automática liberada já (sem os 5 s mínimos). */
function prepare(room: Room<unknown, ArenaState>) {
  for (const m of [MSG.shot, MSG.kill, MSG.sync, MSG.drone]) room.onMessage(m, () => {});
  Object.assign(room.reconnection, { minUptime: 0, delay: 400, minDelay: 400 });
  rooms.push(room);
  return room;
}

async function player(roomId: string | null, name: string): Promise<OnlineSession> {
  const s = await connectOnline(params('duel', roomId, name));
  prepare(s.room);
  return s;
}

/** Entra pela fila (sala cheia de gente); devolve a sala e as mensagens de plateia. */
async function waiting(roomId: string, name: string) {
  const room = prepare(await joinRoom(params('duel', roomId, name)));
  const audience: AudienceMsg[] = [];
  room.onMessage(SPECTATE_MSG.audience, (m: AudienceMsg) => audience.push(m));
  expect(await waitForRole(room)).toBeNull();
  return { room, audience };
}

const serverRoom = (id: string) => matchMaker.getLocalRoomById(id) as unknown as ArenaRoom;

/** Derruba a conexão pelo lado do servidor (queda de rede) e espera ele perceber. */
async function drop(room: ArenaRoom, id: string) {
  const c = room.clients.getById(id) as unknown as { ref: { terminate(): void } };
  c.ref.terminate();
  await waitFor(() => !room.clients.getById(id));
}

function finish(room: ArenaRoom, scores: Record<string, number>) {
  for (const [id, kills] of Object.entries(scores)) room.state.players.get(id)!.kills = kills;
  (room.sim as unknown as { end(): void }).end();
  room.sim.restart();
}

/** Sala de duelo cheia (Ana e Beto jogando) com Caio na fila. */
async function fullDuel() {
  const a = await player(null, 'Ana');
  const b = await player(a.room.roomId, 'Beto');
  const room = serverRoom(a.room.roomId);
  await waitFor(() => room.state.phase === 'playing');
  const c = await waiting(a.room.roomId, 'Caio');
  return { a, b, c, room };
}

beforeAll(async () => { await server.listen(PORT); });
afterAll(async () => {
  for (const r of rooms) if (r.connection.isOpen) await Promise.race([r.leave().catch(() => {}), sleep(1000)]);
  await server.gracefullyShutdown(false);
});

describe('Modo Live: papel autoritativo e recuperável', () => {
  it('jogador que cai durante o rodízio vai para o banco e, ao reconectar, recebe o papel e vê a fila', async () => {
    const { a, b, c, room } = await fullDuel();
    const bId = b.room.sessionId;
    const audience: AudienceMsg[] = [];
    b.room.onMessage(SPECTATE_MSG.audience, (m: AudienceMsg) => audience.push(m));
    await drop(room, bId);
    // Rodízio com Beto fora do ar: ele perde e vai para o fim da fila; Caio entra
    finish(room, { [a.room.sessionId]: 3, [bId]: 1 });
    expect(room.state.players.has(bId)).toBe(false);
    expect(room.audience.isWaiting(bId)).toBe(true);
    expect(room.state.players.has(c.room.sessionId)).toBe(true);
    // Volta na MESMA identidade e recebe o papel atual (banco, 1º da fila)
    await waitFor(() => roleOf(b.room).role.kind === 'bench');
    expect(roleOf(b.room).role).toEqual({ kind: 'bench', msg: { place: 1, waiting: 1 } });
    expect(b.room.sessionId).toBe(bId);
    expect(roleOf(b.room).stale(b.self.seat)).toBe(true); // o jogo dele troca para a tela da fila
    await waitFor(() => audience.some(m => m.place === 1));
    expect(await waitForRole(b.room)).toBeNull();
  });

  it('espectador da fila que cai e é promovido enquanto está fora vira jogador ao reconectar', async () => {
    const { a, b, c, room } = await fullDuel();
    const cId = c.room.sessionId;
    await drop(room, cId);
    await b.room.leave(); // abre a vaga com Caio fora do ar
    await waitFor(() => room.state.players.has(cId));
    const seat = room.state.players.get(cId)!.seat;
    await waitFor(() => roleOf(c.room).role.kind === 'player');
    expect(roleOf(c.room).role).toEqual({ kind: 'player', seat });
    expect(c.room.sessionId).toBe(cId);
    const promoted = await connectOnline(params('duel', a.room.roomId, 'Caio'), {}, c.room);
    expect(promoted.self.seat).toBe(seat);
    expect(promoted.self.name).toBe('Caio');
  });

  it('banco e vaga de novo antes do próximo patch: assume a vaga com o NetPlayer novo', async () => {
    const { a, b, c, room } = await fullDuel();
    const bId = b.room.sessionId;
    const oldSeat = room.state.players.get(bId)!.seat;
    await waitFor(() => b.room.state.players.get(bId)?.seat === oldSeat);
    room.patchRate = null; // segura os patches: as mensagens chegam, o estado não
    finish(room, { [a.room.sessionId]: 3, [bId]: 1 }); // Beto vai para o banco, Caio entra
    await a.room.leave(); // Ana sai: Beto, 1º da fila, volta
    await waitFor(() => room.state.players.has(bId));
    const seat = room.state.players.get(bId)!.seat;
    expect(seat).toBeGreaterThan(oldSeat);
    await waitFor(() => roleOf(b.room).role.kind === 'player');
    // Estado local ainda mostra o boneco antigo: não vale como vaga
    expect(b.room.state.players.get(bId)?.seat).toBe(oldSeat);
    expect(roleOf(b.room).seated(b.room.state.players, bId)).toBeNull();
    const pending = waitForRole(b.room);
    room.patchRate = PATCH_MS;
    const self = await pending;
    expect(self?.seat).toBe(seat);
    const promoted = await connectOnline(params('duel', room.roomId, 'Beto'), {}, b.room);
    expect(promoted.self.seat).toBe(seat);
    expect(b.room.sessionId).toBe(bId);
    expect(room.state.players.has(c.room.sessionId)).toBe(true);
  });

  it('preditor descartado não volta a anexar jogadores, em vários ciclos', async () => {
    const a = await player(null, 'Ana');
    const room = serverRoom(a.room.roomId);
    const old: { predict: Predict; attaches: number }[] = [];
    const watch = (s: OnlineSession) => {
      const entry = { predict: s.predict, attaches: 0 };
      const p = s.predict as unknown as { attachWithPlan: (...args: unknown[]) => unknown };
      const original = p.attachWithPlan.bind(p);
      p.attachWithPlan = (...args: unknown[]) => { entry.attaches += 1; return original(...args); };
      return entry;
    };
    let session = a;
    for (let i = 0; i < 3; i++) {
      const entry = watch(session);
      session.release();
      old.push(entry);
      // Outro jogador entra e sai: a coleção muda depois do descarte
      const b = await player(a.room.roomId, `Beto ${i}`);
      await waitFor(() => a.room.state.players.size === 2);
      await b.room.leave();
      await waitFor(() => a.room.state.players.size === 1 && room.state.players.size === 1);
      session = await connectOnline(params('duel', a.room.roomId, 'Ana'), {}, a.room);
    }
    for (const e of old) expect(e.attaches).toBe(0);
    for (const e of old) expect((e.predict as unknown as { slotByRef: Map<number, unknown> }).slotByRef.size).toBe(0);
    session.release();
  });
});
