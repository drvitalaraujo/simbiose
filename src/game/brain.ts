// Decisões dos drones e regras das ondas. Lógica pura (sem Three.js), testada em brain.test.ts.
import type { Vec3 } from './physics';

export const DRONE_SPEED = 6;

/**
 * Velocidade desejada de um drone em combate: mantém distância preferida do jogador,
 * circula em volta dele (sentido definido por `orbitSign`) e paira acima da cabeça.
 */
export function steer(
  drone: Vec3, player: Vec3, time: number, orbitSign: number, prefDist = 10, height = 2.5, speed = DRONE_SPEED,
): Vec3 {
  const dx = player.x - drone.x;
  const dz = player.z - drone.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  const nx = dx / dist;
  const nz = dz / dist;

  const radial = clamp((dist - prefDist) * 0.8, -1, 1); // >0 aproxima, <0 afasta
  const orbit = 0.55 * orbitSign;
  let vx = nx * radial - nz * orbit;
  let vz = nz * radial + nx * orbit;

  const targetY = player.y + height + Math.sin(time * 1.3) * 0.8;
  let vy = clamp((targetY - drone.y) * 0.8, -1, 1);

  const len = Math.hypot(vx, vy, vz);
  if (len > 1) {
    vx /= len;
    vy /= len;
    vz /= len;
  }
  return { x: vx * speed, y: vy * speed, z: vz * speed };
}

// --- Movimento "vivo" dos drones: inércia, deriva e curvas suaves ---

/** Aproxima `vel` de `desired` com aceleração limitada: curvas em arco em vez de quinas. */
export function accelerate(vel: Vec3, desired: Vec3, maxAccel: number, dt: number): Vec3 {
  const dx = desired.x - vel.x;
  const dy = desired.y - vel.y;
  const dz = desired.z - vel.z;
  const d = Math.hypot(dx, dy, dz);
  const step = maxAccel * dt;
  if (d <= step) return { ...desired };
  const k = step / d;
  return { x: vel.x + dx * k, y: vel.y + dy * k, z: vel.z + dz * k };
}

/** Deriva suave e determinística (soma de senos), módulo até ~1: tira o ar robótico. */
export function wander(time: number, phase: number): Vec3 {
  return {
    x: Math.sin(time * 0.9 + phase) * 0.6 + Math.sin(time * 2.3 + phase * 1.7) * 0.4,
    y: Math.sin(time * 1.4 + phase * 0.5) * 0.5,
    z: Math.cos(time * 0.8 + phase * 1.3) * 0.6 + Math.sin(time * 1.9 + phase * 0.3) * 0.4,
  };
}

/** Gira um ângulo em direção ao alvo pelo caminho mais curto, com velocidade máxima. */
export function turnToward(angle: number, target: number, maxRate: number, dt: number): number {
  let diff = (target - angle) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  const step = maxRate * dt;
  return Math.abs(diff) <= step ? target : angle + Math.sign(diff) * step;
}

/** Posição de escolta do aliado `slot` (0..2) atrás/ao lado do jogador, que olha para `yaw`. */
export function escortSlot(slot: number, yaw: number): Vec3 {
  const offsets = [{ s: -3.2, b: 1.8, h: 2.2 }, { s: 3.2, b: 1.8, h: 2.2 }, { s: 0, b: 3.4, h: 3.4 }];
  const o = offsets[slot % offsets.length];
  // frente do jogador = (-sin yaw, -cos yaw); direita = (cos yaw, -sin yaw)
  return {
    x: Math.cos(yaw) * o.s + Math.sin(yaw) * o.b,
    y: o.h,
    z: -Math.sin(yaw) * o.s + Math.cos(yaw) * o.b,
  };
}

/** Quantos drones aparecem na onda `n` (começa em 1). */
export function waveSize(n: number): number {
  return Math.min(1 + 2 * n, 15);
}

/** A cada 5 ondas, o Gerente de Felicidade aparece. */
export function isBossWave(n: number): boolean {
  return n > 0 && n % 5 === 0;
}

/** Chance de um drone da onda `n` ser um "Abraço Grátis" (kamikaze). Começa na onda 2. */
export function huggerChance(n: number): number {
  return n < 2 ? 0 : Math.min(0.45, 0.2 + 0.05 * (n - 2));
}

/** Intervalo médio entre tiros de cada drone na onda `n`: fica mais agressivo, com limite. */
export function fireInterval(n: number): number {
  return Math.max(1, 2.8 - 0.25 * (n - 1));
}

// --- Hack (verbo-assinatura do GDD) ---

export const HACK_RANGE = 35;
export const HACK_TIME = 0.7; // segundos segurando para converter
export const MAX_ALLIES = 3;
/** Cone de mira para o hack (radianos): generoso, para ser fácil de jogar. */
export const HACK_CONE = 0.14;

export type Team = 'enemy' | 'ally';

/** Só drone inimigo "em pane" (1 de vida) e perto o bastante pode ser hackeado. */
export function hackable(hp: number, team: Team, dist: number): boolean {
  return team === 'enemy' && hp === 1 && dist <= HACK_RANGE;
}

/**
 * Avança o progresso do hack. Segurar no alvo enche; trocar de alvo zera; soltar esvazia
 * rápido (não zera de uma vez, para perdoar um tremido na mira).
 */
export function hackProgress(progress: number, dt: number, holding: boolean, sameTarget: boolean): number {
  if (!holding) return Math.max(0, progress - dt * 3);
  if (!sameTarget) return 0;
  return Math.min(1, progress + dt / HACK_TIME);
}

/** Índices dos aliados que estouram por sobrecarga quando o limite é ultrapassado (mais antigos primeiro). */
export function overloadedAllies(allyCount: number): number {
  return Math.max(0, allyCount - MAX_ALLIES);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
