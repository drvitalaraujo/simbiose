import { describe, expect, it } from 'vitest';
import { AutoDirector, type DirectorPlayer } from './director';

const alive = (...ids: string[]): DirectorPlayer[] => ids.map(id => ({ id, alive: true }));

/** Roda `seconds` em passos de 1/60 s. */
function run(d: AutoDirector, seconds: number, players: () => DirectorPlayer[], each?: () => void) {
  let target: string | null = null;
  for (let t = 0; t < seconds; t += 1 / 60) {
    each?.();
    target = d.update(1 / 60, players());
  }
  return target;
}

describe('diretor automático', () => {
  it('começa em alguém e respeita o tempo mínimo do plano', () => {
    const d = new AutoDirector({ minShot: 4 });
    const players = alive('a', 'b');
    expect(d.update(1 / 60, players)).toBe('a');
    d.note({ type: 'kill', killerId: 'b', victimId: 'x' });
    expect(run(d, 3, () => players)).toBe('a'); // ainda dentro do mínimo
    expect(run(d, 1.2, () => players)).toBe('b'); // passou o mínimo: vai para quem abateu
  });

  it('não pula feito pipoca entre dois jogadores em combate parelho', () => {
    const d = new AutoDirector({ minShot: 4, maxShot: 100 });
    const players = alive('a', 'b');
    let cuts = 0;
    let last: string | null = null;
    let n = 0;
    run(d, 30, () => players, () => {
      d.note({ type: 'shot', by: (n++ * 7) % 3 === 0 ? 'a' : 'b', target: 'x', damage: 10 });
      if (d.target !== last) { cuts++; last = d.target; }
    });
    expect(cuts).toBeLessThanOrEqual(3);
  });

  it('quem estava em cena morre: mostra a queda e corta para quem o abateu', () => {
    const d = new AutoDirector({ minShot: 4, deathHold: 1.5 });
    let players = alive('a', 'b', 'c');
    d.update(1 / 60, players);
    expect(d.target).toBe('a');
    d.note({ type: 'kill', killerId: 'c', victimId: 'a' });
    players = [{ id: 'a', alive: false }, ...alive('b', 'c')];
    expect(run(d, 1, () => players)).toBe('a'); // vê a queda
    expect(run(d, 0.7, () => players)).toBe('c');
  });

  it('o calor esfria: plano longo demais vai para outro com ação; jogador que saiu some', () => {
    const d = new AutoDirector({ minShot: 2, maxShot: 6, halfLife: 1 });
    const players = alive('a', 'b');
    d.update(1 / 60, players);
    d.note({ type: 'shot', by: 'a' });
    run(d, 5, () => players);
    expect(d.heatOf('a')).toBeLessThan(0.1);
    expect(d.target).toBe('a');
    run(d, 2, () => players, () => d.note({ type: 'shot', by: 'b' }));
    expect(d.target).toBe('b');
    expect(d.update(1 / 60, alive('a'))).toBe('a'); // b saiu da sala
    expect(d.update(1 / 60, [])).toBeNull();
  });
});
