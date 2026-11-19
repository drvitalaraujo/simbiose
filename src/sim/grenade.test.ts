import { describe, it, expect } from 'vitest';
import { createGrenade, grenadeDamage, launchGrenade, stepGrenade, stepProjectile } from './grenade';
import { emptyCommand } from './command';
import { TICK } from './clock';

const floor = { min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } };
describe('granada determinística', () => {
  it('uma por vida, morto não lança, segurar/repetir Q não recarrega', () => {
    const s = createGrenade(), cmd = { ...emptyCommand(), grenade: true };
    expect(stepGrenade(s, cmd, false)).toBe(false);
    expect(stepGrenade(s, cmd, true)).toBe(false);
    stepGrenade(s, emptyCommand(), true);
    expect(stepGrenade(s, cmd, true)).toBe(true);
    for (let i = 0; i < 120; i++) expect(stepGrenade(s, { ...cmd, grenade: i % 2 === 0 }, true)).toBe(false);
    expect(s.grenadeReady).toBe(false);
  });
  it('varre paredes finas, quica e detona exatamente no tick 90', () => {
    const wall = { min: { x: -2, y: 0, z: -1 }, max: { x: 2, y: 5, z: -0.99 } };
    const p = launchGrenade('a', { x: 0, y: 1.5, z: 0 }, 0, 0, 1), copy = { ...p };
    let bounced = false;
    for (let i = 1; i <= 90; i++) {
      expect(stepProjectile(p, TICK, [floor, wall])).toBe(i === 90);
      stepProjectile(copy, TICK, [floor, wall]);
      expect(p).toEqual(copy);
      expect(p.z).toBeGreaterThan(-0.91);
      expect(p.y).toBeGreaterThanOrEqual(0.09);
      if (p.vz > 0) bounced = true;
    }
    expect(bounced).toBe(true);
  });
  it('limite sólido segura a trajetória sem virar bloqueador de dano', () => {
    const wall = { min: { x: -2, y: 0, z: -1 }, max: { x: 2, y: 5, z: -0.99 } };
    const p = launchGrenade('a', { x: 0, y: 1.5, z: 0 }, 0, 0, 1);
    for (let i = 0; i < 10; i++) stepProjectile(p, TICK, [], [wall]);
    expect(p.z).toBeGreaterThan(-0.9); expect(p.vz).toBeGreaterThan(0);
    expect(grenadeDamage({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -2 }, [])).toBeGreaterThan(0);
  });
  it('dano cai com distância e shotBlockers bloqueiam completamente', () => {
    const at = { x: 0, y: 1, z: 0 };
    expect(grenadeDamage(at, at, [])).toBe(110);
    expect(grenadeDamage(at, { ...at, x: 3.5 }, [])).toBe(55);
    expect(grenadeDamage(at, { ...at, x: 6 }, [])).toBe(0);
    const wall = { min: { x: 0.5, y: 0, z: -2 }, max: { x: 0.6, y: 3, z: 2 } };
    expect(grenadeDamage(at, { ...at, x: 1 }, [wall])).toBe(0);
  });
});
