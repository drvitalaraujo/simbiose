import { expect, it } from 'vitest';
import { SYNTHS, synthesize } from './synthesis';
import { createRng } from '../../sim/rng';

it('buffers têm ataque/cauda suaves, valores finitos e folga para somar camadas', () => {
  for (const spec of Object.values(SYNTHS)) {
    const data = synthesize(spec, 44100, createRng(123));
    expect(data.length).toBe(Math.ceil(spec.duration * 44100));
    expect(data[0]).toBe(0);
    expect(Math.abs(data[data.length - 1])).toBeLessThan(0.001);
    expect(data.every(Number.isFinite)).toBe(true);
    expect(data.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0)).toBeLessThan(1);
  }
});
