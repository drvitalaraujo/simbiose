// Regras da partida FFA (puro): limites, tempos e a escolha de um ponto de nascimento seguro.
import type { Box } from '../sim/physics';
import { EYE_HEIGHT } from '../sim/player';
import { lineOfSight } from '../sim/ray';
import type { Rng } from '../sim/rng';
import type { Vec3 } from '../sim/vec';
import { MODE_CONFIG, modeFrom, type MatchMode } from './modes';

export interface MatchRules {
  mode?: MatchMode;
  /** Abates para vencer. */
  killLimit: number;
  /** Duração máxima da partida (s). */
  timeLimit: number;
  /** Tempo morto até renascer (s). */
  respawnDelay: number;
  /** Proteção depois de nascer (s); acaba antes se o jogador atirar. */
  invulnTime: number;
  /** Tela de fim antes de a partida reiniciar sozinha (s). */
  endScreen: number;
}

export const DEFAULT_RULES: Readonly<MatchRules> = {
  killLimit: 25,
  timeLimit: 8 * 60,
  respawnDelay: 3,
  invulnTime: 1.5,
  endScreen: 10,
};

/** Opções da sala vindas da URL (`&abates=10&tempo=3`): só limites, sempre dentro de faixas. */
export function rulesFrom(opts: { abates?: unknown; tempo?: unknown; modo?: unknown } = {}): MatchRules {
  const num = (v: unknown, lo: number, hi: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  return {
    ...DEFAULT_RULES,
    mode: modeFrom(opts.modo),
    killLimit: Math.round(num(opts.abates, 1, modeFrom(opts.modo) === 'hack' ? 500 : 100, MODE_CONFIG[modeFrom(opts.modo)].target)),
    timeLimit: num(opts.tempo, 0.5, 30, DEFAULT_RULES.timeLimit / 60) * 60,
  };
}

/** Yaw que olha de `from` para `to` (frente = -z quando yaw = 0, como a câmera). */
export function yawTowards(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

/** Quem ameaça um ponto de nascimento: olho de um inimigo vivo. */
export interface Threat {
  eye: Vec3;
}

/** Distância a partir da qual um inimigo já não pesa (m). */
const SAFE_DIST = 45;
/** Um inimigo vendo o ponto pesa como estar este tanto mais perto (m). */
const SEEN_PENALTY = 100;
const SIGHT_RANGE = 90;

/**
 * Ponto de nascimento seguro: o mais longe dos inimigos vivos e, acima de tudo, fora da linha
 * de visão deles. Um pouco de sorteio entre os bons evita nascer sempre no mesmo lugar.
 * `spawns` são centros do corpo (pés + 0.86), como em `NetMap`.
 */
export function pickSpawn(spawns: readonly Vec3[], threats: readonly Threat[], solids: readonly Box[], rng: Rng): Vec3 {
  let best = spawns[0];
  let bestScore = -Infinity;
  for (const s of spawns) {
    const eye = { x: s.x, y: s.y + EYE_HEIGHT, z: s.z };
    let near = SAFE_DIST;
    let seen = false;
    for (const t of threats) {
      const d = Math.hypot(t.eye.x - eye.x, t.eye.y - eye.y, t.eye.z - eye.z);
      near = Math.min(near, d);
      if (!seen && d < SIGHT_RANGE && lineOfSight(t.eye, eye, solids)) seen = true;
    }
    const score = near - (seen ? SEEN_PENALTY : 0) + rng() * 4;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}
