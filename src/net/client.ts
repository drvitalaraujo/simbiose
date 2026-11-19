// Cliente do modo online (sem Three.js): conecta na sala, liga a predição do jogador
// local (Reconciler do Colyseus 0.18 rodando o mesmo `stepNet` do servidor: movimento +
// cadência da arma) e a interpolação dos outros (~100 ms no passado). O jogo
// (src/game/online.ts) só lê daqui.
import { Client, Predict, type InputHandle, type Reconciler, type Room } from '@colyseus/sdk';
import type { ShotEvent } from '../sim/events';
import { createRng } from '../sim/rng';
import type { SlipperAction } from '../sim/slipper';
import { MSG } from './feed';
import { installLag, type LagOptions, parseLag, type SocketLike } from './lag';
import { getMap, type NetMap } from './maps';
import {
  commandFromWire, DEFAULT_PORT, FLAT_FIELDS, type FlatPlayer, INTERP_DELAY_MS, ROOM_NAME, stepNet, type WireInput,
} from './protocol';
import { ArenaState, MoveInput, type NetPlayer } from './schema';
import { modeFrom, type MatchMode } from './modes';
import { type BotDifficulty, difficultyFrom } from './bot-persona';
import { roleOf } from './role';

export interface OnlineParams {
  mode?: MatchMode;
  /** Sala para entrar (`&sala=`). Sem ela, cria uma nova. */
  roomId: string | null;
  name: string;
  /** Endereço do servidor: override da URL, VITE_SERVER_URL ou mesma máquina:2567. */
  endpoint: string;
  lag: LagOptions | null;
  /** Mapa ao criar a sala (`&mapa=`). */
  map: string | null;
  /** Ao criar a sala: total de jogadores que os bots completam (`&bots=`, 0 = sem bots). */
  bots: number | null;
  /** Ao criar a sala: limite de abates (`&abates=`) e de tempo em minutos (`&tempo=`). */
  killLimit: number | null;
  minutes: number | null;
  /** Ao criar a sala: nível dos bots (`&dificuldade=facil|normal|dificil`). */
  difficulty?: BotDifficulty;
}

/** Ganchos do jogo na predição (só passos "ao vivo", nunca na re-simulação). */
export interface OnlineHooks {
  /** O jogador local disparou (previsto): clarão, rastro e som na hora. */
  onLocalShot?(shot: ShotEvent, seq: number): void;
  onLocalSlipper?(action: SlipperAction): void;
}

const NICKS = ['Capivara', 'Saci', 'Curupira', 'Boto', 'Tatu', 'Jabuti', 'Sabiá', 'Mico', 'Arara', 'Onça'];

export function randomName(rand: () => number = Math.random): string {
  return `${NICKS[Math.floor(rand() * NICKS.length)]}${Math.floor(rand() * 90 + 10)}`;
}

/** Lê os parâmetros do modo online da URL da página. */
export function parseOnlineParams(search: string, page: { hostname: string; protocol: string }, rand?: () => number, buildEndpoint = import.meta.env.VITE_SERVER_URL as string | undefined): OnlineParams {
  const q = new URLSearchParams(search);
  const scheme = page.protocol === 'https:' ? 'wss' : 'ws';
  return {
    roomId: q.get('sala') || null,
    mode: modeFrom(q.get('modo')),
    name: q.get('nome') || randomName(rand),
    endpoint: q.get('servidor') || buildEndpoint?.trim() || `${scheme}://${page.hostname || 'localhost'}:${DEFAULT_PORT}`,
    lag: parseLag(search),
    map: q.get('mapa') || null,
    bots: numParam(q, 'bots'),
    killLimit: numParam(q, 'abates'),
    minutes: numParam(q, 'tempo'),
    difficulty: difficultyFrom(q.get('dificuldade')),
  };
}

function numParam(q: URLSearchParams, key: string): number | null {
  const raw = q.get(key);
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Link de convite: sala e override do servidor, se houver; apelido é de cada um. */
export function inviteLink(href: string, roomId: string): string {
  const url = new URL(href);
  const endpoint = url.searchParams.get('servidor');
  url.search = `?online&sala=${encodeURIComponent(roomId)}`;
  if (endpoint) url.searchParams.set('servidor', endpoint);
  return url.toString();
}

/** A URL atual com `sala=` (recarregar a página volta para a mesma sala). */
export function withRoom(href: string, roomId: string): string {
  const url = new URL(href);
  url.searchParams.set('sala', roomId);
  return url.toString().replace(/([?&]\w+)=(?=&|$)/g, '$1'); // `online=` volta a ser `online`
}

export interface OnlineSession {
  readonly room: Room<unknown, ArenaState>;
  readonly input: InputHandle<WireInput>;
  readonly predict: Predict;
  /** Predição + reconciliação do jogador local. */
  readonly me: Reconciler<FlatPlayer, WireInput>;
  /** Estado autoritativo do jogador local, como chegou do servidor. */
  readonly self: NetPlayer;
  readonly map: NetMap;
  /** Lag simulado: entrega os pacotes vencidos (chamar a cada quadro; sem lag não faz nada). */
  pumpLag(): void;
  /** Solta a predição e o eco do ping SEM sair da sala (rodízio: vira espectador na mesma conexão). */
  release(): void;
  leave(): Promise<unknown>;
}

/** Entrou na sala, mas para assistir (sala cheia de gente): a sala segue aberta em `room`. */
export class SpectatorSeat extends Error {
  constructor(readonly room: Room<unknown, ArenaState>) {
    super('sala cheia: você assiste até abrir vaga');
  }
}

/** Cria a sala ou entra pelo id. `espectador`: só assiste (Modo Live). */
export async function joinRoom(p: OnlineParams, extra: { espectador?: boolean } = {}): Promise<Room<unknown, ArenaState>> {
  const client = new Client(p.endpoint);
  const create = {
    nome: p.name, mapa: p.map ?? undefined, bots: p.bots ?? undefined, abates: p.killLimit ?? undefined, tempo: p.minutes ?? undefined, modo: p.mode, dificuldade: p.difficulty, ...extra,
  };
  const room = (p.roomId
    ? await client.joinById(p.roomId, { nome: p.name, ...extra }, ArenaState)
    : await client.create(ROOM_NAME, create, ArenaState)) as Room<unknown, ArenaState>;
  roleOf(room); // o papel (vaga/banco) é ouvido desde já, antes de qualquer tela
  return room;
}

/**
 * Depois do primeiro estado: o seu jogador, ou `null` se a sala te pôs para assistir (ou
 * no banco). Se o servidor anunciou uma vaga (`vaga {seat}`), espera o NetPlayer dessa
 * geração chegar no patch — o boneco antigo da mesma conexão não vale.
 */
export function waitForRole(room: Room<unknown, ArenaState>): Promise<NetPlayer | null> {
  const tracker = roleOf(room);
  return new Promise((resolve) => {
    let done = false;
    const offs: (() => void)[] = [];
    const check = () => {
      if (done || !room.state?.mapId) return; // mapa vazio = estado ainda não chegou
      const mine = tracker.seated(room.state.players, room.sessionId) as NetPlayer | null;
      if (!mine && tracker.role.kind === 'player') return; // vaga anunciada, patch ainda não chegou
      done = true;
      for (const off of offs) off();
      resolve(mine);
    };
    check();
    if (done) return;
    room.onStateChange(check);
    offs.push(() => room.onStateChange.remove(check), tracker.on(check));
  });
}

/** `existing`: sala já aberta (o espectador que ganhou vaga entra sem reconectar). */
export async function connectOnline(p: OnlineParams, hooks: OnlineHooks = {}, existing?: Room<unknown, ArenaState>): Promise<OnlineSession> {
  const room = existing ?? await joinRoom(p);
  const self = await waitForRole(room);
  if (!self) throw new SpectatorSeat(room);
  let pumpLag = () => {};
  if (p.lag) {
    const ws = (room.connection.transport as unknown as { ws: SocketLike }).ws;
    const lines = installLag(ws, p.lag);
    pumpLag = () => {
      lines.down.deliverDue();
      lines.up.deliverDue();
    };
  }
  // Eco imediato da medida de ping do servidor (ele estima sozinho quanto você vê no passado)
  const offSync = room.onMessage(MSG.sync, (n: unknown) => room.send(MSG.syncAck, n));
  const map = getMap(room.state.mapId);
  // Espalhamento previsto: rng local (o servidor sorteia o de verdade com um rng secreto)
  const localSpread = createRng((Math.random() * 0x100000000) >>> 0);

  const input = room.input<WireInput>({ type: MoveInput, mode: 'reliable' });
  const predict = Predict.get(room, { mode: 'lerp', delay: INTERP_DELAY_MS }) as unknown as Predict;
  // Outros jogadores: desenhados ~100 ms no passado, entre dois estados recebidos.
  // `Predict.dispose()` desta versão NÃO desfaz o attachAll: os detachers vão no release.
  const detach = attachPlayers(predict, room, [
    { mode: 'lerp', fields: ['x', 'y', 'z', 'vx', 'vy', 'vz'], snap: 5 },
    { mode: 'lerp', fields: ['yaw', 'pitch'], angle: true },
  ]);
  // Jogador local: aplica o comando na hora e corrige quando o servidor confirma
  const me = predict.reconciler(self as unknown as FlatPlayer, {
    input,
    fields: FLAT_FIELDS,
    step: (ctx, state, cmd) => {
      // Mesmo passo do servidor (o ponto de nascimento muda a cada vida: lê do estado)
      const spawn = { x: self.spawnX, y: self.spawnY, z: self.spawnZ };
      const shot = stepNet(state, commandFromWire(cmd, ctx.tick), ctx.dt, map.solids, spawn, localSpread, map.shotBlockers,
        action => { if (!ctx.isReplay) hooks.onLocalSlipper?.(action); });
      if (shot && !ctx.isReplay) hooks.onLocalShot?.(shot, ctx.tick);
    },
    snap: 3,
  }) as Reconciler<FlatPlayer, WireInput>;

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    offSync();
    detach();
    predict.dispose();
  };
  return { room, input, predict, me, self, map, pumpLag, release, leave: () => { release(); return room.leave(); } };
}

/**
 * `attachAll` de cada config na coleção `players`; devolve a função que desfaz TODOS (chame
 * antes do `predict.dispose()`, que nesta versão do SDK não remove os callbacks da coleção).
 */
export function attachPlayers(predict: Predict, room: Room<unknown, ArenaState>, configs: object[]): () => void {
  const offs = configs.map(c => predict.attachAll(room.state as never, 'players' as never, c as never) as unknown as () => void);
  return () => { for (const off of offs.splice(0)) off(); };
}
