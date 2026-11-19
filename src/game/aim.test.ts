import { expect, it } from 'vitest';
import { aimedFov } from './aim';

it('zoom preserva a razão óptica em qualquer FOV base e volta exatamente ao FOV original', () => {
  for (const base of [70, 80, 100]) {
    expect(aimedFov(base, 4, 0)).toBeCloseTo(base);
    const zoomed = aimedFov(base, 4, 1);
    expect(Math.tan(base * Math.PI / 360) / Math.tan(zoomed * Math.PI / 360)).toBeCloseTo(4);
    expect(aimedFov(base, 4, 0.5)).toBeLessThan(base);
    expect(aimedFov(base, 4, 0.5)).toBeGreaterThan(zoomed);
  }
});
