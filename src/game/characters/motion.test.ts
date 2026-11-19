import { describe, expect, it } from 'vitest';
import { leanTarget, lowReady, MAX_LEAN, RECOIL, reloadEnvelope, Spring } from './motion';

describe('movimento secundário do boneco', () => {
  it('mola chega ao alvo e continua estável com dt grande', () => {
    const s = new Spring(6, 0.7);
    for (let i = 0; i < 120; i++) s.update(1, 1 / 60);
    expect(s.value).toBeCloseTo(1, 3);
    const big = new Spring(6, 0.3);
    big.kick(20);
    for (let i = 0; i < 20; i++) big.update(0, 0.25);
    expect(Math.abs(big.value)).toBeLessThan(1e-3);
  });

  it('inclina para dentro do strafe e da curva, com teto', () => {
    expect(leanTarget(4.2, 0)).toBeGreaterThan(0);
    expect(leanTarget(-4.2, 0)).toBeLessThan(0);
    expect(leanTarget(0, 3)).toBeLessThan(0);
    expect(Math.abs(leanTarget(100, -100))).toBeLessThanOrEqual(MAX_LEAN);
  });

  it('recarga abaixa a arma e leva a mão ao carregador só no meio', () => {
    expect(reloadEnvelope(0)).toEqual({ lower: 0, mag: 0, drop: 0 });
    const mid = reloadEnvelope(0.45);
    expect(mid.lower).toBe(1);
    expect(mid.mag).toBe(1);
    expect(mid.drop).toBeGreaterThan(0.5);
    expect(reloadEnvelope(1).lower).toBe(0);
  });

  it('guarda baixa só correndo e sem atirar; um coice por arma do ARSENAL', () => {
    expect(lowReady(7, 2)).toBe(1);
    expect(lowReady(7, 0.1)).toBe(0);
    expect(lowReady(4.2, 2)).toBe(0);
    expect(RECOIL.length).toBe(4);
  });
});
