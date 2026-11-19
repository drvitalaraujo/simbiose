// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emptyCommand } from '../sim/command';
import { createRng } from '../sim/rng';
import { commandFromWire, FLAT_FIELDS, flatAt, stepNet, writeWire, type WireInput } from './protocol';
import { MoveInput, NetPlayer } from './schema';

const spawn = { x: 0, y: 0.86, z: 0 };
const floor = { min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } };

describe('munição compartilhada pela rede', () => {
  it('comandos serializados e estado replicado preservam munição em uma vida inteira', () => {
    const server = Object.assign(new NetPlayer(), flatAt(spawn));
    const predicted = flatAt(spawn);
    const wire = new MoveInput() as WireInput;
    const secret = createRng(123), local = createRng(456);
    for (let tick = 0; tick < 1700; tick++) {
      const cmd = { ...emptyCommand(tick), fire: true, reload: tick >= 15 && tick < 150, melee: tick === 40 };
      writeWire(wire, cmd);
      const received = commandFromWire(wire, tick);
      const shot = stepNet(server, received, 1 / 60, [floor], spawn, secret);
      const visual = stepNet(predicted, cmd, 1 / 60, [floor], spawn, local);
      expect(!!shot).toBe(!!visual);
      for (const field of FLAT_FIELDS) expect(predicted[field] === server[field], `${field} no tick ${tick}`).toBe(true);
      expect(server.ammo).toBeGreaterThanOrEqual(0);
      expect(server.reserveAmmo).toBeGreaterThanOrEqual(0);
    }
    expect(server.ammo + server.reserveAmmo).toBe(0);
  });

  it('morrer cancela sem transferir; nascer restaura o estoque e a borda de R', () => {
    const p = flatAt(spawn);
    p.ammo = 0;
    p.reloadRemaining = 0.01;
    p.hp = 0;
    expect(stepNet(p, { ...emptyCommand(), fire: true, reload: true }, 1 / 60, [floor], spawn, createRng(1))).toBeNull();
    expect(p).toMatchObject({ ammo: 0, reserveAmmo: 120, reloadRemaining: 0 });
    Object.assign(p, flatAt(spawn));
    expect(p).toMatchObject({ ammo: 30, reserveAmmo: 120, reloadRemaining: 0, reloadHeld: false });
  });
});
