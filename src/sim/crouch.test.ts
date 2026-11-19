import { describe, expect, it } from 'vitest';
import { emptyCommand } from './command';
import { CROUCH, bodyHalf } from './crouch';
import { createPlayer, eyePosition, stepPlayer, SILENT_WALK } from './player';
import type { Box } from './physics';
import { flatAt, stepFlat } from '../net/protocol';
import { hitboxState, poseOf } from '../net/combat';

const dt = 1 / 60;
const floor: Box = { min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } };
const roof: Box = { min: { x: -2, y: 1.2, z: -4 }, max: { x: 2, y: 2, z: -1 } };
const command = (extra = {}) => ({ ...emptyCommand(), ...extra });
function player() { const p = createPlayer({ x: 0, y: 0.8501, z: 0 }); p.onGround = true; return p; }

describe('agachamento', () => {
  it('abaixa e levanta gradualmente, sem mover os pés nem deslocar parado', () => {
    const p = player(), y = p.pos.y;
    stepPlayer(p, command({ crouch: true }), dt, [floor]);
    expect(p.crouchAmount).toBeGreaterThan(0);
    expect(p.crouchAmount).toBeLessThan(0.4);
    for (let i = 0; i < 40; i++) stepPlayer(p, command({ crouch: true }), dt, [floor]);
    expect(p.crouchAmount).toBe(1);
    expect(p.pos.y).toBeCloseTo(y);
    expect(p.pos.z).toBe(0);
    expect(eyePosition(p).y).toBeCloseTo(y + 0.65 - CROUCH.eyeDrop);
    stepPlayer(p, command(), dt, [floor]);
    expect(p.crouchAmount).toBeGreaterThan(0.7);
    expect(p.crouching).toBe(false);
    for (let i = 0; i < 45; i++) stepPlayer(p, command(), dt, [floor]);
    expect(p.crouchAmount).toBe(0);
  });

  it('passa sob obstáculo baixo agachado e só levanta depois de sair', () => {
    const standing = player();
    for (let i = 0; i < 45; i++) stepPlayer(standing, command({ moveZ: 1 }), dt, [floor, roof]);
    expect(standing.pos.z).toBeGreaterThan(-1);
    const p = player();
    for (let i = 0; i < 35; i++) stepPlayer(p, command({ crouch: true }), dt, [floor, roof]);
    for (let i = 0; i < 35; i++) stepPlayer(p, command({ crouch: true, moveZ: 1 }), dt, [floor, roof]);
    expect(p.pos.z).toBeLessThan(-1.35);
    for (let i = 0; i < 20; i++) stepPlayer(p, command(), dt, [floor, roof]);
    expect(p.crouching).toBe(true);
    expect(bodyHalf(p.crouchAmount).y * 2).toBeLessThan(1.2);
    for (let i = 0; i < 70; i++) stepPlayer(p, command({ moveZ: 1 }), dt, [floor, roof]);
    expect(p.pos.z).toBeLessThan(-4.35);
    for (let i = 0; i < 50; i++) stepPlayer(p, command(), dt, [floor, roof]);
    expect(p.crouchAmount).toBe(0);
  });

  it('agacha em movimento sem iniciar slide', () => {
    const p = player(); p.vel.z = -11;
    const cmd = command({ crouch: true, sprint: true, moveX: 1 });
    stepPlayer(p, cmd, dt, [floor]);
    expect(p.sliding).toBe(false);
    expect(p.vel.x).toBeGreaterThan(0);
    expect(p.vel.x).toBeLessThan(0.4);
    expect(Math.hypot(p.vel.x, p.vel.z)).toBeLessThan(11);
    for (let i = 0; i < 100; i++) stepPlayer(p, cmd, dt, [floor]);
    expect(p.sliding).toBe(false);
    expect(p.crouching).toBe(true);
    expect(Math.hypot(p.vel.x, p.vel.z)).toBeCloseTo(SILENT_WALK);
  });

  it('postura e colisão batem no estado achatado e são conservadas no rewind', () => {
    const p = player(), f = flatAt(p.spawn); f.onGround = true;
    for (let i = 0; i < 80; i++) {
      const cmd = command({ crouch: i < 50, moveZ: 1 });
      stepPlayer(p, cmd, dt, [floor, roof]);
      stepFlat(f, cmd, dt, [floor, roof], p.spawn);
      expect(f.crouchAmount).toBe(p.crouchAmount);
      expect(f.crouching).toBe(p.crouching);
      expect(f.y).toBe(p.pos.y);
      expect(f.z).toBe(p.pos.z);
      expect(hitboxState(poseOf(f)).crouch).toBe(p.crouchAmount);
    }
  });
});
