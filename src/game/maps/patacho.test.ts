import { lineOfSight } from '../../sim/ray';
import { describe, expect, it } from 'vitest';
import { PATACHO } from './patacho';
import { buildNav, nodeAt, walkDistances } from './nav';
import { mapSolids, mapShotBlockers } from './types';
import { mapToSvg } from './svg';
import { getMap } from '../../net/maps';
import { viewsFor } from '../render/bench';
const nav = buildNav(PATACHO);
const start = nodeAt(nav, PATACHO.playerSpawn, 0.05)!;
const distances = walkDistances(nav, start);
describe('Patacho', () => {
  it('nascimentos têm apoio real, corpo livre e caminho nos dois sentidos', () => {
    expect(start).not.toBeNull();
    for (const p of [...PATACHO.spawns.ffa, ...PATACHO.spawns.attack, ...PATACHO.spawns.defend, PATACHO.playerSpawn]) {
      const body = {
        min: { x: p.x - 0.35, y: p.y + 0.01, z: p.z - 0.35 },
        max: { x: p.x + 0.35, y: p.y + 1.71, z: p.z + 0.35 },
      };
      const solids = mapSolids(PATACHO);
      expect(
        solids.some(
          (b) =>
            body.min.x < b.max.x &&
            body.max.x > b.min.x &&
            body.min.y < b.max.y &&
            body.max.y > b.min.y &&
            body.min.z < b.max.z &&
            body.max.z > b.min.z,
        ),
        JSON.stringify(p),
      ).toBe(false);
      expect(
        solids.some(
          (b) =>
            Math.abs(b.max.y - p.y) < 0.01 &&
            b.min.x <= body.min.x &&
            b.max.x >= body.max.x &&
            b.min.z <= body.min.z &&
            b.max.z >= body.max.z,
        ),
        `apoio ${JSON.stringify(p)}`,
      ).toBe(true);
      const id = nodeAt(nav, p, 0.05);
      expect(id).not.toBeNull();
      expect(Number.isFinite(distances[id!]), JSON.stringify(p)).toBe(true);
      expect(Number.isFinite(walkDistances(nav, id!)[start]), JSON.stringify(p)).toBe(true);
    }
  });

  it('fecha o corredor de 70 m e os três pares de nascimentos expostos', () => {
    const blockers = mapShotBlockers(PATACHO);
    for (const x of [26, 27, 28, 29])
      expect(lineOfSight({ x, y: 1.5, z: -35 }, { x, y: 1.5, z: 35 }, blockers)).toBe(false);
    for (const [a, b] of [
      [3, 5],
      [2, 4],
      [6, 7],
    ]) {
      expect(lineOfSight({ ...PATACHO.spawns.ffa[a], y: 1.6 }, { ...PATACHO.spawns.ffa[b], y: 1.2 }, blockers)).toBe(
        false,
      );
    }
  });
  it('servidor e treino compartilham colisão e tiros', () => {
    expect(getMap('patacho').solids).toEqual(mapSolids(PATACHO));
    expect(getMap('patacho').shotBlockers).toEqual(mapShotBlockers(PATACHO));
  });
  it('câmeras têm apoio e corpo livre', () => {
    for (const [, x, y, z] of viewsFor('?map=patacho')) expect(nodeAt(nav, { x, y: y - 0.86, z }, 0.05)).not.toBeNull();
  });
  it('planta atualizada', async () => {
    await expect(mapToSvg(PATACHO)).toMatchFileSnapshot('../../../docs/maps/patacho.svg');
  });
});
