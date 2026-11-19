import type { Box } from '../../sim/physics';
import { lineOfSight } from '../../sim/ray';
import type { Vec3 } from '../../sim/vec';

/** O impacto na face da parede não fica abafado pela própria extremidade do raio. */
export function soundLineOfSight(from: Vec3, to: Vec3, blockers: readonly Box[]) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (distance < 0.16) return true;
  const margin = 0.06 / distance;
  const end = { x: to.x + (from.x - to.x) * margin, y: to.y + (from.y - to.y) * margin, z: to.z + (from.z - to.z) * margin };
  return lineOfSight(from, end, blockers);
}
