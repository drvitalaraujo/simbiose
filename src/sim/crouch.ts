// Postura autoritativa; posição continua referida ao centro do corpo em pé (pés estáveis).
import { boxFromCenter, overlaps, type Box } from './physics';
import type { Vec3 } from './vec';

export interface CrouchState { crouching: boolean; crouchAmount: number }
export const CROUCH = { halfHeight: 0.575, eyeDrop: 0.55, speed: 3.5, downRate: 18, upRate: 12 } as const;
const STANDING_HALF = { x: 0.35, y: 0.85, z: 0.35 };

export function bodyHalf(amount: number): Vec3 {
  return { ...STANDING_HALF, y: STANDING_HALF.y + (CROUCH.halfHeight - STANDING_HALF.y) * amount };
}

export function updateCrouch(s: CrouchState, pos: Vec3, want: boolean, dt: number, solids: readonly Box[]) {
  const standing = boxFromCenter(pos, STANDING_HALF);
  s.crouching = want || (s.crouchAmount > 0 && solids.some(b => overlaps(standing, b)));
  const target = s.crouching ? 1 : 0;
  const rate = s.crouching ? CROUCH.downRate : CROUCH.upRate;
  s.crouchAmount += (target - s.crouchAmount) * (1 - Math.exp(-rate * dt));
  if (Math.abs(target - s.crouchAmount) < 0.001) s.crouchAmount = target;
}

/** Altura do olho relativa à posição canônica, usada também por hack e chinelo. */
export function eyeOffset(p: { crouchAmount?: number; sliding?: boolean }) {
  return 0.65 - (p.crouchAmount ?? (p.sliding ? 1 : 0)) * CROUCH.eyeDrop;
}
