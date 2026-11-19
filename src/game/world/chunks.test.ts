import { describe, expect, it } from 'vitest';
import { CHUNK, chunkKey, FAR_RING, SECTORS } from './chunks';

describe('blocos espaciais do cenário', () => {
  it('perto: grade de CHUNK metros', () => {
    expect(chunkKey(1, 1)).toBe('0,0');
    expect(chunkKey(CHUNK - 0.01, 0)).toBe('0,0');
    expect(chunkKey(CHUNK, 0)).toBe('1,0');
    expect(chunkKey(-0.5, -0.5)).toBe('-1,-1');
  });

  it('longe: fatias angulares (poucos lotes para a silhueta da cidade)', () => {
    const keys = new Set<string>();
    for (let a = 0; a < Math.PI * 2; a += 0.01) keys.add(chunkKey(Math.cos(a) * (FAR_RING + 50), Math.sin(a) * (FAR_RING + 50)));
    expect(keys.size).toBe(SECTORS);
    for (const k of keys) expect(k.startsWith('s')).toBe(true);
  });

  it('peças vizinhas caem no mesmo bloco', () => {
    expect(chunkKey(10, 10)).toBe(chunkKey(12, 9));
    expect(chunkKey(150, 0)).toBe(chunkKey(160, 1));
  });
});
