import type { Box } from '../sim/physics';
import { eyeOffset } from '../sim/crouch';
import { lineOfSight } from '../sim/ray';
import { forward } from '../sim/vec';
import type { Team } from './modes';
import type { NetMap } from './maps';
import { TICK } from '../sim/clock';

export const HACK_RULES = { range: 4, channel: 2, pointInterval: 1, aimCos: 0.8 } as const;
export interface HackDrone {
  x: number; y: number; z: number;
  team: Team;
  hackerId: string;
  progress: number;
  contested: boolean;
  /** Só no drone da OTIMIZA na Arena (src/net/arena-drone.ts); vazio nos drones-objetivo. */
  kind?: string;
  /** 'free' | 'ally' | 'leaving'. */
  phase?: string;
  owner?: string;
  hp?: number;
  /** Segundos que faltam na fase atual. */
  timer?: number;
  /** Quem o drone aliado está mirando agora (laser). */
  target?: string;
  zone?: string;
}
export interface HackPlayer {
  x: number; y: number; z: number; yaw: number; pitch: number; hp: number;
  team?: Team;
  crouchAmount?: number;
}
export interface DroneStore {
  get(id: string): HackDrone | undefined;
  set(id: string, d: HackDrone): unknown;
  [Symbol.iterator](): IterableIterator<[string, HackDrone]>;
  /** Drone da Arena some ao fim do ciclo (Map e MapSchema têm). */
  delete?(id: string): unknown;
}

/** Ponto livre ~1,8 m acima de piso alcançável perto de `center` (drones-objetivo e o da Arena). */
export function droneSpot(map: NetMap, center: { x: number; z: number }) {
  let at = center, floor = 0;
  for (const [dx, dz] of [[0, 0], [4, 4], [-4, -4], [4, -4], [-4, 4]]) {
    at = { x: center.x + dx, z: center.z + dz };
    const floors = map.data?.solids.filter(s => ['ground', 'stairs', 'terrace', 'platform'].includes(s.kind) && s.box.min.x <= at.x && s.box.max.x >= at.x && s.box.min.z <= at.z && s.box.max.z >= at.z);
    floor = Math.max(0, ...(floors ?? []).map(s => s.box.max.y));
    if (!map.solids.some(b => b.min.x < at.x + 0.4 && b.max.x > at.x - 0.4 && b.min.z < at.z + 0.4 && b.max.z > at.z - 0.4 && b.min.y < floor + 1.8 && b.max.y > floor + 0.1)) break;
  }
  return { x: at.x, y: floor + 1.8, z: at.z };
}

export function seedHackDrones(map: NetMap, store: DroneStore, create: (d: HackDrone) => HackDrone) {
  const zones = map.data?.zones.filter(z => z.site || z.id === 'mid');
  const locations = zones?.map(z => ({ x: (z.rect.x0 + z.rect.x1) / 2, z: (z.rect.z0 + z.rect.z1) / 2 })) ?? [{ x: -10, z: 0 }, { x: 0, z: 8 }, { x: 10, z: 0 }];
  for (const [i, center] of locations.entries()) {
    store.set(`drone-${i + 1}`, create({ ...droneSpot(map, center), team: '', hackerId: '', progress: 0, contested: false }));
  }
}

/** Geometria do hack: vivo, a até 4 m, mirando (cone) e com linha de visão. Sem regra de time. */
export function inHackReach(p: HackPlayer, d: { x: number; y: number; z: number }, blockers: readonly Box[]): boolean {
  if (p.hp <= 0) return false;
  const eye = { x: p.x, y: p.y + eyeOffset(p), z: p.z };
  const dx = d.x - eye.x, dy = d.y - eye.y, dz = d.z - eye.z;
  const distance = Math.hypot(dx, dy, dz);
  const aim = forward(p.yaw, p.pitch);
  return distance <= HACK_RULES.range && (distance < 0.01 || (dx * aim.x + dy * aim.y + dz * aim.z) / distance >= HACK_RULES.aimCos) && lineOfSight(eye, d, blockers);
}

/** Canalização autoritativa, sem dt do cliente: comandos só declaram que E está pressionado. */
export class HackObjectives {
  private held = new Map<string, boolean>();
  private scoring = 0;
  constructor(readonly drones: DroneStore, private readonly blockers: readonly Box[]) {}

  input(id: string, held: boolean) { this.held.set(id, held); }
  leave(id: string) { this.held.delete(id); }
  reset() {
    this.held.clear(); this.scoring = 0;
    for (const [, d] of this.drones) Object.assign(d, { team: '', hackerId: '', progress: 0, contested: false });
  }

  canHack(p: HackPlayer, d: HackDrone): boolean {
    if (p.hp <= 0 || !p.team || p.team === d.team) return false;
    return inHackReach(p, d, this.blockers);
  }

  tick(dt: number, players: Iterable<[string, HackPlayer]>, award: (team: Team, points: number) => void) {
    dt = Number.isFinite(dt) ? Math.min(TICK, Math.max(0, dt)) : 0;
    const candidates = new Map<string, [string, HackPlayer][]>();
    // Cada jogador canaliza um único drone: o mais próximo que está na mira.
    for (const [id, p] of players) {
      if (!this.held.get(id)) continue;
      let nearest: [string, HackDrone] | undefined, best = Infinity;
      for (const entry of this.drones) {
        if (!this.canHack(p, entry[1])) continue;
        const distance = Math.hypot(p.x - entry[1].x, p.y - entry[1].y, p.z - entry[1].z);
        if (distance < best) { nearest = entry; best = distance; }
      }
      if (nearest) {
        const list = candidates.get(nearest[0]) ?? [];
        list.push([id, p]); candidates.set(nearest[0], list);
      }
    }
    for (const [id, d] of this.drones) {
      const contenders = candidates.get(id) ?? [];
      d.contested = new Set(contenders.map(([, p]) => p.team)).size > 1;
      const current = contenders.find(([pid]) => pid === d.hackerId) ?? contenders[0];
      if (!current || d.contested) { d.hackerId = ''; d.progress = 0; continue; }
      if (d.hackerId !== current[0]) { d.hackerId = current[0]; d.progress = 0; }
      d.progress = Math.min(1, d.progress + dt / HACK_RULES.channel);
      if (d.progress >= 1 - 1e-9) { d.team = current[1].team!; d.hackerId = ''; d.progress = 0; }
    }
    this.scoring += dt;
    while (this.scoring >= HACK_RULES.pointInterval - 1e-9) {
      this.scoring -= HACK_RULES.pointInterval;
      for (const [, d] of this.drones) if (d.team && !d.contested) award(d.team, 1);
    }
  }
}
