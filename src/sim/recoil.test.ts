import { describe, expect, it } from 'vitest';
import { emptyCommand } from './command';
import { EventBus } from './events';
import { createPlayer, resetPlayer, stepPlayer } from './player';
import { createWeapon, stepWeapon } from './weapon';

const dt = 1 / 60;
const floor = { min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } };

describe('recuo moderado aprovado em 2026-10-03', () => {
  it('rajada sobe de verdade, tem limite natural e recupera sem ultrapassar zero', () => {
    const p = createPlayer({ x: 0, y: 0.85, z: 0 });
    const w = createWeapon();
    const events = new EventBus();
    const heights: number[] = [];
    for (let t = 0; t < 120; t++) {
      stepPlayer(p, emptyCommand(t), dt, [floor]);
      stepWeapon(w, p, true, dt, { solids: [], rng: () => 0.5, events });
      for (const e of events.drain()) if (e.type === 'shot') heights.push(e.dir.y);
      expect(p.recoil).toBeLessThan(0.033); // menos de 1,9 grau no fuzil
    }
    expect(heights[0]).toBe(0);
    expect(heights[1]).toBeGreaterThan(0.007);
    expect(heights.at(-1)!).toBeGreaterThan(0.017);
    const peak = p.recoil;
    for (let t = 0; t < 36; t++) {
      const before = p.recoil;
      stepPlayer(p, emptyCommand(t), dt, [floor]);
      expect(p.recoil).toBeLessThanOrEqual(before);
      expect(p.recoil).toBeGreaterThanOrEqual(0);
    }
    expect(p.recoil).toBeLessThan(peak * 0.051);
    resetPlayer(p);
    expect(p.recoil).toBe(0);
  });

  it.each([0, 1, 2, 3])('arma %i mantém impulso e permite compensar puxando a mira', index => {
    const p = createPlayer({ x: 0, y: 0.85, z: 0 });
    const w = createWeapon(index);
    const events = new EventBus();
    stepWeapon(w, p, true, dt, { solids: [], rng: () => 0.5, events });
    events.drain();
    expect(p.recoil).toBeGreaterThan(0);
    stepPlayer(p, emptyCommand(1), dt, [floor]);
    expect(p.recoil).toBeGreaterThan(0);
    p.pitch = -p.recoil;
    w.cooldown = 0;
    w.fireHeld = false;
    stepWeapon(w, p, true, dt, { solids: [], rng: () => 0.5, events });
    const shot = events.drain().find(e => e.type === 'shot');
    expect(shot?.type === 'shot' && shot.dir.y).toBeCloseTo(0, 10);
  });
});
