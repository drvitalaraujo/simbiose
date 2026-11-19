// Vetor 3D simples (objeto puro, serializável). Sem Three.js: roda no servidor também.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const copy = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });

/** a + b * k */
export const addScaled = (a: Vec3, b: Vec3, k: number): Vec3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);

export function normalize(v: Vec3): Vec3 {
  const l = length(v);
  return l > 0 ? scale(v, 1 / l) : { x: 0, y: 0, z: 0 };
}

export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/**
 * Gira um vetor local da câmera para o mundo, na mesma convenção da câmera do jogo
 * (Euler 'YXZ': primeiro inclina em X pelo `pitch`, depois gira em Y pelo `yaw`).
 * O "para frente" local é (0, 0, -1).
 */
export function fromView(local: Vec3, yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y = local.y * cp - local.z * sp;
  const z1 = local.y * sp + local.z * cp;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return { x: local.x * cy + z1 * sy, y, z: -local.x * sy + z1 * cy };
}

/** Direção para onde se olha com `yaw`/`pitch` (unitária). */
export function forward(yaw: number, pitch: number): Vec3 {
  return fromView({ x: 0, y: 0, z: -1 }, yaw, pitch);
}
