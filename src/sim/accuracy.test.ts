import { describe, expect, it } from 'vitest';
import { emptyCommand } from './command';
import { EventBus, type ShotEvent } from './events';
import { createPlayer, stepPlayer, SPRINT, WALK } from './player';
import { createRng } from './rng';
import { createWeapon, shotDirection, stepWeapon } from './weapon';
import { ARSENAL, weaponSpread } from './weapons';

const DT = 1 / 60;
const floor = { min: { x: -100, y: -1, z: -100 }, max: { x: 100, y: 0, z: 100 } };

describe('precisão em movimento', () => {
  it.each([0, 1, 2, 3])('arma %i: andar, correr e pular custam precisão, inclusive em ADS', index => {
    for (const aim of [0, 0.5, 1]) {
      const spread = (speed: number, ground = true) => weaponSpread(index, aim, ground, speed);
      expect(spread(0.5)).toBe(spread(0));
      expect(spread(3.5)).toBeGreaterThan(spread(0));
      expect(spread(WALK)).toBeGreaterThan(spread(3.5));
      expect(spread(SPRINT)).toBeGreaterThan(spread(WALK));
      expect(spread(SPRINT, false)).toBeGreaterThan(spread(SPRINT));
      expect(spread(0, false)).toBeGreaterThan(spread(WALK));
      expect(spread(20)).toBe(spread(SPRINT)); // slide rápido tem limite, nunca precisão grátis
      for (const speed of [0.5, WALK, SPRINT]) {
        expect(Math.abs(spread(speed + 0.0001) - spread(speed - 0.0001))).toBeLessThan(0.00001);
      }
    }
    expect(weaponSpread(index, 1, true, WALK)).toBeLessThan(weaponSpread(index, 0, true, WALK));
  });

  it('SMG mantém a identidade móvel, sniper cobra a maior estabilidade', () => {
    const penalty = (index: number) => weaponSpread(index, 1, true, WALK) - weaponSpread(index, 1);
    expect(penalty(1)).toBeLessThan(penalty(0));
    expect(penalty(3)).toBeLessThan(penalty(0));
    expect(penalty(2)).toBeGreaterThan(penalty(0) * 2);
    expect(weaponSpread(2, 1)).toBeCloseTo(0.00065);
  });

  it('frear recupera precisão em até 200 ms, sem mudar a aceleração aprovada', () => {
    const p = createPlayer({ x: 0, y: 0.8501, z: 0 });
    p.onGround = true; p.vel.x = SPRINT;
    let previous = weaponSpread(0, 0, true, SPRINT);
    for (let tick = 0; tick < 12; tick++) {
      stepPlayer(p, emptyCommand(), DT, [floor]);
      const spread = weaponSpread(0, 0, p.onGround, Math.hypot(p.vel.x, p.vel.z));
      expect(spread).toBeLessThanOrEqual(previous);
      previous = spread;
    }
    expect(p.vel.x).toBe(0);
    expect(previous).toBe(ARSENAL[0].spread);
  });

  it('distribuição com semente mantém combate móvel de perto e premia parar à distância', () => {
    // Alvo de 60 cm de largura/altura: mede só dispersão, sem assistência de mira/coice.
    const hitRate = (index: number, aim: number, speed: number, distance: number) => {
      const rng = createRng(77);
      let hits = 0;
      for (let i = 0; i < 2000; i++) {
        const dir = shotDirection(0, 0, rng, weaponSpread(index, aim, true, speed));
        if (Math.abs(dir.x / dir.z) * distance < 0.3 && Math.abs(dir.y / dir.z) * distance < 0.3) hits++;
      }
      return hits / 2000;
    };
    expect(hitRate(1, 0, SPRINT, 5)).toBeGreaterThan(0.95);
    expect(hitRate(0, 1, 0, 30)).toBe(1);
    expect(hitRate(0, 1, WALK, 30)).toBeLessThan(0.85);
    expect(hitRate(0, 0, SPRINT, 30)).toBeLessThan(0.2);
    expect(hitRate(2, 1, 0, 60)).toBe(1);
    expect(hitRate(2, 1, WALK, 60)).toBeLessThan(0.1);
  });

  it.each([0, 1, 2, 3])('arma %i usa a dispersão real sem mudar dano, cadência ou munição', index => {
    const p = createPlayer({ x: 0, y: 0.8501, z: 0 });
    p.onGround = false; p.vel.x = 11; p.sliding = true;
    const w = createWeapon(index), events = new EventBus(), rng = createRng(42);
    expect(stepWeapon(w, p, true, DT, { solids: [], events, rng })).toBe(true);
    const shot = events.drain()[0] as ShotEvent;
    const expected = shotDirection(0, 0, createRng(42), weaponSpread(index, 0, false, 11));
    expect(shot.dir).toEqual(expected);
    expect(w.ammo).toBe(ARSENAL[index].magazineSize - 1);
    expect(w.cooldown).toBe(ARSENAL[index].fireInterval);
    expect(p.recoil).toBe(ARSENAL[index].recoilKick);
    expect(shot.pellets?.length ?? 1).toBe(ARSENAL[index].pellets);
  });
});
