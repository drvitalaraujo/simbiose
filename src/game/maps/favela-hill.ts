import * as THREE from 'three';
import { PALETTE as C, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { rng } from '../world/shapes';

// Encosta viva atrás da Favela do Sol: bananeiras e touceiras de mato entre o casario do morro,
// e pipas no céu (uma malha só, animada no shader; nada roda na CPU por quadro).

/** Bananeira: pseudocaule e folhas longas abertas em leque, algumas caídas. */
function bananeira(b: Builder, x: number, y: number, z: number, s: number, r: () => number) {
  const h = (2.2 + r() * 1.2) * s;
  b.add(place(new THREE.CylinderGeometry(0.11 * s, 0.17 * s, h, 7), x, y + h / 2, z), toon(C.colonialMoss), { cast: false });
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const len = (1.6 + r() * 0.9) * s;
    const leaf = new THREE.BoxGeometry(0.42 * s, 0.03, len);
    leaf.translate(0, 0, len / 2);
    // Folhas novas apontam para cima; as velhas pendem (e ficam mais amareladas)
    const old = r() < 0.3;
    leaf.rotateX(old ? 0.5 + r() * 0.4 : -(0.25 + r() * 0.5));
    leaf.rotateY((i / n) * Math.PI * 2 + r() * 0.5);
    b.add(place(leaf, x, y + h - 0.05, z), toon(old ? C.ochre : r() < 0.5 ? C.leaf : C.leafLight), { cast: false });
  }
  // Cacho com o "coração" roxo pendurado
  if (r() < 0.5) {
    b.add(place(new THREE.SphereGeometry(0.22 * s, 7, 5), x + 0.2 * s, y + h - 0.45 * s, z), toon(C.leafLight), { cast: false });
    b.add(place(new THREE.ConeGeometry(0.1 * s, 0.3 * s, 6), x + 0.2 * s, y + h - 0.85 * s, z, 0, Math.PI), toon(C.wine), { cast: false });
  }
}

/** Touceira de capim: cones finos em leque. */
function mato(b: Builder, x: number, y: number, z: number, s: number, r: () => number) {
  for (let i = 0; i < 5; i++) {
    const h = (0.5 + r() * 0.6) * s;
    const g = new THREE.ConeGeometry(0.16 * s, h, 4);
    g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 0.7);
    g.rotateY(r() * Math.PI);
    b.add(place(g, x + (r() - 0.5) * 0.5 * s, y, z + (r() - 0.5) * 0.5 * s), toon([C.leaf, C.colonialMoss, C.leafLight][i % 3]), { cast: false });
  }
}

/** Verde do morro: nos patamares do casario cenográfico (mesmas fileiras de `favelaBackdrop`). */
export function favelaHill(b: Builder) {
  const r = rng(7007);
  for (let row = 0; row < 5; row++) {
    const z = -44 - row * 10;
    const base = row * 3.8;
    for (let x = -74; x < 74; x += 2.2 + r() * 3.5) {
      // Faixa da frente do patamar (2 m antes das casas) e algumas no topo, entre lotes
      const zz = z - 1.6 + r() * 1.2;
      if (r() < 0.32) bananeira(b, x, base, zz, 0.8 + r() * 0.5, r);
      else mato(b, x, base, zz, 0.8 + r() * 0.8, r);
    }
  }
  // Capim e bananeiras nas laterais, na base do casario
  for (const sx of [-49.5, 49]) {
    for (let z = -30; z < 40; z += 3 + r() * 4) {
      if (r() < 0.4) bananeira(b, sx, -1, z, 0.9 + r() * 0.4, r);
      else mato(b, sx, -1, z, 1, r);
    }
  }
}

const KITE_VERT = /* glsl */ `
attribute vec3 anchor;
attribute vec3 kite;
uniform float uTime;
`;
// Corpo da pipa oscila em volta da âncora; rabiola e linha balançam mais (peso `kite.y`).
const KITE_BEGIN = /* glsl */ `
float ph = kite.x;
float t = uTime;
vec3 drift = vec3(sin(t * 0.37 + ph) * 1.6, sin(t * 0.53 + ph * 1.7) * 0.9, cos(t * 0.29 + ph) * 1.2) * kite.z;
vec3 rel = position - anchor;
float roll = sin(t * 0.9 + ph) * 0.35 * kite.z;
float cr = cos(roll), sr = sin(roll);
rel = vec3(rel.x * cr - rel.y * sr, rel.x * sr + rel.y * cr, rel.z);
vec3 transformed = anchor + rel + drift;
transformed.x += sin(t * 2.3 + ph + position.y * 1.4) * 0.35 * kite.y;
`;

/** Pipas coloridas sobre o morro, com rabiola e linha descendo até o casario. */
export function favelaKites(b: Builder) {
  const uTime = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = KITE_VERT + shader.vertexShader.replace('#include <begin_vertex>', KITE_BEGIN);
  };
  mat.onBeforeRender = () => {
    uTime.value = performance.now() / 1000;
  };
  const r = rng(1508);
  const spots: [number, number, number][] = [
    [-30, 34, -70], [-8, 40, -82], [14, 30, -64], [38, 37, -78], [-52, 28, -40], [56, 31, -30], [-60, 36, 10], [62, 33, 18], [5, 44, -100],
  ];
  const cols = [C.pink, C.cyan, C.colonialYellow, C.colonialRed, C.lilac, C.orange, C.leafLight, C.cal];
  const lineColor = new THREE.Color(C.inkSoft);
  for (const [i, [x, y, z]] of spots.entries()) {
    const pos: number[] = [];
    const col: number[] = [];
    const anc: number[] = [];
    const kit: number[] = [];
    const ph = r() * 6.28;
    const tri = (a: number[], bb: number[], c: number[], color: number, tail: number, follow: number) => {
      const cc = new THREE.Color(color);
      for (const p of [a, bb, c]) {
        pos.push(p[0], p[1], p[2]);
        col.push(cc.r, cc.g, cc.b);
        anc.push(x, y, z);
        kit.push(ph, tail, follow);
      }
    };
    // Losango em quatro gomos de duas cores, de frente para o mapa
    const yaw = Math.atan2(-x, -z);
    const u = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const s = 1.1 + r() * 0.5;
    const at = (du: number, dv: number) => [x + u[0] * du * s, y + dv * s, z + u[2] * du * s];
    const c1 = cols[i % cols.length];
    const c2 = cols[(i + 3) % cols.length];
    const top = at(0, 0.75);
    const right = at(0.55, 0.1);
    const bottom = at(0, -0.8);
    const left = at(-0.55, 0.1);
    const mid = at(0, 0.1);
    tri(mid, top, right, c1, 0, 1);
    tri(mid, right, bottom, c2, 0, 1);
    tri(mid, bottom, left, c1, 0, 1);
    tri(mid, left, top, c2, 0, 1);
    // Rabiola: laços alternados descendo
    for (let k = 0; k < 6; k++) {
      const p = at(0, -0.8 - (k + 1) * 0.4);
      const w = 0.16 * s;
      tri([p[0] - u[0] * w, p[1] + w, p[2] - u[2] * w], [p[0] + u[0] * w, p[1] - w, p[2] + u[2] * w], [p[0] + u[0] * w, p[1] + w, p[2] + u[2] * w], k % 2 ? c1 : C.cal, (k + 1) / 6, 1);
    }
    // Linha: fita fina até o morro, presa embaixo (sem deriva na ponta de baixo)
    const end = [x * 1.25, 4 + r() * 6, z * 1.25 - 10];
    const lw = 0.03;
    for (let k = 0; k < 6; k++) {
      const t0 = k / 6;
      const t1 = (k + 1) / 6;
      const p0 = [bottom[0] + (end[0] - bottom[0]) * t0, bottom[1] + (end[1] - bottom[1]) * t0 - Math.sin(t0 * Math.PI) * 3, bottom[2] + (end[2] - bottom[2]) * t0];
      const p1 = [bottom[0] + (end[0] - bottom[0]) * t1, bottom[1] + (end[1] - bottom[1]) * t1 - Math.sin(t1 * Math.PI) * 3, bottom[2] + (end[2] - bottom[2]) * t1];
      const f0 = 1 - t0;
      const f1 = 1 - t1;
      // Dois triângulos por trecho; o peso de deriva cai até zero no chão
      const q = (p: number[], dy: number, f: number) => ({ p: [p[0], p[1] + dy, p[2]], f });
      const v = [q(p0, -lw, f0), q(p0, lw, f0), q(p1, lw, f1), q(p1, -lw, f1)];
      for (const [a, bb, c] of [[0, 1, 2], [0, 2, 3]]) {
        for (const vv of [v[a], v[bb], v[c]]) {
          pos.push(...vv.p);
          col.push(lineColor.r, lineColor.g, lineColor.b);
          anc.push(x, y, z);
          kit.push(ph, 0, vv.f);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('anchor', new THREE.Float32BufferAttribute(anc, 3));
    geo.setAttribute('kite', new THREE.Float32BufferAttribute(kit, 3));
    // Rotação de até 0,35 rad + deriva + rabiola: envelope conservador por pipa.
    let reach = 0;
    for (let k = 0; k < pos.length; k += 3) {
      reach = Math.max(reach, Math.hypot(pos[k] - x, pos[k + 1] - y) * kit[k + 2]);
    }
    const boundsPadding = 0.35 * reach + Math.hypot(1.6, 0.9, 1.2) + 0.35;
    b.add(geo, mat, { cast: false, receive: false, boundsPadding });
  }
}
