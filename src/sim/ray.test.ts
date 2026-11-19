import { describe, expect, it } from 'vitest';
import type { Box } from './physics';
import { lineOfSight, rayBox, raycastBoxes, raySphere } from './ray';
import { createRng } from './rng';

const wall: Box = { min: { x: 4, y: 0, z: -5 }, max: { x: 5, y: 3, z: 5 } };
const pillar: Box = { min: { x: 8, y: 0, z: -1 }, max: { x: 9, y: 3, z: 1 } };
const o = { x: 0, y: 1.5, z: 0 };
const east = { x: 1, y: 0, z: 0 };

describe('raio contra drone esférico', () => {
  it('retorna primeiro contato, aceita origem dentro e erra atrás/lateral', () => {
    expect(raySphere({ x: 0, y: 0, z: 0 }, east, { x: 3, y: 0, z: 0 }, 0.7)).toBeCloseTo(2.3);
    expect(raySphere({ x: 3, y: 0, z: 0 }, east, { x: 3, y: 0, z: 0 }, 0.7)).toBe(0);
    expect(raySphere({ x: 0, y: 0, z: 0 }, east, { x: -3, y: 0, z: 0 }, 0.7)).toBeNull();
    expect(raySphere({ x: 0, y: 0, z: 0 }, east, { x: 3, y: 1, z: 0 }, 0.7)).toBeNull();
  });
});

describe('raio contra AABB', () => {
  it('acerta a face de entrada da caixa', () => {
    expect(rayBox(o, east, wall)).toBeCloseTo(4, 9);
  });

  it('erra quando passa ao lado, por cima ou está de costas', () => {
    expect(rayBox(o, { x: 0, y: 0, z: 1 }, wall)).toBeNull();
    expect(rayBox({ x: 0, y: 4, z: 0 }, east, wall)).toBeNull(); // por cima
    expect(rayBox(o, { x: -1, y: 0, z: 0 }, wall)).toBeNull(); // de costas
  });

  it('respeita o alcance máximo', () => {
    expect(rayBox(o, east, wall, 3.9)).toBeNull();
    expect(rayBox(o, east, wall, 4.1)).toBeCloseTo(4, 9);
  });

  it('começando dentro da caixa acerta em t = 0', () => {
    expect(rayBox({ x: 4.5, y: 1, z: 0 }, east, wall)).toBe(0);
  });

  it('raio inclinado acerta no ponto certo', () => {
    const d = { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 };
    const hit = raycastBoxes(o, d, [wall]);
    expect(hit?.point.x).toBeCloseTo(4, 9);
    expect(hit?.point.z).toBeCloseTo(4, 9);
  });

  it('devolve a caixa mais próxima, qualquer que seja a ordem da lista', () => {
    const hit = raycastBoxes(o, east, [pillar, wall]);
    expect(hit?.index).toBe(1);
    expect(hit?.t).toBeCloseTo(4, 9);
    expect(raycastBoxes(o, { x: 0, y: 1, z: 0 }, [pillar, wall])).toBeNull();
  });

  it('linha de visão: parede bloqueia, caminho livre não', () => {
    expect(lineOfSight(o, { x: 10, y: 1.5, z: 3 }, [wall])).toBe(false);
    expect(lineOfSight(o, { x: 3, y: 1.5, z: 3 }, [wall])).toBe(true);
    expect(lineOfSight(o, { x: 10, y: 6, z: 0 }, [wall])).toBe(true); // por cima do muro
  });
});

describe('rng com semente', () => {
  it('repete a sequência com a mesma semente e fica em [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(createRng(43)()).not.toBe(createRng(42)());
  });
});
