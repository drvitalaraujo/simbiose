import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE, toon } from '../toon';
import type { Builder } from './builder';

// Vegetação toon do Pelourinho e da Lapa: palmeira com tronco em gomos e folhas com volume
// (nervura central, folíolos serrilhados dobrados em "V" e caindo em arco), árvore de copa
// em tufos. Só decoração: o mapa decide onde pode (a peça devolve a caixa que ocupa).
// Tudo em `toon(cor)`: o Builder junta no lote de cor por vértice (sem draw call novo).

export interface PalmOptions {
  /** Inclinação do tronco (m de deslocamento no topo); 0 = reto (tronco com colisão). */
  lean?: number;
  /** Folhas na coroa. */
  fronds?: number;
  /** Comprimento das folhas. */
  frond?: number;
  /** Confere se uma peça da coroa pode entrar (ex.: fora do alcance do corpo). */
  fits?: (b: Box) => boolean;
  /** Raio do tronco na base. */
  radius?: number;
  /** Silhueta de fundo: menos gomos, folhas mais simples, sem cocos nem folhas secas. */
  far?: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

/** Palmeira: devolve o topo do tronco (onde a coroa nasce). */
export function palm(b: Builder, x: number, base: number, z: number, h: number, r: () => number, o: PalmOptions = {}): THREE.Vector3 {
  const lean = o.lean ?? (r() - 0.5) * 1.2;
  const yaw = r() * Math.PI * 2;
  const rad = o.radius ?? 0.22;
  const segs = o.far ? 4 : Math.max(5, Math.round(h / 1.0));
  // Curva do tronco: sai reto e inclina mais perto do topo (como palmeira de verdade)
  const at = (u: number) => new THREE.Vector3(x + Math.cos(yaw) * lean * u * u, base + h * u, z + Math.sin(yaw) * lean * u * u);
  for (let i = 0; i < segs; i++) {
    const a = at(i / segs);
    const c = at((i + 1) / segs);
    const dir = c.clone().sub(a);
    const len = dir.length();
    const k = 1 - (i / segs) * 0.3;
    // Gomo: alarga embaixo (a cicatriz da folha velha) e afina em cima
    const g = new THREE.CylinderGeometry(rad * k * 0.86, rad * k * 1.08, len, 6, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
    g.translate((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2);
    b.add(g, toon(i % 2 ? PALETTE.cantaria : PALETTE.sand), { cast: false });
    if (o.far) continue;
    const ring = new THREE.CylinderGeometry(rad * k * 1.12, rad * k * 1.12, 0.06, 6, 1, true);
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
    ring.translate(a.x, a.y + 0.03, a.z);
    b.add(ring, toon(PALETTE.bark), { cast: false });
  }
  const top = at(1);
  const fits = o.fits ?? (() => true);
  const crownBox = (g: THREE.BufferGeometry): Box => {
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    return { min: { x: bb.min.x, y: bb.min.y, z: bb.min.z }, max: { x: bb.max.x, y: bb.max.y, z: bb.max.z } };
  };
  // Cocos e a "saia" escura onde as folhas nascem
  const heart = new THREE.IcosahedronGeometry(rad * 1.5, 0);
  heart.scale(1, 0.8, 1);
  heart.translate(top.x, top.y - 0.05, top.z);
  if (fits(crownBox(heart))) b.add(heart, toon(PALETTE.bark), { cast: false });
  for (let i = 0; i < (o.far ? 0 : 3); i++) {
    const a = r() * Math.PI * 2;
    const nut = new THREE.IcosahedronGeometry(0.13, 0);
    nut.translate(top.x + Math.cos(a) * rad * 1.3, top.y - 0.28, top.z + Math.sin(a) * rad * 1.3);
    if (fits(crownBox(nut))) b.add(nut, toon(PALETTE.ochre), { cast: false });
  }
  const n = o.fronds ?? 9;
  const L = o.frond ?? 2.8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.35;
    const droop = i % 3 === 0 ? 1.25 : 0.7 + r() * 0.4;
    const g = frond(L * (0.85 + r() * 0.3), droop, r, o.far ? 4 : 7);
    g.rotateY(a);
    g.translate(top.x, top.y, top.z);
    if (!fits(crownBox(g))) continue;
    b.add(g, toon(i % 3 === 0 ? PALETTE.leaf : i % 3 === 1 ? PALETTE.leafLight : PALETTE.colonialMoss), { cast: false, receive: false });
  }
  // Duas folhas secas penduradas sob a coroa
  for (let i = 0; i < (o.far ? 0 : 2); i++) {
    const g = frond(L * 0.6, 2.6, r, 5);
    g.rotateY(r() * Math.PI * 2);
    g.translate(top.x, top.y - 0.1, top.z);
    if (fits(crownBox(g))) b.add(g, toon(PALETTE.ochre), { cast: false, receive: false });
  }
  return top;
}

/**
 * Folha de palmeira ao longo de +x: nervura em arco (sobe e cai conforme `droop`) e folíolos
 * dos dois lados, dobrados para baixo em "V" e serrilhados. Dupla face (triângulos nos dois
 * sentidos), para não depender de material de dois lados.
 */
function frond(L: number, droop: number, r: () => number, N: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const spine: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    spine.push(new THREE.Vector3(u * L, 0.45 * L * u - droop * 0.55 * L * u * u, 0));
  }
  const side = (i: number, s: 1 | -1) => {
    const u = i / N;
    // Largura: cresce até 35% e afina até a ponta; serrilhado alterna largura
    const w = 0.55 * Math.sin(Math.min(1, u / 0.35) * Math.PI / 2) * (1 - Math.max(0, u - 0.35) / 0.75) * (i % 2 ? 0.62 : 1);
    const p = spine[i];
    return new THREE.Vector3(p.x - w * 0.25, p.y - w * 0.45, s * w);
  };
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
  };
  for (let i = 0; i < N; i++) {
    for (const s of [1, -1] as const) {
      tri(spine[i], side(i, s), spine[i + 1]);
      tri(side(i, s), side(i + 1, s), spine[i + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // Leve torção aleatória: a coroa não fica simétrica demais
  g.rotateX((r() - 0.5) * 0.5);
  return g;
}

/** Árvore de copa larga em tufos (mangueira, amendoeira): fundo e quintais. */
export function broadleaf(b: Builder, x: number, base: number, z: number, h: number, r: () => number) {
  const trunk = new THREE.CylinderGeometry(0.18, 0.32, h * 0.55, 7);
  trunk.translate(x, base + h * 0.275, z);
  b.add(trunk, toon(PALETTE.bark), { cast: false });
  const R = h * 0.32;
  const cy = base + h * 0.62;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r();
    const d = i === 0 ? 0 : R * (0.45 + r() * 0.3);
    const s = R * (i === 0 ? 0.95 : 0.6 + r() * 0.25);
    const y = cy + (i === 0 ? R * 0.35 : (r() - 0.2) * R * 0.5);
    const blob = new THREE.IcosahedronGeometry(1, 1);
    blob.scale(s, s * 0.8, s);
    blob.translate(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
    // Tufos de cima mais claros (luz do céu); de baixo, verde fechado
    b.add(blob, toon(y > cy + R * 0.2 ? PALETTE.leafLight : i % 2 ? PALETTE.leaf : PALETTE.colonialMoss), { cast: false, receive: false });
  }
}
