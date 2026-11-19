import { describe, expect, it, vi } from 'vitest';
import { createAmmo, MAGAZINE_SIZE, RELOAD_TIME, RESERVE_AMMO, stepAmmo } from './ammo';
import { EventBus } from './events';
import { createPlayer } from './player';
import { createWeapon, stepWeapon } from './weapon';
import { ARSENAL } from './weapons';

const DT = 1 / 60;

describe('munição e recarga', () => {
  it.each(ARSENAL.map((spec, index) => [index, spec] as const))('arma %i recarrega sozinha ao gastar a última bala', (index, spec) => {
    const w = { ...createWeapon(index), ammo: 1 };
    const p = createPlayer({ x: 0, y: 1, z: 0 });
    const ctx = { solids: [], rng: () => 0.5, events: new EventBus() };
    expect(stepWeapon(w, p, true, DT, ctx)).toBe(true);
    expect(w.ammo).toBe(0);
    expect(w.reloadRemaining).toBe(spec.reloadTime);
    for (let i = 0; i < Math.ceil(spec.reloadTime / DT); i++) stepWeapon(w, p, false, DT, ctx);
    expect(w.ammo).toBe(spec.magazineSize);
    expect(w.reserveAmmo).toBe(spec.reserveAmmo - spec.magazineSize);
  });

  it('pente vazio recarrega sem gatilho; reserva vazia não inicia recarga', () => {
    const w = { ...createAmmo(), ammo: 0, reserveAmmo: 2 };
    expect(stepAmmo(w, false, false, DT, true)).toBe(true);
    expect(w.reloadRemaining).toBe(RELOAD_TIME);
    w.reloadRemaining = 0;
    w.reserveAmmo = 0;
    expect(stepAmmo(w, false, false, DT, true)).toBe(false);
    expect(w.reloadRemaining).toBe(0);
  });

  it('nasce com 30 + 120 e só transfere a diferença após 81 ticks completos', () => {
    const w = createAmmo();
    expect(w.ammo).toBe(MAGAZINE_SIZE);
    expect(w.reserveAmmo).toBe(RESERVE_AMMO);
    w.ammo = 17;
    expect(stepAmmo(w, true, false, DT, true)).toBe(true);
    expect(w.reloadRemaining).toBe(RELOAD_TIME);
    for (let i = 0; i < 80; i++) stepAmmo(w, false, false, DT, true);
    expect(w.ammo).toBe(17);
    stepAmmo(w, false, false, DT, true);
    expect(w).toMatchObject({ ammo: 30, reserveAmmo: 107, reloadRemaining: 0 });
  });

  it('reserva parcial não cria munição e R segurado não inicia outra recarga', () => {
    const w = { ...createAmmo(), ammo: 3, reserveAmmo: 4 };
    stepAmmo(w, true, false, DT, true);
    for (let i = 0; i < 81; i++) stepAmmo(w, true, false, DT, true);
    expect(w).toMatchObject({ ammo: 7, reserveAmmo: 0, reloadRemaining: 0 });
    w.reserveAmmo = 10;
    stepAmmo(w, true, false, DT, true);
    expect(w.reloadRemaining).toBe(0);
    stepAmmo(w, false, false, DT, true);
    stepAmmo(w, true, false, DT, true);
    expect(w.reloadRemaining).toBe(RELOAD_TIME);
  });

  it('ignora pente cheio e reserva vazia; cancelar preserva as balas', () => {
    const w = createAmmo();
    expect(stepAmmo(w, true, false, DT, true)).toBe(false);
    w.ammo = 0;
    w.reserveAmmo = 0;
    expect(stepAmmo(w, false, true, DT, true)).toBe(false);
    w.reserveAmmo = 9;
    stepAmmo(w, false, true, DT, true);
    for (let i = 0; i < 40; i++) stepAmmo(w, false, false, DT, true);
    stepAmmo(w, false, false, DT, false);
    expect(w).toMatchObject({ ammo: 0, reserveAmmo: 9, reloadRemaining: 0 });
  });

  it('bloqueia tiros e sorteios durante recarga; volta a disparar só depois de concluir', () => {
    const w = { ...createWeapon(), ammo: 1 };
    const p = createPlayer({ x: 0, y: 1, z: 0 });
    const rng = vi.fn(() => 0.5);
    const ctx = { solids: [], rng, events: new EventBus() };
    expect(stepWeapon(w, p, true, DT, ctx)).toBe(true);
    expect(w.ammo).toBe(0);
    expect(w.reloadRemaining).toBe(RELOAD_TIME);
    expect(stepWeapon(w, p, true, DT, ctx)).toBe(false);
    expect(w.reloadRemaining).toBeCloseTo(RELOAD_TIME - DT);
    for (let i = 0; i < 80; i++) expect(stepWeapon(w, p, true, DT, ctx)).toBe(false);
    expect(rng).toHaveBeenCalledTimes(2);
    expect(w.ammo).toBe(30);
    expect(stepWeapon(w, p, true, DT, ctx)).toBe(true);
    expect(w.ammo).toBe(29);
    expect(rng).toHaveBeenCalledTimes(4);
  });

  it('morte e Chinelada cancelam recarga e não permitem tiro', () => {
    for (const dead of [false, true]) {
      const w = { ...createWeapon(), ammo: 8, reloadRemaining: 0.01 };
      const p = createPlayer({ x: 0, y: 1, z: 0 });
      if (dead) p.hp = 0;
      const ctx = { solids: [], rng: vi.fn(() => 0.5), events: new EventBus() };
      expect(stepWeapon(w, p, true, DT, ctx, true, dead)).toBe(false);
      expect(w).toMatchObject({ ammo: 8, reserveAmmo: 120, reloadRemaining: 0 });
      expect(ctx.rng).not.toHaveBeenCalled();
    }
  });
});
