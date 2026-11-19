import { Builder } from '../world/builder';
import { createGrime, floorDecal, wallDecal } from '../world/street-grime';
import { rng } from '../world/shapes';
import { coverAt, exposedFaces, facePoint, floorAt } from './facades';
import { FAVELA_HOUSES, FAVELA_TERRACES } from './favela';
import type { FavelaWindow } from './favela-roofs';
import type { MapData } from './types';

// Chão e sujeira da Favela do Sol: cimento em placas de 4 m com juntas, folhas e terra junto às
// paredes, rachaduras, manchas, lixo miúdo e escorrido sob as janelas. Só decalques planos.

export function favelaGround(b: Builder, map: MapData, windows: FavelaWindow[]) {
  const k = createGrime();
  const r = rng(6060);
  const { x0, z0, x1, z1 } = map.bounds;
  const open = (x: number, z: number) => coverAt(map, x, z) === 0 && floorAt(map, x, z) === 0;
  for (let x = x0; x < x1; x += 4) {
    for (let z = z0; z < z1; z += 4) {
      const corners = [[x + 0.5, z + 0.5], [x + 3.5, z + 0.5], [x + 0.5, z + 3.5], [x + 3.5, z + 3.5], [x + 2, z + 2]];
      if (!corners.some(([cx, cz]) => open(cx, cz))) continue;
      if (x < 10 && x + 4 > -10 && z < 14 && z + 4 > -7) continue; // a quadra tem pintura própria
      // Gira a placa em passos de 90°: as manchas não se repetem lado a lado
      floorDecal(b, k.mat, k.slab, x + 2, 0.012, z + 2, 4, 4, Math.floor(r() * 4) * (Math.PI / 2));
    }
  }
  // Lajes de cima das escadinhas: o mesmo cimento, na altura de cada laje
  for (const t of FAVELA_TERRACES) {
    const { min: p, max: q } = t.box;
    for (let x = p.x; x < q.x - 0.01; x += 4) for (let z = p.z; z < q.z - 0.01; z += 4) {
      const w = Math.min(4, q.x - x);
      const d = Math.min(4, q.z - z);
      floorDecal(b, k.mat, { ...k.slab, u1: k.slab.u0 + (k.slab.u1 - k.slab.u0) * (w / 4), v0: k.slab.v1 - (k.slab.v1 - k.slab.v0) * (d / 4) }, x + w / 2, q.y + 0.02, z + d / 2, w, d);
    }
  }
  // Pé das paredes: terra, folhas secas e mato rasteiro onde a vassoura não chega
  const homes = new Set(FAVELA_HOUSES.filter((h) => h.solid.box.min.y === 0).map((h) => h.solid));
  for (const f of exposedFaces(map, (s) => homes.has(s))) {
    if (f.base > 0) continue;
    for (let t = f.t0 + 0.5 + r() * 2; t < f.t1 - 0.8; t += 2.5 + r() * 4) {
      const len = 1.2 + r() * 1.8;
      const p = facePoint(f, t, 0.28);
      floorDecal(b, k.mat, k.leaves, p.x, 0.013, p.z, len, 0.56, f.axis === 'x' ? Math.PI / 2 : 0);
    }
  }
  // Rachaduras, manchas e lixo espalhados no que é piso aberto
  const scatter = (n: number, pick: () => { uv: typeof k.slab; w: number; d: number }) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + 2 + r() * (x1 - x0 - 4);
      const z = z0 + 2 + r() * (z1 - z0 - 4);
      if (!open(x, z)) continue;
      const { uv, w, d } = pick();
      floorDecal(b, k.mat, uv, x, 0.014, z, w, d, r() * Math.PI * 2);
    }
  };
  scatter(40, () => ({ uv: k.cracks[Math.floor(r() * 2)], w: 2 + r() * 2, d: 2 + r() * 2 }));
  scatter(26, () => ({ uv: k.stains[Math.floor(r() * 3)], w: 1 + r() * 1.6, d: 1 + r() * 1.6 }));
  scatter(22, () => ({ uv: k.litter[0], w: 1.5, d: 1.5 }));
  // Escorrido sob o peitoril das janelas de cima
  for (const w of windows) {
    if (w.y < 2 || w.seed % 3 === 0) continue;
    const off = w.n * 0.026;
    const uv = k.drips[w.seed % 2];
    if (w.side) wallDecal(b, k.mat, uv, w.x + off, w.y - 0.72, w.z, 1.1, 1.3, w.n > 0 ? Math.PI / 2 : -Math.PI / 2);
    else wallDecal(b, k.mat, uv, w.x, w.y - 0.72, w.z + off, 1.1, 1.3, w.n > 0 ? 0 : Math.PI);
  }
  k.finish();
}
