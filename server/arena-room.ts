// Sala "arena": servidor autoritativo do FFA. Roda a MESMA simulação de src/sim a 60 Hz,
// consumindo só os comandos de cada cliente (nunca posição nem acerto). As regras da
// partida moram em src/net/arena-sim.ts (puro); aqui só o Colyseus 0.18:
//  - `defineInput`: fila de comandos por cliente, com ack para a reconciliação;
//  - `setFixedTimestep`: passo fixo anunciado à predição do cliente;
//  - `allowRewindState`: histórico das posições (gravado a cada envio de estado) para o
//    tiro acertar onde o atirador via o alvo — com a profundidade estimada pelo SERVIDOR
//    (src/net/lagcomp.ts), não pelo carimbo do cliente;
//  - limites contra abuso (src/net/limits.ts) e reconexão curta sem vida nova.
import { type AuthContext, type Client, Room, ServerError, type StepContext } from '@colyseus/core';
import type { Rewind } from '@colyseus/core';
import { ArenaSim, type SimPlayer, type ViewLookup } from '../src/net/arena-sim';
import { MSG } from '../src/net/feed';
import { ViewClock } from '../src/net/lagcomp';
import { debugAllowed, DEFAULT_LIMITS, Quota, type ServerLimits } from '../src/net/limits';
import { getMap } from '../src/net/maps';
import { rulesFrom } from '../src/net/match';
import { InputPacer } from '../src/net/pacer';
import {
  cleanName, commandFromWire, INPUT_LIMITS, MAX_PLAYERS, PATCH_MS, REWIND_MAX_MS, TICK_HZ,
} from '../src/net/protocol';
import { ArenaState, MoveInput, NetPlayer, NetHackDrone, NetSlipper, NetGrenade } from '../src/net/schema';
import { MODE_CONFIG, modeFrom } from '../src/net/modes';
import { difficultyFrom } from '../src/net/bot-persona';
import { createRng } from '../src/sim/rng';
import { Audience, type BenchedMsg, type SeatMsg, seatFor, SPECTATE_MSG, SPECTATOR_SLOTS } from '../src/net/spectate';
import { pickBenched } from '../src/net/rotation';

/** Fila máxima de comandos por cliente (~1 s a 60 Hz). */
const BUFFER = 64;
/** Total de jogadores que os bots completam por padrão. */
export const DEFAULT_BOT_FILL = 6;
/** Campos gravados para o rewind: o que a hitbox usa. */
const REWIND_FIELDS = ['x', 'y', 'z', 'yaw', 'pitch', 'vx', 'vz', 'slideTime', 'crouchAmount'] as const;
/** Medida do ping feita pelo servidor (ms entre medidas). */
const SYNC_EVERY_MS = 500;
/** Queda de conexão: segundos para voltar com o mesmo boneco, vida e placar. */
export const RECONNECT_SECONDS = 10;

export interface ArenaCreateOptions {
  modo?: string;
  mapa?: string;
  /** Total de jogadores que os bots completam (0 = sem bots). */
  bots?: number | string;
  /** Limites da partida (abates, minutos). */
  abates?: number | string;
  tempo?: number | string;
  /** Nível dos bots: facil | normal | dificil (padrão normal). */
  dificuldade?: string;
  /** Criada por anfitrião espectador (Modo Live): os bots começam já, sem esperar gente. */
  espectador?: boolean | string;
}

const wantsSpectator = (o: unknown) => {
  const v = (o as { espectador?: unknown } | null | undefined)?.espectador;
  return v === true || v === 'true';
};

export interface ArenaJoinOptions {
  nome?: string;
  /** Entra só para assistir (Modo Live): não vira jogador nem conta na capacidade. */
  espectador?: boolean | string;
}

/** Por conexão: ritmo dos comandos, estimativa de quanto ela vê no passado e medidas de ping. */
interface Conn {
  pacer: InputPacer;
  view: ViewClock;
  ip: string;
  syncs: Map<number, number>;
}

export class ArenaRoom extends Room<{ state: ArenaState; input: MoveInput }> {
  /** Limites do processo inteiro (os testes trocam). */
  static limits: ServerLimits = { ...DEFAULT_LIMITS };
  /** Ferramentas de teste ligadas (só em desenvolvimento: ver `debugAllowed`). */
  static debug = debugAllowed(process.env);
  private static liveRooms = 0;
  private static readonly roomsByIp = new Quota();
  private static readonly connsByIp = new Quota();

  maxClients = MAX_PLAYERS;
  inputs = this.defineInput(MoveInput, { bufferMaxSize: BUFFER, sanitize: INPUT_LIMITS });
  sim!: ArenaSim;
  private rewind!: Rewind;
  private readonly conns = new Map<string, Conn>();
  private creatorIp: string | null = null;
  private counted = false;
  private botFill = DEFAULT_BOT_FILL;
  private botsStarted = false;
  private joined = 0;
  /** Quem assiste (por escolha ou esperando vaga): fora da simulação. */
  readonly audience = new Audience();
  private audienceDirty = false;
  /** Rodízio: partidas seguidas jogadas por cada pessoa na simulação. */
  private readonly streaks = new Map<string, number>();
  /** Geração da participação: cada entrada na simulação ganha um número novo (NetPlayer.seat). */
  private seatGen = 0;
  private syncSeq = 0;
  /** Ticks simulados desde a criação (útil em teste). */
  ticks = 0;

  onCreate(options: ArenaCreateOptions = {}) {
    const limits = ArenaRoom.limits;
    if (ArenaRoom.liveRooms >= limits.maxRooms) throw new ServerError(503, 'servidor cheio: salas demais abertas');
    ArenaRoom.liveRooms += 1;
    this.counted = true;
    this.maxMessagesPerSecond = limits.messagesPerSecond; // acima disso o Colyseus derruba a conexão

    const map = getMap(options.mapa);
    const mode = modeFrom(options.modo);
    this.maxClients = MODE_CONFIG[mode].capacity + SPECTATOR_SLOTS; // plateia cabe além dos jogadores
    this.state = new ArenaState({ mapId: map.id, phase: 'playing', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0, mode, scoreA: 0, scoreB: 0, winnerTeam: '', drawn: false });
    this.patchRate = PATCH_MS;
    this.rewind = this.allowRewindState({ maxRewindMs: REWIND_MAX_MS });
    this.rewind.attachAll(this.state.players, { fields: REWIND_FIELDS });

    this.sim = new ArenaSim({
      map,
      rules: rulesFrom(options),
      rng: createRng((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0),
      state: this.state,
      players: this.state.players as never,
      create: (init) => new NetPlayer({ ...init, selectedWeapon: init.selectedWeapon ?? 0, team: init.team ?? '', seat: 0 }) as unknown as SimPlayer,
      now: () => this.clock.elapsedTime,
      grenades: this.state.grenades, createGrenade: p => new NetGrenade(p),
      slippers: this.state.slippers,
      createSlipper: (p) => new NetSlipper(p),
      drones: this.state.drones as never,
      createDrone: d => new NetHackDrone(d) as never,
      difficulty: difficultyFrom(options.dificuldade),
    });
    this.sim.on((e) => {
      if (e.type === 'shot') this.broadcast(MSG.shot, e.msg);
      else if (e.type === 'kill') this.broadcast(MSG.kill, e.msg);
      else if (e.type === 'drone') this.broadcast(MSG.drone, e.msg);
      else if (e.type === 'end') this.countStreaks();
      else if (e.type === 'restarting') this.rotate(); // quem perde sai, a fila entra
      else if (e.type === 'start') this.promoteWaiting(); // vaga livre: a fila entra
    });
    this.guardSeats();

    this.onMessage(MSG.ping, (client, ms: unknown) => {
      const p = this.state.players.get(client.sessionId);
      const n = Number(ms);
      if (p && Number.isFinite(n)) p.ping = Math.min(9999, Math.max(0, Math.round(n)));
    });
    this.onMessage(MSG.loadout, (client, index: unknown) => this.sim.selectLoadout(client.sessionId, index));
    // Eco da medida de ping: só vale número que o servidor mandou (não dá para inventar)
    this.onMessage(MSG.syncAck, (client, n: unknown) => {
      const c = this.conns.get(client.sessionId);
      const sentAt = typeof n === 'number' ? c?.syncs.get(n) : undefined;
      if (!c || sentAt === undefined) return;
      c.syncs.delete(n as number);
      c.view.observeRtt(this.clock.currentTime - sentAt);
    });
    if (ArenaRoom.debug) {
      // Só em desenvolvimento: "me põe perto de fulano" para duas abas se acharem no teste
      this.onMessage('debug-perto', (client, target: unknown) => {
        if (typeof target === 'string') this.sim.placeNear(client.sessionId, target);
      });
      // Só em desenvolvimento: chama o drone da OTIMIZA agora (Arena FFA)
      this.onMessage('debug-drone', (client, here: unknown) => {
        this.sim.arenaDrone?.skipWait();
        const d = this.sim.arenaDrone?.drone, p = this.state.players.get(client.sessionId);
        // `true`: traz o drone livre para 3 m à frente de quem pediu (teste no navegador)
        if (here === true && d && p && d.phase === 'free') Object.assign(d, { x: p.x - Math.sin(p.yaw) * 3, y: p.y + 0.9, z: p.z - Math.cos(p.yaw) * 3 });
      });
    }
    // Qualquer outra mensagem avulsa do cliente é descartada: em especial, posição e acerto.
    this.onMessage('*', () => {});
    this.clock.setInterval(() => this.sendSyncs(), SYNC_EVERY_MS);
    this.setFixedTimestep((ctx) => this.step(ctx), TICK_HZ);
    const bots = Number(options.bots ?? MODE_CONFIG[mode].fill);
    this.botFill = Number.isFinite(bots) ? Math.min(this.maxClients, Math.max(0, bots)) : MODE_CONFIG[mode].fill;
    // Live: a transmissão começa com os bots jogando (gente que entra substitui bot)
    if (wantsSpectator(options)) this.startBots();
  }

  private startBots() {
    if (this.botsStarted) return;
    this.botsStarted = true;
    this.sim.setBotTarget(this.botFill);
  }

  /**
   * Reserva por papel: o Colyseus conta a reserva de vaga antes do onAuth/onJoin; aqui a
   * plateia (voluntários + fila, inclusive reservas pendentes) não passa de SPECTATOR_SLOTS,
   * então sempre sobra lugar para quem vem jogar. Recusada aqui, nada de cota foi gasto.
   */
  private guardSeats() {
    const room = this as unknown as {
      _reserveSeat: (id: string, options: unknown, ...rest: unknown[]) => Promise<boolean>;
      _reservedSeats: Record<string, [unknown, ...unknown[]]>;
    };
    const reserve = room._reserveSeat.bind(this);
    room._reserveSeat = async (id, options, ...rest) => {
      const reconnecting = rest[2] === true;
      if (!reconnecting) {
        // Reservas que ainda não entraram (fora as de reconexão: esse boneco já está na sala)
        const pending = Object.values(room._reservedSeats).filter(r => r[3] !== true).map(([o]) => wantsSpectator(o));
        if (seatFor(wantsSpectator(options), MODE_CONFIG[this.sim.mode].capacity, this.humans(), this.audience.size, pending) === 'full') return false;
      }
      return reserve(id, options, ...rest);
    };
  }

  /** Cota por IP: conexões no processo e salas criadas (quem entra primeiro é o criador). */
  onAuth(client: Client, _options: unknown, context: AuthContext) {
    const limits = ArenaRoom.limits;
    const ip = context?.ip ?? 'sem-ip';
    if (!ArenaRoom.connsByIp.tryAdd(ip, limits.connectionsPerIp)) {
      throw new ServerError(429, 'conexões demais deste endereço');
    }
    if (this.creatorIp === null) {
      if (!ArenaRoom.roomsByIp.tryAdd(ip, limits.roomsPerIp)) {
        ArenaRoom.connsByIp.remove(ip);
        throw new ServerError(429, 'salas demais criadas deste endereço');
      }
      this.creatorIp = ip;
    }
    this.conns.set(client.sessionId, { pacer: new InputPacer(), view: new ViewClock(), ip, syncs: new Map() });
    return true;
  }

  onJoin(client: Client, options: ArenaJoinOptions = {}) {
    this.joined += 1;
    const name = cleanName(options.nome, `Jogador ${this.joined}`);
    const role = this.audience.admit(client.sessionId, name, wantsSpectator(options), this.humans(), MODE_CONFIG[this.sim.mode].capacity);
    // Plateia no teto (corrida entre reservas): recusa; o onLeave do Colyseus devolve a cota
    if (role === 'full') throw new ServerError(503, 'sala cheia: a plateia está lotada');
    if (role !== 'player') {
      this.audienceDirty = true; // assiste: fora da sim, dos bots e da capacidade
      return;
    }
    this.enterSim(client.sessionId, name);
  }

  /** Gente de verdade jogando (bots e plateia fora). */
  private humans(): number {
    let n = 0;
    for (const p of this.state.players.values()) if (!p.bot) n += 1;
    return n;
  }

  private enterSim(id: string, name: string) {
    this.sim.join(id, name);
    const p = this.state.players.get(id);
    if (p) p.seat = ++this.seatGen; // participação nova (o cliente distingue do boneco antigo)
    this.streaks.set(id, 0);
    this.audienceDirty = true;
    const c = this.conns.get(id);
    if (c) Object.assign(c, { pacer: new InputPacer(), view: new ViewClock() }); // voltou do banco: ritmo do zero
    this.startBots(); // fora da live, bots só quando a sala tem gente de verdade
    this.sim.balanceBots();
  }

  /** Fim de partida: mais uma seguida para quem jogou (desempate do rodízio). */
  private countStreaks() {
    for (const [id, p] of this.state.players) if (!p.bot) this.streaks.set(id, (this.streaks.get(id) ?? 0) + 1);
  }

  /**
   * Rodízio no reinício (placar ainda é o da partida que acabou): vaga livre primeiro; se a
   * fila continua e a sala está cheia de gente, os piores saem para o FIM da fila (mesma
   * conexão, viram plateia) e os primeiros da fila entram no lugar.
   */
  private rotate() {
    if (this.state.phase !== 'ended') return; // reinício do duelo ao completar a dupla
    this.promoteWaiting();
    const capacity = MODE_CONFIG[this.sim.mode].capacity;
    const waiting = this.audience.waitingCount;
    if (waiting === 0 || this.humans() < capacity) return;
    const standings = [...this.state.players].filter(([, p]) => !p.bot).map(([id, p]) => ({ id, kills: p.kills, deaths: p.deaths, streak: this.streaks.get(id) ?? 0 }));
    const out = pickBenched(standings, waiting);
    for (const id of out) {
      const name = this.state.players.get(id)!.name;
      this.sim.leave(id);
      this.streaks.delete(id);
      this.audience.bench(id, name);
    }
    this.promoteWaiting(out.length);
    for (const id of out) this.sendRole(id); // desconectado agora: o onReconnect reenvia
    this.sim.balanceBots();
  }

  /** Abriu vaga: quem espera na fila vira jogador (comandos velhos da espera são descartados). */
  private promoteWaiting(limit = Infinity) {
    const free = Math.min(limit, MODE_CONFIG[this.sim.mode].capacity - this.humans());
    for (const { id, name } of this.audience.promote(free)) {
      const queue = this.inputs.get(id);
      if (queue.size > 0) queue.take(queue.size);
      this.enterSim(id, name);
      this.audienceDirty = true;
      this.sendRole(id); // desconectado agora: o onReconnect reenvia
    }
  }

  /**
   * Papel atual da conexão, de forma idempotente: jogador (`vaga` com a geração do NetPlayer)
   * ou fila (`banco` com a posição). Espectador por escolha não recebe nada.
   */
  private sendRole(id: string) {
    const client = this.clients.getById(id);
    if (!client) return;
    const p = this.state.players.get(id);
    if (p) {
      const msg: SeatMsg = { seat: p.seat };
      client.send(SPECTATE_MSG.seat, msg);
    } else if (this.audience.isWaiting(id)) {
      const msg: BenchedMsg = { place: this.audience.placeOf(id), waiting: this.audience.waitingCount };
      client.send(SPECTATE_MSG.benched, msg);
    }
  }

  /** Voltou dentro do prazo: o papel pode ter mudado enquanto estava fora (rodízio, vaga). */
  onReconnect(client: Client) {
    this.sendRole(client.sessionId);
    this.audienceDirty = true; // plateia/fila recebe a contagem de novo
  }

  /** Caiu a conexão: guarda o boneco (e a vida e o placar) por alguns segundos. */
  onDrop(client: Client) {
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onLeave(client: Client) {
    const c = this.conns.get(client.sessionId);
    if (c) ArenaRoom.connsByIp.remove(c.ip);
    this.conns.delete(client.sessionId);
    if (this.audience.remove(client.sessionId)) {
      this.audienceDirty = true;
      return;
    }
    this.sim.leave(client.sessionId);
    this.streaks.delete(client.sessionId);
    this.audienceDirty = true;
    this.promoteWaiting();
    this.sim.balanceBots();
  }

  onDispose() {
    // Também libera autenticações que não chegaram ao onJoin/onLeave (falha de entrada).
    for (const c of this.conns.values()) ArenaRoom.connsByIp.remove(c.ip);
    this.conns.clear();
    if (this.counted) ArenaRoom.liveRooms -= 1;
    this.counted = false;
    if (this.creatorIp !== null) ArenaRoom.roomsByIp.remove(this.creatorIp);
    this.creatorIp = null;
  }

  private sendSyncs() {
    const now = this.clock.currentTime;
    const audience = this.audienceDirty ? this.audience.message(this.humans(), MODE_CONFIG[this.sim.mode].capacity) : null;
    this.audienceDirty = false;
    for (const client of this.clients) {
      if (this.audience.has(client.sessionId)) {
        // Plateia: só a contagem (quem está na fila também recebe a própria posição)
        const place = audience ? this.audience.placeOf(client.sessionId) : 0;
        if (audience) client.send(SPECTATE_MSG.audience, place ? { ...audience, place } : audience);
        continue;
      }
      const c = this.conns.get(client.sessionId);
      if (!c) continue;
      const n = ++this.syncSeq;
      c.syncs.set(n, now);
      if (c.syncs.size > 8) c.syncs.delete(c.syncs.keys().next().value!); // eco perdido
      client.send(MSG.sync, n);
    }
  }

  /** Instante do rewind para o tiro de `sid`, decidido no momento do disparo. */
  private viewFor(sid: string): ViewLookup {
    return () => {
      const c = this.conns.get(sid);
      const now = this.clock.elapsedTime;
      const at = c ? c.view.resolve(now, this.inputs.get(sid).renderTime) : now;
      const seen = this.rewind.at(at);
      return (tid, tp) => {
        // Nasceu depois do instante que o atirador via: lá ele ainda era o corpo antigo
        if (seen.time < this.sim.spawnedAt(tid)) return null;
        const pose = seen.read(tp, REWIND_FIELDS);
        return { ...pose, sliding: pose.slideTime > 0 };
      };
    };
  }

  private step(ctx: StepContext) {
    this.ticks += 1;
    for (const [sid, c] of this.conns) {
      if (!this.state.players.has(sid)) continue;
      const queue = this.inputs.get(sid);
      const plan = c.pacer.plan(queue.size);
      if (plan.skip > 0) queue.take(plan.skip);
      if (plan.idle) this.sim.idle(sid, ctx.dt); // sem comando: a física continua
      if (plan.steps > 0) {
        const view = this.viewFor(sid);
        let k = 0;
        // Um comando por vez: o carimbo (renderTime) é o de CADA comando
        for (const cmd of queue) {
          this.sim.command(sid, commandFromWire(cmd, queue.consumedCount), ctx.dt, view);
          if (++k >= plan.steps) break;
        }
      }
    }
    this.sim.tick(ctx.dt);
  }
}
