// @vitest-environment node
import { expect, it } from 'vitest';
import type { ShotEvent } from '../sim/events';
import { gunMessages } from './gun-combat';
import { flatAt } from './protocol';

const origin = { x: 0, y: 1.35, z: 0 };
const shot: ShotEvent = { type: 'shot', origin, dir: { x: 0, y: 0, z: -1 }, end: { x: 0, y: 1.35, z: -45 }, hit: 'none' };
const wall = { min: { x: -10, y: 0, z: -9 }, max: { x: 10, y: 3, z: -8 } };

it('envia marcas de todos os projéteis que param na parede, mesmo acertando um personagem', () => {
  const target = { id: 'b', pose: { ...flatAt({ x: 0, y: 0.8501, z: -4 }), yaw: 0 } };
  const side = { ...shot, dir: { x: 0.2, y: 0, z: -Math.sqrt(0.96) } };
  const messages = gunMessages('a', 1, 3, { ...shot, pellets: [shot, side] }, [wall], [target]);
  expect(messages).toHaveLength(1);
  expect(messages[0].t).toBe('b');
  expect(messages[0].impacts).toHaveLength(1);
  expect(messages[0].impacts![0][2]).toBe(-8);
  expect(messages[0].pellets).toHaveLength(2);
});

it('não envia impactos para personagens ou tiros no vazio; parede tem ponto quantizado', () => {
  expect(gunMessages('a', 1, 0, shot, [], [])[0].impacts).toBeUndefined();
  expect(gunMessages('a', 1, 0, shot, [wall], [])[0].impacts).toEqual([[0, 1.35, -8]]);
});
