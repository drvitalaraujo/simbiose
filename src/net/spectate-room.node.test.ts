// @vitest-environment node
// Modo Live no servidor de verdade: espectador fora da simulação, bots inalterados, comandos
// dele ignorados e quem sobra numa sala cheia assiste até abrir vaga.
import { matchMaker } from '@colyseus/core';
import type { Room } from '@colyseus/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArenaRoom } from '../../server/arena-room';
import { createServer } from '../../server/server';
import { connectOnline, joinRoom, type OnlineParams, type OnlineSession, SpectatorSeat, waitForRole } from './client';
import { MSG } from './feed';
import { MODE_CONFIG, type MatchMode } from './modes';
import { ArenaState, MoveInput } from './schema';
import { type AudienceMsg, type BenchedMsg, SPECTATE_MSG, SPECTATOR_SLOTS } from './spectate';

const PORT = 26100 + Math.floor(Math.random() * 200);
const server = createServer({ limits: { maxRooms: 1000, roomsPerIp: 1000, connectionsPerIp: 1000, messagesPerSecond: 1000 }, debug: true });
const rooms: Room<unknown, ArenaState>[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(check: () => boolean, ms = 3000) {
  const deadline = performance.now() + ms;
  while (!check() && performance.now() < deadline) await sleep(10);
  expect(check()).toBe(true);
}

function params(mode: MatchMode, roomId: string | null, name: string, bots: number | null = 0): OnlineParams {
  return { mode, roomId, name, endpoint: `ws://localhost:${PORT}`, map: 'arena', bots, minutes: null, killLimit: null, lag: null };
}

function quiet(room: Room<unknown, ArenaState>) {
  room.onMessage(MSG.shot, () => {});
  room.onMessage(MSG.kill, () => {});
  room.onMessage(MSG.sync, () => {});
  rooms.push(room);
  return room;
}

async function player(mode: MatchMode, roomId: string | null, name: string, bots: number | null = 0): Promise<OnlineSession> {
  const s = await connectOnline(params(mode, roomId, name, bots));
  quiet(s.room);
  return s;
}

/** Entra só para assistir; devolve a sala e as mensagens de plateia recebidas. */
async function spectator(mode: MatchMode, roomId: string | null, name = 'Plateia', bots: number | null = 0) {
  const room = await joinRoom(params(mode, roomId, name, bots), { espectador: true });
  const audience: AudienceMsg[] = [];
  room.onMessage(SPECTATE_MSG.audience, (m: AudienceMsg) => audience.push(m));
  quiet(room);
  expect(await waitForRole(room)).toBeNull();
  return { room, audience };
}

const serverRoom = (id: string) => matchMaker.getLocalRoomById(id) as unknown as ArenaRoom;
const humans = (r: ArenaRoom) => [...r.state.players.values()].filter(p => !p.bot).length;
const bots = (r: ArenaRoom) => [...r.state.players.values()].filter(p => p.bot).length;

beforeAll(async () => { await server.listen(PORT); });
afterAll(async () => {
  for (const r of rooms) if (r.connection.isOpen) await Promise.race([r.leave().catch(() => {}), sleep(1000)]);
  await server.gracefullyShutdown(false);
});

describe('Modo Live: espectadores na sala', () => {
  it('anfitrião espectador cria a sala sem virar jogador; bots já jogam e são inalterados pela plateia', async () => {
    const host = await spectator('ffa', null, 'Anfitrião', 4);
    const room = serverRoom(host.room.roomId);
    expect(room.maxClients).toBe(MODE_CONFIG.ffa.capacity + SPECTATOR_SLOTS);
    // Live: a transmissão não começa vazia — os bots entram sem esperar gente
    expect(room.state.players.has(host.room.sessionId)).toBe(false);
    expect(bots(room)).toBe(4);
    const a = await player('ffa', host.room.roomId, 'Ana');
    await waitFor(() => room.state.players.size === 4);
    expect(humans(room)).toBe(1);
    expect(bots(room)).toBe(3);
    const extra = await spectator('ffa', host.room.roomId, 'Mais um');
    await sleep(100);
    expect(room.state.players.size).toBe(4);
    expect(bots(room)).toBe(3);
    expect(room.audience.size).toBe(2);
    // A plateia recebe o estado da partida e a contagem
    await waitFor(() => host.room.state.players.size === 4);
    await waitFor(() => host.audience.some(m => m.players === 1 && m.spectators === 2));
    await extra.room.leave();
    await waitFor(() => room.audience.size === 1);
    expect(bots(room)).toBe(3);
    expect(a.room.state.players.has(a.room.sessionId)).toBe(true);
  });

  it('comandos e mensagens do espectador são ignorados', async () => {
    const a = await player('ffa', null, 'Ana');
    const host = await spectator('ffa', a.room.roomId);
    const room = serverRoom(a.room.roomId);
    const before = { ...room.state.players.get(a.room.sessionId)!.toJSON() };
    const input = host.room.input({ type: MoveInput, mode: 'reliable' });
    for (let i = 0; i < 40; i++) {
      Object.assign(input.data, { moveX: 1, moveZ: -1, fire: true, jump: true, yaw: 1, pitch: 0.2, weaponSlot: 3 });
      input.send();
    }
    host.room.send(MSG.loadout, 2);
    host.room.send(MSG.ping, 77);
    host.room.send('debug-perto', a.room.sessionId);
    host.room.send('teleporte', { x: 0, y: 0, z: 0 });
    await sleep(300);
    expect(room.state.players.has(host.room.sessionId)).toBe(false);
    expect(room.state.players.size).toBe(1);
    const after = room.state.players.get(a.room.sessionId)!;
    expect(after.hp).toBe(before.hp);
    expect(after.selectedWeapon).toBe(before.selectedWeapon);
    expect(host.room.connection.isOpen).toBe(true);
  });

  it('sala cheia de gente: quem entra pelo convite assiste e vira jogador quando abre vaga', async () => {
    const a = await player('duel', null, 'Ana');
    const b = await player('duel', a.room.roomId, 'Beto');
    const room = serverRoom(a.room.roomId);
    await waitFor(() => room.state.phase === 'playing');
    let seat: SpectatorSeat | null = null;
    try {
      await connectOnline(params('duel', a.room.roomId, 'Caio'));
    } catch (e) {
      seat = e as SpectatorSeat;
    }
    expect(seat).toBeInstanceOf(SpectatorSeat);
    const c = quiet(seat!.room);
    const audience: AudienceMsg[] = [];
    c.onMessage(SPECTATE_MSG.audience, (m: AudienceMsg) => audience.push(m));
    expect(room.audience.isWaiting(c.sessionId)).toBe(true);
    expect(humans(room)).toBe(2);
    await waitFor(() => audience.some(m => m.waiting === 1 && m.players === 2));
    // Um quarto também espera, atrás do terceiro
    const d = await joinRoom(params('duel', a.room.roomId, 'Duda'));
    quiet(d);
    expect(await waitForRole(d)).toBeNull();
    expect(room.audience.waitingCount).toBe(2);
    // Beto sai: Caio (primeiro da fila) entra na partida; Duda continua esperando
    await b.room.leave();
    await waitFor(() => c.state.players.has(c.sessionId));
    expect(room.state.players.get(c.sessionId)!.name).toBe('Caio');
    expect(room.state.players.has(d.sessionId)).toBe(false);
    expect(room.audience.isWaiting(d.sessionId)).toBe(true);
    // O cliente promovido vira jogador na MESMA conexão
    const promoted = await connectOnline(params('duel', a.room.roomId, 'Caio'), {}, c);
    expect(promoted.self.name).toBe('Caio');
    await waitFor(() => room.state.phase === 'playing');
  });

  it('gente continua substituindo bot (sala só com bots não manda ninguém assistir)', async () => {
    const a = await player('tdm', null, 'Ana', null);
    const room = serverRoom(a.room.roomId);
    expect(room.state.players.size).toBe(MODE_CONFIG.tdm.capacity);
    const b = await player('tdm', a.room.roomId, 'Beto');
    expect(b.self.name).toBe('Beto');
    expect(humans(room)).toBe(2);
    expect(room.state.players.size).toBe(MODE_CONFIG.tdm.capacity);
    expect(room.audience.size).toBe(0);
  });

  it('rodízio: sala cheia atravessa duas partidas, quem perde sai e a fila entra, sem desconectar ninguém', async () => {
    const host = await spectator('duel', null, 'Anfitrião');
    const room = serverRoom(host.room.roomId);
    const a = await player('duel', host.room.roomId, 'Ana');
    const b = await player('duel', host.room.roomId, 'Beto');
    let seat: SpectatorSeat | null = null;
    try {
      await connectOnline(params('duel', host.room.roomId, 'Caio'));
    } catch (e) {
      seat = e as SpectatorSeat;
    }
    const c = quiet(seat!.room);
    const benched: BenchedMsg[] = [];
    const bAudience: AudienceMsg[] = [];
    b.room.onMessage(SPECTATE_MSG.benched, (m: BenchedMsg) => benched.push(m));
    b.room.onMessage(SPECTATE_MSG.audience, (m: AudienceMsg) => bAudience.push(m));
    c.onMessage(SPECTATE_MSG.benched, () => {});
    c.onMessage(SPECTATE_MSG.audience, () => {});
    let drops = 0;
    for (const r of [host.room, a.room, b.room, c]) r.onLeave(() => { drops += 1; });
    await waitFor(() => room.state.phase === 'playing');
    const match = room.state.match;
    const finish = (scores: Record<string, number>) => {
      for (const [id, kills] of Object.entries(scores)) room.state.players.get(id)!.kills = kills;
      (room.sim as unknown as { end(): void }).end();
      room.sim.restart();
    };
    // Partida 1: Beto perde, sai para o fim da fila; Caio entra
    finish({ [a.room.sessionId]: 3, [b.room.sessionId]: 1 });
    expect(room.state.players.has(b.room.sessionId)).toBe(false);
    expect(room.state.players.get(c.sessionId)?.name).toBe('Caio');
    expect(room.audience.isWaiting(b.room.sessionId)).toBe(true);
    expect(room.audience.has(host.room.sessionId)).toBe(true); // anfitrião nunca entra no rodízio
    expect(room.audience.isWaiting(host.room.sessionId)).toBe(false);
    expect(room.state.phase).toBe('playing');
    await waitFor(() => benched.length === 1);
    expect(benched[0]).toEqual({ place: 1, waiting: 1 });
    await waitFor(() => bAudience.some(m => m.place === 1));
    const promoted = await connectOnline(params('duel', host.room.roomId, 'Caio'), {}, c);
    expect(promoted.self.name).toBe('Caio');
    // Partida 2: Caio perde; Beto volta na MESMA conexão
    finish({ [a.room.sessionId]: 2, [c.sessionId]: 0 });
    expect(room.state.players.has(c.sessionId)).toBe(false);
    expect(room.audience.isWaiting(c.sessionId)).toBe(true);
    await waitFor(() => b.room.state.players.has(b.room.sessionId));
    expect(room.state.players.get(b.room.sessionId)!.name).toBe('Beto');
    expect(room.state.match).toBe(match + 2);
    expect(humans(room)).toBe(2);
    expect(room.audience.size).toBe(2);
    await sleep(100);
    expect(drops).toBe(0);
    for (const r of [host.room, a.room, b.room, c]) expect(r.connection.isOpen).toBe(true);
  });

  it('plateia lotada não tira a vaga de quem vem jogar; excedente é recusado sem gastar cota', async () => {
    const host = await spectator('ffa', null, 'Anfitrião', 4);
    const room = serverRoom(host.room.roomId);
    for (let i = 1; i < SPECTATOR_SLOTS; i++) await spectator('ffa', host.room.roomId, `Plateia ${i}`);
    expect(room.audience.size).toBe(SPECTATOR_SLOTS);
    expect(humans(room)).toBe(0);
    const quota = (ArenaRoom as unknown as { connsByIp: { counts: Map<string, number> } }).connsByIp.counts;
    const used = () => [...quota.values()].reduce((n, v) => n + v, 0);
    const before = used();
    await expect(joinRoom(params('ffa', host.room.roomId, 'Sobrando'), { espectador: true })).rejects.toThrow();
    expect(used()).toBe(before);
    expect(room.audience.size).toBe(SPECTATOR_SLOTS);
    // Sala ainda sem gente jogando: o jogador entra
    const p = await player('ffa', host.room.roomId, 'Jogadora');
    expect(p.self.name).toBe('Jogadora');
    expect(humans(room)).toBe(1);
    expect(used()).toBe(before + 1);
  });
});
