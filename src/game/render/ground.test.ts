import { describe, expect, it } from 'vitest';
import type { Box } from '../physics';
import { ARENA1 } from '../maps/arena1';
import { FAVELA } from '../maps/favela';
import { LAPA } from '../maps/lapa';
import { mapSolids } from '../maps/types';
import { blobScale, floorBelow, FloorIndex } from './ground';

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box => ({
  min: { x: x0, y: y0, z: z0 },
  max: { x: x1, y: y1, z: z1 },
});

describe('índice de pisos das sombras', () => {
  it('mantém caixas inclusivas, pisos sobrepostos, tolerância vertical e fallback', () => {
    const solids = [box(-1000, -2, -1000, 1000, -1, 1000), box(-16, -1, -8, 8, 4, 16), box(0, 4, 0, 8, 8, 8)];
    const index = new FloorIndex(solids);
    for (const x of [-1001, -1000, -16.00001, -16, -8, 0, 8, 8.00001, 1000, 1001]) {
      for (const z of [-1000, -8.00001, -8, 0, 8, 16, 16.00001, 1000]) {
        for (const y of [-3, -1.002, -1.001, 0, 3.998, 3.999, 4, 7.999, 8, 12]) {
          const p = { x, y, z };
          expect(index.below(p, 20)).toBe(floorBelow(solids, p, 20));
        }
      }
    }
    expect(new FloorIndex([]).below({ x: 0, y: 2, z: 0 }, -Infinity)).toBe(-Infinity);
  });

  for (const map of [ARENA1, LAPA, FAVELA]) {
    it(`preserva a busca linear em pisos, lajes, bordas e escadas de ${map.name}`, () => {
      const solids = mapSolids(map);
      const index = new FloorIndex(solids);
      for (const b of solids) {
        for (const x of [b.min.x - 0.001, b.min.x, (b.min.x + b.max.x) / 2, b.max.x, b.max.x + 0.001]) {
          for (const z of [b.min.z, (b.min.z + b.max.z) / 2, b.max.z]) {
            for (const y of [b.max.y - 0.01, b.max.y, b.max.y + 0.85, b.max.y + 10]) {
              const p = { x, y, z };
              expect(index.below(p, -Infinity)).toBe(floorBelow(solids, p, -Infinity));
            }
          }
        }
      }
    });
  }
});

describe('sombra-bolha', () => {
  const solids = [box(-50, -1, -50, 50, 0, 50), box(0, 0, 0, 4, 4.5, 4), box(10, 0, 10, 12, 30, 12)];

  it('acha o chão mais alto embaixo do ponto', () => {
    expect(floorBelow(solids, { x: 2, y: 10, z: 2 })).toBe(4.5); // em cima da laje
    expect(floorBelow(solids, { x: -10, y: 10, z: -10 })).toBe(0); // chão
  });

  it('ignora o que está acima do ponto (prédio alto ao lado)', () => {
    expect(floorBelow(solids, { x: 11, y: 10, z: 11 })).toBe(0);
  });

  it('fora de tudo usa o valor padrão', () => {
    expect(floorBelow(solids, { x: 99, y: 5, z: 99 }, -3)).toBe(-3);
  });

  it('bolha encolhe com a altura e some lá no alto', () => {
    expect(blobScale(0, 1)).toBe(1);
    expect(blobScale(7, 1)).toBeCloseTo(0.75);
    expect(blobScale(20, 1)).toBe(0);
  });
});
