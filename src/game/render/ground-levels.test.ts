import { describe, expect, it } from 'vitest';
import { groundBelow, groundLevels, NO_LEVEL } from './ground-levels';

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });

describe('pisos da luz pintada', () => {
  // Piso invisível de segurança em y=-1, rua em y=0, laje de 3 m e passarela a 9 m
  const g = groundLevels([
    box(0, -2, 0, 10, -1, 10), box(0, -1, 0, 10, 0, 10), box(5, 0, 0, 10, 3, 10), box(0, 8, 0, 10, 9, 2),
  ])!;

  it('parede na rua usa a rua como pé (não o piso de segurança nem a passarela acima)', () => {
    expect(groundBelow(g, 2, 1, 1)).toBe(0);
  });

  it('parede em cima da laje usa a laje; abaixo do topo dela, volta à rua', () => {
    expect(groundBelow(g, 7, 4, 5)).toBe(3);
    expect(groundBelow(g, 7, 1, 5)).toBe(0);
  });

  it('acima da passarela, ela vira o pé', () => {
    expect(groundBelow(g, 2, 10, 1)).toBe(9);
  });

  it('fora de qualquer caixa não há pé e mapa vazio não monta textura', () => {
    const h = groundLevels([box(0, 0, 0, 1, 1, 1), box(9, 0, 9, 10, 1, 10)])!;
    expect(groundBelow(h, 5, 0, 5)).toBe(NO_LEVEL);
    expect(groundLevels([])).toBeNull();
  });

  it('mapa enorme engrossa a célula em vez de estourar a textura', () => {
    const big = groundLevels([box(-1000, 0, -1000, 1000, 1, 1000)], 0.5, 256)!;
    expect(big.width).toBeLessThanOrEqual(256);
    expect(big.height).toBeLessThanOrEqual(256);
  });
});
