// Só a reação sonora ao estado: sem construir renderer, mundo ou viewmodel.
import { expect, it, vi } from 'vitest';
import { createAmmo, RELOAD_TIME } from '../sim/ammo';
import { Weapon } from './weapon';

it('correção regressiva de recarga não repete os sons; cancelamento permite uma nova recarga', () => {
  const reload = vi.fn();
  const weapon = Object.assign(Object.create(Weapon.prototype), {
    reloadProgress: -1, weaponIndex: 0, d: { sfx: { reload } },
  }) as Weapon;
  const state = createAmmo();
  for (const progress of [0, 0.65, 0.63, 0.65, 0.82, 0.79, 0.82]) {
    state.reloadRemaining = RELOAD_TIME * (1 - progress);
    weapon.syncAmmo(state);
  }
  expect(reload.mock.calls).toEqual([['out'], ['in'], ['bolt']]);
  state.reloadRemaining = 0;
  weapon.syncAmmo(state);
  state.reloadRemaining = RELOAD_TIME;
  weapon.syncAmmo(state);
  expect(reload.mock.calls).toEqual([['out'], ['in'], ['bolt'], ['out']]);
});
