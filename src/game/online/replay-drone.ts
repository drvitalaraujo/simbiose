// Drone da OTIMIZA no replay (puro, sem Three.js): o gravador guarda a pose e o estado do
// drone em cada quadro, junto com os jogadores, para a killcam e a Jogada da Partida
// mostrarem o drone histórico (e não o ao vivo). Também escolhe a câmera da killcam quando
// quem matou foi o drone. Memória fixa: nada é alocado por quadro gravado.
//
// Linha do tempo: o estado do drone chega sem interpolação (≈ meio ping no passado do
// servidor), mas os outros jogadores aparecem ~100 ms atrás. Quem chama empurra cada leitura
// já no tempo do replay (`agora + atraso de interpolação − meio ping`) e o quadro gravado
// pega a leitura interpolada no instante dele.

import type { Box } from '../../sim/physics';
import { rayBox } from '../../sim/ray';

/** 'hacking' = livre com alguém canalizando. */
export type DronePhase = 'free' | 'hacking' | 'ally' | 'leaving';
const PHASES: readonly DronePhase[] = ['free', 'hacking', 'ally', 'leaving'];

/** O que o replay precisa do drone (o `HackDrone` do estado serve). */
export interface DroneState {
  x: number; y: number; z: number;
  hackerId: string;
  progress: number;
  contested: boolean;
  phase?: string;
  owner?: string;
  target?: string;
}

export interface DroneSample {
  x: number; y: number; z: number;
  phase: DronePhase;
  /** Quem canaliza (livre), dono (aliado/indo embora) e quem ele mira ('' = ninguém). */
  hacker: string;
  owner: string;
  target: string;
  progress: number;
  contested: boolean;
}

export function emptyDroneSample(): DroneSample {
  return { x: 0, y: 0, z: 0, phase: 'free', hacker: '', owner: '', target: '', progress: 0, contested: false };
}

export function dronePhaseOf(d: DroneState): DronePhase {
  if (d.phase === 'ally') return 'ally';
  if (d.phase === 'leaving') return 'leaving';
  return d.hackerId ? 'hacking' : 'free';
}

// Campos por quadro no Float32Array
const X = 0, Y = 1, Z = 2, PHASE = 3, PROGRESS = 4, FLAGS = 5;
const FIELDS = 6;
const PRESENT = 1, CONTESTED = 2;
/** Leituras recentes guardadas para achar a do instante do quadro (cobre ~0,4 s a 144 Hz). */
const RING = 64;
/** Leitura mais nova vale por até este tempo além dela (patch atrasado). */
const HOLD = 0.25;

/** Trilha do drone dentro do gravador: um registro por quadro, no mesmo índice dos jogadores. */
export class DroneTrack {
  private readonly data: Float32Array;
  private readonly hacker: string[];
  private readonly owner: string[];
  private readonly target: string[];
  private readonly ringTimes = new Float64Array(RING);
  private readonly ringPresent = new Uint8Array(RING);
  private readonly ring: DroneSample[] = Array.from({ length: RING }, emptyDroneSample);
  private ringHead = 0;
  private ringCount = 0;
  private readonly scratch = emptyDroneSample();

  constructor(readonly capacity: number) {
    this.data = new Float32Array(capacity * FIELDS);
    this.hacker = new Array<string>(capacity).fill('');
    this.owner = new Array<string>(capacity).fill('');
    this.target = new Array<string>(capacity).fill('');
  }

  clear() {
    this.ringCount = 0;
    this.data.fill(0);
  }

  /** Leitura do drone no tempo do replay `t` (`null` = não há drone). Chame todo quadro. */
  push(t: number, d: DroneState | null) {
    const i = this.ringHead;
    this.ringTimes[i] = t;
    this.ringPresent[i] = d ? 1 : 0;
    if (d) {
      const s = this.ring[i];
      s.x = d.x; s.y = d.y; s.z = d.z;
      s.phase = dronePhaseOf(d);
      s.hacker = d.hackerId; s.owner = d.owner ?? ''; s.target = d.target ?? '';
      s.progress = d.progress; s.contested = d.contested;
    }
    this.ringHead = (i + 1) % RING;
    this.ringCount = Math.min(RING, this.ringCount + 1);
  }

  /** Grava no quadro `f` (instante `t`) a leitura interpolada; sem leitura, fica ausente. */
  writeFrame(f: number, t: number) {
    const at = f * FIELDS;
    const s = this.scratch;
    if (!this.at(t, s)) { this.data[at + FLAGS] = 0; return; }
    this.data[at + X] = s.x; this.data[at + Y] = s.y; this.data[at + Z] = s.z;
    this.data[at + PHASE] = PHASES.indexOf(s.phase);
    this.data[at + PROGRESS] = s.progress;
    this.data[at + FLAGS] = PRESENT | (s.contested ? CONTESTED : 0);
    this.hacker[f] = s.hacker; this.owner[f] = s.owner; this.target[f] = s.target;
  }

  /** Cópia congelada dos quadros `idx` (em ordem); null se o drone não aparece em nenhum. */
  copy(idx: readonly number[], times: Float64Array): DroneClip | null {
    const data = new Float32Array(idx.length * FIELDS);
    const hacker: string[] = [], owner: string[] = [], target: string[] = [];
    let any = false;
    for (let i = 0; i < idx.length; i++) {
      const f = idx[i];
      data.set(this.data.subarray(f * FIELDS, (f + 1) * FIELDS), i * FIELDS);
      if (data[i * FIELDS + FLAGS] & PRESENT) any = true;
      hacker.push(this.hacker[f]); owner.push(this.owner[f]); target.push(this.target[f]);
    }
    return any ? new DroneClip(times, data, hacker, owner, target) : null;
  }

  /** Leitura no instante `t` (interpola posição entre as duas vizinhas presentes). */
  private at(t: number, out: DroneSample): boolean {
    let older = -1;
    let newer = -1;
    for (let k = 1; k <= this.ringCount; k++) {
      const i = (this.ringHead - k + RING) % RING;
      if (this.ringTimes[i] <= t) { older = i; break; }
      newer = i;
    }
    if (older < 0) return false; // ainda não chegou leitura desse instante
    if (!this.ringPresent[older]) return false;
    const a = this.ring[older];
    if (newer < 0 || !this.ringPresent[newer]) {
      if (newer < 0 && t - this.ringTimes[older] > HOLD) return false;
      Object.assign(out, a);
      return true;
    }
    const b = this.ring[newer];
    const span = this.ringTimes[newer] - this.ringTimes[older];
    const k = span > 0 ? (t - this.ringTimes[older]) / span : 0;
    Object.assign(out, k < 0.5 ? a : b);
    out.x = a.x + (b.x - a.x) * k; out.y = a.y + (b.y - a.y) * k; out.z = a.z + (b.z - a.z) * k;
    out.progress = a.progress + (b.progress - a.progress) * k;
    return true;
  }
}

/** Drone num `ReplayClip`: mesmos instantes dos jogadores. */
export class DroneClip {
  constructor(
    private readonly times: Float64Array,
    private readonly data: Float32Array,
    private readonly hacker: readonly string[],
    private readonly owner: readonly string[],
    private readonly target: readonly string[],
  ) {}

  /** Drone interpolado no instante `t`; false se ele não estava no ar. */
  sample(t: number, out: DroneSample): boolean {
    const times = this.times;
    const n = times.length;
    if (n === 0) return false;
    let lo = 0;
    let hi = n - 1;
    if (t <= times[0]) hi = 0;
    else if (t >= times[hi]) lo = hi;
    else {
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= t) lo = mid; else hi = mid;
      }
    }
    const d = this.data;
    const aOk = (d[lo * FIELDS + FLAGS] & PRESENT) !== 0;
    const bOk = (d[hi * FIELDS + FLAGS] & PRESENT) !== 0;
    // Só aparece entre dois quadros em que ele existe (não "nasce" meio quadro antes)
    if (!aOk || (!bOk && hi !== lo && t > times[lo] + 1e-6)) return false;
    const from = lo;
    const to = bOk ? hi : lo;
    const span = times[hi] - times[lo];
    const k = span > 0 && from !== to ? Math.min(1, Math.max(0, (t - times[lo]) / span)) : 0;
    const a = from * FIELDS, b = to * FIELDS;
    out.x = d[a + X] + (d[b + X] - d[a + X]) * k;
    out.y = d[a + Y] + (d[b + Y] - d[a + Y]) * k;
    out.z = d[a + Z] + (d[b + Z] - d[a + Z]) * k;
    out.progress = d[a + PROGRESS] + (d[b + PROGRESS] - d[a + PROGRESS]) * k;
    const near = k < 0.5 ? from : to;
    out.phase = PHASES[d[near * FIELDS + PHASE]] ?? 'free';
    out.contested = (d[near * FIELDS + FLAGS] & CONTESTED) !== 0;
    out.hacker = this.hacker[near]; out.owner = this.owner[near]; out.target = this.target[near];
    return true;
  }
}

// --- Killcam pelo drone -----------------------------------------------------------------

/**
 * Câmera por cima do ombro do drone: recuo, deslocamento para a direita e subida (m), e
 * altura do peito do alvo acima do centro do corpo. O drone fica de lado na tela e o alvo aparece.
 */
export const DRONE_CAM = { back: 2.2, side: 0.75, up: 0.45, chest: 0.35, wallGap: 0.25 } as const;

export interface CameraView { x: number; y: number; z: number; yaw: number; pitch: number }

/** A killcam olha pelo drone quando foi ele quem matou. */
export function killcamFromDrone(weapon: string): boolean {
  return weapon === 'drone';
}

/** Origem do tiro do drone no replay: o drone desenhado (se no ar) ou a origem gravada. */
export function droneShotOrigin<T extends { x: number; y: number; z: number }>(drone: DroneClip | null, t: number, recorded: readonly [number, number, number], scratch: DroneSample, out: T): T {
  if (drone && drone.sample(t, scratch)) { out.x = scratch.x; out.y = scratch.y; out.z = scratch.z; }
  else { out.x = recorded[0]; out.y = recorded[1]; out.z = recorded[2]; }
  return out;
}

/**
 * Câmera da killcam por drone: atrás, à direita e acima do drone, olhando o peito do alvo
 * (centro do corpo em `target`). Sem alvo, mantém o yaw/pitch que já estavam em `out`.
 * yaw/pitch no padrão do jogo (frente = −Z; pitch > 0 olha para cima).
 */
export function droneKillcamView(drone: { x: number; y: number; z: number }, target: { x: number; y: number; z: number } | null, out: CameraView, blockers: readonly Box[] = []): CameraView {
  if (target) {
    const dx = target.x - drone.x;
    const dz = target.z - drone.z;
    if (Math.hypot(dx, dz) > 1e-3) out.yaw = Math.atan2(-dx, -dz);
  }
  // Frente (−Z girado) e direita do drone olhando o alvo
  const fx = -Math.sin(out.yaw), fz = -Math.cos(out.yaw);
  const rx = -fz, rz = fx;
  out.x = drone.x - fx * DRONE_CAM.back + rx * DRONE_CAM.side;
  out.y = drone.y + DRONE_CAM.up;
  out.z = drone.z - fz * DRONE_CAM.back + rz * DRONE_CAM.side;
  pullFromWalls(drone, out, blockers);
  if (target) {
    // Mira de onde a câmera está (não do drone): o alvo fica no centro da tela
    const dx = target.x - out.x, dz = target.z - out.z;
    const h = Math.hypot(dx, dz);
    if (h > 1e-3) out.yaw = Math.atan2(-dx, -dz);
    out.pitch = Math.atan2(target.y + DRONE_CAM.chest - out.y, Math.max(1e-3, h));
  }
  return out;
}

/** Legenda da killcam (a faixa de baixo). */
export function killcamTitle(killer: string, bot: boolean, weapon: string, label: string): { lead: string; name: string; tail: string; sub: string } {
  const name = bot ? `BOT ${killer}` : killer;
  if (killcamFromDrone(weapon)) return { lead: 'MORTO PELO DRONE DE ', name, tail: '', sub: 'pelos olhos do drone hackeado' };
  return { lead: 'MORTO POR ', name, tail: ` · ${label.toUpperCase()}`, sub: 'pelos olhos de quem te otimizou' };
}

const rayDir = { x: 0, y: 0, z: 0 };

/** Parede entre o drone e a câmera: traz a câmera para perto do drone (não atravessa). */
function pullFromWalls(drone: { x: number; y: number; z: number }, cam: CameraView, blockers: readonly Box[]) {
  const dx = cam.x - drone.x, dy = cam.y - drone.y, dz = cam.z - drone.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6 || blockers.length === 0) return;
  rayDir.x = dx / len; rayDir.y = dy / len; rayDir.z = dz / len;
  let near = len + DRONE_CAM.wallGap;
  for (const box of blockers) {
    const t = rayBox(drone, rayDir, box, near);
    if (t !== null && t < near) near = t;
  }
  if (near >= len + DRONE_CAM.wallGap) return;
  const k = Math.max(0, near - DRONE_CAM.wallGap) / len;
  cam.x = drone.x + dx * k; cam.y = drone.y + dy * k; cam.z = drone.z + dz * k;
}
