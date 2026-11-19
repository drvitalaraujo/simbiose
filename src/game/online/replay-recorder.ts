// Gravador de replays do modo online (puro, sem Three.js): guarda num buffer circular os
// últimos ~12 s do que o cliente desenha (cada jogador a ~30 Hz, você incluído) e os eventos
// de combate (tiros, acertos, abates). Killcam e "Jogada da Partida" recortam daqui um
// `ReplayClip` (cópia congelada). Memória fixa: nada é alocado por quadro.
//
// O drone da OTIMIZA vai numa trilha à parte (replay-drone.ts), nos mesmos quadros.
//
// Linha do tempo: os outros aparecem interpolados ~100 ms no passado; você aparece previsto
// (no presente). Para tudo ficar no mesmo instante do servidor, sua pose entra no quadro com
// `localDelay` de atraso e os eventos chegam com o tempo já ajustado por quem chama.

import { type DroneClip, type DroneState, DroneTrack } from './replay-drone';

/** Pose de um jogador num instante (centro do corpo, como `NetPlayer`). */
export interface ReplaySample {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  crouch: number;
  weapon: number;
  aim: number;
  reload: number;
  alive: boolean;
  sliding: boolean;
  onGround: boolean;
}

/** Quem é quem no replay (o índice é o slot das poses). */
export interface ReplayActor {
  id: string;
  name: string;
  team: string;
  bot: boolean;
}

/** Tiro (com ou sem acerto) ou abate, já no tempo do replay. */
export interface ReplayEvent {
  t: number;
  kind: 'shot' | 'kill';
  /** Quem atirou/abateu e o alvo (ids; '' = nenhum). */
  by: string;
  target: string;
  weapon: string;
  /** Origem e fim do disparo (só tiros). */
  o: [number, number, number];
  e: [number, number, number];
  /** Projéteis da escopeta (referência à mensagem original, sem cópia). */
  pellets: readonly (readonly [number, number, number])[] | null;
  part: string;
  damage: number;
  killed: boolean;
  headshot: boolean;
  /** Confirmação extra da mesma salva (outro alvo): não repete rastro nem som. */
  continuation: boolean;
  grenadePhase?: 'throw' | 'explode';
  grenadeVelocity?: readonly [number, number, number];
}

export function emptySample(): ReplaySample {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: 0, weapon: 0, aim: 0, reload: 0, alive: false, sliding: false, onGround: true };
}

function emptyEvent(): ReplayEvent {
  return { t: 0, kind: 'shot', by: '', target: '', weapon: '', o: [0, 0, 0], e: [0, 0, 0], pellets: null, part: '', damage: 0, killed: false, headshot: false, continuation: false };
}

function copyEvent(from: ReplayEvent, to: ReplayEvent) {
  to.t = from.t; to.kind = from.kind; to.by = from.by; to.target = from.target; to.weapon = from.weapon;
  to.o[0] = from.o[0]; to.o[1] = from.o[1]; to.o[2] = from.o[2];
  to.e[0] = from.e[0]; to.e[1] = from.e[1]; to.e[2] = from.e[2];
  to.pellets = from.pellets; to.part = from.part; to.damage = from.damage; to.killed = from.killed; to.headshot = from.headshot;
  to.continuation = from.continuation;
  to.grenadePhase = from.grenadePhase;
  to.grenadeVelocity = from.grenadeVelocity;
}

// Campos de cada pose no Float32Array
const X = 0, Y = 1, Z = 2, VX = 3, VY = 4, VZ = 5, YAW = 6, PITCH = 7, CROUCH = 8, WEAPON = 9, FLAGS = 10;
const AIM = 11, RELOAD = 12;
const FIELDS = 13;
const PRESENT = 1, ALIVE = 2, SLIDING = 4, GROUND = 8;

function writePose(data: Float32Array, at: number, s: ReplaySample) {
  data[at + X] = s.x; data[at + Y] = s.y; data[at + Z] = s.z;
  data[at + VX] = s.vx; data[at + VY] = s.vy; data[at + VZ] = s.vz;
  data[at + YAW] = s.yaw; data[at + PITCH] = s.pitch; data[at + CROUCH] = s.crouch;
  data[at + WEAPON] = s.weapon;
  data[at + AIM] = s.aim;
  data[at + RELOAD] = s.reload;
  data[at + FLAGS] = PRESENT | (s.alive ? ALIVE : 0) | (s.sliding ? SLIDING : 0) | (s.onGround ? GROUND : 0);
}

/** Diferença angular pelo caminho mais curto (−π..π). */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Trecho congelado: poses de todos os atores + eventos, entre `start` e `end`. */
export class ReplayClip {
  constructor(
    readonly times: Float64Array,
    private readonly data: Float32Array,
    readonly actors: readonly ReplayActor[],
    readonly events: readonly ReplayEvent[],
    /** Drone da OTIMIZA no trecho (null = não apareceu). */
    readonly drone: DroneClip | null = null,
  ) {}

  get start() { return this.times[0]; }
  get end() { return this.times[this.times.length - 1]; }
  get frames() { return this.times.length; }

  slotOf(id: string): number {
    return this.actors.findIndex(a => a.id === id);
  }

  /** O ator aparece no trecho (pelo menos um quadro presente)? */
  present(slot: number): boolean {
    const stride = this.actors.length * FIELDS;
    for (let f = 0; f < this.frames; f++) if ((this.data[f * stride + slot * FIELDS + FLAGS] & PRESENT) !== 0) return true;
    return false;
  }

  /**
   * Pose interpolada do ator no instante `t` (yaw pelo caminho curto; estados booleanos do
   * quadro anterior). Devolve false se ele não estava na sala nesse momento.
   */
  sample(slot: number, t: number, out: ReplaySample): boolean {
    if (slot < 0 || slot >= this.actors.length || this.frames === 0) return false;
    const times = this.times;
    let lo = 0;
    let hi = times.length - 1;
    if (t <= times[0]) hi = 0;
    else if (t >= times[hi]) lo = hi;
    else {
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= t) lo = mid; else hi = mid;
      }
    }
    const stride = this.actors.length * FIELDS;
    const a = lo * stride + slot * FIELDS;
    const b = hi * stride + slot * FIELDS;
    const d = this.data;
    const aOk = (d[a + FLAGS] & PRESENT) !== 0;
    const bOk = (d[b + FLAGS] & PRESENT) !== 0;
    if (!aOk && !bOk) return false;
    const from = aOk ? a : b;
    const to = bOk ? b : a;
    const span = times[hi] - times[lo];
    const k = span > 0 && from !== to ? Math.min(1, Math.max(0, (t - times[lo]) / span)) : 0;
    // Renasceu entre os quadros (salto grande): não desliza pelo mapa
    const jump = Math.hypot(d[to + X] - d[from + X], d[to + Z] - d[from + Z]) > 4;
    const w = jump ? (k < 0.5 ? 0 : 1) : k;
    const lerp = (f: number) => d[from + f] + (d[to + f] - d[from + f]) * w;
    out.x = lerp(X); out.y = lerp(Y); out.z = lerp(Z);
    out.vx = lerp(VX); out.vy = lerp(VY); out.vz = lerp(VZ);
    out.pitch = lerp(PITCH); out.crouch = lerp(CROUCH);
    out.yaw = d[from + YAW] + angleDelta(d[from + YAW], d[to + YAW]) * w;
    const flags = d[(w < 0.5 ? from : to) + FLAGS];
    out.weapon = d[(w < 0.5 ? from : to) + WEAPON];
    out.aim = d[from + WEAPON] === d[to + WEAPON] ? lerp(AIM) : d[(w < 0.5 ? from : to) + AIM];
    // Início/cancelamento e troca de arma são descontinuidades, não uma recarga em câmera lenta.
    out.reload = d[from + WEAPON] === d[to + WEAPON] && d[from + RELOAD] > 0 && d[to + RELOAD] > 0
      && d[to + RELOAD] <= d[from + RELOAD] ? lerp(RELOAD) : d[(w < 0.5 ? from : to) + RELOAD];
    out.alive = (flags & ALIVE) !== 0;
    out.sliding = (flags & SLIDING) !== 0;
    out.onGround = (flags & GROUND) !== 0;
    return true;
  }
}

export interface RecorderOptions {
  /** Segundos guardados. */
  seconds?: number;
  /** Quadros por segundo gravados. */
  hz?: number;
  /** Máximo de jogadores simultâneos. */
  slots?: number;
  /** Eventos guardados (tiros de escopeta e SMG enchem rápido). */
  events?: number;
}

const LOCAL_RING = 32;

export class ReplayRecorder {
  readonly hz: number;
  readonly capacity: number;
  readonly slots: number;
  /** Atraso aplicado à sua pose (s): alinha o previsto com os outros, que estão no passado. */
  localDelay = 0.1;
  private readonly times: Float64Array;
  private readonly data: Float32Array;
  private readonly actors: (ReplayActor & { lastSeen: number })[] = [];
  private readonly slotById = new Map<string, number>();
  private head = 0;
  private count = 0;
  private open = -1;
  private lastFrame = -Infinity;
  private readonly eventRing: ReplayEvent[];
  private eventHead = 0;
  private eventCount = 0;
  // Sua pose recente (para aplicar `localDelay` com interpolação)
  private readonly localTimes = new Float64Array(LOCAL_RING);
  private readonly localPoses: ReplaySample[] = Array.from({ length: LOCAL_RING }, emptySample);
  private localHead = 0;
  private localCount = 0;
  private localId = '';
  private readonly scratch = emptySample();
  private readonly scratchB = emptySample();
  private readonly droneTrack: DroneTrack;

  constructor(opts: RecorderOptions = {}) {
    this.hz = opts.hz ?? 30;
    this.capacity = Math.ceil((opts.seconds ?? 12) * this.hz) + 1;
    this.slots = opts.slots ?? 16;
    this.times = new Float64Array(this.capacity);
    this.data = new Float32Array(this.capacity * this.slots * FIELDS);
    this.droneTrack = new DroneTrack(this.capacity);
    this.eventRing = Array.from({ length: opts.events ?? 384 }, emptyEvent);
  }

  /** Quadros guardados agora e o intervalo de tempo coberto. */
  get frames() { return this.count; }
  get oldest() { return this.count ? this.times[(this.head - this.count + this.capacity) % this.capacity] : 0; }
  get newest() { return this.count ? this.times[(this.head - 1 + this.capacity) % this.capacity] : 0; }

  /** Apaga tudo (troca de sala). */
  clear() {
    this.count = 0;
    this.head = 0;
    this.open = -1;
    this.lastFrame = -Infinity;
    this.eventCount = 0;
    this.localCount = 0;
    this.actors.length = 0;
    this.slotById.clear();
    this.droneTrack.clear();
  }

  /**
   * Sua pose prevista no instante `t`: chame todo quadro, antes de `begin`. No quadro gravado
   * ela entra atrasada de `localDelay`.
   */
  pushLocal(t: number, id: string, s: ReplaySample) {
    this.localId = id;
    const i = this.localHead;
    this.localTimes[i] = t;
    Object.assign(this.localPoses[i], s);
    this.localHead = (i + 1) % LOCAL_RING;
    this.localCount = Math.min(LOCAL_RING, this.localCount + 1);
  }

  /**
   * Drone da OTIMIZA lido agora (`null` = não há), já no tempo do replay `t`: chame todo
   * quadro, antes de `begin`. O quadro gravado pega a leitura do instante dele.
   */
  drone(t: number, d: DroneState | null) {
    this.droneTrack.push(t, d);
  }

  /** Abre um quadro em `t` se já deu o intervalo da gravação; senão devolve false. */
  begin(t: number): boolean {
    if (t - this.lastFrame < 1 / this.hz - 1e-6) return false;
    this.lastFrame = t;
    const f = this.head;
    this.times[f] = t;
    this.data.fill(0, f * this.slots * FIELDS, (f + 1) * this.slots * FIELDS);
    this.head = (f + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);
    this.open = f;
    return true;
  }

  /** Pose de um jogador no quadro aberto (os outros: como você os vê na tela). */
  player(id: string, name: string, team: string, bot: boolean, s: ReplaySample) {
    if (this.open < 0) return;
    const slot = this.slotFor(id, name, team, bot);
    if (slot < 0) return;
    writePose(this.data, (this.open * this.slots + slot) * FIELDS, s);
  }

  /** Fecha o quadro: grava sua pose atrasada. Nome/time de você vêm em `self`. */
  end(self?: { name: string; team: string }) {
    if (this.open < 0) return;
    if (self && this.localId && this.localCount > 0 && this.delayedLocal(this.times[this.open] - this.localDelay, this.scratch)) {
      const slot = this.slotFor(this.localId, self.name, self.team, false);
      if (slot >= 0) writePose(this.data, (this.open * this.slots + slot) * FIELDS, this.scratch);
    }
    this.droneTrack.writeFrame(this.open, this.times[this.open]);
    this.open = -1;
  }

  /** Guarda um evento (o objeto é copiado para o anel; `pellets` só por referência). */
  event(e: ReplayEvent) {
    const i = (this.eventHead) % this.eventRing.length;
    copyEvent(e, this.eventRing[i]);
    this.eventHead = (i + 1) % this.eventRing.length;
    this.eventCount = Math.min(this.eventRing.length, this.eventCount + 1);
  }

  /** Último evento guardado que satisfaz `match` (procura do mais novo ao mais velho). */
  findEvent(match: (e: ReplayEvent) => boolean): ReplayEvent | null {
    for (let k = 1; k <= this.eventCount; k++) {
      const e = this.eventRing[(this.eventHead - k + this.eventRing.length) % this.eventRing.length];
      if (match(e)) return e;
    }
    return null;
  }

  /**
   * Recorta uma cópia congelada entre `from` e `to` (limitada ao que ainda está no buffer).
   * Sem pelo menos dois quadros, devolve null.
   */
  clip(from: number, to: number): ReplayClip | null {
    const idx: number[] = [];
    for (let k = this.count; k >= 1; k--) {
      const f = (this.head - k + this.capacity) % this.capacity;
      const t = this.times[f];
      if (t >= from - 1e-6 && t <= to + 1e-6) idx.push(f);
    }
    if (idx.length < 2) return null;
    const actors = this.actors.map(({ id, name, team, bot }) => ({ id, name, team, bot }));
    const n = actors.length;
    const times = new Float64Array(idx.length);
    const data = new Float32Array(idx.length * n * FIELDS);
    idx.forEach((f, i) => {
      times[i] = this.times[f];
      data.set(this.data.subarray(f * this.slots * FIELDS, f * this.slots * FIELDS + n * FIELDS), i * n * FIELDS);
    });
    const events: ReplayEvent[] = [];
    for (let k = this.eventCount; k >= 1; k--) {
      const e = this.eventRing[(this.eventHead - k + this.eventRing.length) % this.eventRing.length];
      if (e.t >= times[0] && e.t <= times[times.length - 1] + 0.05) {
        const c = emptyEvent();
        copyEvent(e, c);
        events.push(c);
      }
    }
    events.sort((a, b) => a.t - b.t);
    return new ReplayClip(times, data, actors, events, this.droneTrack.copy(idx, times));
  }

  private slotFor(id: string, name: string, team: string, bot: boolean): number {
    const now = this.lastFrame;
    let slot = this.slotById.get(id);
    if (slot === undefined) {
      if (this.actors.length < this.slots) {
        slot = this.actors.length;
        this.actors.push({ id, name, team, bot, lastSeen: now });
      } else {
        // Reaproveita o slot de quem sumiu há mais tempo que o buffer (já não aparece em nada)
        const span = this.capacity / this.hz;
        let best = -1;
        for (let i = 0; i < this.actors.length; i++) {
          if (now - this.actors[i].lastSeen > span && (best < 0 || this.actors[i].lastSeen < this.actors[best].lastSeen)) best = i;
        }
        if (best < 0) return -1;
        this.slotById.delete(this.actors[best].id);
        slot = best;
        Object.assign(this.actors[best], { id, name, team, bot });
      }
      this.slotById.set(id, slot);
    }
    const a = this.actors[slot];
    a.lastSeen = now;
    if (a.name !== name) a.name = name;
    if (a.team !== team) a.team = team;
    return slot;
  }

  private delayedLocal(t: number, out: ReplaySample): boolean {
    const n = this.localCount;
    let older = -1;
    let newer = -1;
    for (let k = 1; k <= n; k++) {
      const i = (this.localHead - k + LOCAL_RING) % LOCAL_RING;
      if (this.localTimes[i] <= t) { older = i; break; }
      newer = i;
    }
    if (older < 0 && newer < 0) return false;
    if (older < 0) { Object.assign(out, this.localPoses[newer]); return true; }
    if (newer < 0) { Object.assign(out, this.localPoses[older]); return true; }
    const a = this.localPoses[older];
    const b = this.localPoses[newer];
    const span = this.localTimes[newer] - this.localTimes[older];
    const k = span > 0 ? (t - this.localTimes[older]) / span : 0;
    const s = this.scratchB;
    Object.assign(s, k < 0.5 ? a : b);
    s.x = a.x + (b.x - a.x) * k; s.y = a.y + (b.y - a.y) * k; s.z = a.z + (b.z - a.z) * k;
    s.vx = a.vx + (b.vx - a.vx) * k; s.vy = a.vy + (b.vy - a.vy) * k; s.vz = a.vz + (b.vz - a.vz) * k;
    s.yaw = a.yaw + angleDelta(a.yaw, b.yaw) * k;
    s.pitch = a.pitch + (b.pitch - a.pitch) * k;
    s.crouch = a.crouch + (b.crouch - a.crouch) * k;
    if (a.weapon === b.weapon) {
      s.aim = a.aim + (b.aim - a.aim) * k;
      if (a.reload > 0 && b.reload > 0 && b.reload <= a.reload) s.reload = a.reload + (b.reload - a.reload) * k;
    }
    Object.assign(out, s);
    return true;
  }
}
