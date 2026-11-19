// Colisão simples por caixas alinhadas aos eixos (AABB). Sem dependência do Three.js,
// para poder ser testada isoladamente e rodar no servidor.
import type { Vec3 } from './vec';

export type { Vec3 } from './vec';

export interface Box {
  min: Vec3;
  max: Vec3;
}

export type Axis = 'x' | 'y' | 'z';

const SKIN = 1e-4;

export function boxFromCenter(center: Vec3, half: Vec3): Box {
  return {
    min: { x: center.x - half.x, y: center.y - half.y, z: center.z - half.z },
    max: { x: center.x + half.x, y: center.y + half.y, z: center.z + half.z },
  };
}

export function overlaps(a: Box, b: Box): boolean {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  );
}

/**
 * Move `center` por `delta` em um eixo e empurra para fora das caixas. Retorna se colidiu.
 * Com várias caixas sobrepostas, para na face mais próxima no sentido do movimento
 * (antes parava na última da lista e podia atravessar a mais próxima).
 */
export function sweepAxis(center: Vec3, half: Vec3, axis: Axis, delta: number, solids: Box[]): boolean {
  if (delta === 0) return false;
  center[axis] += delta;
  const moved = boxFromCenter(center, half);
  let stop = delta > 0 ? Infinity : -Infinity;
  for (const s of solids) {
    if (!overlaps(moved, s)) continue;
    stop = delta > 0 ? Math.min(stop, s.min[axis]) : Math.max(stop, s.max[axis]);
  }
  if (!Number.isFinite(stop)) return false;
  center[axis] = delta > 0 ? stop - half[axis] - SKIN : stop + half[axis] + SKIN;
  return true;
}

export interface MoveResult {
  onGround: boolean;
  hitCeiling: boolean;
}

function blocked(center: Vec3, half: Vec3, solids: Box[]): boolean {
  const box = boxFromCenter(center, half);
  return solids.some((s) => overlaps(box, s));
}

/** Movimento horizontal que sobe degraus de até `stepHeight` em vez de travar neles. */
function sweepWithStep(center: Vec3, half: Vec3, axis: Axis, delta: number, solids: Box[], stepHeight: number) {
  const before = { ...center };
  if (!sweepAxis(center, half, axis, delta, solids) || stepHeight <= 0) return;
  const lifted = { ...before, y: before.y + stepHeight };
  if (blocked(lifted, half, solids)) return;
  lifted[axis] += delta;
  if (blocked(lifted, half, solids)) return;
  sweepAxis(lifted, half, 'y', -stepHeight, solids); // assenta no degrau
  Object.assign(center, lifted);
}

/** Move eixo por eixo (x, z, y) para o personagem deslizar nas paredes. */
export function moveAndCollide(center: Vec3, half: Vec3, motion: Vec3, solids: Box[], stepHeight = 0): MoveResult {
  sweepWithStep(center, half, 'x', motion.x, solids, stepHeight);
  sweepWithStep(center, half, 'z', motion.z, solids, stepHeight);
  const hitY = sweepAxis(center, half, 'y', motion.y, solids);
  return { onGround: hitY && motion.y < 0, hitCeiling: hitY && motion.y > 0 };
}
