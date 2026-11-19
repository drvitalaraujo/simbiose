// Câmeras do espectador (puro, sem Three.js): voo livre, 3ª pessoa atrás do ombro com
// colisão contra os sólidos AABB, 1ª pessoa e a suavização entre planos.
// Convenção da câmera do jogo: yaw 0 olha para -z; pitch positivo olha para cima.
import type { Box } from '../../sim/physics';
import { raycastBoxes } from '../../sim/ray';
import type { Vec3 } from '../../sim/vec';

export type CameraMode = 'free' | 'chase' | 'eyes' | 'director';

export interface CamPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Entrada do voo livre: -1..1 em cada eixo (direita, cima, frente). */
export interface FlyInput {
  right: number;
  up: number;
  forward: number;
  fast: boolean;
}

export const FLY_SPEED = 9;
export const FLY_FAST = 26;
export const PITCH_MAX = 1.45;
/** 3ª pessoa: distância atrás, altura e ombro (m). */
export const CHASE = { back: 3.4, up: 0.55, shoulder: 0.55, pad: 0.3 } as const;

export function lookDir(yaw: number, pitch: number): Vec3 {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

/** Um passo do voo livre: anda para onde olha (Q/E sobem e descem no eixo do mundo). */
export function stepFree(cam: CamPose, input: FlyInput, dt: number): CamPose {
  const speed = (input.fast ? FLY_FAST : FLY_SPEED) * dt;
  const f = lookDir(cam.yaw, cam.pitch);
  const r = { x: Math.cos(cam.yaw), z: -Math.sin(cam.yaw) };
  const len = Math.hypot(input.right, input.up, input.forward) || 1;
  const k = speed / Math.max(1, len);
  return {
    ...cam,
    x: cam.x + (f.x * input.forward + r.x * input.right) * k,
    y: cam.y + (f.y * input.forward + input.up) * k,
    z: cam.z + (f.z * input.forward + r.z * input.right) * k,
  };
}

/** Gira a câmera livre (arrastar o mouse), com o pitch preso. */
export function turn(cam: CamPose, dYaw: number, dPitch: number): CamPose {
  return { ...cam, yaw: cam.yaw + dYaw, pitch: Math.max(-PITCH_MAX, Math.min(PITCH_MAX, cam.pitch + dPitch)) };
}

/**
 * 3ª pessoa: atrás do ombro de quem é seguido, olhando para onde ele mira. Se houver
 * parede entre o olho dele e a câmera, a câmera chega mais perto (nunca atravessa).
 */
export function chasePose(eye: Vec3, yaw: number, pitch: number, solids: readonly Box[]): CamPose {
  const p = pitch * 0.6;
  const f = lookDir(yaw, p);
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const want = {
    x: -f.x * CHASE.back + right.x * CHASE.shoulder,
    y: -f.y * CHASE.back + CHASE.up,
    z: -f.z * CHASE.back + right.z * CHASE.shoulder,
  };
  const dist = Math.hypot(want.x, want.y, want.z);
  const dir = { x: want.x / dist, y: want.y / dist, z: want.z / dist };
  const hit = raycastBoxes(eye, dir, solids, dist + CHASE.pad);
  const t = hit ? Math.max(0.2, hit.t - CHASE.pad) : dist;
  return { x: eye.x + dir.x * t, y: eye.y + dir.y * t, z: eye.z + dir.z * t, yaw, pitch: p };
}

/** Ângulo mais curto de `a` até `b`. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Aproxima `from` de `to` sem depender do quadro (`rate` maior = mais rápido). */
export function smoothPose(from: CamPose, to: CamPose, dt: number, rate: number): CamPose {
  const k = 1 - Math.exp(-rate * dt);
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    z: from.z + (to.z - from.z) * k,
    yaw: from.yaw + angleDelta(from.yaw, to.yaw) * k,
    pitch: from.pitch + (to.pitch - from.pitch) * k,
  };
}

/** Distância entre dois planos: corte seco se longe (troca de jogador), suave se perto. */
export function poseDistance(a: CamPose, b: CamPose): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
