// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emptyCommand } from '../sim/command';
import { createRng } from '../sim/rng';
import { flatAt, FLAT_FIELDS, stepNet } from './protocol';
import { SlipperCombat, type SlipperPlayer, type SlipperProjectile } from './slipper-combat';
import type { ShotMsg } from './feed';

const body = (x: number, z: number): SlipperPlayer => ({ ...flatAt({ x, y: 0.8501, z }), life: 1 });
describe('Chinelada autoritativa', () => {
  it('arremesso na cabeça causa os 100 de dano aprovados', () => {
    const c = new SlipperCombat(new Map());
    const a = body(0, 0), b = body(0, -4);
    a.pitch = 0.06;
    const rows = new Map([['a', a], ['b', b]]);
    const hits: { msg: ShotMsg; damage: number }[] = [];
    const receive = (msg: ShotMsg, damage: number) => hits.push({ msg, damage });
    c.action('a', a, 'throw', 1, [], rows, receive);
    for (let i = 0; i < 30; i++) c.tick(1 / 60, [], rows, receive);
    expect(hits.find(h => h.msg.t === 'b')).toMatchObject({ msg: { part: 'head' }, damage: 100 });
  });
  it('golpe causa 50 de frente e 100 pelas costas, parede bloqueia', () => {
    const c = new SlipperCombat(new Map());
    const a = body(0, 0), b = body(0, -1.4);
    const rows = new Map([['a', a], ['b', b]]);
    const hits: { msg: ShotMsg; damage: number }[] = [];
    b.yaw = Math.PI;
    c.action('a', a, 'melee', 1, [], rows, (msg, damage) => hits.push({ msg, damage }));
    expect(hits[0]).toMatchObject({ msg: { t: 'b', weapon: 'chinelo' }, damage: 50 });
    b.yaw = 0;
    c.action('a', a, 'melee', 2, [], rows.entries(), (msg, damage) => hits.push({ msg, damage }));
    expect(hits[1].damage).toBe(100);
    for (const distance of [0.4, 0.6, 1.4]) {
      const close = body(0, -distance);
      c.action('a', a, 'melee', 2, [], new Map([['a', a], ['b', close]]), (_msg, damage) => expect(damage).toBe(100));
    }
    c.action('a', a, 'melee', 3, [{ min: { x: -1, y: 0, z: -0.8 }, max: { x: 1, y: 3, z: -0.7 } }], rows, (msg, damage) => hits.push({ msg, damage }));
    expect(hits[2].msg.t).toBeUndefined();
  });

  it('arremesso viaja, acerta só uma vez por vítima e pode ser recolhido pelo dono', () => {
    const drops = new Map<string, SlipperProjectile>();
    const c = new SlipperCombat(drops);
    const a = body(0, 0), b = body(0, -4);
    a.pitch = -0.1; a.slipperReady = false;
    const rows = new Map([['a', a], ['b', b]]);
    const hits: ShotMsg[] = [];
    const receive = (m: ShotMsg) => hits.push(m);
    c.action('a', a, 'throw', 1, [], rows, receive);
    expect(hits.filter(h => h.t)).toHaveLength(0);
    const floor = [{ min: { x: -20, y: -1, z: -20 }, max: { x: 20, y: 0, z: 20 } }];
    for (let i = 0; i < 100; i++) c.tick(1 / 60, floor, rows, receive);
    expect(hits.filter(h => h.t === 'b')).toHaveLength(1);
    const drop = [...drops.values()][0];
    expect(drop.resting).toBe(true);
    a.x = drop.x; a.z = drop.z;
    c.tick(1 / 60, floor, rows, receive);
    expect(a.slipperReady).toBe(true);
    expect(drops.size).toBe(0);
  });

  it('vida nova remove projétil velho e campos de slide/chinelo fazem parte da reconciliação', () => {
    const drops = new Map<string, SlipperProjectile>();
    const c = new SlipperCombat(drops);
    const a = body(0, 0);
    c.action('a', a, 'throw', 1, [], new Map(), () => {});
    a.life++;
    c.tick(1 / 60, [], new Map([['a', a]]), () => {});
    expect(drops.size).toBe(0);
    expect(FLAT_FIELDS).toEqual(expect.arrayContaining(['sliding', 'slideTime', 'slideCooldown', 'slideHeld', 'slipperReady', 'slipperCooldown', 'meleeHeld', 'throwHeld']));
  });

  it('predição e autoridade avançam os mesmos estados com entradas de slide e arremesso', () => {
    const spawn = { x: 0, y: 0.8501, z: 0 };
    const a = flatAt(spawn), b = flatAt(spawn);
    const floor = [{ min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } }];
    for (let i = 0; i < 100; i++) {
      const cmd = { ...emptyCommand(i), moveZ: 1, sprint: true, crouch: i >= 30, throwSlipper: i === 40 };
      stepNet(a, cmd, 1 / 60, floor, spawn, createRng(1));
      stepNet(b, cmd, 1 / 60, floor, spawn, createRng(2));
      expect(a).toEqual(b);
    }
    expect(a.slipperReady).toBe(false);
  });
});
