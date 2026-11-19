import { describe, expect, it } from 'vitest';
import { classify, gaitWeights, legTwist } from './locomotion';

const base = { vx: 0, vz: 0, yaw: 0, grounded: true, crouch: false, dead: false };

describe('locomotion', () => {
  it('classifica as poses', () => {
    expect(classify(base)).toBe('idle');
    expect(classify({ ...base, vz: -4 })).toBe('move');
    expect(classify({ ...base, crouch: true })).toBe('crouchIdle');
    expect(classify({ ...base, crouch: true, vx: 2 })).toBe('crouchMove');
    expect(classify({ ...base, grounded: false })).toBe('air');
    expect(classify({ ...base, dead: true, grounded: false })).toBe('dead');
  });

  it('gira as pernas para o lado do movimento e toca de trás para frente ao recuar', () => {
    // yaw 0 olha para -Z
    expect(legTwist(0, -4, 0)).toEqual({ twist: 0, reverse: false });
    const left = legTwist(-4, 0, 0); // andando para -X = esquerda
    expect(left.twist).toBeCloseTo(Math.PI / 2);
    expect(left.reverse).toBe(false);
    const back = legTwist(0, 4, 0);
    expect(back.reverse).toBe(true);
    expect(Math.abs(back.twist)).toBeCloseTo(0);
    const backRight = legTwist(3, 3, 0); // diagonal trás-direita
    expect(backRight.reverse).toBe(true);
    expect(backRight.twist).toBeCloseTo(Math.PI / 4); // pernas giram para a esquerda
  });

  it('misturas de passada somam 1 e seguem a velocidade', () => {
    for (const s of [0, 1, 3, 5, 6.9, 12]) {
      const w = gaitWeights(s);
      expect(w.walk + w.jog + w.sprint).toBeCloseTo(1);
    }
    expect(gaitWeights(1).walk).toBe(1);
    expect(gaitWeights(12).sprint).toBe(1);
  });
});
