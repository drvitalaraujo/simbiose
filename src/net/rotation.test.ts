import { describe, expect, it } from 'vitest';
import { pickBenched, type Standing } from './rotation';

const st = (id: string, kills: number, deaths = 0, streak = 1): Standing => ({ id, kills, deaths, streak });

describe('rodízio "quem perde sai" (puro)', () => {
  it('sai quem fez menos abates, até o tamanho da fila', () => {
    const s = [st('a', 5), st('b', 1), st('c', 3), st('d', 0)];
    expect(pickBenched(s, 1)).toEqual(['d']);
    expect(pickBenched(s, 2)).toEqual(['d', 'b']);
    expect(pickBenched(s, 0)).toEqual([]);
  });

  it('empate: mais mortes sai; depois quem jogou mais partidas seguidas', () => {
    expect(pickBenched([st('a', 2, 1), st('b', 2, 4), st('c', 9)], 1)).toEqual(['b']);
    expect(pickBenched([st('a', 2, 3, 1), st('b', 2, 3, 4), st('c', 9)], 1)).toEqual(['b']);
  });

  it('quem ganha nunca sai, mesmo com fila maior que a sala', () => {
    expect(pickBenched([st('a', 5), st('b', 1)], 5)).toEqual(['b']);
    expect(pickBenched([st('a', 5)], 3)).toEqual([]);
    expect(pickBenched([], 3)).toEqual([]);
  });
});
