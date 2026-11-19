import type { Vec3 } from '../../sim/vec';

/** Convergência visual no centro da tela; não altera o raio nem o alcance do tiro. */
export const HIP_AIM_DISTANCE = 12;

/**
 * Alinha o eixo -z do cano (x=0, y=boreHeight) ao ponto de mira.
 * Compensa a altura do cano e a inclinação lateral antes de resolver yaw/pitch.
 * A ordem YXZ é a mesma da raiz do viewmodel; o comprimento da arma não interfere.
 */
export function hipAimRotation(position: Vec3, boreHeight: number, roll: number) {
  const dx = -position.x;
  const dy = -position.y;
  const dz = -HIP_AIM_DISTANCE - position.z;
  const horizontal = Math.hypot(dx, dz);
  const boreX = -boreHeight * Math.sin(roll);
  const boreY = boreHeight * Math.cos(roll);
  const depth = Math.sqrt(horizontal * horizontal - boreX * boreX);
  return {
    x: Math.atan2(dy, depth) - Math.asin(boreY / Math.hypot(dy, depth)),
    y: Math.atan2(-dx, -dz) + Math.asin(boreX / horizontal),
    z: roll,
  };
}
