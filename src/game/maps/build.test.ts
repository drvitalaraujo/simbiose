import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Builder } from '../world/builder';
import { ARENA1 } from './arena1';
import { LAPA } from './lapa';
import { FAVELA } from './favela';
import { PATACHO } from './patacho';
import { mapShotBlockers, mapSolids } from './types';
import { clearOfBody } from './facades';

// Monta o mapa de verdade (Three.js) nos dois modos e confere que a roupa do Pelourinho
// não mexe no que é jogo: sólidos, spawns, zonas e proxies de tiro iguais ao greybox; e que
// toda peça saliente da decoração fica fora do alcance do corpo, mesmo pulando.
// Canvas 2D falso: só o necessário para os atlas desenharem sem navegador.

function fakeCanvas() {
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return (t: string) => ({ width: t.length * 10 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  return { width: 0, height: 0, style: {}, getContext: () => ctx };
}

const g = globalThis as unknown as { document?: unknown; location?: unknown };
let search = '';
beforeAll(() => {
  g.document = { createElement: () => fakeCanvas() };
  g.location = { get search() { return search; } };
});
afterAll(() => {
  delete g.document;
  delete g.location;
});

async function build(mode: 'vestido' | 'greybox') {
  search = mode === 'greybox' ? '?greybox' : '';
  const { buildMap } = await import('./build');
  return buildMap(new THREE.Scene(), ARENA1);
}

const boxes = (list: { min: object; max: object }[]) => JSON.stringify(list.map((b) => [b.min, b.max]));

describe('build: vestido = greybox no que é jogo', () => {
  it('Patacho conserva sólidos, proxies de tiro e envelope de pulo entre vestido e greybox', async () => {
    const { buildMap } = await import('./build');
    const { dressPatacho } = await import('./patacho-dress');
    const before = JSON.stringify(PATACHO);
    const hits: number[][] = [];
    for (const mode of ['', '?greybox']) {
      search = mode;
      const world = buildMap(new THREE.Scene(), PATACHO);
      expect(world.solids).toEqual(mapSolids(PATACHO));
      expect(world.shotBlockers).toEqual(mapShotBlockers(PATACHO));
      const rays = [
        [new THREE.Vector3(-14, 1.5, -16), new THREE.Vector3(1, 0, 0)], // cabana norte-central
        [new THREE.Vector3(20, 1.5, -10), new THREE.Vector3(1, 0, 0)], // rancho de pesca leste
        [new THREE.Vector3(-4, 1.5, 3), new THREE.Vector3(1, 0, 0)], // tronco de coqueiro (-3, 3)
        [new THREE.Vector3(11, 0.7, -12), new THREE.Vector3(1, 0, 0)], // canteiro baixo (13, -13)
      ];
      hits.push(
        rays.map(([o, d]) => new THREE.Raycaster(o, d, 0, 40).intersectObjects(world.shootables, false)[0]?.distance ?? -1),
      );
    }
    expect(hits[0]).toEqual(hits[1]);
    expect(hits[0].every((d) => d > 0)).toBe(true);
    expect(JSON.stringify(PATACHO)).toBe(before);

    // Todas as peças suspensas (telhados em 3 camadas, caibros, varais e copas) ficam fora do alcance do corpo.
    const overhangs: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[] = [];
    const b = new Builder(new THREE.Scene());
    dressPatacho(new THREE.Scene(), b, PATACHO, true, overhangs);
    expect(overhangs.length).toBeGreaterThan(200);
    for (const o of overhangs) expect(clearOfBody(PATACHO, o), JSON.stringify(o)).toBe(true);
  }, 20000);
  it('Favela conserva dados e proxies de tiro entre vestido e greybox', async () => {
    const { buildMap } = await import('./build');
    const before = JSON.stringify(FAVELA);
    const hits: number[][] = [];
    for (const mode of ['', '?greybox']) {
      search = mode;
      const world = buildMap(new THREE.Scene(), FAVELA);
      expect(world.solids).toEqual(mapSolids(FAVELA)); expect(world.shotBlockers).toEqual(mapShotBlockers(FAVELA));
      const rays = [
        [new THREE.Vector3(-26, 1.5, -20), new THREE.Vector3(1, 0, 0)],
        [new THREE.Vector3(-19, 4.8, 0), new THREE.Vector3(0, 0, 1)],
        [new THREE.Vector3(0, 1.5, 3), new THREE.Vector3(0, 0, -1)],
      ];
      hits.push(rays.map(([o, d]) => new THREE.Raycaster(o, d, 0, 60).intersectObjects(world.shootables, false)[0]?.distance ?? -1));
    }
    expect(hits[0]).toEqual(hits[1]); expect(hits[0].every(d => d > 0)).toBe(true);
    expect(JSON.stringify(FAVELA)).toBe(before);
  }, 20000); // monta o mapa vestido inteiro duas vezes: lento com a suíte toda em paralelo
  it('Lapa mantém os vãos e as caixas do servidor nos dois visuais', async () => {
    const { buildMap } = await import('./build');
    const before = JSON.stringify(LAPA);
    for (const mode of ['', '?greybox']) {
      search = mode;
      const world = buildMap(new THREE.Scene(), LAPA);
      expect(world.solids).toEqual(mapSolids(LAPA));
      expect(world.shotBlockers).toEqual(mapShotBlockers(LAPA));
      const ray = new THREE.Raycaster(new THREE.Vector3(3, 1.5, 4), new THREE.Vector3(0, 0, -1), 0, 8);
      expect(ray.intersectObjects(world.shootables, false)).toHaveLength(0);
      ray.set(new THREE.Vector3(0, 1.5, 4), new THREE.Vector3(0, 0, -1));
      expect(ray.intersectObjects(world.shootables, false)[0].distance).toBeCloseTo(2.9);
    }
    expect(JSON.stringify(LAPA)).toBe(before);
  });
  it('mesmos sólidos (ordem e coordenadas), spawns e mapa intacto', async () => {
    const before = JSON.stringify(ARENA1);
    const dressed = await build('vestido');
    const grey = await build('greybox');
    expect(dressed.solids).toHaveLength(ARENA1.solids.length);
    expect(boxes(dressed.solids)).toBe(boxes(ARENA1.solids.map((s) => s.box)));
    expect(boxes(grey.solids)).toBe(boxes(dressed.solids));
    expect(dressed.shotBlockers).toEqual(ARENA1.solids.filter((s) => s.kind !== 'bound').map((s) => s.box));
    expect(grey.shotBlockers).toEqual(dressed.shotBlockers);
    expect(dressed.playerSpawn).toEqual(grey.playerSpawn);
    expect(dressed.droneSpawns).toEqual(grey.droneSpawns);
    // Spawns, sites e zonas vêm dos dados: montar não pode alterá-los
    expect(JSON.stringify(ARENA1)).toBe(before);
  });

  it('proxies de tiro cobrem as mesmas caixas (achado M2: tampa do pedestal)', async () => {
    const dressed = await build('vestido');
    const grey = await build('greybox');
    const ray = new THREE.Raycaster();
    const hit = (w: typeof dressed, o: THREE.Vector3, d: THREE.Vector3) => {
      ray.set(o, d);
      ray.far = 30;
      return ray.intersectObjects(w.shootables, false)[0]?.distance ?? null;
    };
    const rays: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(40, 3.18, -25), new THREE.Vector3(1, 0, 0)], // rente ao topo do pedestal
      [new THREE.Vector3(0, 3.9, 8), new THREE.Vector3(0, 0, -1)], // rente ao topo do chafariz
      [new THREE.Vector3(-53, 1.5, 0), new THREE.Vector3(-1, 0, 0)], // muro da ladeira A
      [new THREE.Vector3(51, 6, -20), new THREE.Vector3(0, 0, -1)], // fachada da igreja
      [new THREE.Vector3(-30, 0.5, -24), new THREE.Vector3(-1, 0, 0)], // caixotes do site A
    ];
    for (const [o, d] of rays) {
      const a = hit(grey, o, d);
      expect(a, `greybox ${o.toArray()}`).not.toBeNull();
      expect(hit(dressed, o, d), `vestido ${o.toArray()}`).toBeCloseTo(a!, 3);
    }
  });
});

describe('build: decoração fora do alcance do corpo (achado H1)', () => {
  it('toda peça saliente registrada passa no envelope de pulo', async () => {
    search = '';
    const { createDress, dressDetails, dressFacades, reserveTeloes } = await import('./pelourinho-dress');
    const b = new Builder(new THREE.Scene());
    const d = createDress(new THREE.Scene(), b, ARENA1);
    reserveTeloes(d);
    dressFacades(d);
    dressDetails(d);
    expect(d.overhangs.length).toBeGreaterThan(100);
    for (const o of d.overhangs) expect(clearOfBody(ARENA1, o), JSON.stringify(o)).toBe(true);
    // Nada de sólido novo: a decoração não entra na colisão
    expect(b.solids).toHaveLength(0);
  });
});
