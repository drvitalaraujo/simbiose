// Raio contra caixas AABB (método das "placas"/slabs). Puro, sem Three.js: é o que o
// servidor vai usar para tiro e linha de visão. Muito mais barato que o Raycaster nas
// malhas mescladas do mundo.
import type { Box } from './physics';
import type { Vec3 } from './vec';

const AXES = ['x', 'y', 'z'] as const;

export interface RayHit {
  /** Distância ao longo do raio (o raio tem direção unitária). */
  t: number;
  point: Vec3;
  /** Índice da caixa atingida em `boxes`. */
  index: number;
}

/** Raio unitário contra esfera (drones do treino e outros alvos simples). */
export function raySphere(origin: Vec3, dir: Vec3, center: Vec3, radius: number): number | null {
  const x = origin.x - center.x, y = origin.y - center.y, z = origin.z - center.z;
  const c = x * x + y * y + z * z - radius * radius;
  if (c <= 0) return 0;
  const b = x * dir.x + y * dir.y + z * dir.z;
  const h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : null;
}

/**
 * Distância até a entrada do raio na caixa, ou `null` se não acerta dentro de [0, far].
 * Raio começando dentro da caixa acerta em t = 0.
 */
export function rayBox(origin: Vec3, dir: Vec3, box: Box, far = Infinity, padding = 0): number | null {
  let tmin = 0;
  let tmax = far;
  for (const a of AXES) {
    const o = origin[a];
    const d = dir[a];
    const lo = box.min[a] - padding;
    const hi = box.max[a] + padding;
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return null; // paralelo e fora da placa
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Caixa mais próxima atingida pelo raio (direção unitária) até `far`. */
export function raycastBoxes(origin: Vec3, dir: Vec3, boxes: readonly Box[], far = Infinity, padding = 0): RayHit | null {
  let best = far;
  let index = -1;
  for (let i = 0; i < boxes.length; i++) {
    const t = rayBox(origin, dir, boxes[i], best, padding);
    if (t !== null && t < best) {
      best = t;
      index = i;
    }
  }
  if (index < 0) return null;
  return {
    t: best,
    index,
    point: { x: origin.x + dir.x * best, y: origin.y + dir.y * best, z: origin.z + dir.z * best },
  };
}

/** Linha de visão livre entre dois pontos (nenhuma caixa no caminho). */
export function lineOfSight(from: Vec3, to: Vec3, boxes: readonly Box[]): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-9) return true;
  const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
  for (const b of boxes) if (rayBox(from, dir, b, dist) !== null) return false;
  return true;
}
