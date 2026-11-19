import type { Box } from '../physics';

// Mapa de pisos para a luz pintada do cenário (render/scene-light.ts): em cada célula do
// plano xz guarda até 4 topos de caixas sólidas que a cobrem (rua, laje, telhado vizinho...),
// os mais altos, em ordem crescente. O shader usa o mais alto que fica abaixo do pixel da
// parede: o "pé" escurece na rua e também em cima da laje. Lógica pura, sem Three.js.

export const LEVELS = 4;
/** Nível vazio: nunca fica abaixo de um pixel (o pé não escurece). */
export const NO_LEVEL = -1e4;

export interface GroundLevels {
  /** Canto mínimo (x, z) e tamanho da célula em metros. */
  x0: number;
  z0: number;
  cell: number;
  width: number;
  height: number;
  /** `LEVELS` alturas por célula (crescentes; vazias = `NO_LEVEL`), linha a linha em z. */
  data: Float32Array;
}

/** Insere `top` nos níveis da célula `k` (mantém os 4 mais altos, sem repetir quase iguais). */
function insert(data: Float32Array, k: number, top: number) {
  const o = k * LEVELS;
  for (let i = 0; i < LEVELS; i++) if (Math.abs(data[o + i] - top) < 0.05) return;
  if (top <= data[o]) return;
  // Substitui o mais baixo e reordena (insertion sort de 4)
  data[o] = top;
  for (let i = 0; i < LEVELS - 1 && data[o + i] > data[o + i + 1]; i++) {
    const t = data[o + i];
    data[o + i] = data[o + i + 1];
    data[o + i + 1] = t;
  }
}

export function groundLevels(solids: readonly Box[], cell = 0.5, maxCells = 512): GroundLevels | null {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const b of solids) {
    minX = Math.min(minX, b.min.x); minZ = Math.min(minZ, b.min.z);
    maxX = Math.max(maxX, b.max.x); maxZ = Math.max(maxZ, b.max.z);
  }
  if (!Number.isFinite(minX)) return null;
  // Mapa grande demais para a célula pedida: engrossa a célula, nunca a textura
  cell = Math.max(cell, (maxX - minX) / maxCells, (maxZ - minZ) / maxCells);
  const width = Math.max(1, Math.ceil((maxX - minX) / cell));
  const height = Math.max(1, Math.ceil((maxZ - minZ) / cell));
  const data = new Float32Array(width * height * LEVELS).fill(NO_LEVEL);
  for (const b of solids) {
    // Células cujo centro cai dentro da caixa
    const i0 = Math.max(0, Math.ceil((b.min.x - minX) / cell - 0.5));
    const i1 = Math.min(width - 1, Math.floor((b.max.x - minX) / cell - 0.5));
    const j0 = Math.max(0, Math.ceil((b.min.z - minZ) / cell - 0.5));
    const j1 = Math.min(height - 1, Math.floor((b.max.z - minZ) / cell - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) insert(data, j * width + i, b.max.y);
  }
  return { x0: minX, z0: minZ, cell, width, height, data };
}

/** Piso logo abaixo do ponto (mesma regra do shader), ou `NO_LEVEL`. */
export function groundBelow(g: GroundLevels, x: number, y: number, z: number): number {
  const i = Math.min(g.width - 1, Math.max(0, Math.floor((x - g.x0) / g.cell)));
  const j = Math.min(g.height - 1, Math.max(0, Math.floor((z - g.z0) / g.cell)));
  let best = NO_LEVEL;
  for (let l = 0; l < LEVELS; l++) {
    const v = g.data[(j * g.width + i) * LEVELS + l];
    if (v <= y + 0.15) best = Math.max(best, v);
  }
  return best;
}
