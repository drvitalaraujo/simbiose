import { describe, expect, it } from 'vitest';
import { type Box, moveAndCollide, overlaps, sweepAxis } from './physics';

const floor: Box = { min: { x: -10, y: -1, z: -10 }, max: { x: 10, y: 0, z: 10 } };
const wall: Box = { min: { x: 2, y: 0, z: -10 }, max: { x: 3, y: 5, z: 10 } };
const half = { x: 0.4, y: 0.9, z: 0.4 };

describe('physics', () => {
  it('detecta sobreposição só quando as caixas se cruzam', () => {
    expect(overlaps(floor, wall)).toBe(false); // só encostam
    expect(overlaps(floor, { min: { x: 0, y: -0.5, z: 0 }, max: { x: 1, y: 1, z: 1 } })).toBe(true);
  });

  it('para no chão e marca onGround', () => {
    const c = { x: 0, y: 1, z: 0 };
    const r = moveAndCollide(c, half, { x: 0, y: -0.5, z: 0 }, [floor]);
    expect(r.onGround).toBe(true);
    expect(c.y).toBeCloseTo(0.9, 3);
  });

  it('não atravessa parede e desliza no eixo livre', () => {
    const c = { x: 1, y: 0.95, z: 0 };
    moveAndCollide(c, half, { x: 1, y: 0, z: 0.5 }, [floor, wall]);
    expect(c.x).toBeLessThanOrEqual(2 - half.x);
    expect(c.z).toBeCloseTo(0.5, 5);
  });

  it('sobe degrau baixo, mas não parede alta', () => {
    const step: Box = { min: { x: 1, y: 0, z: -5 }, max: { x: 3, y: 0.35, z: 5 } };
    const c = { x: 0.5, y: 0.9 + 1e-4, z: 0 };
    moveAndCollide(c, half, { x: 0.3, y: 0, z: 0 }, [floor, step], 0.45);
    expect(c.x).toBeCloseTo(0.8, 5);
    expect(c.y).toBeCloseTo(0.35 + 0.9, 3);

    const c2 = { x: 1, y: 0.9 + 1e-4, z: 0 };
    moveAndCollide(c2, half, { x: 0.3, y: 0, z: 0 }, [floor, wall], 0.45);
    expect(c2.x).toBeLessThanOrEqual(2 - half.x);
  });

  it('marca teto ao subir contra uma caixa', () => {
    const ceiling: Box = { min: { x: -5, y: 2, z: -5 }, max: { x: 5, y: 3, z: 5 } };
    const c = { x: 0, y: 1, z: 0 };
    const r = moveAndCollide(c, half, { x: 0, y: 0.5, z: 0 }, [ceiling]);
    expect(r.hitCeiling).toBe(true);
    expect(c.y).toBeCloseTo(2 - half.y, 3);
  });

  it('com duas caixas sobrepostas, para na mais próxima (não na última da lista)', () => {
    const near: Box = { min: { x: 1, y: 0, z: -5 }, max: { x: 1.5, y: 3, z: 5 } };
    const far: Box = { min: { x: 1.8, y: 0, z: -5 }, max: { x: 3, y: 3, z: 5 } };
    const c = { x: 0, y: 1, z: 0 };
    // passo grande: depois de mover, o jogador cruza as duas caixas
    expect(sweepAxis(c, half, 'x', 1.5, [near, far])).toBe(true);
    expect(c.x).toBeCloseTo(1 - half.x, 3);

    const c2 = { x: 4, y: 1, z: 0 };
    expect(sweepAxis(c2, half, 'x', -2.2, [far, near])).toBe(true);
    expect(c2.x).toBeCloseTo(3 + half.x, 3);
  });
});
