import { PALETTE } from '../../toon';
import type { Kit } from './kit';

// Peças repetidas entre as skins. Medidas em metros, pose de descanso do manequim
// (cabeça de y 1,55 a 1,83 e frente do rosto em z ≈ 0,11).

/** Sola grossa (o tênis/bota fica "pesado" na silhueta). */
export function soles(k: Kit, color: number, height = 0.035): void {
  for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
    k.bevel(`DEF-foot${side}`, [0.135, height, 0.25], [s * 0.1, height / 2, 0.005], color, { outline: 0.4 });
    k.bevel(`DEF-toe${side}`, [0.135, height, 0.09], [s * 0.1, height / 2, 0.175], color, { outline: 0.4 });
  }
}

/** Cano da bota/tênis: anel um pouco mais largo que a canela. */
export function bootCuffs(k: Kit, color: number, radius = 0.068, y = 0.19): void {
  for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
    k.cyl(`DEF-shin${side}`, radius, 0.08, [s * 0.095, y, -0.035], color, { segs: 8 });
  }
}

/** Placa no dorso de cada mão (a palma do manequim fica para baixo na T-pose). */
export function glovePlates(k: Kit, color: number): void {
  for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
    k.bevel(`DEF-hand${side}`, [0.07, 0.014, 0.06], [s * 0.795, 1.462, -0.07], color, { outline: 0.12 });
  }
}

/** Joelheiras chanfradas na frente do joelho. */
export function kneePads(k: Kit, color: number): void {
  for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
    k.bevel(`DEF-shin${side}`, [0.108, 0.118, 0.036], [s * 0.095, 0.5, 0.045], PALETTE.polymer, { rot: [-6, 0, 0], outline: 0.3 });
    k.bevel(`DEF-shin${side}`, [0.091, 0.098, 0.019], [s * 0.095, 0.504, 0.067], color, { rot: [-6, 0, 0], outline: 0 });
  }
}

/** Emblema na manga esquerda (lado de fora do ombro, visível de perfil e na mira). */
export function sleeveBadge(k: Kit, faction: 'resistencia' | 'sorridentes'): void {
  const at = [0.27, 1.512, -0.06] as const;
  if (faction === 'resistencia') {
    // Resistência: disco amarelo com raio de tinta (o "estalo" que corta o sinal da IA)
    k.cyl('DEF-upper_armL', 0.036, 0.006, at, PALETTE.ink, { segs: 10, outline: 0.15 });
    k.cyl('DEF-upper_armL', 0.03, 0.006, [at[0], at[1] + 0.002, at[2]], PALETTE.yellow, { segs: 10, outline: 0 });
    k.panel('DEF-upper_armL', [[-0.004, 0.022], [0.012, 0.022], [0.002, 0.003], [0.011, 0.003], [-0.008, -0.024], [-0.002, -0.004], [-0.012, -0.004]],
      0.004, [at[0], at[1] + 0.006, at[2]], PALETTE.ink, { rot: [-90, 0, 90], outline: 0 });
  } else {
    // Sorridentes: disco branco com o sorriso rosa
    k.cyl('DEF-upper_armL', 0.036, 0.006, at, PALETTE.polymer, { segs: 10, outline: 0.15 });
    k.cyl('DEF-upper_armL', 0.03, 0.006, [at[0], at[1] + 0.002, at[2]], PALETTE.paper, { segs: 10, outline: 0 });
    k.arc('DEF-upper_armL', 0.016, 0.0035, Math.PI, [at[0], at[1] + 0.006, at[2] + 0.003], PALETTE.pink, { rot: [-90, 0, 0], glow: 1.2, outline: 0 });
  }
}

/** Coldre na coxa direita com a coronha da pistola e duas tiras. */
export function thighHolster(k: Kit, strap: number): void {
  k.bevel('DEF-thighR', [0.04, 0.17, 0.085], [-0.176, 0.79, 0.0], PALETTE.polymer, { rot: [0, 0, -4], outline: 0.25 });
  k.bevel('DEF-thighR', [0.03, 0.06, 0.035], [-0.18, 0.89, 0.02], PALETTE.inkSoft, { rot: [-15, 0, -4], outline: 0.2 });
  for (const y of [0.74, 0.83]) k.cyl('DEF-thighR', 0.083, 0.018, [-0.1, y, -0.03], strap, { segs: 8, outline: 0.1 });
}

/** Bolsas pequenas no cinto, nas costas e nos lados. */
export function beltPouches(k: Kit, color: number, flap: number): void {
  for (const [x, z, r] of [[0.13, -0.08, 30], [-0.13, -0.08, -30], [0.0, -0.115, 0]] as const) {
    k.bevel('DEF-hips', [0.07, 0.065, 0.04], [x, 1.03, z], color, { rot: [0, r, 0], outline: 0.25 });
    k.box('DEF-hips', [0.072, 0.018, 0.043], [x, 1.058, z], flap, { rot: [0, r, 0], outline: 0 });
  }
}
