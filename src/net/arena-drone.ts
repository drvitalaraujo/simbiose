// Drone da OTIMIZA na Arena (FFA): evento recorrente e autoritativo no servidor. Puro (sem
// Three.js, sem Colyseus, sem Math.random): aparece numa zona, quem segurar E mirando nele
// por 2 s ganha um aliado por 12 s que segue o dono e atira em inimigos visíveis; qualquer
// outro jogador pode derrubá-lo. Pilar 2 do GDD: "Hackear muda a luta".
import { poseOf, resolveShot, type ShotTarget } from './combat';
import { type DroneEventMsg, type ShotMsg, WEAPON_DRONE } from './feed';
import type { PropTarget } from './gun-combat';
import { droneSpot, type DroneStore, HACK_RULES, type HackDrone, inHackReach } from './hack-objectives';
import type { NetMap } from './maps';
import type { SimPlayer } from './modes-arena-types';
import type { Box } from '../sim/physics';
import { lineOfSight } from '../sim/ray';
import { createRng, type Rng } from '../sim/rng';
import { normalize, type Vec3 } from '../sim/vec';
import { MK2 } from '../sim/weapons';

export const DRONE_ID = 'otimiza';
export const DRONE_KIND = 'otimiza';

export const ARENA_DRONE = {
  /** Primeiro drone: segundos depois do início da partida. */
  firstDelay: 30,
  /** Próximo drone: segundos depois que o anterior sumiu. */
  cycle: 45,
  /** Livre por tempo demais: a OTIMIZA recolhe (não fica preso num canto para sempre). */
  freeLife: 50,
  /** Aliado do dono por este tempo. */
  allyLife: 12,
  /** Animação de "voltar para a OTIMIZA" (sobe e some). */
  leaveTime: 1.5,
  hp: 80,
  /** Cadência e dano do tiro do aliado (sem multiplicador de cabeça). */
  fireEvery: 0.45,
  damage: 9,
  /** Alcance da mira do aliado e da marcação de inimigos. */
  sight: 30,
  markRange: 25,
  /** Erro de mira do drone (rad, sorteado pelo rng secreto). */
  spread: 0.03,
  /** Meia aresta da caixa atingível. */
  half: 0.45,
} as const;

/** O que o drone precisa saber de um jogador (o `NetPlayer` do schema serve). */
export type DronePlayer = Pick<SimPlayer, 'x' | 'y' | 'z' | 'yaw' | 'pitch' | 'vx' | 'vz' | 'hp' | 'name' | 'invuln' | 'crouchAmount' | 'sliding'>;

export interface PlayerLookup {
  get(id: string): DronePlayer | undefined;
  [Symbol.iterator](): IterableIterator<[string, DronePlayer]>;
}

export interface ArenaDroneHooks {
  /** Cria o objeto do estado (no servidor, `new NetHackDrone`). */
  create?: (d: HackDrone) => HackDrone;
  /** Aplica um tiro do drone (dano, morte e crédito ficam com a ArenaSim). */
  shot(msg: ShotMsg, damage: number): void;
  /** Passo do ciclo para anúncio e efeitos. */
  event(msg: DroneEventMsg): void;
}

const CHEST = 0.3;
const FOLLOW_RATE = 8;
const LEAVE_SPEED = 7;

/** Caixa atingível do drone. */
export function droneBox(d: Vec3): Box {
  const h = ARENA_DRONE.half;
  return { min: { x: d.x - h, y: d.y - h, z: d.z - h }, max: { x: d.x + h, y: d.y + h, z: d.z + h } };
}

const overlaps = (p: Vec3, solids: readonly Box[], r = 0.3) =>
  solids.some(b => b.min.x < p.x + r && b.max.x > p.x - r && b.min.y < p.y + r && b.max.y > p.y - r && b.min.z < p.z + r && b.max.z > p.z - r);

/** Onde o drone aliado quer ficar: acima do ombro direito; sem espaço, acima da cabeça. */
export function shoulderSpot(owner: Pick<DronePlayer, 'x' | 'y' | 'z' | 'yaw'>, solids: readonly Box[]): Vec3 {
  const rx = Math.cos(owner.yaw), rz = -Math.sin(owner.yaw);
  const fx = -Math.sin(owner.yaw), fz = -Math.cos(owner.yaw);
  for (const p of [
    { x: owner.x + rx * 0.75 - fx * 0.35, y: owner.y + 1.35, z: owner.z + rz * 0.75 - fz * 0.35 },
    { x: owner.x, y: owner.y + 1.3, z: owner.z },
  ]) if (!overlaps(p, solids)) return p;
  return { x: owner.x, y: owner.y + 0.6, z: owner.z };
}

/** Inimigos marcados para o dono: vivos a até 25 m do drone aliado (vê através de paredes). */
export function markedEnemies(drone: Vec3 & { phase?: string; owner?: string }, players: Iterable<[string, { x: number; y: number; z: number; hp: number }]>): string[] {
  if (drone.phase !== 'ally' || !drone.owner) return [];
  const out: string[] = [];
  for (const [id, p] of players) {
    if (id === drone.owner || p.hp <= 0) continue;
    if (Math.hypot(p.x - drone.x, p.y - drone.y, p.z - drone.z) <= ARENA_DRONE.markRange) out.push(id);
  }
  return out;
}

export class ArenaDrone {
  private wait: number = ARENA_DRONE.firstDelay;
  private readonly held = new Map<string, boolean>();
  private hackerHp = 0;
  private fireTimer = 0;
  private lastZone = -1;
  private rng: Rng | null = null;

  constructor(
    private readonly map: NetMap,
    private readonly store: DroneStore,
    /** Semente do rng secreto (lida só quando o primeiro drone aparece). */
    private readonly seed: () => number,
    private readonly hooks: ArenaDroneHooks,
  ) {}

  get drone(): HackDrone | undefined {
    const d = this.store.get(DRONE_ID);
    return d?.kind === DRONE_KIND ? d : undefined;
  }

  /** Segundos até o próximo drone (sem drone ativo). */
  get nextIn(): number { return this.drone ? 0 : this.wait; }

  input(id: string, held: boolean) { this.held.set(id, held); }
  leave(id: string) { this.held.delete(id); }

  /** Partida nova: some com o drone e recomeça a contagem dos 30 s. */
  reset() {
    this.held.clear();
    if (this.drone) this.store.delete?.(DRONE_ID);
    this.wait = ARENA_DRONE.firstDelay;
  }

  /** Teste (só com SIMBIOSE_DEBUG): o próximo drone aparece no próximo tick. */
  skipWait() { if (!this.drone) this.wait = 0; }

  /** Drone livre como objetivo de UM bot (o vivo mais perto); os outros seguem lutando. */
  botObjective(players: Iterable<[string, { x: number; z: number; hp: number; bot: boolean }]>): { id: string; at: Vec3 } | null {
    const d = this.drone;
    if (!d || d.phase !== 'free') return null;
    let best: { id: string; at: Vec3 } | null = null, bestDist = Infinity;
    for (const [id, p] of players) {
      const dist = Math.hypot(p.x - d.x, p.z - d.z);
      if (p.bot && p.hp > 0 && dist < bestDist) { best = { id, at: { x: d.x, y: d.y, z: d.z } }; bestDist = dist; }
    }
    return best;
  }

  /** Caixa atingível para o tiro de `shooter` (o dono não acerta o próprio drone). */
  props(shooter: string): PropTarget[] {
    const d = this.drone;
    if (!d || d.phase === 'leaving' || d.owner === shooter) return [];
    return [{ id: DRONE_ID, box: droneBox(d) }];
  }

  /** Tiro no drone; devolve true se derrubou. */
  damage(by: string, byName: string, amount: number): boolean {
    const d = this.drone;
    if (!d || d.phase === 'leaving' || d.owner === by || amount <= 0) return false;
    d.hp = Math.max(0, (d.hp ?? 0) - amount);
    if (d.hp > 0) return false;
    this.hooks.event({ kind: 'down', zone: d.zone ?? '', x: d.x, y: d.y, z: d.z, by, byName, ...(d.owner ? { owner: d.owner } : {}) });
    this.remove();
    return true;
  }

  tick(dt: number, players: PlayerLookup, blockers: readonly Box[]) {
    const d = this.drone;
    if (!d) {
      this.wait -= dt;
      if (this.wait <= 1e-9) this.spawn();
      return;
    }
    d.timer = Math.max(0, (d.timer ?? 0) - dt);
    if (d.phase === 'free') {
      this.channel(dt, d, players, blockers);
      if (d.phase === 'free' && d.timer <= 0) this.depart(d);
    } else if (d.phase === 'ally') {
      const owner = players.get(d.owner ?? '');
      if (!owner || owner.hp <= 0 || d.timer <= 0) { this.depart(d); return; }
      const want = shoulderSpot(owner, blockers);
      const k = Math.min(1, dt * FOLLOW_RATE);
      const next = { x: d.x + (want.x - d.x) * k, y: d.y + (want.y - d.y) * k, z: d.z + (want.z - d.z) * k };
      Object.assign(d, overlaps(next, blockers) ? want : next);
      this.fight(dt, d, players, blockers);
    } else {
      d.y += LEAVE_SPEED * dt;
      if (d.timer <= 0) this.remove();
    }
  }

  private spawn() {
    this.rng ??= createRng(Math.floor(this.seed() * 0x100000000) >>> 0);
    const zones = this.map.data?.zones ?? [];
    const places = zones.length
      ? zones.map(z => ({ name: z.name, x: (z.rect.x0 + z.rect.x1) / 2, z: (z.rect.z0 + z.rect.z1) / 2 }))
      : [{ name: 'centro', x: 0, z: 8 }, { name: 'lado oeste', x: -10, z: 0 }, { name: 'lado leste', x: 10, z: 0 }];
    let i = Math.floor(this.rng() * places.length);
    if (places.length > 1 && i === this.lastZone) i = (i + 1 + Math.floor(this.rng() * (places.length - 1))) % places.length;
    this.lastZone = i;
    const at = droneSpot(this.map, places[i]);
    const init: HackDrone = {
      ...at, team: '', hackerId: '', progress: 0, contested: false,
      kind: DRONE_KIND, phase: 'free', owner: '', hp: ARENA_DRONE.hp, timer: ARENA_DRONE.freeLife, target: '', zone: places[i].name,
    };
    this.store.set(DRONE_ID, this.hooks.create ? this.hooks.create(init) : init);
    this.hackerHp = 0;
    this.hooks.event({ kind: 'spawn', zone: places[i].name, ...at });
  }

  /** Canalização: um só canalizando avança; dois ou mais = contestado (pausa); dano zera. */
  private channel(dt: number, d: HackDrone, players: PlayerLookup, blockers: readonly Box[]) {
    const contenders: [string, DronePlayer][] = [];
    for (const [id, p] of players) if (this.held.get(id) && inHackReach(p, d, blockers)) contenders.push([id, p]);
    const hacker = d.hackerId ? players.get(d.hackerId) : undefined;
    if (hacker && hacker.hp < this.hackerHp - 1e-9) { d.hackerId = ''; d.progress = 0; } // levou dano: interrompe
    d.contested = contenders.length > 1;
    if (d.contested) { if (hacker) this.hackerHp = hacker.hp; return; }
    const current = contenders[0];
    if (!current) { d.hackerId = ''; d.progress = 0; return; }
    if (d.hackerId !== current[0]) { d.hackerId = current[0]; d.progress = 0; }
    this.hackerHp = current[1].hp;
    d.progress = Math.min(1, d.progress + dt / HACK_RULES.channel);
    if (d.progress < 1 - 1e-9) return;
    Object.assign(d, { phase: 'ally', owner: current[0], hackerId: '', progress: 0, contested: false, hp: ARENA_DRONE.hp, timer: ARENA_DRONE.allyLife, target: '' });
    this.fireTimer = ARENA_DRONE.fireEvery * 0.5;
    this.held.clear();
    this.hooks.event({ kind: 'hacked', zone: d.zone ?? '', x: d.x, y: d.y, z: d.z, owner: current[0], ownerName: current[1].name });
  }

  /** Mira o inimigo visível mais perto (linha de visão pelos sólidos de tiro) e atira. */
  private fight(dt: number, d: HackDrone, players: PlayerLookup, blockers: readonly Box[]) {
    let best: { id: string; aim: Vec3; dist: number } | null = null;
    const targets: ShotTarget[] = [];
    for (const [id, p] of players) {
      if (id === d.owner || p.hp <= 0) continue;
      targets.push({ id, pose: poseOf(p) });
      if (p.invuln) continue;
      const aim = { x: p.x, y: p.y + CHEST - (p.crouchAmount ?? 0) * 0.4, z: p.z };
      const dist = Math.hypot(aim.x - d.x, aim.y - d.y, aim.z - d.z);
      if (dist > ARENA_DRONE.sight || (best && dist >= best.dist) || !lineOfSight(d, aim, blockers)) continue;
      best = { id, aim, dist };
    }
    d.target = best?.id ?? '';
    this.fireTimer -= dt;
    if (!best || this.fireTimer > 1e-9) return;
    this.fireTimer = ARENA_DRONE.fireEvery;
    const rng = this.rng!;
    const base = normalize({ x: best.aim.x - d.x, y: best.aim.y - d.y, z: best.aim.z - d.z });
    const s = ARENA_DRONE.spread;
    const dir = normalize({ x: base.x + (rng() - 0.5) * 2 * s, y: base.y + (rng() - 0.5) * 2 * s, z: base.z + (rng() - 0.5) * 2 * s });
    const origin = { x: d.x, y: d.y, z: d.z };
    const r = resolveShot(origin, dir, blockers, targets, MK2, ARENA_DRONE.sight + 5);
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const msg: ShotMsg = {
      by: d.owner ?? '', seq: -1, o: [round(d.x), round(d.y), round(d.z)], e: [round(r.end.x), round(r.end.y), round(r.end.z)], weapon: WEAPON_DRONE,
      ...(r.wall ? { w: true } : {}),
      ...(r.hit ? { t: r.hit.id, part: r.hit.part } : {}),
    };
    this.hooks.shot(msg, r.hit ? ARENA_DRONE.damage : 0);
  }

  private depart(d: HackDrone) {
    this.hooks.event({ kind: 'leave', zone: d.zone ?? '', x: d.x, y: d.y, z: d.z, ...(d.owner ? { owner: d.owner } : {}) });
    Object.assign(d, { phase: 'leaving', timer: ARENA_DRONE.leaveTime, hackerId: '', progress: 0, contested: false, target: '' });
  }

  private remove() {
    this.store.delete?.(DRONE_ID);
    this.wait = ARENA_DRONE.cycle;
    this.hackerHp = 0;
  }
}
