import { describe, expect, it } from 'vitest';
import { getMap } from '../../net/maps';
import { lineOfSight } from '../../sim/ray';
import { FAVELA, FAVELA_STAIRWAYS, FAVELA_TERRACES } from './favela';
import { buildNav, longestSightline, nodeAt, nodePos, walkDistances } from './nav';
import { mapToSvg } from './svg';
import { mapShotBlockers, mapSolids } from './types';

const nav = buildNav(FAVELA);
const blockers = mapShotBlockers(FAVELA);
const start = nodeAt(nav, FAVELA.playerSpawn, 0.05)!;
const distances = walkDistances(nav, start);
const eye = (p: { x: number; y: number; z: number }) => ({ ...p, y: p.y + 1.5 });
describe('Favela: quarteirões, largos e rotas de flanco', () => {
  it('nascimentos têm apoio real, corpo livre e caminho nos dois sentidos', () => {
    expect(start).not.toBeNull();
    for (const p of [...FAVELA.spawns.ffa, ...FAVELA.spawns.attack, ...FAVELA.spawns.defend, FAVELA.playerSpawn]) {
      const body = { min: { x: p.x - 0.35, y: p.y + 0.01, z: p.z - 0.35 }, max: { x: p.x + 0.35, y: p.y + 1.71, z: p.z + 0.35 } };
      const solids = mapSolids(FAVELA);
      expect(solids.some(b => body.min.x < b.max.x && body.max.x > b.min.x && body.min.y < b.max.y && body.max.y > b.min.y && body.min.z < b.max.z && body.max.z > b.min.z), JSON.stringify(p)).toBe(false);
      expect(solids.some(b => Math.abs(b.max.y - p.y) < 0.01 && b.min.x <= body.min.x && b.max.x >= body.max.x && b.min.z <= body.min.z && b.max.z >= body.max.z), `apoio ${JSON.stringify(p)}`).toBe(true);
      const id = nodeAt(nav, p, 0.05); expect(id).not.toBeNull();
      expect(Number.isFinite(distances[id!]), JSON.stringify(p)).toBe(true);
      expect(Number.isFinite(walkDistances(nav, id!)[start]), JSON.stringify(p)).toBe(true);
    }
  });

  it('quatro subidas, por eixos distintos, alcançam lajes de alturas diferentes sem pular', () => {
    expect(FAVELA_TERRACES.map(s => s.box.max.y)).toEqual([2.4, 3.2]);
    for (const stair of FAVELA_STAIRWAYS) {
      const bottom = nodeAt(nav, stair.bottom, 0.05), top = nodeAt(nav, stair.top, 0.05);
      expect(bottom, stair.name).not.toBeNull(); expect(top, stair.name).not.toBeNull();
      expect(walkDistances(nav, bottom!)[top!], stair.name).toBeLessThan(stair.steps.length + 4);
      expect(walkDistances(nav, top!)[bottom!], stair.name).toBeLessThan(stair.steps.length + 4);
      let y = 0;
      for (const step of stair.steps) { expect(step.box.max.y - y).toBeLessThanOrEqual(0.40001); y = step.box.max.y; }
    }
  });

  it('cada circuito lateral liga os dois times mesmo com a quadra completamente fechada', () => {
    for (const side of [-1, 1]) {
      const route = { ...nav, floors: nav.floors.slice() };
      for (let id = 0; id < route.floors.length; id++) {
        if (!Number.isFinite(route.floors[id])) continue;
        const p = nodePos(route, id);
        if (p.z > -14 && p.z < 14 && (side < 0 ? p.x > -11 : p.x < 11)) route.floors[id] = NaN;
      }
      const a = nodeAt(route, FAVELA.spawns.attack[2], 0.05)!;
      const b = nodeAt(route, FAVELA.spawns.defend[2], 0.05)!;
      expect(walkDistances(route, a)[b], side < 0 ? 'flanco oeste' : 'flanco leste').toBeLessThan(125);
      expect(walkDistances(route, b)[a]).toBeLessThan(125);
    }
  });

  it('quarteirões recortam os quatro cantos e quebram as antigas retas periféricas', () => {
    for (const x of [-34, 34]) for (const z of [-30, 30]) expect(nodeAt(nav, { x, y: 0, z }, 0.05)).toBeNull();
    for (const x of [-26, 26]) expect(lineOfSight({ x, y: 1.5, z: -28 }, { x, y: 1.5, z: 28 }, blockers)).toBe(false);
    // Uma diagonal residual serve às armas de alcance; ninguém domina o perímetro inteiro.
    expect(longestSightline(nav, distances, 2).length).toBeLessThan(55);
    expect(lineOfSight({ x: 0, y: 1.5, z: -5 }, { x: 0, y: 1.5, z: 13 }, blockers)).toBe(true);
  });

  it('times nascem protegidos; exposição entre pares FFA fica abaixo do mapa anterior', () => {
    for (const a of FAVELA.spawns.attack) for (const b of FAVELA.spawns.defend) expect(lineOfSight(eye(a), eye(b), blockers)).toBe(false);
    let visible = 0;
    for (let i = 0; i < FAVELA.spawns.ffa.length; i++) for (const b of FAVELA.spawns.ffa.slice(i + 1)) if (lineOfSight(eye(FAVELA.spawns.ffa[i]), eye(b), blockers)) visible++;
    expect(visible).toBeLessThan(9);
  });

  it('treino e servidor usam o mesmo mapa e entradas de drones livres', () => {
    const net = getMap('favela'); expect(net.data).toBe(FAVELA);
    expect(net.solids).toEqual(mapSolids(FAVELA)); expect(net.shotBlockers).toEqual(blockers);
    expect(net.spawns).toEqual(FAVELA.spawns.ffa.map(p => ({ ...p, y: p.y + 0.86 })));
    for (const [x, y, z] of FAVELA.droneSpawns) {
      expect(y).toBeGreaterThan(FAVELA.wallHeight + 6);
      expect(mapSolids(FAVELA).some(b => x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z)).toBe(false);
    }
  });

  it('planta atualizada em docs/maps/favela.svg', async () => {
    await expect(mapToSvg(FAVELA)).toMatchFileSnapshot('../../../docs/maps/favela.svg');
  });
});
