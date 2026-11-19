import { describe, expect, it } from 'vitest';
import type { Box, Vec3 } from '../physics';
import { insideAny, MAX_RISE } from '../world/shapes';
import { ARENA1 } from './arena1';
import { buildNav, distanceToRect, entrances, longestSightline, nodeAt, walkDistances } from './nav';
import { mapToSvg } from './svg';
import { floorAt } from './facades';

const map = ARENA1;
const nav = buildNav(map);
const boxes = map.solids.map((s) => s.box);
const zone = (id: string) => map.zones.find((z) => z.id === id)!;
const center = (ps: Vec3[]): Vec3 => ({
  x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
  y: ps[0].y,
  z: ps.reduce((s, p) => s + p.z, 0) / ps.length,
});
const allSpawns = [...map.spawns.attack, ...map.spawns.defend, ...map.spawns.ffa, map.playerSpawn];
// Corpo do jogador em pé (centro = pés + 0.86)
const body = (p: Vec3) => [
  { x: p.x, y: p.y + 0.1, z: p.z },
  { x: p.x, y: p.y + 0.86, z: p.z },
  { x: p.x, y: p.y + 1.65, z: p.z },
];

function distFrom(p: Vec3) {
  const id = nodeAt(nav, p);
  expect(id, `sem piso em ${JSON.stringify(p)}`).not.toBeNull();
  return walkDistances(nav, id!);
}

const atk = distFrom(center(map.spawns.attack));
const def = distFrom(center(map.spawns.defend));
const sites = map.zones.filter((z) => z.site);

describe('arena1: spawns', () => {
  it('ninguém nasce dentro de sólido nem no ar', () => {
    for (const p of allSpawns) {
      for (const q of body(p)) expect(insideAny(q, boxes), `dentro de sólido: ${JSON.stringify(p)}`).toBe(false);
      expect(nodeAt(nav, p, 0.05), `sem chão: ${JSON.stringify(p)}`).not.toBeNull();
    }
  });

  it('tem 5 spawns por time e 8–12 de FFA bem espalhados', () => {
    expect(map.spawns.attack).toHaveLength(5);
    expect(map.spawns.defend).toHaveLength(5);
    const ffa = map.spawns.ffa;
    expect(ffa.length).toBeGreaterThanOrEqual(8);
    expect(ffa.length).toBeLessThanOrEqual(12);
    for (let i = 0; i < ffa.length; i++) {
      for (let j = i + 1; j < ffa.length; j++) {
        expect(Math.hypot(ffa[i].x - ffa[j].x, ffa[i].z - ffa[j].z), `FFA ${i} e ${j} muito perto`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('drones nascem no alto, dentro do mapa e fora de sólidos', () => {
    const { x0, z0, x1, z1 } = map.bounds;
    for (const [x, y, z] of map.droneSpawns) {
      expect(y).toBeGreaterThanOrEqual(map.wallHeight + 6);
      expect(x > x0 && x < x1 && z > z0 && z < z1).toBe(true);
      expect(insideAny({ x, y, z }, boxes)).toBe(false);
    }
  });
});

describe('arena1: caminhos', () => {
  it('de qualquer spawn se chega a todos os outros andando (ida e volta)', () => {
    for (const p of allSpawns) {
      const id = nodeAt(nav, p)!;
      expect(Number.isFinite(atk[id]), `ataque não chega em ${JSON.stringify(p)}`).toBe(true);
      expect(Number.isFinite(def[id]), `defesa não chega em ${JSON.stringify(p)}`).toBe(true);
      const back = walkDistances(nav, id);
      expect(Number.isFinite(back[nodeAt(nav, center(map.spawns.attack))!])).toBe(true);
    }
  });

  it('posições altas (palco, céu, sacadas, alto do largo, adro) são alcançáveis andando', () => {
    for (const p of [
      { x: -46, y: 1.2, z: -24 }, { x: -58, y: 2.8, z: -30 }, { x: -10, y: 1.6, z: -10 },
      { x: 10, y: 1.6, z: -10 }, { x: 0, y: 1.2, z: -6.5 }, { x: 53, y: 2, z: -32 },
      { x: -47, y: 2.8, z: 15 }, { x: 49, y: 3.2, z: 23 },
      { x: 49, y: 0.3, z: -5.5 }, { x: 38, y: 2.2, z: 13.5 },
    ]) {
      const id = nodeAt(nav, p, 0.05);
      expect(id, `sem piso em ${JSON.stringify(p)}`).not.toBeNull();
      expect(Number.isFinite(atk[id!]), `não alcança ${JSON.stringify(p)}`).toBe(true);
    }
  });

  it('degraus e terraços não passam de 0.4 (sem rampa, só AABB)', () => {
    const touches = (a: Box, b: Box) =>
      a.min.x <= b.max.x + 1e-6 && a.max.x >= b.min.x - 1e-6 && a.min.z <= b.max.z + 1e-6 && a.max.z >= b.min.z - 1e-6;
    for (const s of map.solids.filter((s) => s.kind === 'stairs' || s.kind === 'terrace')) {
      // Algum piso encostado (chão, terraço ou degrau anterior) fica no máximo MAX_RISE abaixo
      const lower = map.solids.filter((o) => o !== s && touches(o.box, s.box) &&
        o.box.max.y < s.box.max.y - 1e-6 && s.box.max.y - o.box.max.y <= MAX_RISE + 1e-6);
      expect(lower.length, `degrau alto em ${JSON.stringify(s.box)}`).toBeGreaterThan(0);
    }
  });

  it('cada site tem 2 ou 3 entradas', () => {
    for (const s of sites) {
      const n = entrances(nav, atk, s.rect);
      expect(n, `${s.name}: ${n} entradas`).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('tempos equilibrados: A ≈ B para cada time, meio ≈ igual para os dois times', () => {
    const tol = 0.15;
    const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b);
    const [A, B] = [zone('siteA').rect, zone('siteB').rect];
    const mid = zone('mid').rect;
    const m = {
      atkA: distanceToRect(nav, atk, A), atkB: distanceToRect(nav, atk, B), atkMid: distanceToRect(nav, atk, mid),
      defA: distanceToRect(nav, def, A), defB: distanceToRect(nav, def, B), defMid: distanceToRect(nav, def, mid),
    };
    console.info('arena1 distâncias a pé (m):', Object.fromEntries(Object.entries(m).map(([k, d]) => [k, Math.round(d)])));
    expect(rel(m.atkA, m.atkB)).toBeLessThanOrEqual(tol);
    expect(rel(m.defA, m.defB)).toBeLessThanOrEqual(tol);
    expect(rel(m.atkMid, m.defMid)).toBeLessThanOrEqual(tol);
    // Modo bomba: a defesa chega antes nos sites (uns 5–9 s andando a 7 m/s)
    for (const [a, d] of [[m.atkA, m.defA], [m.atkB, m.defB]]) {
      expect(a - d).toBeGreaterThan(5 * 7);
      expect(a - d).toBeLessThan(9 * 7);
    }
  });
});

describe('arena1: leitura', () => {
  it('o largo afunila até a igreja e desce em microdegraus caminháveis', () => {
    const slopes = map.solids.filter(s => s.kind === 'terrace' && s.tint === 'routeB');
    expect(slopes).toHaveLength(32);
    expect(slopes[0].box.max.x - slopes[0].box.min.x).toBe(16);
    expect(slopes.at(-1)!.box.max.x - slopes.at(-1)!.box.min.x).toBe(28);
    for (let i = 0; i < slopes.length; i++) {
      const b = slopes[i].box;
      const height = floorAt(map, 49, (b.min.z + b.max.z) / 2);
      expect(height).toBeCloseTo((i + 1) / 10, 5);
      const id = nodeAt(nav, { x: 49, y: height, z: (b.min.z + b.max.z) / 2 }, 0.05)!;
      expect(id).not.toBeNull();
      expect(Number.isFinite(atk[id])).toBe(true);
    }
  });

  it('nenhuma linha de visão no térreo passa de ~50 m', () => {
    const s = longestSightline(nav, atk);
    console.info('arena1 maior linha de visão:', Math.round(s.length), 'm', s.from, '->', s.to);
    expect(s.length).toBeLessThanOrEqual(55); // ~50 m, com folga para o canto do spawn
  });

  it('zonas não se sobrepõem (o piso colorido não briga)', () => {
    const zs = map.zones;
    for (let i = 0; i < zs.length; i++) {
      for (let j = i + 1; j < zs.length; j++) {
        const a = zs[i].rect;
        const b = zs[j].rect;
        const hit = a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
        expect(hit, `${zs[i].id} x ${zs[j].id}`).toBe(false);
      }
    }
  });

  it('planta baixa em docs/maps está atualizada (rode com -u para regerar)', async () => {
    await expect(mapToSvg(map)).toMatchFileSnapshot('../../../docs/maps/arena1.svg');
  });
});
