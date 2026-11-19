import { expect, it } from 'vitest';
import { OnomaCadence, onomaPlacement } from './onomatopoeia';
it('texto fica na faixa oposta ao alvo, fora dos 40% centrais, em qualquer viewport', () => {
  for (const width of [320, 768, 1920, 3840]) for (const x of [-1, -0.1, 0, 0.8]) {
    const p = onomaPlacement(x, 0);
    // Caixa CSS limitada a 24vw; a animação nunca amplia além de 1.
    const left = (p.x - 0.12) * width, right = (p.x + 0.12) * width;
    expect(right < width * 0.3 || left > width * 0.7).toBe(true);
    expect(x >= 0 ? right < width / 2 : left > width / 2).toBe(true);
    expect(p.y).toBe(0.5);
  }
});
it('rajada mantém acentos espaçados, mas abate/hack podem interromper o texto comum', () => {
  const gate = new OnomaCadence();
  expect(gate.allow(false)).toBe(true);
  gate.tick(1/13); expect(gate.allow(false)).toBe(false);
  expect(gate.allow(true)).toBe(true);
  gate.tick(0.3); expect(gate.allow(false)).toBe(false);
  gate.tick(0.11); expect(gate.allow(false)).toBe(true);
  gate.reset(); expect(gate.allow(false)).toBe(true);
});
