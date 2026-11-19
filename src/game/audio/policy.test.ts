import { describe, expect, it } from 'vitest';
import { audibility, useHrtf, voiceToSteal } from './policy';

describe('mixagem competitiva', () => {
  it('reserva espaço binaural para passos sem exceder o orçamento', () => {
    expect(useHrtf(2, 2, 0)).toBe(false);
    expect(useHrtf(5, 10, 5)).toBe(true);
    expect(useHrtf(5, 10, 6)).toBe(false);
    expect(useHrtf(7, 10, 6, true)).toBe(true);
    expect(useHrtf(7, 10, 8, true)).toBe(false);
    expect(useHrtf(7, 32, 0, true)).toBe(false);
  });
  it('reduz distância, corta alcance e abafa cobertura sem silenciar o som', () => {
    const origin = { x: 0, y: 1, z: 0 };
    const near = { x: 5, y: 1, z: 0 };
    const open = audibility(origin, near, 60, false);
    const blocked = audibility(origin, near, 60, true);
    expect(open.gain).toBeGreaterThan(audibility(origin, { ...near, x: 30 }, 60, false).gain);
    expect(blocked.gain).toBeGreaterThan(0);
    expect(blocked.gain).toBeLessThan(open.gain);
    expect(blocked.cutoff).toBeLessThan(open.cutoff);
    expect(audibility(origin, { ...near, x: 60 }, 60, false).gain).toBe(0);
  });
  it('preserva feedback prioritário e rouba a voz fraca mais antiga', () => {
    const voices = [{ priority: 9, started: 0 }, { priority: 2, started: 2 }, { priority: 2, started: 1 }];
    expect(voiceToSteal(voices, 1, 3)).toBe(-2);
    expect(voiceToSteal(voices, 5, 3)).toBe(2);
    expect(voiceToSteal(voices, 5, 4)).toBe(-1);
  });
});
