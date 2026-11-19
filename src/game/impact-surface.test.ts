import { expect, it } from 'vitest';
import { impactSurface, visibleImpact } from './impact-surface';

const box = { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } };

it('orienta marcas para fora nas seis faces, incluindo piso e teto', () => {
  for (const axis of ['x', 'y', 'z'] as const) for (const sign of [-1, 1]) {
    const point = { x: 0, y: 1, z: 0 }; point[axis] = sign < 0 ? box.min[axis] : box.max[axis];
    const direction = { x: 0, y: 0, z: 0 }; direction[axis] = -sign;
    const hit = impactSurface(point, direction, [box])!;
    expect(hit.normal[axis]).toBe(sign);
    expect(hit.radius).toBe(0.065);
  }
});

it('tolera a quantização da rede e reduz a marca para caber na quina', () => {
  const hit = impactSurface({ x: 0.98, y: 1, z: 1.0005 }, { x: 0.2, y: 0, z: -1 }, [box])!;
  expect(hit.normal).toEqual({ x: 0, y: 0, z: 1 });
  expect(hit.radius * Math.SQRT2).toBeCloseTo(0.02);
});

it('não marca alcance máximo, pontos internos nem faces de saída', () => {
  expect(impactSurface({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, [box])).toBeNull();
  expect(impactSurface({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, [box])).toBeNull();
  expect(impactSurface({ x: 0, y: 1, z: 1 }, { x: 0, y: 0, z: 1 }, [box])).toBeNull();
});

it('cola no reboco e no piso decorativo sem aceitar superfícies distantes', () => {
  const point = { x: 0, y: 1, z: 1 }, direction = { x: 0, y: 0, z: -1 };
  const surface = impactSurface(point, direction, [box])!;
  const plaster = { min: { x: -1, y: 0, z: 1 }, max: { x: 1, y: 2, z: 1.03 } };
  expect(visibleImpact(point, surface, [plaster]).point.z).toBeCloseTo(1.03);
  const distant = { min: { x: -1, y: 0, z: 2 }, max: { x: 1, y: 2, z: 2.03 } };
  expect(visibleImpact(point, surface, [distant]).point).toEqual(point);
  const floor = { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 0.02, z: 1 } };
  expect(visibleImpact({ x: 0, y: 0, z: 0 }, { normal: { x: 0, y: 1, z: 0 }, radius: 0.06 }, [floor]).point.y).toBeCloseTo(0.02);
});
