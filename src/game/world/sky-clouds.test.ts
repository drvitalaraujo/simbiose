import { describe, expect, it } from 'vitest';
import { bakeCloudField, cloudFields } from './sky-clouds';

describe('campos do céu', () => {
  it('fecha a volta sem emenda, inclusive na derivada das nuvens', () => {
    const epsilon = 1e-5;
    for (const height of [0.04, 0.12, 0.3, 0.5, 0.7, 1]) {
      expect(cloudFields(0, height)).toEqual(cloudFields(1, height));
      const before = cloudFields(-epsilon, height), after = cloudFields(epsilon, height);
      for (let channel = 0; channel < 2; channel++) {
        expect(Math.abs(before[channel] - after[channel])).toBeLessThan(0.005);
      }
      expect(cloudFields(-0.25, height)).toEqual(cloudFields(0.75, height));
    }
  });

  it('gera dados determinísticos e variados para os dois canais', () => {
    const data = bakeCloudField(64, 32);
    expect(data).toEqual(bakeCloudField(64, 32));
    expect(data.length).toBe(64 * 32 * 2);
    for (const channel of [0, 1]) {
      const values = data.filter((_, i) => i % 2 === channel);
      expect(Math.min(...values)).toBeLessThan(60);
      expect(Math.max(...values)).toBeGreaterThan(160);
      expect(new Set(values).size).toBeGreaterThan(100);
    }
  });

  it('mantém os campos no intervalo da textura, sem estourar bytes', () => {
    for (let i = 0; i < 200; i++) {
      for (const value of cloudFields(i / 37, (i % 31) / 30)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    expect(() => bakeCloudField(0, 32)).toThrow();
    expect(() => bakeCloudField(64, 1)).toThrow();
  });
});
