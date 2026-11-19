import { describe, expect, it } from 'vitest';
import { EventBus, type ShotEvent } from './events';
import { createPlayer, stepPlayer } from './player';
import { emptyCommand } from './command';
import { stairs, box } from '../game/world/shapes';
import { createRng } from './rng';
import { createWeapon, stepWeapon } from './weapon';
import { switchWeapon } from './inventory';
import { ARSENAL, gunSpec, MK2, validWeaponIndex, weaponDamage, weaponSpread } from './weapons';

const DT = 1 / 60;
function setup(index: number) {
  const w = createWeapon(index), p = createPlayer({ x: 0, y: 0.8501, z: 0 });
  p.onGround = true;
  const events = new EventBus();
  const ctx = { solids: [], rng: createRng(42), events };
  return { w, p, events, ctx };
}

describe('arsenal e mira', () => {
  it('descer degraus de 0,4 m não derruba a luneta', () => {
    const { w, p, ctx } = setup(2);
    const solids = [box(-20, -1, -3, 20, 0, 3), ...stairs({ axis: 'x', start: 0, dir: 1, across: [-2, 2], base: 0, top: 2, depth: 1 })];
    p.pos = { x: 4.5, y: 2.85, z: 0 }; w.aimAmount = 1;
    let airborneTicks = 0;
    for (let i = 0; i < 140; i++) {
      stepPlayer(p, { ...emptyCommand(), moveX: -1, sprint: true }, DT, solids);
      stepWeapon(w, p, false, DT, { ...ctx, solids }, false, true, true);
      if (!p.onGround) airborneTicks++;
      expect(w.aimAmount).toBe(1);
    }
    expect(airborneTicks).toBeGreaterThan(10);
    expect(p.pos.y).toBeLessThan(1);
  });

  it('ferrolho baixa a luneta sem depender de troca de arma e retoma ao terminar', () => {
    const { w, p, ctx } = setup(2); w.aimAmount = 1;
    stepWeapon(w, p, true, DT, ctx, false, true, true);
    for (let i = 0; i < 30; i++) stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(w.aimAmount).toBe(0);
    for (let i = 0; i < 60; i++) stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(w.aimAmount).toBe(1);
  });
  it('sniper: ferrolho impede disparo antecipado e troca não encurta o ciclo', () => {
    const { w, p, ctx } = setup(2);
    w.aimAmount = 1;
    expect(stepWeapon(w, p, true, DT, ctx, false, true, true)).toBe(true);
    switchWeapon(w, 0); switchWeapon(w, 2);
    for (let tick = 1; tick <= 86; tick++) {
      expect(stepWeapon(w, p, tick % 2 === 0, DT, ctx, false, true, true)).toBe(false);
      if (tick === 40) expect(w.aimAmount).toBe(0);
    }
    stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(stepWeapon(w, p, true, DT, ctx, false, true, true)).toBe(true);
    expect(w.aimAmount).toBe(1);
  });

  it('sniper perde estabilidade no pulo e recupera progressivamente ao pousar', () => {
    const { w, p, ctx } = setup(2);
    w.aimAmount = 1; p.onGround = false; p.sinceGround = 1;
    for (let i = 0; i < 30; i++) stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(w.aimAmount).toBe(0);
    expect(weaponSpread(2, w.aimAmount, false, 0)).toBeGreaterThan(0.14);
    p.onGround = true;
    stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(w.aimAmount).toBeGreaterThan(0);
    expect(weaponSpread(2, w.aimAmount, true, 0)).toBeGreaterThan(0.05);
    for (let i = 0; i < 20; i++) stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(weaponSpread(2, w.aimAmount, true, 0)).toBeCloseTo(0.00065);
  });
  it('preserva a MK-2 e distingue os papéis sem automática letal na cabeça', () => {
    expect(MK2).toMatchObject({ bodyDamage: 20, fireInterval: 1 / 9, spread: 0.012, recoilKick: 0.014, magazineSize: 30, reloadTime: 1.35 });
    expect(weaponDamage(gunSpec(1), 'torso', 30)).toBeLessThan(weaponDamage(MK2, 'torso', 30));
    expect(weaponDamage(gunSpec(2), 'head', 80)).toBeGreaterThanOrEqual(100);
    expect(weaponDamage(gunSpec(2), 'torso', 80)).toBeGreaterThanOrEqual(100);
    expect(weaponDamage(gunSpec(3), 'torso', 20) * 8).toBeLessThan(20);
    for (const w of ARSENAL.filter(w => w.automatic)) expect(weaponDamage(w, 'head', 0)).toBeLessThan(100);
    for (const invalid of [-1, 4, NaN, Infinity, 1.5, 'sniper', null]) expect(validWeaponIndex(invalid)).toBe(false);
    expect(createWeapon(-1).weaponIndex).toBe(0);
    const ttk = (index: number, distance: number) => {
      const spec = gunSpec(index);
      return (Math.ceil(100 / weaponDamage(spec, 'torso', distance)) - 1) * Math.ceil(spec.fireInterval / DT) * DT;
    };
    expect(ttk(1, 5)).toBeLessThan(ttk(0, 5));
    expect(ttk(1, 30)).toBeGreaterThan(ttk(0, 30));
  });

  it.each([0, 1, 2, 3])('arma %i respeita sua munição e tempo de recarga', index => {
    const { w, p, ctx } = setup(index), spec = gunSpec(index);
    expect(w.ammo).toBe(spec.magazineSize); expect(w.reserveAmmo).toBe(spec.reserveAmmo);
    w.ammo -= 2;
    stepWeapon(w, p, false, DT, ctx, true);
    expect(w.reloadRemaining).toBe(spec.reloadTime);
    for (let i = 0; i < Math.ceil(spec.reloadTime / DT) - 1; i++) stepWeapon(w, p, false, DT, ctx);
    expect(w.ammo).toBe(spec.magazineSize - 2);
    stepWeapon(w, p, false, DT, ctx);
    expect(w.ammo).toBe(spec.magazineSize); expect(w.reserveAmmo).toBe(spec.reserveAmmo - 2);
  });

  it.each([2, 3])('arma %i exige soltar o gatilho entre disparos', index => {
    const { w, p, ctx } = setup(index);
    for (let i = 0; i < 180; i++) stepWeapon(w, p, true, DT, ctx);
    expect(w.ammo).toBe(gunSpec(index).magazineSize - 1);
    stepWeapon(w, p, false, DT, ctx);
    expect(stepWeapon(w, p, true, DT, ctx)).toBe(true);
  });

  it('oito projéteis somam dano antes de resolver alvo e gastam só um cartucho/coice', () => {
    const { w, p, events, ctx } = setup(3);
    const damage: number[] = [];
    ctx.solids = [];
    stepWeapon(w, p, true, DT, { ...ctx, targets: {
      raycast: () => ({ id: 7, t: 3 }), damage: (_id, _dir, amount) => { damage.push(amount!); return true; },
    } });
    expect(damage).toEqual([112]);
    const out = events.drain();
    expect(out.filter(e => e.type === 'shot')).toHaveLength(1);
    expect((out[0] as ShotEvent).pellets).toHaveLength(8);
    expect(out.filter(e => e.type === 'kill')).toHaveLength(1);
    expect(w.ammo).toBe(5); expect(p.recoil).toBe(0.035);
  });

  it('ADS entra progressivamente e sai na recarga, slide e morte', () => {
    const { w, p, ctx } = setup(2);
    stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(w.aimAmount).toBeCloseTo(DT / gunSpec(2).aimTime);
    for (let i = 0; i < 25; i++) stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(w.aimAmount).toBe(1);
    w.ammo--;
    stepWeapon(w, p, false, DT, ctx, true, true, true);
    expect(w.aimAmount).toBeLessThan(1);
    w.reloadRemaining = 0; p.sliding = true;
    stepWeapon(w, p, false, DT, ctx, false, true, true);
    expect(w.aimAmount).toBeLessThan(1 - DT / gunSpec(2).aimTime);
    p.hp = 0;
    for (let i = 0; i < 30; i++) stepWeapon(w, p, true, DT, ctx, false, true, true);
    expect(w.aimAmount).toBe(0);
  });

  it('precisão da sniper exige mira completa e postura estável', () => {
    const still = weaponSpread(2, 1, true, 0);
    expect(still).toBeCloseTo(0.00065);
    expect(weaponSpread(2, 0.5, true, 0)).toBeGreaterThan(still * 40);
    expect(weaponSpread(2, 1, true, 7)).toBeGreaterThan(still * 20);
    expect(weaponSpread(2, 1, false, 0)).toBeGreaterThan(weaponSpread(2, 1, true, 7));
  });

  it('MK-2 preserva os três acertos no drone mesmo distante no treino', () => {
    const { w, p, ctx } = setup(0);
    let amount = 0;
    stepWeapon(w, p, true, DT, { ...ctx, targets: {
      raycast: () => ({ id: 1, t: 60 }), damage: (_id, _dir, value) => { amount = value!; return false; },
    } });
    expect(amount).toBe(20);
  });
});
