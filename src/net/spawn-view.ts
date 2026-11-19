// Para onde olhar ao nascer (puro): o yaw com a maior linha de visão livre, preferindo o que
// aponta para o centro do mapa (ou outros pontos de interesse). Antes o renascimento olhava
// sempre para o centro e, na Favela, isso dava de cara com a parede do beco.
import type { Box } from '../sim/physics';
import { EYE_HEIGHT } from '../sim/player';
import { raycastBoxes } from '../sim/ray';
import type { Vec3 } from '../sim/vec';

/** Quantas direções testar (a cada 11,25°). */
const STEPS = 32;
/** Visão além disto já basta: não vale trocar o centro por um corredor mais comprido (m). */
const ENOUGH = 28;
/** Raio máximo testado (m). */
const MAX_RAY = 60;
/** Peso de "apontar para o foco" em metros de visão equivalentes. */
const FOCUS_WEIGHT = 10;

/** Direção horizontal do yaw (frente = -z quando yaw = 0, como a câmera). */
export function yawDir(yaw: number): Vec3 {
  return { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
}

/** Distância livre olhando reto na direção `yaw` a partir de `eye` (até `max`). */
export function clearanceAlong(eye: Vec3, yaw: number, blockers: readonly Box[], max = MAX_RAY): number {
  const hit = raycastBoxes(eye, yawDir(yaw), blockers, max);
  return hit ? Math.max(0, hit.t) : max;
}

/**
 * Yaw de nascimento. `at` é o centro do corpo (como os spawns de `NetMap`). Cada direção vale
 * a menor visão entre ela e as duas vizinhas (fresta estreita não conta como rua), limitada a
 * `ENOUGH`, mais um bônus por apontar para o foco mais alinhado.
 */
export function spawnYaw(at: Vec3, blockers: readonly Box[], focus: readonly { x: number; z: number }[] = [{ x: 0, z: 0 }]): number {
  const eye = { x: at.x, y: at.y + EYE_HEIGHT, z: at.z };
  const step = (Math.PI * 2) / STEPS;
  const clear: number[] = [];
  for (let i = 0; i < STEPS; i++) clear.push(clearanceAlong(eye, i * step, blockers));
  const focusDirs = focus
    .map((f) => ({ x: f.x - at.x, z: f.z - at.z }))
    .filter((d) => Math.hypot(d.x, d.z) > 1)
    .map((d) => ({ x: d.x / Math.hypot(d.x, d.z), z: d.z / Math.hypot(d.x, d.z) }));
  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < STEPS; i++) {
    const open = Math.min(clear[i], clear[(i + 1) % STEPS], clear[(i + STEPS - 1) % STEPS]);
    const dir = yawDir(i * step);
    let align = 0;
    for (const f of focusDirs) align = Math.max(align, dir.x * f.x + dir.z * f.z);
    const score = Math.min(open, ENOUGH) + align * FOCUS_WEIGHT;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  const yaw = best * step;
  return yaw > Math.PI ? yaw - Math.PI * 2 : yaw;
}
