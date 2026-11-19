import type { Box, Vec3 } from '../physics';

// Lógica pura da sombra-bolha (ver blobs.ts): onde fica o chão embaixo de um ponto e de que
// tamanho a bolha fica conforme a altura.

/** Altura do topo do sólido mais alto embaixo de `p` (ou `fallback` se não houver nenhum). */
export function floorBelow(solids: readonly Box[], p: Vec3, fallback = 0): number {
  let best = -Infinity;
  for (const b of solids) {
    if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z) continue;
    const top = b.max.y;
    if (top <= p.y + 1e-3 && top > best) best = top;
  }
  return best === -Infinity ? fallback : best;
}

const CELL = 8;
const MAX_CELLS_PER_BOX = 64;
const EMPTY: readonly Box[] = [];

/** Índice exato dos pisos estáticos. Células filtram candidatos; as caixas decidem o piso. */
export class FloorIndex {
  private readonly columns = new Map<number, Map<number, Box[]>>();
  private readonly broad: Box[] = [];

  constructor(solids: readonly Box[]) {
    for (const b of solids) {
      const x0 = Math.floor(b.min.x / CELL), x1 = Math.floor(b.max.x / CELL);
      const z0 = Math.floor(b.min.z / CELL), z1 = Math.floor(b.max.z / CELL);
      // Chão e limites grandes ficam numa lista curta, sem duplicar milhares de referências.
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > MAX_CELLS_PER_BOX) {
        this.broad.push(b);
        continue;
      }
      for (let x = x0; x <= x1; x++) {
        let column = this.columns.get(x);
        if (!column) this.columns.set(x, column = new Map());
        for (let z = z0; z <= z1; z++) {
          let bucket = column.get(z);
          if (!bucket) column.set(z, bucket = []);
          bucket.push(b);
        }
      }
    }
  }

  below(p: Vec3, fallback = 0): number {
    const local = this.columns.get(Math.floor(p.x / CELL))?.get(Math.floor(p.z / CELL)) ?? EMPTY;
    const best = Math.max(floorBelow(local, p, -Infinity), floorBelow(this.broad, p, -Infinity));
    return best === -Infinity ? fallback : best;
  }
}

/** Bolha encolhe com a altura e some em `maxH` (0 = escondida). */
export function blobScale(height: number, radius: number, maxH = 14): number {
  if (height >= maxH) return 0;
  const t = Math.max(0, height / maxH);
  return radius * (1 - 0.5 * t);
}
