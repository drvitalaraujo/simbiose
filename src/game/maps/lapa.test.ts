import { describe, expect, it } from 'vitest';
import { LAPA, LAPA_ARCADE, LAPA_STAIRS } from './lapa';
import { buildNav, nodeAt, walkDistances } from './nav';
import { mapToSvg } from './svg';
import { mapShotBlockers, mapSolids } from './types';
import { getMap } from '../../net/maps';
import { lineOfSight } from '../../sim/ray';
import { createPlayer, stepPlayer } from '../../sim/player';
import { emptyCommand } from '../../sim/command';

const nav = buildNav(LAPA);
const spawns = [...LAPA.spawns.ffa, ...LAPA.spawns.attack, ...LAPA.spawns.defend, LAPA.playerSpawn];

describe('Lapa: arena e monumento', () => {
  it('spawns com corpo livre, chão e ligação de ida e volta', () => {
    const start = nodeAt(nav, LAPA.playerSpawn, 0.05)!;
    expect(start).not.toBeNull();
    const out = walkDistances(nav, start);
    for (const p of spawns) {
      const body = { min: { x: p.x - 0.35, y: p.y + 0.01, z: p.z - 0.35 },
        max: { x: p.x + 0.35, y: p.y + 1.71, z: p.z + 0.35 } };
      expect(mapSolids(LAPA).some(b => body.min.x < b.max.x && body.max.x > b.min.x &&
        body.min.y < b.max.y && body.max.y > b.min.y && body.min.z < b.max.z && body.max.z > b.min.z), JSON.stringify(p)).toBe(false);
      expect(mapSolids(LAPA).some(b => p.x > b.min.x && p.x < b.max.x && p.z > b.min.z && p.z < b.max.z &&
        Math.abs(b.max.y - p.y) < 0.01), `sem apoio real em ${JSON.stringify(p)}`).toBe(true);
      const id = nodeAt(nav, p, 0.05);
      expect(id).not.toBeNull();
      expect(Number.isFinite(out[id!]), `não chega em ${JSON.stringify(p)}`).toBe(true);
      expect(Number.isFinite(walkDistances(nav, id!)[start])).toBe(true);
    }
  });

  it('terraço sobe e desce andando pelas duas escadas, usando a física real', () => {
    const solids = mapSolids(LAPA);
    const go = (start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }) => {
      const player = createPlayer({ ...start, y: start.y + 0.85 });
      player.onGround = true;
      for (let tick = 0; tick < 240; tick++) {
        const dx = end.x - player.pos.x, dz = end.z - player.pos.z;
        if (Math.hypot(dx, dz) < 0.15) break;
        stepPlayer(player, { ...emptyCommand(tick), moveZ: 1, yaw: Math.atan2(-dx, -dz) }, 1 / 60, solids);
      }
      expect(Math.hypot(player.pos.x - end.x, player.pos.z - end.z)).toBeLessThan(0.2);
      expect(player.pos.y).toBeCloseTo(end.y + 0.85, 2);
      expect(player.onGround).toBe(true);
    };
    for (const [bottom, top] of [
      [{ x: 4, y: 0, z: 31.5 }, { x: 12, y: 1.6, z: 31.5 }],
      [{ x: 20.5, y: 0, z: 22 }, { x: 20.5, y: 1.6, z: 30 }],
    ]) { go(bottom, top); go(top, bottom); }
    for (let i = 0; i < LAPA_STAIRS.length; i++) {
      const previous = i % 4 === 0 ? 0 : LAPA_STAIRS[i - 1].box.max.y;
      expect(LAPA_STAIRS[i].box.max.y - previous).toBeLessThanOrEqual(0.40001);
    }
  });

  it('becos contornam ilhas por ambos os lados e o perímetro tem recuos reais', () => {
    const blockers = mapShotBlockers(LAPA);
    const west = { x: -39, y: 0, z: 20 }, east = { x: -19, y: 0, z: 20 };
    expect(lineOfSight({ ...west, y: 1.5 }, { ...east, y: 1.5 }, blockers)).toBe(false);
    // Duas voltas curtas conectam os mesmos lados da ilha: não é um fundo sem saída.
    for (const z of [12, 28]) {
      const target = { x: -29, y: 0, z };
      const distances = walkDistances(nav, nodeAt(nav, target, 0.05)!);
      expect(distances[nodeAt(nav, west, 0.05)!]).toBeLessThan(21);
      expect(distances[nodeAt(nav, east, 0.05)!]).toBeLessThan(21);
    }
    // A antiga volta retangular ao norte deixou de existir; o beco ocupa recortes de profundidades distintas.
    for (const p of [{ x: -47, y: 0, z: 25 }, { x: -7, y: 0, z: 36 }, { x: 40, y: 0, z: 40 }])
      expect(nodeAt(nav, p, 0.05)).toBeNull();
    for (const p of [{ x: -39, y: 0, z: 28 }, { x: -20, y: 0, z: 37 }, { x: 4, y: 0, z: 40 }])
      expect(nodeAt(nav, p, 0.05)).not.toBeNull();
  });

  it('arquitetura corta miras de ponta a ponta e reduz nascimentos expostos', () => {
    const blockers = mapShotBlockers(LAPA);
    for (const z of [-22, -5, 5, 18, 30])
      expect(lineOfSight({ x: -46, y: 1.5, z }, { x: 46, y: 1.5, z }, blockers)).toBe(false);
    // Um duelo de média distância permanece no largo principal.
    expect(lineOfSight({ x: -19, y: 1.5, z: 21 }, { x: 22, y: 1.5, z: 21 }, blockers)).toBe(true);
    let visible = 0;
    for (let i = 0; i < LAPA.spawns.ffa.length; i++) for (let j = i + 1; j < LAPA.spawns.ffa.length; j++) {
      const a = LAPA.spawns.ffa[i], b = LAPA.spawns.ffa[j];
      if (lineOfSight({ ...a, y: a.y + 1.5 }, { ...b, y: b.y + 1.5 }, blockers)) visible++;
    }
    // O mapa antigo expunha 19 dos 45 pares de spawn. Proteção vem dos volumes, não de invulnerabilidade.
    expect(visible).toBeLessThanOrEqual(10);
  });

  it('cada vão inferior atravessa a praça e os pilares bloqueiam tiros', () => {
    const a = LAPA_ARCADE;
    const blockers = mapShotBlockers(LAPA);
    for (let i = 0; i < a.bays; i++) {
      const x = a.start + (i + 0.5) * a.pitch;
      const one = nodeAt(nav, { x, y: 0, z: 4 })!;
      const other = nodeAt(nav, { x, y: 0, z: -4 })!;
      expect(walkDistances(nav, one)[other]).toBeLessThan(10);
      expect(lineOfSight({ x, y: 1.5, z: 4 }, { x, y: 1.5, z: -4 }, blockers)).toBe(true);
      const pier = a.start + i * a.pitch;
      expect(lineOfSight({ x: pier, y: 1.5, z: 4 }, { x: pier, y: 1.5, z: -4 }, blockers)).toBe(false);
    }
  });

  it('cliente e servidor partilham colisão, tiro e spawns', () => {
    const net = getMap('lapa');
    expect(net.id).toBe('lapa'); expect(net.data).toBe(LAPA);
    expect(net.solids).toEqual(mapSolids(LAPA));
    expect(net.shotBlockers).toEqual(mapShotBlockers(LAPA));
    expect(net.spawns).toEqual(LAPA.spawns.ffa.map(p => ({ ...p, y: p.y + 0.86 })));
    for (const [x, y, z] of LAPA.droneSpawns) {
      expect(y).toBeGreaterThanOrEqual(LAPA.wallHeight + 6);
      expect(mapSolids(LAPA).some(b => x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z)).toBe(false);
    }
  });

  it('planta em docs/maps/lapa.svg atualizada', async () => {
    await expect(mapToSvg(LAPA)).toMatchFileSnapshot('../../../docs/maps/lapa.svg');
  });
});
