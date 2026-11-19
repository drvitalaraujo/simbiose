import { expect, it } from 'vitest';
import { createWeapon } from './weapon';
import { EQUIP_TIME, switchWeapon } from './inventory';
import { emptyCommand } from './command';
import { createRng } from './rng';
import { flatAt, stepNet, FLAT_FIELDS, writeWire, commandFromWire, type WireInput } from '../net/protocol';
import { NetPlayer } from '../net/schema';

it('troca conserva munição por arma e cancela recarga sem ganhar balas', () => {
  const w = createWeapon(); w.ammo = 7; w.reserveAmmo = 42; w.reloadRemaining = 1;
  expect(switchWeapon(w, 3)).toBe(true);
  expect(w.ammo).toBe(6); expect(w.reloadRemaining).toBe(0);
  w.ammo = 2;
  switchWeapon(w, 0);
  expect(w.ammo).toBe(7); expect(w.reserveAmmo).toBe(42);
  switchWeapon(w, 3); expect(w.ammo).toBe(2);
  expect(w.equipRemaining).toBe(EQUIP_TIME);
  for (const invalid of [NaN, -1, 4, 1.5, '1', undefined]) expect(switchWeapon(w, invalid)).toBe(false);
});

it('trocar não burla a cadência da sniper, nem reequipa o slot atual', () => {
  const w = createWeapon(2); w.cooldown = 1.1;
  switchWeapon(w, 1); expect(w.cooldown).toBe(1.1);
  w.equipRemaining = 0.1;
  expect(switchWeapon(w, 1)).toBe(false);
  expect(w.equipRemaining).toBe(0.1);
});

it('inventário inteiro reconcilia trocas, tiro, recarga e bloqueia troca morto', () => {
  const spawn = { x: 0, y: 0.85, z: 0 };
  const server = Object.assign(new NetPlayer(), flatAt(spawn));
  const client = flatAt(spawn), wire = {} as WireInput;
  const floor = { min: { x: -10, y: -1, z: -10 }, max: { x: 10, y: 0, z: 10 } };
  for (let i = 0; i < 300; i++) {
    writeWire(wire, { ...emptyCommand(i), weaponSlot: i % 40 === 0 ? (i / 40) % 4 + 1 : 0, fire: i % 10 < 4, reload: i % 40 === 30 });
    const cmd = commandFromWire(wire, i);
    stepNet(server, cmd, 1 / 60, [floor], spawn, createRng(i));
    stepNet(client, cmd, 1 / 60, [floor], spawn, createRng(i + 8));
    for (const key of FLAT_FIELDS) expect(client[key] === server[key], `${key} tick ${i}`).toBe(true);
  }
  server.hp = 0; const weapon = server.weaponIndex;
  stepNet(server, { ...emptyCommand(), weaponSlot: weapon === 0 ? 2 : 1 }, 1 / 60, [floor], spawn, createRng(0));
  expect(server.weaponIndex).toBe(weapon);
});
