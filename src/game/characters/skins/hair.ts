import { PALETTE as C } from '../../toon';
import { SURFACE } from '../shading';
import type { Kit, Vec } from './kit';

/** Mecha pontuda (perfil fino) pendurada a partir de `at`, girada em graus. */
function lock(k: Kit, at: Vec, rot: Vec, len: number, width: number, depth = 0.018): void {
  k.panel('DEF-head', [[-width / 2, 0], [width / 2, 0], [width * 0.18, -len * 0.75], [-width * 0.05, -len], [-width * 0.32, -len * 0.55]],
    depth, at, C.inkSoft, { rot, outline: 0.25 });
}

/** Todas as peças de cabelo usam a resposta de cabelo (faixa de brilho anime). */
function hair(k: Kit, build: () => void): void {
  k.surface = SURFACE.hair;
  build();
  k.surface = null;
}

/** Massas de cabelo sobrepostas; o corte desenha a silhueta sem caixas ortogonais. */
export function bobHair(k: Kit): void {
  hair(k, () => {
    k.ball('DEF-head', 0.13, [0, 1.765, -0.005], C.inkSoft, { half: true, segs: 12, scale: [0.84, 0.56, 0.94], outline: 0.3 });
    k.ball('DEF-head', 0.112, [0, 1.695, -0.09], C.inkSoft, { segs: 10, scale: [0.92, 0.9, 0.32], outline: 0.3 });
    // Lateral longa e franja varrida; ponta cortada afasta o cabelo da bochecha.
    k.panel('DEF-head', [[-0.025, 0.09], [0.024, 0.068], [0.03, -0.035], [0.002, -0.102], [-0.026, -0.067]],
      0.13, [-0.084, 1.688, -0.017], C.inkSoft, { rot: [0, 0, -5], outline: 0.35 });
    k.panel('DEF-head', [[-0.082, 0.008], [-0.032, 0.055], [0.075, 0.035], [0.03, -0.01], [-0.053, -0.048]],
      0.027, [-0.012, 1.759, 0.094], C.inkSoft, { outline: 0 });
    k.panel('DEF-head', [[-0.02, 0.035], [0.016, 0.014], [0.022, -0.039], [0, -0.051], [-0.015, -0.018]],
      0.11, [0.089, 1.741, -0.024], C.inkSoft, { outline: 0.25 });
    // Uma mecha iluminada larga, sem fios individuais nem custo de textura.
    k.panel('DEF-head', [[-0.024, -0.028], [-0.004, 0.025], [0.035, 0.035], [0.017, 0.016]],
      0.003, [-0.038, 1.764, 0.11], C.asphalt, { outline: 0 });
    // Pontas do chanel: mechas em volta da nuca e das laterais, franja em três pontas
    for (const s of [1, -1]) {
      lock(k, [s * 0.098, 1.66, 0.02], [0, s * 80, s * 6], 0.07, 0.05);
      lock(k, [s * 0.1, 1.66, -0.035], [0, s * 95, s * 10], 0.075, 0.05);
      lock(k, [s * 0.075, 1.67, -0.085], [-12, s * 140, s * 8], 0.075, 0.055);
    }
    lock(k, [0, 1.675, -0.105], [-14, 180, 0], 0.07, 0.06);
    for (const [x, r, len] of [[-0.05, -12, 0.06], [-0.012, 6, 0.072], [0.03, 16, 0.055]] as const) {
      lock(k, [x, 1.775, 0.1], [-18, 0, r], len, 0.04, 0.012);
    }
  });
  k.cyl('DEF-head', 0.024, 0.012, [0.106, 1.745, 0.035], C.cyan, { axis: 'x', segs: 3, rot: [90, 0, 0], outline: 0 });
}

export function tousledHair(k: Kit): void {
  hair(k, () => {
    k.ball('DEF-head', 0.105, [0, 1.761, -0.024], C.inkSoft, { half: true, segs: 10, scale: [1, 0.65, 1.06], outline: 0.3 });
    // Três massas principais, com bases largas conectadas à calota.
    k.cyl('DEF-head', 0.076, 0.145, [0.01, 1.825, -0.04], C.inkSoft, { top: 0.008, segs: 5, rot: [-62, 20, 8], outline: 0.3 });
    k.cyl('DEF-head', 0.065, 0.125, [-0.06, 1.805, -0.02], C.inkSoft, { top: 0.004, segs: 5, rot: [-30, 0, 55], outline: 0.3 });
    k.cyl('DEF-head', 0.061, 0.115, [0.065, 1.81, -0.05], C.inkSoft, { top: 0.004, segs: 5, rot: [-45, 0, -50], outline: 0.3 });
    k.panel('DEF-head', [[-0.055, 0.012], [-0.018, 0.041], [0.041, 0.03], [0.02, -0.018], [-0.013, -0.054], [-0.012, -0.002]],
      0.025, [0.002, 1.773, 0.091], C.inkSoft, { outline: 0 });
    k.panel('DEF-head', [[-0.045, 0.006], [-0.018, 0.023], [0.024, 0.027], [-0.006, 0.007]],
      0.003, [-0.01, 1.786, 0.106], C.asphalt, { outline: 0 });
    // Pontas extras: nuca espetada e duas mechas caindo sobre a bandana
    for (const s of [1, -1]) lock(k, [s * 0.06, 1.72, -0.095], [-150, s * 25, 0], 0.07, 0.045);
    lock(k, [-0.035, 1.79, 0.09], [-30, 0, -20], 0.06, 0.03, 0.012);
    lock(k, [0.045, 1.785, 0.085], [-30, 0, 25], 0.05, 0.028, 0.012);
  });
}

export function croppedHair(k: Kit): void {
  hair(k, () => {
    k.ball('DEF-head', 0.112, [0, 1.757, -0.017], C.inkSoft, { half: true, segs: 12, scale: [0.87, 0.64, 1.04], outline: 0.3 });
    k.panel('DEF-head', [[-0.079, 0.001], [-0.065, 0.025], [0.064, 0.026], [0.077, 0.002], [0.035, -0.006], [-0.029, -0.003]],
      0.014, [0, 1.746, 0.08], C.inkSoft, { outline: 0 });
    // Topete penteado para trás: crista e três sulcos claros
    k.ball('DEF-head', 0.07, [0, 1.8, 0.03], C.inkSoft, { half: true, segs: 8, scale: [0.9, 0.7, 1.4], outline: 0.25 });
    for (const x of [-0.035, 0, 0.035]) k.box('DEF-head', [0.006, 0.004, 0.11], [x, 1.828 - Math.abs(x) * 0.4, 0.0], C.asphalt, { rot: [-8, 0, 0], outline: 0 });
  });
}
