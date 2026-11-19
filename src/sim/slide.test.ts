import { describe, expect, it } from 'vitest';
import { emptyCommand } from './command';
import { CROUCH } from './crouch';
import { createPlayer, stepPlayer, SILENT_WALK, WALK } from './player';
import { flatAt, stepNet, FLAT_FIELDS } from '../net/protocol';

const floor = [{ min: { x: -100, y: -1, z: -100 }, max: { x: 100, y: 0, z: 100 } }];
const spawn = { x: 0, y: 0.8501, z: 0 };
const dt = 1 / 60;

describe('movimento tático sem corrida nem slide', () => {
  it.each([false, true])('Shift=%s limita velocidade, inclusive diagonal', shift => {
    const p = createPlayer(spawn);
    for (let i = 0; i < 120; i++) stepPlayer(p, { ...emptyCommand(), moveZ: 1, moveX: 1, sprint: shift }, dt, floor);
    expect(Math.hypot(p.vel.x, p.vel.z)).toBeCloseTo(shift ? SILENT_WALK : WALK);
    expect(p.walking).toBe(shift);
    expect(p.sliding).toBe(false);
  });

  it.each([false, true])('C/Ctrl agacha sem deslizar, com Shift=%s', shift => {
    const p = createPlayer(spawn);
    p.onGround = true; p.vel.z = -WALK;
    for (let i = 0; i < 120; i++) {
      stepPlayer(p, { ...emptyCommand(), moveZ: 1, sprint: shift, crouch: true }, dt, floor);
      expect(p.sliding).toBe(false);
      expect(p.slideTime).toBe(0);
      expect(p.crouching).toBe(true);
    }
    expect(-p.vel.z).toBe(shift ? Math.min(CROUCH.speed, SILENT_WALK) : CROUCH.speed);
  });

  it('Shift funciona mirando e é reconciliado igual ao treino', () => {
    const p = createPlayer(spawn), f = flatAt(spawn);
    expect(FLAT_FIELDS).toContain('walking');
    for (let i = 0; i < 180; i++) {
      const cmd = { ...emptyCommand(i), moveZ: 1, sprint: i < 120, aim: true, crouch: i >= 60 && i < 90 };
      stepPlayer(p, cmd, dt, floor);
      stepNet(f, cmd, dt, floor, spawn, () => 0.5);
      expect(f.z).toBe(p.pos.z);
      expect(f.walking).toBe(p.walking);
      expect(f.sliding).toBe(false);
      if (i === 119) expect(-f.vz).toBe(SILENT_WALK);
    }
    expect(-f.vz).toBe(WALK);
  });
});
