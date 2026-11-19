import { expect, it } from 'vitest';
import { SniperPulse } from './sniper-pulse';
it('pulso exige disparo observado da sniper, não troca/cadência herdada ou recarga', () => {
  const p = new SniperPulse();
  expect(p.update(1/60, { weaponIndex: 0, ammo: 30 }, true)).toBe(0);
  expect(p.update(1/60, { weaponIndex: 2, ammo: 5 }, true)).toBe(0);
  expect(p.update(1/60, { weaponIndex: 2, ammo: 5 }, true)).toBe(0);
  expect(p.update(1/60, { weaponIndex: 2, ammo: 4 }, true)).toBeGreaterThan(0);
  expect(p.update(0.2, { weaponIndex: 2, ammo: 4 }, true)).toBe(0);
  expect(p.update(1/60, { weaponIndex: 2, ammo: 5 }, true)).toBe(0);
  expect(p.update(1/60, { weaponIndex: 2, ammo: 4 }, false)).toBe(0);
});
