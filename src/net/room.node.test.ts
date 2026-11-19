// @vitest-environment node
// Sobe o servidor de verdade (em memória, porta aleatória), conecta clientes Colyseus
// e confere: posições convergem, predição local é imediata (mesmo com lag) e posição
// mandada pelo cliente é ignorada.
import { matchMaker } from '@colyseus/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ArenaRoom } from '../../server/arena-room';
import { createServer } from '../../server/server';
import { connectOnline, type OnlineHooks, type OnlineSession } from './client';
import { MSG, type ShotMsg } from './feed';
import { writeWire } from './protocol';
import type { PlayerCommand } from '../sim/command';
import { EYE_HEIGHT } from '../sim/player';
import type { Vec3 } from '../sim/vec';
import type { LagOptions } from './lag';

const PORT = 25700 + Math.floor(Math.random() * 200);
const ENDPOINT = `ws://localhost:${PORT}`;
// Limites folgados: esta suíte abre muitas salas do mesmo IP (os limites têm testes próprios)
const ROOMY = { maxRooms: 1000, roomsPerIp: 1000, connectionsPerIp: 1000 };
const server = createServer({ limits: ROOMY, debug: false });
const sessions: OnlineSession[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sai da sala sem travar o teste (conexão já derrubada não responde ao leave). */
async function quietLeave(s: OnlineSession) {
  if (!s.room.connection.isOpen) return;
  await Promise.race([s.leave().catch(() => {}), sleep(1000)]);
}

function idle(): PlayerCommand {
  return { seq: 0, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0, pitch: 0, fire: false, alt: false };
}

/** Entra (ou cria) numa sala da arena simples, sem bots por padrão. */
async function join(name: string, roomId: string | null, lag: LagOptions | null = null, bots = 0, hooks: OnlineHooks = {}) {
  const s = await connectOnline({ roomId, name, endpoint: ENDPOINT, lag, map: 'arena', bots, killLimit: null, minutes: null }, hooks);
  s.room.onMessage(MSG.shot, () => {});
  s.room.onMessage(MSG.kill, () => {});
  sessions.push(s);
  return s;
}

/** A sala de verdade no servidor (mesmo processo): para posicionar jogadores no teste. */
function serverRoom(s: OnlineSession): ArenaRoom {
  return matchMaker.getLocalRoomById(s.room.roomId) as unknown as ArenaRoom;
}

/** Roda o laço do cliente em tempo real (como o requestAnimationFrame faria). */
async function play(list: { s: OnlineSession; cmd: () => PlayerCommand }[], ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    for (const { s, cmd } of list) {
      s.pumpLag();
      const n = s.predict.tick(performance.now());
      for (let i = 0; i < n; i++) {
        writeWire(s.input.data, cmd());
        s.input.send();
      }
    }
    await sleep(8);
  }
}

beforeAll(async () => {
  await server.listen(PORT);
});

afterAll(async () => {
  for (const s of sessions) await quietLeave(s);
  await server.gracefullyShutdown(false);
});

describe('sala arena (servidor autoritativo)', () => {
  it('inventário troca em vida com lag e conserva munição ao voltar à arma', async () => {
    const a = await join('Inventário', null, { lag: 100, jitter: 15, loss: 0 });
    await play([{ s: a, cmd: () => ({ ...idle(), fire: true }) }], 600);
    await play([{ s: a, cmd: idle }], 400);
    const ammo = a.self.ammo, life = a.self.life;
    expect(ammo).toBeLessThan(30);
    await play([{ s: a, cmd: () => ({ ...idle(), weaponSlot: 4 }) }], 650);
    expect(a.self.weaponIndex).toBe(3); expect(a.me.state.weaponIndex).toBe(3);
    expect(a.self.ammo).toBe(6); expect(a.self.life).toBe(life);
    await play([{ s: a, cmd: () => ({ ...idle(), weaponSlot: 1 }) }], 650);
    expect(a.self.weaponIndex).toBe(0); expect(a.self.ammo).toBe(ammo);
    expect(a.me.state.ammo).toBe(ammo);
  }, 10000);
  it('recarga predita com lag: bloqueia tiro, replica estoque e converge sem repetir efeitos', async () => {
    let shots = 0;
    const a = await join('Recarga', null, { lag: 150, jitter: 20, loss: 0 }, 0, { onLocalShot: () => shots++ });
    await play([{ s: a, cmd: idle }], 500);
    await play([{ s: a, cmd: () => ({ ...idle(), fire: true }) }], 400);
    await play([{ s: a, cmd: idle }], 500);
    const spent = 30 - a.self.ammo;
    expect(spent).toBeGreaterThan(0);
    expect(shots).toBe(spent);
    await play([{ s: a, cmd: () => ({ ...idle(), reload: true, fire: true }) }], 70);
    expect(a.me.state.reloadRemaining).toBeGreaterThan(0);
    expect(a.self.reloadRemaining).toBe(0); // a resposta ainda não chegou
    const before = shots;
    await play([{ s: a, cmd: () => ({ ...idle(), reload: true, fire: true }) }], 650);
    expect(shots).toBe(before);
    expect(a.self.reserveAmmo).toBe(120); // transferência só ao concluir
    await play([{ s: a, cmd: () => ({ ...idle(), reload: true }) }], 1400);
    expect(a.self.ammo).toBe(30);
    expect(a.self.reserveAmmo).toBe(120 - spent);
    expect(a.self.reloadRemaining).toBe(0);
    expect(a.me.state.ammo).toBe(a.self.ammo);
    expect(a.me.state.reserveAmmo).toBe(a.self.reserveAmmo);
    expect(a.me.state.reloadRemaining).toBe(0);
    expect(shots).toBe(before);
  }, 15000);

  it('dois clientes: o movimento de A aparece em B e a predição de A bate com o servidor', async () => {
    const a = await join('A', null);
    const b = await join('B', a.room.roomId);
    expect(b.room.roomId).toBe(a.room.roomId);
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 300);
    expect(a.room.state.players.size).toBe(2);
    expect(b.room.state.players.size).toBe(2);

    const startZ = a.self.z;
    const forward = () => ({ ...idle(), moveZ: 1 });
    await play([{ s: a, cmd: forward }, { s: b, cmd: idle }], 700);
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 500); // para e espera a confirmação

    const seenByB = b.room.state.players.get(a.room.sessionId)!;
    expect(startZ - a.self.z).toBeGreaterThan(3); // andou para a frente (-z)
    expect(seenByB.z).toBeCloseTo(a.self.z, 6);
    expect(seenByB.x).toBeCloseTo(a.self.x, 6);
    // Previsto (cliente) == confirmado (servidor): mesma sim, mesmos comandos
    expect(a.me.state.z).toBeCloseTo(a.self.z, 6);
    expect(a.me.state.x).toBeCloseTo(a.self.x, 6);
    expect(a.input.pendingCount).toBeLessThanOrEqual(6); // só os comandos ainda em trânsito
  }, 15000);

  it('posição mandada pelo cliente é ignorada', async () => {
    const a = await join('Trapaça', null);
    await play([{ s: a, cmd: idle }], 300);
    const before = { x: a.self.x, y: a.self.y, z: a.self.z };
    for (const type of ['pos', 'move', 'state']) {
      a.room.send(type, { x: 999, y: 50, z: 999 });
    }
    await play([{ s: a, cmd: idle }], 400);
    expect(a.self.x).toBeCloseTo(before.x, 6);
    expect(a.self.z).toBeCloseTo(before.z, 6);
    expect(Math.abs(a.self.y - before.y)).toBeLessThan(0.01);
  }, 10000);

  it('com 150 ms de lag: o passo local é imediato e a reconciliação fica perto de zero', async () => {
    const a = await join('Lento', null, { lag: 150, jitter: 20, loss: 0 });
    await play([{ s: a, cmd: idle }], 500);
    const z0 = a.me.state.z;
    const confirmed0 = a.self.z;
    const forward = () => ({ ...idle(), moveZ: 1 });
    await play([{ s: a, cmd: forward }], 60);
    // Previsto já andou; o servidor ainda não viu (a resposta leva >= 150 ms)
    expect(a.me.state.z).toBeLessThan(z0);
    expect(a.self.z).toBeCloseTo(confirmed0, 6);

    await play([{ s: a, cmd: forward }], 600);
    await play([{ s: a, cmd: idle }], 700);
    expect(a.me.state.z).toBeCloseTo(a.self.z, 6);
    expect(a.me.lastCorrectionMag).toBeLessThan(0.01); // < 1 cm
  }, 15000);
});

const FEET = 0.86;

/** Mira do olho (previsto) de `s` até o peito de onde ele VÊ o jogador `targetId`. */
function aimAtSeen(s: OnlineSession, targetId: string): { yaw: number; pitch: number; seen: Vec3 } {
  const t = s.room.state.players.get(targetId)!;
  const seen = { x: s.predict.value(t, 'x'), y: s.predict.value(t, 'y') + 0.3, z: s.predict.value(t, 'z') };
  const me = s.me.state;
  const dx = seen.x - me.x;
  const dz = seen.z - me.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(seen.y - (me.y + EYE_HEIGHT), Math.hypot(dx, dz)), seen };
}

function listenShots(s: OnlineSession): ShotMsg[] {
  const out: ShotMsg[] = [];
  s.room.onMessage(MSG.shot, (m: ShotMsg) => out.push(m));
  return out;
}

describe('combate autoritativo', () => {
  /**
   * B (sem lag) corre de lado na frente de A; A, com `lag`, mira onde VÊ B (interpolado) e
   * segura o gatilho. O servidor decide o acerto com o rewind do Colyseus.
   */
  async function strafeDuel(lag: LagOptions | null) {
    const predicted = new Map<number, Vec3>();
    const a = await join('Atirador', null, lag, 0, { onLocalShot: (e, seq) => predicted.set(seq, e.dir) });
    const b = await join('Alvo', a.room.roomId);
    const room = serverRoom(a);
    const shots = listenShots(a);
    const bid = b.room.sessionId;
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 300);
    room.sim.teleport(a.room.sessionId, { x: -15, y: FEET, z: 18 }, -Math.PI / 2);
    room.sim.teleport(bid, { x: 0, y: FEET, z: 18 }, -Math.PI / 2);
    // Passa a proteção de nascimento e deixa o relógio do cliente medir o lag simulado
    await play([{ s: a, cmd: () => ({ ...idle(), yaw: -Math.PI / 2 }) }, { s: b, cmd: () => ({ ...idle(), yaw: -Math.PI / 2 }) }], 1800);
    let t = 0;
    const strafe = () => ({ ...idle(), yaw: -Math.PI / 2, moveX: Math.floor(t++ / 40) % 2 ? 1 : -1 });
    const shoot = () => {
      room.state.players.get(bid)!.hp = 100; // alvo de treino: não morre
      const { yaw, pitch } = aimAtSeen(a, bid);
      return { ...idle(), yaw, pitch, fire: true };
    };
    shots.length = 0;
    await play([{ s: b, cmd: strafe }, { s: a, cmd: shoot }], 2500);
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 600);
    const mine = shots.filter((m) => m.by === a.room.sessionId);
    const hits = mine.filter((m) => m.t === bid).length;
    return { a, mine, ratio: hits / mine.length, predicted };
  }

  it('com 150 ms de lag o acerto continua como sem lag (rewind no servidor)', async () => {
    const now = await strafeDuel(null);
    const lagged = await strafeDuel({ lag: 150, jitter: 20, loss: 0 });
    console.info(`[rewind] 0 ms: ${(now.ratio * 100).toFixed(0)}% de ${now.mine.length} · 150 ms: ${(lagged.ratio * 100).toFixed(0)}% de ${lagged.mine.length}`);
    expect(now.mine.length).toBeGreaterThan(12);
    expect(lagged.mine.length).toBeGreaterThan(12);
    expect(now.ratio).toBeGreaterThan(0.85);
    expect(lagged.ratio).toBeGreaterThan(0.85);
    // O tiro saiu na hora no cliente (previsto) para cada tiro confirmado; a direção exata é
    // do servidor (espalhamento secreto), então o rastro previsto só fica perto dela
    let near = 0;
    for (const m of now.mine) {
      const d = now.predicted.get(m.seq);
      if (!d) continue;
      const len = Math.hypot(m.e[0] - m.o[0], m.e[1] - m.o[1], m.e[2] - m.o[2]);
      const sd = [(m.e[0] - m.o[0]) / len, (m.e[1] - m.o[1]) / len, (m.e[2] - m.o[2]) / len];
      if (Math.hypot(sd[0] - d.x, sd[1] - d.y, sd[2] - d.z) < 0.03) near += 1;
    }
    expect(near).toBeGreaterThan(10);
  }, 30000);

  it('alvo atrás do pilar não toma dano', async () => {
    const a = await join('Atirador', null);
    const b = await join('Escondido', a.room.roomId);
    const room = serverRoom(a);
    const shots = listenShots(a);
    const bid = b.room.sessionId;
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 300);
    room.sim.teleport(a.room.sessionId, { x: 15, y: FEET, z: 0 }, Math.PI / 2);
    room.sim.teleport(bid, { x: 5.5, y: FEET, z: 0 }, 0); // pilar da arena em x 7..9 no meio
    await play([{ s: a, cmd: () => ({ ...idle(), yaw: Math.PI / 2 }) }, { s: b, cmd: idle }], 2000); // passa a proteção
    shots.length = 0;
    await play([{ s: a, cmd: () => ({ ...idle(), ...aimAtSeen(a, bid), fire: true }) }, { s: b, cmd: idle }], 1200);
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 300);
    const mine = shots.filter((m) => m.by === a.room.sessionId);
    expect(mine.length).toBeGreaterThan(5);
    expect(mine.every((m) => m.t === undefined)).toBe(true);
    expect(room.state.players.get(bid)!.hp).toBe(100);
  }, 15000);

  it('cadência: inundar o servidor de comandos não atira mais rápido que a arma', async () => {
    const a = await join('Metralha', null);
    const shots = listenShots(a);
    await play([{ s: a, cmd: idle }], 300);
    shots.length = 0;
    // Rajada de 120 comandos de uma vez (abaixo do limite de mensagens por segundo)
    for (let i = 0; i < 120; i++) {
      writeWire(a.input.data, { ...idle(), fire: true });
      a.input.send();
    }
    await sleep(2500);
    const mine = shots.filter((m) => m.by === a.room.sessionId);
    // A fila guarda até 64 comandos; com 1 tiro a cada 7 comandos, no máximo 10 tiros
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThanOrEqual(10);
  }, 15000);

  it('ping informado vai para o placar e bots completam a sala (e saem quando entra gente)', async () => {
    const a = await join('Dono', null, null, 3);
    await play([{ s: a, cmd: idle }], 300);
    const bots = () => [...a.room.state.players.values()].filter((p) => p.bot).length;
    expect(a.room.state.players.size).toBe(3);
    expect(bots()).toBe(2);
    const b = await join('Amigo', a.room.roomId);
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 300);
    expect(a.room.state.players.size).toBe(3);
    expect(bots()).toBe(1);
    a.room.send(MSG.ping, 123);
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 300);
    expect(a.self.ping).toBe(123);
  }, 15000);
});

/** Espera a conexão cair (ou o tempo acabar). */
async function closed(s: OnlineSession, ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end && s.room.connection.isOpen) await sleep(20);
  return !s.room.connection.isOpen;
}

describe('revisão do Codex: servidor de verdade', () => {
  it('revisão da main, item 10: andando com a mira variando, a predição não precisa de correção', async () => {
    const a = await join('Mira', null, { lag: 150, jitter: 20, loss: 0 });
    await play([{ s: a, cmd: idle }], 1500);
    let t = 0;
    let worst = 0;
    let lastSeq = a.me.reconcileSeq;
    const moving = () => {
      t += 1;
      if (a.me.reconcileSeq !== lastSeq) {
        lastSeq = a.me.reconcileSeq;
        worst = Math.max(worst, a.me.lastCorrectionMag);
      }
      return { ...idle(), moveZ: 1, moveX: t % 60 < 30 ? 1 : -1, yaw: 0.345678912345 + Math.sin(t / 23) * 2.9, pitch: 0.123456789123 };
    };
    await play([{ s: a, cmd: moving }], 2000);
    await play([{ s: a, cmd: idle }], 700);
    expect(worst).toBeLessThan(1e-6);
    expect(a.me.state.x).toBeCloseTo(a.self.x, 9);
    expect(a.me.state.z).toBeCloseTo(a.self.z, 9);
  }, 15000);

  it('achado 4: quem pula e para de mandar comandos cai (o servidor simula sozinho)', async () => {
    const a = await join('Parado', null);
    const room = serverRoom(a);
    const sid = a.room.sessionId;
    room.sim.teleport(sid, { x: 0, y: FEET + 6, z: 18 }, 0); // no ar
    await play([{ s: a, cmd: idle }], 100);
    const p = room.state.players.get(sid)!;
    // O cliente para de mandar comandos (aba escondida, rede caiu, trapaça)
    await sleep(1500);
    expect(p.y).toBeLessThan(FEET + 0.01);
    expect(p.onGround).toBe(true);
  }, 10000);

  it('achado 5: queda de conexão volta com o mesmo boneco, vida e placar', async () => {
    const a = await join('Caiu', null);
    const room = serverRoom(a);
    const sid = a.room.sessionId;
    await play([{ s: a, cmd: idle }], 5300); // o SDK só reconecta salas com 5 s de vida
    const p = room.state.players.get(sid)!;
    p.kills = 7;
    p.deaths = 2;
    const life = p.life;
    (a.room.connection.transport as unknown as { ws: { close(code: number): void } }).ws.close(4010); // queda, não saída
    await sleep(2500);
    await play([{ s: a, cmd: idle }], 500);
    expect(a.room.connection.isOpen).toBe(true);
    expect(a.room.sessionId).toBe(sid);
    const after = room.state.players.get(sid)!;
    expect(after.kills).toBe(7);
    expect(after.deaths).toBe(2);
    expect(after.life).toBe(life); // não ganhou vida nova
  }, 20000);

  it('achado 6: sem modo de desenvolvimento, o teleporte de teste não existe', async () => {
    const a = await join('Esperto', null);
    const b = await join('Longe', a.room.roomId);
    const room = serverRoom(a);
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 300);
    const p = room.state.players.get(a.room.sessionId)!;
    const before = { x: p.x, z: p.z };
    a.room.send('debug-perto', b.room.sessionId);
    await play([{ s: a, cmd: idle }, { s: b, cmd: idle }], 400);
    expect(p.x).toBeCloseTo(before.x, 6);
    expect(p.z).toBeCloseTo(before.z, 6);
  }, 10000);

  it('achado 7: mapa com nome inválido cria a sala no mapa padrão', async () => {
    for (const mapa of ['toString', '__proto__', 'constructor']) {
      const s = await connectOnline({ roomId: null, name: 'Mapa', endpoint: ENDPOINT, lag: null, map: mapa, bots: 0, killLimit: null, minutes: null });
      sessions.push(s);
      expect(s.room.state.mapId).toBe('pelourinho');
      await quietLeave(s);
    }
  }, 15000);

  describe('achado 3: limites de tráfego e de salas', () => {
    const saved = { ...ArenaRoom.limits };
    beforeAll(async () => {
      // Começa do zero: todo mundo deste IP sai
      for (const s of sessions.splice(0)) await quietLeave(s);
      await sleep(400);
    });
    afterEach(() => {
      ArenaRoom.limits = { ...saved };
    });

    it('salas por IP, conexões por IP e teto de salas', async () => {
      for (const s of sessions.splice(0)) await quietLeave(s);
      await sleep(400);
      ArenaRoom.limits = { ...saved, roomsPerIp: 1, connectionsPerIp: 2 };
      const a = await join('Dono', null);
      await expect(join('Outra sala', null)).rejects.toThrow(/salas demais/);
      const b = await join('Amigo', a.room.roomId);
      await expect(join('Terceiro', a.room.roomId)).rejects.toThrow(/conexões demais/);
      await quietLeave(b);
      await sleep(200);
      ArenaRoom.limits = { ...saved, maxRooms: 1, roomsPerIp: 10, connectionsPerIp: 10 };
      await expect(join('Mais uma', null)).rejects.toThrow(/servidor cheio/);
    }, 15000);

    it('descartar a sala libera cotas para outra partida do mesmo IP', async () => {
      for (const s of sessions.splice(0)) await quietLeave(s);
      await sleep(400);
      ArenaRoom.limits = { ...saved, roomsPerIp: 1, connectionsPerIp: 1 };
      const a = await join('Primeira', null);
      const id = a.room.roomId;
      await quietLeave(a);
      await sleep(300);
      expect(matchMaker.getLocalRoomById(id)).toBeUndefined();
      const b = await join('Segunda', null);
      expect(b.room.roomId).not.toBe(id);
      expect(b.self.hp).toBe(100);
    }, 10000);

    it('mensagens demais por segundo derrubam a conexão', async () => {
      ArenaRoom.limits = { ...saved, messagesPerSecond: 150 };
      const a = await join('Flood', null);
      await play([{ s: a, cmd: idle }], 200);
      for (let i = 0; i < 400; i++) a.room.send('lixo', i);
      expect(await closed(a, 2000)).toBe(true);
    }, 10000);

    it('mensagem grande demais derruba a conexão', async () => {
      const a = await join('Grandão', null);
      await play([{ s: a, cmd: idle }], 200);
      a.room.send('lixo', 'x'.repeat(5000));
      expect(await closed(a, 2000)).toBe(true);
    }, 10000);
  });
});
