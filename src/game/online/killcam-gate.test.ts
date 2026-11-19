import { describe, expect, it } from 'vitest';
import { KILLCAM, killcamGate } from './replay-timing';

const alive = { phase: 'playing', life: 3, hp: 100 };
const dead = { phase: 'playing', life: 3, hp: 0 };

describe('killcam: morte pendente até o patch confirmar', () => {
  it('antes da espera mínima sempre espera, mesmo com hp 0 já no estado', () => {
    expect(killcamGate(KILLCAM.delay - 0.01, 3, dead)).toBe('wait');
    expect(killcamGate(0, 3, alive)).toBe('wait');
  });

  it('patch atrasado além da espera: continua pendente e mostra quando a morte chega', () => {
    expect(killcamGate(KILLCAM.delay, 3, alive)).toBe('wait');
    expect(killcamGate(2.5, 3, alive)).toBe('wait');
    expect(killcamGate(2.5, 3, dead)).toBe('show');
  });

  it('prazo máximo: renasceu (outra vida) ou a partida acabou descarta', () => {
    expect(killcamGate(3, 3, { ...alive, life: 4 })).toBe('drop');
    expect(killcamGate(3, 3, { ...dead, life: 4 })).toBe('drop');
    expect(killcamGate(0.1, 3, { ...dead, phase: 'ended' })).toBe('drop');
  });
});
