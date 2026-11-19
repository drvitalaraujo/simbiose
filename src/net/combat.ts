// Acerto do tiro no servidor (puro, sem Three.js): raio contra o mundo (AABB, src/sim/ray)
// e contra as hitboxes de dados (characters/hitbox.ts) dos outros jogadores, na pose que o
// atirador VIA (o rewind escolhe a pose; aqui só a geometria). Dano por parte do corpo.
import { type HitboxState, type HitPart, raycastBody } from '../game/characters/hitbox';
import type { Box } from '../sim/physics';
import { PLAYER_HALF } from '../sim/player';
import { raycastBoxes } from '../sim/ray';
import { addScaled, type Vec3 } from '../sim/vec';
import { RANGE } from '../sim/weapon';
import { MK2, weaponDamage, type WeaponSpec } from '../sim/weapons';

/**
 * Dano de um acerto: a hitbox só diz a parte; multiplicador e queda por distância são da
 * arma (src/sim/weapons.ts). MK-2 é o padrão para chamadas antigas.
 */
export function damageFor(part: HitPart, distance: number, weapon: WeaponSpec = MK2): number {
  return weaponDamage(weapon, part, distance);
}

/** O que a hitbox precisa de um jogador (centro do corpo, como no estado da sim). */
export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  sliding?: boolean;
  crouchAmount?: number;
}

export function poseOf(p: Pose): Pose {
  return { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, vx: p.vx, vz: p.vz, sliding: !!p.sliding, crouchAmount: p.crouchAmount };
}

/** Pose da sim (centro da caixa) → estado da hitbox (pés no chão). */
export function hitboxState(p: Pose): HitboxState {
  return {
    pos: { x: p.x, y: p.y - PLAYER_HALF.y, z: p.z },
    yaw: p.yaw,
    crouch: p.crouchAmount ?? (p.sliding ? 1 : 0),
    pitch: p.pitch,
    speed: Math.hypot(p.vx, p.vz),
  };
}

export interface ShotTarget {
  id: string;
  pose: Pose;
}

export interface ShotHit {
  id: string;
  part: HitPart;
  t: number;
  point: Vec3;
  damage: number;
}

export interface ShotResolution {
  /** Onde o tiro parou (parede, alvo ou alcance). */
  end: Vec3;
  /** Parou numa parede (sem alvo antes dela). */
  wall: boolean;
  hit: ShotHit | null;
}

/** Primeiro alvo atingido antes da parede mais próxima (quem está atrás da parede não leva). */
export function resolveShot(origin: Vec3, dir: Vec3, solids: readonly Box[], targets: readonly ShotTarget[], weapon: WeaponSpec = MK2, range = RANGE): ShotResolution {
  const wall = raycastBoxes(origin, dir, solids, range);
  const far = wall ? wall.t : range;
  let hit: ShotHit | null = null;
  for (const tg of targets) {
    const h = raycastBody(origin, dir, hitboxState(tg.pose), hit ? hit.t : far);
    if (h && (!hit || h.t < hit.t)) hit = { id: tg.id, part: h.part, t: h.t, point: h.point, damage: damageFor(h.part, h.t, weapon) };
  }
  if (hit) return { end: hit.point, wall: false, hit };
  return { end: addScaled(origin, dir, far), wall: !!wall, hit: null };
}

/** Soma os projéteis por alvo antes do dano; um disparo conta no máximo um abate por alvo. */
export function groupVolleyHits(resolutions: readonly ShotResolution[]): ShotHit[] {
  const hits = new Map<string, ShotHit>();
  for (const { hit } of resolutions) {
    if (!hit) continue;
    const previous = hits.get(hit.id);
    const representative = previous?.part === 'head' ? previous : hit;
    hits.set(hit.id, { ...representative, damage: (previous?.damage ?? 0) + hit.damage });
  }
  return [...hits.values()];
}
