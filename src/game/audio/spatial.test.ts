import { expect, it } from 'vitest';
import { soundLineOfSight } from './spatial';

it('impacto na parede visível é aberto, mas sons atrás dela são abafados', () => {
  const wall = { min: { x: 4, y: 0, z: -2 }, max: { x: 5, y: 4, z: 2 } };
  const listener = { x: 0, y: 1, z: 0 };
  expect(soundLineOfSight(listener, { x: 4, y: 1, z: 0 }, [wall])).toBe(true);
  expect(soundLineOfSight(listener, { x: 6, y: 1, z: 0 }, [wall])).toBe(false);
});
