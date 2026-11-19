import * as THREE from 'three';
import { PALETTE as C, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { box, rng } from '../world/shapes';
import { clearOfBody } from './facades';
import { FAVELA_COLORS } from './favela-art';
import type { MapData } from './types';

const deco = { solid: false, shoot: false, cast: false, outline: 0 };
/** Telhado de duas águas só em casas altas: quinas reais sem afetar a colisão AABB do jogo. */
export function favelaRoof(b: Builder, map: MapData, p: { x: number; y: number; z: number }, q: { x: number; y: number; z: number }) {
  const x0 = p.x - 0.08, x1 = q.x + 0.08, z0 = p.z - 0.08, z1 = q.z + 0.08;
  const cx = (x0 + x1) / 2, y = q.y + 0.06, ridge = y + Math.min(1.1, (x1 - x0) * 0.18);
  if (!clearOfBody(map, box(x0, y, z0, x1, ridge, z1))) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    x0, y, z0, x0, y, z1, cx, ridge, z1, x0, y, z0, cx, ridge, z1, cx, ridge, z0,
    cx, ridge, z0, cx, ridge, z1, x1, y, z1, cx, ridge, z0, x1, y, z1, x1, y, z0,
    x0, y, z0, cx, ridge, z0, x1, y, z0, x1, y, z1, cx, ridge, z1, x0, y, z1,
  ], 3));
  geo.computeVertexNormals(); b.add(geo, toon(C.telha));
  b.block(x0, y - 0.06, z0, x0 + 0.08, y + 0.06, z1, C.cantaria, deco);
  b.block(x1 - 0.08, y - 0.06, z0, x1, y + 0.06, z1, C.cantaria, deco);
  b.add(place(new THREE.CylinderGeometry(0.09, 0.09, z1 - z0, 6), cx, ridge, (z0 + z1) / 2, 0, Math.PI / 2), toon(C.terracotta), { cast: false });
}
/** Varais, bandeirolas e cabos acima de qualquer envelope de movimento. */
export function favelaWires(b: Builder, map: MapData) {
  const safe = (geo: THREE.BufferGeometry, color: number) => {
    geo.computeBoundingBox(); const bb = geo.boundingBox!;
    if (!clearOfBody(map, box(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z))) return;
    b.add(geo, toon(color), { cast: false });
  };
  for (const z of [-17, 18, 5]) {
    for (let strand = 0; strand < 1; strand++) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20; points.push(new THREE.Vector3(-30 + t * 60, 12.3 + strand * 0.2 - Math.sin(t * Math.PI) * 2, z + strand * 0.22));
      }
      safe(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.055, 6, false), C.inkSoft);
    }
    if (z === 5) for (let i = 0; i < 17; i++) {
      const x = -24 + i * 3, t = (x + 30) / 60, y = 12.3 - Math.sin(t * Math.PI) * 2;
      const flag = new THREE.BufferGeometry();
      flag.setAttribute('position', new THREE.Float32BufferAttribute([x, y, z, x + 0.85, y - 0.03, z, x + 0.42, y - 0.95, z, x + 0.42, y - 0.95, z, x + 0.85, y - 0.03, z, x, y, z], 3));
      flag.computeVertexNormals(); safe(flag, [C.ochre, C.colonialRose, C.colonialSky, C.cal][i % 4]);
    }
  }
  for (const side of [-1, 1]) {
    const x = side * 20;
    safe(place(new THREE.BoxGeometry(0.035, 0.035, 14), x, 9, 3), C.steel);
    for (let i = 0; i < 7; i++) {
      const z = -3 + i * 1.8;
      safe(place(new THREE.BoxGeometry(0.025, 1.2 + (i % 2) * 0.35, 0.9), x, 8.3, z), [C.cal, C.colonialSky, C.ochre, C.colonialRose][i % 4]);
      safe(place(new THREE.BoxGeometry(0.09, 0.15, 0.055), x, 9, z - 0.3), C.bark);
      safe(place(new THREE.BoxGeometry(0.09, 0.15, 0.055), x, 9, z + 0.3), C.bark);
    }
  }
}

/** Encosta cenográfica além da borda: silhueta densa, quebrada e reconhecível. */
export function favelaBackdrop(b: Builder) {
  b.block(-240, -1.5, -210, 240, -1, 210, C.colonialMoss, deco);
  const r = rng(20261004);
  // Patamares de terra sustentam o casario escalonado; nenhum lote paira nos vãos.
  for (let row = 0; row < 5; row++) {
    const z = -44 - row * 10, base = row * 3.8;
    b.block(-77, -1, z - 2, 77, base, z + 9, C.colonialMoss, deco);
    if (row > 0) b.block(-76, base - 0.6, z + 8.7, 76, base, z + 9, C.cantaria, deco);
  }
  for (let row = 0; row < 5; row++) for (let i = 0; i < 18; i++) {
    const x = -72 + i * 8 + (row % 2) * 3.5 + r() * 1.2, z = -44 - row * 10 - r() * 1.8;
    const base = row * 3.8, w = 5.4 + r() * 2, d = 6 + r() * 2, h = 5 + r() * 6;
    b.block(x, base - 4, z, x + w, base + h, z + d, FAVELA_COLORS[(i + row * 3) % 6], deco);
    b.block(x - 0.08, base + h, z - 0.08, x + w + 0.08, base + h + 0.17, z + d + 0.08, C.cobbleStone, deco);
    for (let y = base + 1; y < base + h - 1; y += 2.6) for (let xx = x + 0.9; xx < x + w - 0.5; xx += 2) {
      b.block(xx, y, z + d, xx + 0.7, y + 1.2, z + d + 0.025, C.glass, deco);
    }
    if ((i + row) % 3 === 0) b.add(place(new THREE.CylinderGeometry(0.65, 0.8, 1.25, 8), x + w * 0.6, base + h + 0.8, z + d * 0.6), toon(C.tank), { cast: false });
    if ((i + row) % 4 === 0) {
      b.block(x + 1, base + h, z + 1, x + 1.04, base + h + 2.8, z + 1.04, C.steel, deco);
      b.block(x + 0.2, base + h + 2.4, z + 0.99, x + 1.8, base + h + 2.44, z + 1.05, C.steel, deco);
    }
  }
  // Muros laterais continuam em casario, evitando sensação de arena recortada no vazio.
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
    const x = side < 0 ? -48 : 41, z = -30 + i * 8, h = 7 + r() * 9;
    b.block(x, -1, z, x + 7, h, z + 6, FAVELA_COLORS[i % 6], deco);
    b.block(x, h, z, x + 7, h + 0.2, z + 6, C.cobbleStone, deco);
    for (let y = 2; y < h - 1; y += 3) for (const dz of [1, 3.5]) b.block(x - 0.02, y, z + dz, x + 7.02, y + 1.25, z + dz + 0.8, C.glass, deco);
  }
  // Morros verdes fecham a composição, deixando o céu aberto para os drones.
  for (const [x, z, scale] of [[-115, -120, 1], [100, -145, 1.5], [175, -40, 1]]) {
    const geo = new THREE.SphereGeometry(1, 16, 9); geo.scale(45 * scale, 40 * scale, 42 * scale);
    b.add(place(geo, x, -6, z), toon(C.colonialMoss), { cast: false });
  }
}
