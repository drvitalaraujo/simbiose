// A marca usa só a superfície já atingida: não faz raycast nas malhas do cenário.
import type { Box } from '../sim/physics';
import type { Vec3 } from '../sim/vec';
import { raycastBoxes } from '../sim/ray';

const AXES = ['x', 'y', 'z'] as const;
const EPSILON = 0.002; // a rede arredonda posições para milímetros

export interface ImpactSurface {
  normal: Vec3;
  radius: number;
}

/** Normal de entrada e raio que cabe inteiro na face (não vaza na quina). */
export function impactSurface(point: Vec3, direction: Vec3, boxes: readonly Box[], radius = 0.065): ImpactSurface | null {
  let best: ImpactSurface | null = null;
  let alignment = 0;
  for (const box of boxes) {
    if (AXES.some(a => point[a] < box.min[a] - EPSILON || point[a] > box.max[a] + EPSILON)) continue;
    for (const axis of AXES) {
      const sign = direction[axis] > 0 ? -1 : 1;
      const face = sign < 0 ? box.min[axis] : box.max[axis];
      if (Math.abs(point[axis] - face) > EPSILON || Math.abs(direction[axis]) <= alignment) continue;
      const tangent = AXES.filter(a => a !== axis);
      const margin = Math.min(...tangent.flatMap(a => [point[a] - box.min[a], box.max[a] - point[a]]));
      const normal = { x: 0, y: 0, z: 0 };
      normal[axis] = sign;
      best = { normal, radius: Math.min(radius, Math.max(0, margin) / Math.SQRT2) };
      alignment = Math.abs(direction[axis]);
    }
  }
  return best;
}

/** Ajuste local até o acabamento visível, sem alterar onde a simulação parou o tiro. */
export function visibleImpact(point: Vec3, surface: ImpactSurface, boxes: readonly Box[]): { point: Vec3; surface: ImpactSurface } {
  const n = surface.normal;
  const origin = { x: point.x + n.x * 0.3, y: point.y + n.y * 0.3, z: point.z + n.z * 0.3 };
  const direction = { x: -n.x, y: -n.y, z: -n.z };
  const hit = raycastBoxes(origin, direction, boxes, 0.302);
  if (!hit || hit.t <= EPSILON) return { point, surface };
  const visual = impactSurface(hit.point, direction, [boxes[hit.index]], surface.radius);
  return visual ? { point: hit.point, surface: visual } : { point, surface };
}
