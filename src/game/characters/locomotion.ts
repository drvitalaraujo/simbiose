// Decisões de animação de locomoção, em lógica pura (sem Three.js), para poder testar.
// O boneco recebe só o que o servidor vai mandar de cada jogador: velocidade, yaw, se está
// no chão, agachado ou morto. Daqui sai qual pose usar, o peso de cada passada e quanto as
// pernas giram em relação à mira (correr de lado/de costas com uma animação só de frente).

export type Pose = 'idle' | 'move' | 'crouchIdle' | 'crouchMove' | 'air' | 'dead';

export interface LocoInput {
  vx: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  crouch: boolean;
  dead: boolean;
}

/** Abaixo disso (m/s) o boneco é considerado parado. */
export const MOVE_EPS = 0.35;

export function classify(i: LocoInput): Pose {
  if (i.dead) return 'dead';
  if (!i.grounded) return 'air';
  const moving = Math.hypot(i.vx, i.vz) > MOVE_EPS;
  if (i.crouch) return moving ? 'crouchMove' : 'crouchIdle';
  return moving ? 'move' : 'idle';
}

/** Máximo que as pernas giram em relação ao tronco (o resto o tronco compensa). */
export const MAX_LEG_TWIST = Math.PI / 2;

/**
 * Ângulo do movimento relativo à mira e como tocar a passada:
 *  - frente/diagonal da frente: anima para frente, pernas giradas até ±90°;
 *  - trás/diagonal de trás: anima de trás para frente (`reverse`) com as pernas giradas
 *    para o lado oposto, assim o pé nunca "patina" para o lado errado.
 * `twist` > 0 gira as pernas para a esquerda (sentido anti-horário visto de cima).
 */
export function legTwist(vx: number, vz: number, yaw: number): { twist: number; reverse: boolean } {
  if (Math.hypot(vx, vz) <= MOVE_EPS) return { twist: 0, reverse: false };
  // yaw do próprio movimento, na mesma convenção da câmera (frente = -Z)
  const moveYaw = Math.atan2(-vx, -vz);
  const rel = wrap(moveYaw - yaw);
  // Exatamente de lado (±90°) prefere frente; passou disso, vai de costas.
  if (Math.abs(rel) <= MAX_LEG_TWIST + 1e-6) return { twist: rel, reverse: false };
  return { twist: wrap(rel - Math.PI), reverse: true };
}

/** Velocidade (m/s) em que cada passada do Quaternius UAL não patina, medida a olho. */
export const GAIT_SPEED = { walk: 1.7, jog: 4.2, sprint: 7.0, crouch: 1.6 } as const;

/** Pesos de andar/trotar/correr para uma velocidade (somam 1), interpolando entre vizinhos. */
export function gaitWeights(speed: number): { walk: number; jog: number; sprint: number } {
  const { walk, jog, sprint } = GAIT_SPEED;
  if (speed <= walk) return { walk: 1, jog: 0, sprint: 0 };
  if (speed <= jog) {
    const k = (speed - walk) / (jog - walk);
    return { walk: 1 - k, jog: k, sprint: 0 };
  }
  if (speed <= sprint) {
    const k = (speed - jog) / (sprint - jog);
    return { walk: 0, jog: 1 - k, sprint: k };
  }
  return { walk: 0, jog: 0, sprint: 1 };
}

/** Ângulo em (-π, π]. */
export function wrap(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}
