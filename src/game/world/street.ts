import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE, toon } from '../toon';
import { bush, posterUVs } from './buildings';
import { PLAZA, ROAD } from './city';
import type { Ctx, Face } from './props';
import { graf } from './props';
import { box, rng } from './shapes';

// Rua viva: ipês e árvores toon, floreiras, lixeiras laranja, cones, lambe-lambe nas paredes
// da praça, poças de luz dos postes e pétalas/poeira flutuando no ar (um único Points).

const CURB = 0.25;

function overlaps(a: Box, solids: Box[]): boolean {
  return solids.some(
    (s) => s.max.y > CURB + 0.01 && a.min.x < s.max.x && a.max.x > s.min.x && a.min.y < s.max.y && a.max.y > s.min.y && a.min.z < s.max.z && a.max.z > s.min.z,
  );
}

export function buildStreet(ctx: Ctx) {
  const r = rng(404);
  trees(ctx, r);
  clutter(ctx, r);
  posters(ctx, r);
  petals(ctx);
}

/** Árvore toon: tronco torto e copa de bolhas (ipê rosa, ipê amarelo ou verde). */
function tree(ctx: Ctx, x: number, z: number, kind: number, r: () => number) {
  const { b } = ctx;
  const H = 2.6 + r() * 1.2;
  b.solids.push(box(x - 0.2, CURB, z - 0.2, x + 0.2, CURB + H, z + 0.2));
  const trunk = new THREE.CylinderGeometry(0.13, 0.2, H, 7);
  trunk.translate(x, CURB + H / 2, z);
  b.add(trunk, toon(PALETTE.bark), { shoot: true });
  // Galhos em Y
  for (const s of [-1, 1]) {
    const g = new THREE.CylinderGeometry(0.06, 0.1, 1.3, 5);
    g.rotateZ(s * 0.7);
    g.rotateY(r() * Math.PI);
    g.translate(x, CURB + H + 0.3, z);
    b.add(g, toon(PALETTE.bark));
  }
  const color = [PALETTE.ipe, PALETTE.ipeYellow, PALETTE.leaf, PALETTE.leaf][kind % 4];
  const light = kind % 4 < 2 ? color : PALETTE.leafLight;
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r();
    const rad = i === 0 ? 0 : 0.9 + r() * 0.5;
    const s = i === 0 ? 1.5 : 0.95 + r() * 0.4;
    const g = new THREE.SphereGeometry(s, 12, 8);
    g.scale(1, 0.78, 1);
    g.translate(x + Math.cos(a) * rad, CURB + H + 0.9 + (i === 0 ? 0.5 : r() * 0.6), z + Math.sin(a) * rad);
    b.add(g, toon(i === 0 || r() < 0.4 ? color : light), { cast: true });
  }
  // Ipê derruba flor: tapete de pétalas na calçada
  if (kind % 4 < 2) {
    for (let k = 0; k < 7; k++) {
      const a = r() * Math.PI * 2;
      const d = 0.4 + r() * 1.8;
      const disc = new THREE.CircleGeometry(0.2 + r() * 0.35, 7);
      disc.rotateX(-Math.PI / 2);
      disc.translate(x + Math.cos(a) * d, CURB + 0.015, z + Math.sin(a) * d);
      b.add(disc, toon(color), { cast: false });
    }
  }
}

function trees(ctx: Ctx, r: () => number) {
  let kind = 0;
  const E = ROAD + 1.7; // canteiro da calçada, colado na guia
  const spots: [number, number][] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const d of [14.5, 26.5, 36]) {
        spots.push([sx * E, sz * d], [sx * d, sz * E]);
      }
      spots.push([sx * 30, sz * 30], [sx * 24, sz * 34.5]);
    }
  }
  for (const [x, z] of spots) {
    const clear = box(x - 1.8, CURB + 0.05, z - 1.8, x + 1.8, CURB + 6, z + 1.8);
    if (overlaps(clear, ctx.b.solids)) continue;
    tree(ctx, x, z, kind++, r);
  }
}

/** Floreiras, lixeiras laranja de poste e cones. */
function clutter(ctx: Ctx, r: () => number) {
  const { b } = ctx;
  const tryPlace = (x: number, z: number, size: number, fn: () => void) => {
    if (overlaps(box(x - size, CURB + 0.05, z - size, x + size, CURB + 2, z + size), b.solids)) return;
    fn();
  };
  // Floreiras de concreto com mato (cobertura baixa, dá para pular)
  for (const [x, z] of [[-30, -21], [21, 30], [-21, -33], [33, -9.5], [-12, 33], [33, 21]]) {
    tryPlace(x, z, 1.1, () => {
      b.block(x - 0.9, CURB, z - 0.9, x + 0.9, CURB + 0.75, z + 0.9, PALETTE.concrete);
      bush(ctx, x, CURB + 0.75, z, 0.9, r() < 0.5 ? PALETTE.leaf : PALETTE.ipe);
    });
  }
  // Lixeira laranja de poste (a "papeleira" paulistana)
  for (const [x, z] of [[9, 16], [-9, -16], [16, -9], [-16, 9], [9, -30], [-30, 9], [30, -9.2], [-9.1, 30]]) {
    tryPlace(x, z, 0.4, () => {
      b.block(x - 0.05, CURB, z - 0.05, x + 0.05, CURB + 1.2, z + 0.05, PALETTE.concreteDark, { solid: false });
      const can = new THREE.CylinderGeometry(0.27, 0.22, 0.6, 10);
      can.translate(x, CURB + 1.0, z);
      b.add(can, toon(PALETTE.orange));
      const rim = new THREE.CylinderGeometry(0.29, 0.29, 0.06, 10);
      rim.translate(x, CURB + 1.32, z);
      b.add(rim, toon(PALETTE.ink));
    });
  }
  // Cones em volta das barreiras e do buraco do metrô
  const cone = (x: number, y: number, z: number) => {
    const g = new THREE.CylinderGeometry(0.04, 0.24, 0.72, 8);
    g.translate(x, y + 0.4, z);
    b.add(g, toon(PALETTE.orange));
    const band = new THREE.CylinderGeometry(0.13, 0.16, 0.12, 8);
    band.translate(x, y + 0.5, z);
    b.add(band, toon(PALETTE.paper));
    b.block(x - 0.28, y, z - 0.28, x + 0.28, y + 0.05, z + 0.28, PALETTE.ink, { solid: false, cast: false });
  };
  for (const [x, z, y] of [[-3.5, 36.5 - 1.1, 0], [4.2, 35.3, 0], [35.3, 3.8, 0], [-35.4, -4, 0], [-1, -35.3, 0], [11.3, 19, CURB], [17, 19.2, CURB], [6.5, -11, 0], [-6.8, 11.5, 0], [-11.6, -4.6, 0]]) {
    cone(x, y, z + (r() - 0.5) * 0.2);
  }
}

/** Lambe-lambe colado no térreo das paredes da praça, entre as lojas. */
function posters(ctx: Ctx, r: () => number) {
  const uvs = posterUVs(ctx);
  const faces: Face[] = [
    { axis: 'z', at: -PLAZA, n: 1 },
    { axis: 'z', at: PLAZA, n: -1 },
    { axis: 'x', at: -PLAZA, n: 1 },
    { axis: 'x', at: PLAZA, n: -1 },
  ];
  for (const f of faces) {
    for (const s of [-1, 1]) {
      const t = s * (ROAD + 2.5 + r() * 25);
      graf(ctx, f, uvs[Math.floor(r() * uvs.length)], t, 1.45 + r() * 0.3, 4.4, 0.83, 0.05);
    }
  }
}

// ---------------------------------------------------------------- pétalas e poeira

const PETAL_VERT = /* glsl */ `
uniform float uTime, uScale;
attribute vec4 seed;
#include <fog_pars_vertex>
varying float vKind;
varying float vSpin;
void main() {
  vec3 p = position;
  float t = uTime * (0.4 + seed.y * 0.5);
  // Vento leve para leste + queda lenta + bamboleio; tudo dá a volta dentro da caixa
  p.x += t * 1.2 + sin(t * 1.3 + seed.x * 6.28) * 0.8;
  p.z += sin(t * 0.9 + seed.z * 6.28) * 0.9;
  p.y -= t * 0.35;
  p.x = mod(p.x + 46.0, 92.0) - 46.0;
  p.y = mod(p.y, 22.0) + 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vKind = seed.w;
  vSpin = t * 2.0 + seed.x * 6.28;
  gl_PointSize = (vKind > 0.55 ? 0.16 : 0.07) * uScale / -mv.z;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;

const PETAL_FRAG = /* glsl */ `
uniform vec3 uPetal, uDust;
#include <fog_pars_fragment>
varying float vKind;
varying float vSpin;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vSpin), co = cos(vSpin);
  c = mat2(co, -s, s, co) * c;
  bool petal = vKind > 0.55;
  // Pétala: elipse com o achatamento girando (parece virar no ar); poeira: ponto redondo
  float squash = petal ? 0.35 + 0.65 * abs(sin(vSpin * 0.7)) : 1.0;
  if (length(vec2(c.x, c.y / squash)) > 0.5) discard;
  gl_FragColor = vec4(petal ? uPetal : uDust, 1.0);
  #include <fog_fragment>
}`;

function petals(ctx: Ctx) {
  const N = 700;
  const r = rng(77);
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (r() - 0.5) * 92;
    pos[i * 3 + 1] = r() * 22;
    pos[i * 3 + 2] = (r() - 0.5) * 92;
    seed.set([r(), r(), r(), r()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 10, 0), 80);
  const mat = new THREE.ShaderMaterial({
    vertexShader: PETAL_VERT,
    fragmentShader: PETAL_FRAG,
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uScale: { value: 900 },
      uPetal: { value: new THREE.Color(PALETTE.ipe).multiplyScalar(1.1) },
      uDust: { value: new THREE.Color(PALETTE.sun).multiplyScalar(1.3) },
    },
    fog: true,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.raycast = () => {};
  points.frustumCulled = false;
  ctx.scene.add(points);
  ctx.updaters.push((_dt, time) => {
    mat.uniforms.uTime.value = time;
  });
}
