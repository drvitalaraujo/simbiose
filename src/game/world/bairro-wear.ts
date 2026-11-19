import * as THREE from 'three';
import { PALETTE as C, toon } from '../toon';
import { place } from './builder';
import { PLAZA, ROAD } from './city';
import { baseGrime, createGrime, floorDecal } from './street-grime';
import type { Ctx } from './props';
import { rng } from './shapes';

// Desgaste da Neo-São Paulo: placas de calçada com juntas, remendos e rachaduras no asfalto,
// manchas de óleo, bueiros, poças com o reflexo do neon, lixo miúdo, sujeira no pé dos prédios
// e sacos de lixo/caçamba nas avenidas (fora da praça jogável: decoração não vira cobertura falsa).

const CURB = 0.25;
const PIT = { x0: 12, z0: 20, x1: 16, z1: 30 };
const deco = { solid: false, shoot: false, cast: false, outline: 0 };

const inPit = (x: number, z: number, m = 0) => x > PIT.x0 - m && x < PIT.x1 + m && z > PIT.z0 - m && z < PIT.z1 + m;

export function bairroWear(ctx: Ctx) {
  const { b } = ctx;
  const k = createGrime();
  const r = rng(1990);
  // Calçadas: placas de cimento de 4 m (as manchas giram para não repetir)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let u = ROAD; u < PLAZA - 0.01; u += 4) for (let v = ROAD; v < PLAZA - 0.01; v += 4) {
      const x = sx * (u + 2);
      const z = sz * (v + 2);
      if (inPit(x, z, 2)) continue;
      floorDecal(b, k.mat, k.slab, x, CURB + 0.004, z, 4, 4, Math.floor(r() * 4) * (Math.PI / 2));
    }
  }
  // Asfalto: remendos, rachaduras e manchas de óleo onde os carros param
  const road = (n: number, fn: (x: number, z: number) => void) => {
    for (let i = 0; i < n; i++) {
      const along = (r() - 0.5) * 2 * (PLAZA - 1);
      const across = (r() - 0.5) * 2 * (ROAD - 0.8);
      const [x, z] = r() < 0.5 ? [along, across] : [across, along];
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue; // ilha central
      fn(x, z);
    }
  };
  road(14, (x, z) => floorDecal(b, k.mat, k.patch, x, 0.004, z, 1.6 + r() * 2, 1.2 + r() * 1.6, r() * Math.PI));
  road(30, (x, z) => floorDecal(b, k.mat, k.cracks[Math.floor(r() * 2)], x, 0.006, z, 2.5 + r() * 2.5, 2.5 + r() * 2.5, r() * Math.PI * 2));
  road(18, (x, z) => floorDecal(b, k.mat, k.stains[Math.floor(r() * 2)], x, 0.008, z, 1.2 + r() * 1.4, 1 + r() * 1.2, r() * Math.PI));
  // Calçada: rachadura, mancha de chiclete/água e lixo miúdo perto das lojas
  for (let i = 0; i < 60; i++) {
    const sx = r() < 0.5 ? -1 : 1;
    const sz = r() < 0.5 ? -1 : 1;
    const x = sx * (ROAD + 0.5 + r() * (PLAZA - ROAD - 1));
    const z = sz * (ROAD + 0.5 + r() * (PLAZA - ROAD - 1));
    if (inPit(x, z, 0.8)) continue;
    const roll = r();
    const uv = roll < 0.35 ? k.cracks[i % 2] : roll < 0.6 ? k.stains[2] : k.litter[i % 2];
    const s = roll < 0.35 ? 2 + r() * 2 : 1.2 + r() * 0.8;
    floorDecal(b, k.mat, uv, x, CURB + 0.006, z, s, s, r() * Math.PI * 2);
  }
  // Bueiros e bocas de lobo: tampa de ferro com aro (decalque em relevo de 2 cm)
  for (const [x, z] of [[-3.5, 14], [4, -18], [18, 3.6], [-22, -4], [2.5, 30], [-30, 2.8], [33, -3.5]]) {
    b.add(place(new THREE.CylinderGeometry(0.48, 0.5, 0.025, 16), x, 0.013, z), toon(C.concreteDark), { cast: false });
    b.add(place(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 16), x, 0.016, z), toon(C.inkSoft), { cast: false });
    for (const d of [-0.2, 0, 0.2]) b.block(x - 0.32, 0.031, z + d - 0.025, x + 0.32, 0.036, z + d + 0.025, C.concreteDark, deco);
  }
  for (const s of [-1, 1]) for (const d of [16, 27, 36]) {
    // Boca de lobo na guia: grelha escura na face da calçada
    const g = (x0: number, z0: number, x1: number, z1: number) => b.block(x0, 0.03, z0, x1, CURB - 0.04, z1, C.ink, deco);
    g(s * ROAD - 0.02, d - 0.6, s * ROAD + 0.02, d + 0.6);
    g(-d - 0.6, s * ROAD - 0.02, -d + 0.6, s * ROAD + 0.02);
  }
  // Poças com reflexo falso de neon: perto das guias, onde a água empoça
  const puddles: [number, number, number, number][] = [
    [-5.6, -22, 2.6, 1.6], [5.4, 24, 3, 1.8], [-24, 5.7, 2.4, 1.5], [21, -5.5, 2.8, 1.7], [5.8, -33, 2.2, 1.4],
    [-33, -5.8, 2.6, 1.5], [30, 5.6, 2.4, 1.6], [-5.5, 33, 2, 1.3], [-14, -6.2, 1.6, 1.1], [13, 5.8, 1.8, 1.2],
  ];
  puddles.forEach(([x, z, w, d], i) => {
    const along = Math.abs(x) < ROAD ? Math.PI / 2 : 0;
    floorDecal(b, k.puddleMat, k.puddles[i % 3], x, 0.01, z, w * 1.4, d * 1.4, along + (r() - 0.5) * 0.4);
  });
  // Ilha do totem: o mesmo cimento em placas, por cima da laje de 30 cm
  for (const x of [-2.25, 2.25]) for (const z of [-2.25, 2.25]) floorDecal(b, k.mat, k.slab, x, 0.304, z, 4.5, 4.5, ((x > 0 ? 1 : 0) + (z > 0 ? 2 : 0)) * (Math.PI / 2));
  // Sujeira no pé dos prédios que dão para a praça (lotes: vãos de 1 m entre prédios ficam limpos)
  const lots: [number, number][] = [[ROAD + 3, ROAD + 11 - 0.5], [ROAD + 11 + 0.5, ROAD + 22 - 0.5], [ROAD + 22 + 0.5, PLAZA]];
  for (const s of [-1, 1]) for (const [t0, t1] of lots) for (const side of [-1, 1]) {
    const t = side * (t0 + t1) / 2;
    const w = t1 - t0;
    baseGrime(b, k, t, CURB, s * PLAZA, w, s > 0 ? Math.PI : 0, 1.1, 0.04);
    baseGrime(b, k, s * PLAZA, CURB, t, w, s > 0 ? -Math.PI / 2 : Math.PI / 2, 1.1, 0.04);
  }
  avenueTrash(ctx, r);
  k.finish();
}

/** Sacos de lixo, papelão e caçamba nas calçadas das avenidas, além do limite da praça. */
function avenueTrash(ctx: Ctx, r: () => number) {
  const { b } = ctx;
  const bag = (x: number, y: number, z: number, s: number) => {
    const g = new THREE.SphereGeometry(0.42 * s, 9, 7);
    g.scale(1, 0.75, 0.9);
    g.rotateY(r() * Math.PI);
    b.add(place(g, x, y + 0.3 * s, z), toon(r() < 0.7 ? C.ink : C.inkSoft), { cast: false });
    b.add(place(new THREE.ConeGeometry(0.1 * s, 0.22 * s, 5), x, y + 0.66 * s, z), toon(C.ink), { cast: false });
  };
  const pile = (x: number, z: number) => {
    for (let i = 0; i < 4 + Math.floor(r() * 4); i++) bag(x + (r() - 0.5) * 1.4, CURB, z + (r() - 0.5) * 1.4, 0.8 + r() * 0.5);
    const cw = 0.6 + r() * 0.4;
    const box = new THREE.BoxGeometry(cw, 0.45, 0.5);
    b.add(place(box, x + (r() - 0.5) * 1.2, CURB + 0.23, z + (r() - 0.5) * 1.2, r() * Math.PI), toon(C.sand), { cast: false });
  };
  for (const s of [-1, 1]) for (const side of [-1, 1]) {
    const e = side * (ROAD + 1.4);
    pile(e, s * (44 + r() * 8));
    pile(s * (46 + r() * 8), e);
  }
  // Caçamba de entulho amarela numa das avenidas
  for (const [x, z, rot] of [[ROAD + 1.6, -52, 0], [-56, -(ROAD + 1.6), Math.PI / 2]] as const) {
    const shape = new THREE.Shape([new THREE.Vector2(-1.9, 0), new THREE.Vector2(1.9, 0), new THREE.Vector2(2.3, 1.2), new THREE.Vector2(-2.3, 1.2)]);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: false });
    g.translate(0, 0, -0.85);
    g.rotateY(Math.PI / 2);
    b.add(place(g, x, CURB, z, rot), toon(C.ochre), { cast: false });
    b.add(place(new THREE.BoxGeometry(1.5, 0.35, 4), x, CURB + 1.15, z, rot), toon(C.concrete), { cast: false });
  }
}
