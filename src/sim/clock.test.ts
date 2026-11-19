import { describe, expect, it } from 'vitest';
import { FixedStep, TICK } from './clock';

describe('passo fixo', () => {
  it('a 60 fps roda exatamente um tick por quadro', () => {
    const s = new FixedStep();
    let total = 0;
    for (let i = 0; i < 600; i++) {
      const n = s.advance(1 / 60);
      expect(n).toBe(1);
      total += n;
    }
    expect(total).toBe(600);
  });

  it('a 144 fps roda 60 ticks por segundo e o alpha fica entre 0 e 1', () => {
    const s = new FixedStep();
    let total = 0;
    for (let i = 0; i < 144; i++) {
      total += s.advance(1 / 144);
      expect(s.alpha).toBeGreaterThanOrEqual(0);
      expect(s.alpha).toBeLessThanOrEqual(1);
    }
    expect(total).toBeGreaterThanOrEqual(59);
    expect(total).toBeLessThanOrEqual(60);
  });

  it('a 20 fps continua em tempo real (sem câmera lenta)', () => {
    const s = new FixedStep();
    let total = 0;
    for (let i = 0; i < 20; i++) total += s.advance(1 / 20);
    expect(total).toBe(60);
  });

  it('limita os ticks por quadro e descarta o atraso', () => {
    const s = new FixedStep(TICK, 5);
    expect(s.advance(0.2)).toBe(5);
    expect(s.alpha).toBe(0);
    expect(s.advance(1 / 60)).toBe(1);
  });

  it('dt zero ou negativo não roda tick', () => {
    const s = new FixedStep();
    expect(s.advance(0)).toBe(0);
    expect(s.advance(-1)).toBe(0);
  });
});
