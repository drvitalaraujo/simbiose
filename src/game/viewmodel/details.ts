import { PALETTE as C } from '../toon';
import type { PartList, Vec } from './parts';

// Peças mecânicas reaproveitadas pelas quatro armas (centímetros, osso 0 por padrão).
// Construção original: parafusos sextavados, trilho dentado, respiros, fitas e fios.

const X_AXIS: Vec = [0, 0, Math.PI / 2];
const Z_AXIS: Vec = [Math.PI / 2, 0, 0];

/** Parafuso sextavado saindo da face lateral (x = ±face) com a fenda em tinta. */
export function screw(p: PartList, x: number, y: number, z: number, r = 0.42, bone = 0) {
  const s = Math.sign(x) || 1;
  p.cyl(r, r, 0.22, 6, { at: [x + s * 0.11, y, z], rot: X_AXIS, color: C.steelLight, bone, spin: 0.3 });
  p.box(0.1, r * 1.5, r * 0.32, { at: [x + s * 0.24, y, z], color: C.ink, bone, bevel: 0.02, wear: 0 });
}

/** Trilho dentado (padrão picatinny estilizado) de z0 a z1 no topo `y`. */
export function rail(p: PartList, z0: number, z1: number, y: number, w = 2.4, bone = 0) {
  const d = z1 - z0;
  p.box(w, 0.7, d, { at: [0, y - 0.35, (z0 + z1) / 2], color: C.steel, bone, bevel: 0.15 });
  for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.2) {
    p.box(w + 0.5, 0.5, 0.65, { at: [0, y + 0.2, z], color: C.steel, bone, bevel: 0.08 });
  }
}

/** Respiros retangulares escuros nas duas laterais (face em ±x). */
export function vents(p: PartList, half: number, y: number, zs: number[], h = 1.3, d = 2.2, bone = 0) {
  for (const s of [-1, 1]) for (const z of zs) {
    p.box(0.3, h, d, { at: [s * half, y, z], color: C.ink, bone, bevel: 0.08, wear: 0 });
  }
}

/** Fita/abraçadeira em volta de uma seção retangular (gambiarra). */
export function tape(p: PartList, z: number, y0: number, y1: number, half: number, color: number = C.yellow, width = 1.3, bone = 0) {
  const o = { color, bone, bevel: 0.08, wear: 0.25 };
  p.box(half * 2 + 0.3, 0.3, width, { ...o, at: [0, y1 + 0.1, z] });
  p.box(half * 2 + 0.3, 0.3, width, { ...o, at: [0, y0 - 0.1, z] });
  for (const s of [-1, 1]) p.box(0.3, y1 - y0 + 0.4, width, { ...o, at: [s * (half + 0.12), (y0 + y1) / 2, z] });
}

/** Anel em volta do cano (eixo z, centro y). */
export function band(p: PartList, y: number, z: number, r: number, length: number, color: number, bone = 0, glow = false, sides = 10) {
  p.cyl(r, r, length, sides, { at: [0, y, z], rot: Z_AXIS, color, bone, glow });
}

/** Tubo ao longo de z no eixo do cano. */
export function barrel(p: PartList, y: number, z0: number, z1: number, r: number, color: number = C.steel, bone = 0, sides = 10) {
  p.cyl(r, r, Math.abs(z1 - z0), sides, { at: [0, y, (z0 + z1) / 2], rot: Z_AXIS, color, bone });
}

/** Lâmina de vidro (lote aditivo): reflexo ciano nas bordas, quase transparente no meio. */
export function glass(p: PartList, at: Vec, w: number, h: number, color: number = C.cyan, bone = 0) {
  p.box(w, h, 0.12, { at, color, bone, lens: true, bevel: 0.02 });
}
