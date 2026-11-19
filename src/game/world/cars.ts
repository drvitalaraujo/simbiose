import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE as C, toon } from '../toon';
import { place } from './builder';
import type { Ctx } from './props';

const proxy = toon(C.ink).clone();
proxy.visible = false; // só os AABBs e as cópias de tiro do Builder, fora da cena

/** Carro urbano abandonado. Os dois AABBs originais continuam definindo corpo e tiro. */
export function car(ctx: Ctx, cx: number, cz: number, alongX: boolean, color: number) {
  const b = ctx.b;
  // Pintura automotiva envelhecida usa os tons foscos já existentes na paleta.
  color = new Map<number, number>([[C.pink,C.wine],[C.cyan,C.clothTeal],[C.yellow,C.ochre],
    [C.paper,C.cal],[C.orange,C.colonialRose],[C.lilac,C.concreteDark]]).get(color) ?? color;
  const yaw = alongX ? Math.PI / 2 : 0;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number, cast = true) =>
    b.add(place(new THREE.BoxGeometry(w, h, d), cx + (alongX ? z : x), y, cz + (alongX ? -x : z), yaw), toon(c), { cast });
  const hx = alongX ? 2.1 : 0.95;
  const hz = alongX ? 0.95 : 2.1;
  b.block(cx - hx, 0.25, cz - hz, cx + hx, 1.05, cz + hz, proxy, { cast: false });
  b.add(place(new RoundedBoxGeometry(1.9, 0.8, 4.2, 1, 0.06), cx, 0.65, cz, yaw), toon(color));
  const ox = alongX ? -0.25 : 0;
  const oz = alongX ? 0 : -0.25;
  const cabX = alongX ? 1.1 : 0.85;
  const cabZ = alongX ? 0.85 : 1.1;
  b.block(cx + ox - cabX, 1.05, cz + oz - cabZ, cx + ox + cabX, 1.75, cz + oz + cabZ, proxy, { cast: false });
  const shape = new THREE.Shape([new THREE.Vector2(-1.35, 1.05), new THREE.Vector2(0.85, 1.05), new THREE.Vector2(0.5, 1.75), new THREE.Vector2(-0.98, 1.75)]);
  const cab = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: false, steps: 1, curveSegments: 1 });
  cab.translate(0, 0, -0.85);
  cab.applyMatrix4(new THREE.Matrix4().set(0,0,1,0, 0,1,0,0, -1,0,0,0, 0,0,0,1));
  // O perfil acima usa -z ao transformar; espelha para manter a frente em +z.
  cab.rotateY(Math.PI);
  b.add(place(cab, cx, 0, cz, yaw), toon(color));
  const quad = (points: number[], reverse = false) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    g.setIndex(reverse ? [0,2,1,0,3,2] : [0,1,2,0,2,3]); g.computeVertexNormals();
    b.add(place(g, cx, 0, cz, yaw), toon(C.glass), { cast: false });
  };
  // Vidros separados pelas colunas, com pintura ao redor da cabine.
  for (const s of [-1, 1]) {
    for (const [backBottom, backTop, frontBottom, frontTop] of [[-1.28,-1.02,-0.29,-0.29],[-0.18,-0.18,0.78,0.54]]) {
      const x = s * 0.856;
      quad([x,1.17,backBottom, x,1.65,backTop, x,1.65,frontTop, x,1.17,frontBottom], s < 0);
    }
    // Reflexo, coluna central, emenda de porta e maçaneta embutida.
    box(0.016, 0.06, 0.65, s * 0.867, 1.57, -0.8, C.concrete, false);
    box(0.035, 0.58, 0.08, s * 0.863, 1.4, -0.23, C.inkSoft, false);
    box(0.016, 0.55, 0.014, s * 0.96, 0.71, -0.23, C.inkSoft, false);
    box(0.03, 0.055, 0.18, s * 0.964, 0.91, -0.46, C.inkSoft, false);
    box(0.03, 0.055, 0.18, s * 0.964, 0.91, 0.58, C.inkSoft, false);
    box(0.025, 0.085, 3.95, s * 0.961, 0.56, 0, C.inkSoft, false);
    // Raspado e fundo de pintura exposto no painel inferior.
    box(0.028, 0.045, 0.48, s * 0.97, 0.76, -0.65, C.cantaria, false);
    box(0.029, 0.025, 0.23, s * 0.97, 0.81, -0.86, C.terracotta, false);
  }
  quad([-0.75,1.17,0.798, 0.75,1.17,0.798, 0.75,1.65,0.558, -0.75,1.65,0.558]);
  quad([-0.75,1.17,-1.295, 0.75,1.17,-1.295, 0.75,1.65,-1.041, -0.75,1.65,-1.041], true);
  for (const x of [-0.35, 0.35]) box(0.45, 0.025, 0.022, x, 1.2, 0.789, C.ink, false);
  b.add(place(new RoundedBoxGeometry(1.564,0.1,1.54,1,0.035),cx + (alongX ? -0.24 : 0),1.8,cz + (alongX ? 0 : -0.24),yaw),toon(color === C.wine ? C.pantsWine : color));
  // Capô, tampa traseira, grade, faróis sem bloom e para-choques de borracha.
  box(1.65, 0.035, 1.04, 0, 1.073, 1.48, color, false);
  for (const z of [-2.13, 2.13]) {
    box(1.86, 0.16, 0.08, 0, 0.45, z, C.inkSoft);
    box(0.36, 0.14, 0.016, 0, 0.57, z + Math.sign(z) * 0.046, C.cal, false);
  }
  box(0.72, 0.2, 0.016, 0, 0.79, 2.11, C.ink, false);
  for (const y of [0.73, 0.79, 0.85]) box(0.67, 0.012, 0.025, 0, y, 2.121, C.concrete, false);
  for (const s of [-1, 1]) {
    box(0.45, 0.22, 0.025, s * 0.66, 0.83, 2.117, C.cal, false);
    box(0.14, 0.22, 0.028, s * 0.895, 0.83, 2.117, C.ochre, false);
    box(0.45, 0.19, 0.026, s * 0.65, 0.86, -2.117, C.colonialRed, false);
  }
  // Caixa de roda escura, barro na saia, ferrugem, retrovisores, antena e placa Mercosul.
  for (const s of [-1, 1]) {
    for (const z of [-1.3, 1.3]) box(0.02, 0.3, 0.98, s * 0.962, 0.6, z, C.inkSoft, false);
    box(0.018, 0.1, 3.7, s * 0.963, 0.32, 0, C.concreteDark, false);
    box(0.022, 0.07, 0.16, s * 0.966, 0.68, 1.75 - (cz * 7 % 3) * 0.2, C.bark, false);
    box(0.1, 0.09, 0.15, s * 1.0, 1.22, 0.62, C.inkSoft, false);
    box(0.016, 0.07, 0.12, s * 1.051, 1.22, 0.62, C.concrete, false);
  }
  box(0.02, 0.5, 0.02, 0.55, 2.05, -0.95, C.ink, false);
  for (const z of [-2.178, 2.178]) {
    box(0.52, 0.16, 0.012, 0, 0.42, z, C.cal, false);
    box(0.52, 0.035, 0.014, 0, 0.483, z, C.colonialBlue, false);
    for (let i = 0; i < 6; i++) box(0.045, 0.07, 0.016, -0.17 + i * 0.068, 0.405, z, C.ink, false);
  }
  // Reflexo diagonal de anime no para-brisa
  for (const [x, w] of [[-0.25, 0.14], [0.05, 0.06]]) {
    const g = new THREE.BoxGeometry(w, 0.5, 0.01);
    g.rotateZ(0.5);
    g.rotateX(-0.4636);
    g.translate(x, 1.415, 0.689);
    b.add(place(g, cx, 0, cz, yaw), toon(C.colonialSky), { cast: false });
  }
  // Pneus com perfil, aro rebaixado e cubo central.
  for (const s of [-1, 1]) for (const z of [-1.3, 1.3]) {
    for (const [radius, depth, off, c] of [[0.36, 0.3, 0, C.inkSoft], [0.25, 0.018, 0.16, C.ink], [0.2, 0.022, 0.18, C.concrete], [0.085, 0.024, 0.198, C.inkSoft]]) {
      const g = new THREE.CylinderGeometry(radius, radius, depth, 16);
      g.rotateZ(Math.PI / 2);
      g.translate(s * (0.97 + off), 0.36, z);
      b.add(place(g, cx, 0, cz, yaw), toon(c));
    }
  }
}
