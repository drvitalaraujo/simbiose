import { describe, expect, it } from 'vitest';
import { buildHitboxes, DAMAGE_MULTIPLIER, raycastBody, rayCapsule, type HitboxState } from './hitbox';

// Alvo parado na origem, olhando para +Z (yaw = π) — de frente para quem está em z = 10.
const standing: HitboxState = { pos: { x: 0, y: 0, z: 0 }, yaw: Math.PI, crouch: 0 };
const crouched: HitboxState = { ...standing, crouch: 1 };
const fromFront = (y: number, x = 0) => ({ origin: { x, y, z: 10 }, dir: { x: 0, y: 0, z: -1 } });

describe('hitbox', () => {
  it('tiro na altura do rosto acerta a cabeça', () => {
    const { origin, dir } = fromFront(1.66);
    const hit = raycastBody(origin, dir, standing);
    expect(hit?.part).toBe('head');
    expect(hit!.t).toBeGreaterThan(9.5);
    expect(hit!.t).toBeLessThan(10);
  });

  it('tiro no peito acerta o tronco; na coxa, as pernas', () => {
    expect(raycastBody(fromFront(1.2).origin, fromFront(1.2).dir, standing)?.part).toBe('torso');
    expect(raycastBody(fromFront(0.5).origin, fromFront(0.5).dir, standing)?.part).toBe('legs');
  });

  it('tiro ao lado ou por cima erra', () => {
    expect(raycastBody(fromFront(1.2, 0.6).origin, fromFront(1.2, 0.6).dir, standing)).toBeNull();
    expect(raycastBody(fromFront(2.0).origin, fromFront(2.0).dir, standing)).toBeNull();
  });

  it('agachado: a cabeça desce e o tiro que era na cabeça passa por cima', () => {
    expect(raycastBody(fromFront(1.66).origin, fromFront(1.66).dir, crouched)).toBeNull();
    const head = buildHitboxes(crouched).find((c) => c.part === 'head')!;
    const hit = raycastBody({ x: 0, y: head.a.y, z: 10 }, { x: 0, y: 0, z: -1 }, crouched);
    expect(hit?.part).toBe('head');
  });

  it('acompanha posição e yaw do jogador', () => {
    const moved: HitboxState = { pos: { x: 5, y: 2, z: -3 }, yaw: 0.7, crouch: 0 };
    const hit = raycastBody({ x: 5, y: 2 + 1.2, z: 20 }, { x: 0, y: 0, z: -1 }, moved);
    expect(hit?.part).toBe('torso');
    // a cabeça fica um pouco à frente (para onde o jogador olha)
    const head = buildHitboxes(moved).find((c) => c.part === 'head')!;
    expect(head.a.x).toBeLessThan(5); // frente = (-sin yaw, 0, -cos yaw)
  });

  it('correndo, a cabeça vai para frente (como a animação)', () => {
    const still = buildHitboxes(standing).find((c) => c.part === 'head')!;
    const running = buildHitboxes({ ...standing, speed: 7 }).find((c) => c.part === 'head')!;
    // olhando para +Z: frente = +Z
    expect(running.a.z - still.a.z).toBeGreaterThan(0.2);
    expect(running.a.y).toBeLessThan(still.a.y);
  });

  it('respeita o alcance máximo (parede na frente)', () => {
    const { origin, dir } = fromFront(1.66);
    expect(raycastBody(origin, dir, standing, 5)).toBeNull();
  });

  it('tiro de cima para baixo pega a cabeça antes do tronco', () => {
    const hit = raycastBody({ x: 0, y: 10, z: 0.02 }, { x: 0, y: -1, z: 0 }, standing);
    expect(hit?.part).toBe('head');
  });

  it('raio que começa dentro da cápsula dá t = 0 e raio de costas erra', () => {
    const cap = { part: 'torso' as const, a: { x: 0, y: 1, z: 0 }, b: { x: 0, y: 1.4, z: 0 }, radius: 0.2 };
    expect(rayCapsule({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 0, z: 1 }, cap)).toBe(0);
    expect(rayCapsule({ x: 0, y: 1.2, z: 3 }, { x: 0, y: 0, z: 1 }, cap)).toBeNull();
    expect(rayCapsule({ x: 0, y: 1.2, z: 3 }, { x: 0, y: 0, z: -1 }, cap)).toBeCloseTo(2.8);
  });

  it('cabeça vale mais que corpo, que vale mais que perna', () => {
    expect(DAMAGE_MULTIPLIER.head).toBeGreaterThan(DAMAGE_MULTIPLIER.torso);
    expect(DAMAGE_MULTIPLIER.torso).toBeGreaterThan(DAMAGE_MULTIPLIER.legs);
  });
});
