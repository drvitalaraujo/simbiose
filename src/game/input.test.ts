import { describe, expect, it, vi } from 'vitest';
import { PITCH_LIMIT } from '../sim/player';
import { applyLook, Input } from './input';
import { InputPacer } from '../net/pacer';
import { flatAt, stepNet } from '../net/protocol';
import { createRng } from '../sim/rng';

it('slot desejado sobrevive ao descarte de comandos atrasados', () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', new EventTarget());
  try {
    const input = new Input({} as HTMLCanvasElement);
    input.weaponSlot = 4;
    const commands = Array.from({ length: 10 }, () => input.command());
    const pacer = new InputPacer();
    for (let i = 0; i < 12; i++) pacer.plan(0);
    const plan = pacer.plan(commands.length);
    expect(plan.skip).toBeGreaterThan(0);
    const spawn = { x: 0, y: 1, z: 0 }, player = flatAt(spawn);
    for (const cmd of commands.slice(plan.skip, plan.skip + plan.steps)) stepNet(player, cmd, 1 / 60, [], spawn, createRng(3));
    expect(player.weaponIndex).toBe(3);
  } finally { vi.unstubAllGlobals(); }
});

describe('mira com sensibilidade', () => {
  it('multiplica o giro pela sensibilidade', () => {
    expect(applyLook(0, 0, 100, 0, 1).yaw).toBeCloseTo(-0.22);
    expect(applyLook(0, 0, 100, 0, 2).yaw).toBeCloseTo(-0.44);
    expect(applyLook(0, 0, 100, 0, 0.1).yaw).toBeCloseTo(-0.022);
  });

  it('perto do limite, sensibilidade baixa não inverte o movimento', () => {
    // Achado I2 da revisão: empurrar para cima perto do limite fazia a mira descer
    const up = applyLook(0, PITCH_LIMIT - 0.001, 0, -100, 0.1);
    expect(up.pitch).toBeCloseTo(PITCH_LIMIT);
    const down = applyLook(0, -PITCH_LIMIT + 0.001, 0, 100, 0.1);
    expect(down.pitch).toBeCloseTo(-PITCH_LIMIT);
  });

  it('sensibilidade alta continua respeitando o limite', () => {
    expect(applyLook(0, 0, 0, -10000, 5).pitch).toBe(PITCH_LIMIT);
  });
});
