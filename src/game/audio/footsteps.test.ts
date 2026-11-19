import { expect, it } from 'vitest';
import { Footsteps, type FootMotion } from './footsteps';

const motion = (x = 0): FootMotion => ({ position: { x, y: 0.85, z: 0 }, grounded: true, sliding: false, crouch: 0, alive: true, vy: 0 });

it('passos seguem deslocamento, sem som parado, agachado, deslizando ou no ar', () => {
  const feet = new Footsteps();
  expect(feet.update('a', motion())).toBeNull();
  for (let i = 0; i < 60; i++) expect(feet.update('a', motion())).toBeNull();
  expect(feet.update('a', motion(2.2))?.kind).toBe('step');
  for (const patch of [{ walking: true }, { crouch: 1 }, { sliding: true }, { grounded: false }, { alive: false }]) {
    feet.reset(); feet.update('a', motion());
    expect(feet.update('a', { ...motion(2.2), ...patch })).toBeNull();
  }
});

it('aterrissagem toca uma vez; teleporte e renascimento não criam passos', () => {
  const feet = new Footsteps();
  feet.update('a', { ...motion(), grounded: false, vy: -8 });
  expect(feet.update('a', motion())?.kind).toBe('land');
  expect(feet.update('a', motion())).toBeNull();
  expect(feet.update('a', motion(40))).toBeNull();
  feet.forget('a');
  expect(feet.update('a', motion(42.5))).toBeNull();
  feet.update('a', { ...motion(42.5), alive: false, grounded: false, vy: -9 });
  expect(feet.update('a', motion(43))).toBeNull();
  feet.update('a', { ...motion(43), grounded: false, vy: -9, life: 1 });
  expect(feet.update('a', { ...motion(43), life: 2 })).toBeNull();
});
