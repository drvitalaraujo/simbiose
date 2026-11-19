import * as THREE from 'three';
import type { Box } from '../physics';
import { GLOW, PALETTE, toon } from '../toon';
import { place } from '../world/builder';
import { broadleaf, palm as floraPalm } from '../world/flora';
import { facePos, neonBox } from '../world/props';
import { rng } from '../world/shapes';
import { type Dress, faceBoxOf, overhang, TRIM } from './colonial';

// Segunda passada de arte do Pelourinho (alvo: docs/concept/mapa-pelourinho): telhados de
// quatro águas sobre os quarteirões, plantas nas sacadas e trepadeiras sob as cornijas,
// palmeiras e bananeiras no casario e nos quintais, a baía com a ilha e o farol ao fundo,
// floreiras de pedra no largo e a luz menos lilás. Tudo é decoração: nada entra na colisão,
// e toda peça que sai da parede passa pela checagem de alcance do corpo (`overhang`).
// Plantas e telhados usam `toon(cor)`: o Builder junta tudo no lote de cor por vértice, então
// repetir peça custa triângulos, não draw calls (faz o papel do instancing aqui).

const deco = { solid: false, cast: false, outline: 0 } as const;
const LEAF = PALETTE.leaf;
const LEAF_LIGHT = PALETTE.colonialMoss;

/** Tudo da segunda passada que depende das fachadas prontas. */
export function dressScenery(d: Dress) {
  roofs(d);
  balconyPlants(d);
  eaveVines(d);
  yardPalms(d);
  backdropPalms(d);
  bay(d);
}

// ---------------------------------------------------------------- telhados

/**
 * Telhado de quatro águas sobre o retângulo (x0..x1, z0..z1) na altura `y`, com cumeeira
 * `h` acima, ao longo do lado maior. Triângulos soltos: normais chapadas (cel).
 */
export function hipRoof(x0: number, z0: number, x1: number, z1: number, y: number, h: number): THREE.BufferGeometry {
  const w = x1 - x0;
  const l = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const top = y + h;
  // Cumeeira: segmento no meio, encurtado de meia largura do lado menor em cada ponta
  const [ra, rb] = w >= l ? [[x0 + l / 2, top, cz], [x1 - l / 2, top, cz]] : [[cx, top, z0 + w / 2], [cx, top, z1 - w / 2]];
  const A = [x0, y, z0];
  const B = [x1, y, z0];
  const C = [x1, y, z1];
  const D = [x0, y, z1];
  const tris: number[][] =
    w >= l
      ? [A, ra, rb, A, rb, B, B, rb, C, C, rb, ra, C, ra, D, D, ra, A]
      : [A, ra, B, B, ra, rb, B, rb, C, C, rb, D, D, rb, ra, D, ra, A];
  // Cada triângulo virado para fora (centróide longe do centro da base); degenerados saem
  const out: number[] = [];
  const v = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);
  const c = new THREE.Vector3(cx, y, cz);
  for (let i = 0; i < tris.length; i += 3) {
    const [p, q, s] = [v(tris[i]), v(tris[i + 1]), v(tris[i + 2])];
    const n = q.clone().sub(p).cross(s.clone().sub(p));
    if (n.lengthSq() < 1e-8) continue;
    const mid = p.clone().add(q).add(s).divideScalar(3).sub(c);
    const tri = n.dot(mid) >= 0 ? [p, q, s] : [p, s, q];
    for (const t of tri) out.push(t.x, t.y, t.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}

/** Telhado de barro sobre cada quarteirão comum: o "mar de telhados" subindo a encosta. */
function roofs(d: Dress) {
  for (const s of d.map.solids) {
    if (s.kind !== 'wall' || s.tint !== 'neutral') continue;
    const { min, max } = s.box;
    const w = max.x - min.x;
    const l = max.z - min.z;
    const i = 0.45; // recuo: o beiral e a platibanda das fachadas ficam na frente
    if (Math.min(w, l) < 1.8) continue;
    const h = Math.min(3.4, Math.min(w, l) * 0.26);
    const y = max.y + 0.3;
    const box: Box = { min: { x: min.x + i, y, z: min.z + i }, max: { x: max.x - i, y: y + h + 0.2, z: max.z - i } };
    if (!overhang(d, box)) continue;
    d.b.add(hipRoof(min.x + i, min.z + i, max.x - i, max.z - i, y, h), toon(PALETTE.telha), { cast: true });
    // Cumeeira em telha mais clara
    const ridge = w >= l ? [min.x + l / 2, max.x - l / 2] : [min.z + w / 2, max.z - w / 2];
    if (ridge[1] - ridge[0] > 0.3) {
      const t = 0.14;
      if (w >= l) d.b.block(ridge[0], y + h - t, (min.z + max.z) / 2 - t, ridge[1], y + h + t, (min.z + max.z) / 2 + t, PALETTE.terracotta, deco);
      else d.b.block((min.x + max.x) / 2 - t, y + h - t, ridge[0], (min.x + max.x) / 2 + t, y + h + t, ridge[1], PALETTE.terracotta, deco);
    }
  }
}

// ---------------------------------------------------------------- plantas

const blob = new THREE.IcosahedronGeometry(1, 0);

/** Tufo de folhas low-poly (icosaedro achatado) já posicionado. */
function tuft(d: Dress, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number) {
  const g = blob.clone();
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  d.b.add(g, toon(color), { cast: false });
}

/** Vasos de barro com plantas na laje e trepadeira pendurada no guarda-corpo. */
function balconyPlants(d: Dress) {
  const r = rng(812);
  for (const bal of d.balconies) {
    if (r() > 0.7) continue;
    const { face: f, t0, t1, y, depth: D } = bal;
    // Vasos: dentro do volume da sacada (já conferido quando a sacada entrou)
    const pots = t1 - t0 > 2.2 ? 2 : 1;
    for (let k = 0; k < pots; k++) {
      const t = pots === 1 ? (r() < 0.5 ? t0 + 0.32 : t1 - 0.32) : k === 0 ? t0 + 0.32 : t1 - 0.32;
      const p = facePos(f, t, y + 0.15, D * 0.55);
      d.b.add(place(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 6), p.x, p.y, p.z), toon(PALETTE.terracotta), { cast: false });
      const big = r() < 0.5;
      tuft(d, p.x, p.y + 0.32, p.z, big ? 0.3 : 0.24, big ? 0.34 : 0.22, big ? 0.3 : 0.24, r() < 0.5 ? LEAF : LEAF_LIGHT);
      if (r() < 0.35) tuft(d, p.x, p.y + 0.5, p.z, 0.1, 0.1, 0.1, PALETTE.magenta); // flor
    }
    // Trepadeira caindo pela frente do guarda-corpo (abaixo da laje só se o corpo não alcança)
    const strands = 1 + Math.floor(r() * 3);
    for (let k = 0; k < strands; k++) {
      const t = t0 + 0.2 + r() * (t1 - t0 - 0.4);
      let len = 1.0 + r() * 0.9;
      const top = y + 0.9;
      const fits = (L: number) => overhang(d, faceBoxOf(f, t - 0.2, t + 0.2, top - L - 0.15, top + 0.15, D - 0.1, D + 0.22));
      if (!fits(len)) {
        len = 0.9; // só até a laje
        if (!fits(len)) continue;
      }
      const n = Math.max(2, Math.round(len / 0.3));
      for (let j = 0; j < n; j++) {
        const yy = top - (j / (n - 1)) * len;
        const s = 0.17 - j * 0.015;
        const p = facePos(f, t + (r() - 0.5) * 0.12, yy, D + 0.06);
        tuft(d, p.x, p.y, p.z, s, s * 1.2, s, j % 2 ? LEAF : LEAF_LIGHT);
      }
      if (r() < 0.4) {
        const p = facePos(f, t, top - len * 0.4, D + 0.14);
        tuft(d, p.x, p.y, p.z, 0.09, 0.09, 0.09, PALETTE.magenta);
      }
    }
  }
}

/** Trepadeira descendo da cornija em alguns casarões (cortina de folhas no alto da parede). */
function eaveVines(d: Dress) {
  const r = rng(913);
  for (const lot of d.lots) {
    if (r() > 0.4 || lot.t1 - lot.t0 < 3) continue;
    const t = r() < 0.5 ? lot.t0 + 0.7 : lot.t1 - 0.7;
    const len = 1.6 + r() * 1.6;
    const top = lot.top - 0.35;
    const box = faceBoxOf(lot.face, t - 0.6, t + 0.6, top - len - 0.2, top + 0.2, 0, 0.42);
    if (!overhang(d, box)) continue;
    for (let s = -1; s <= 1; s++) {
      const L = len * (s === 0 ? 1 : 0.65 + r() * 0.2);
      const n = Math.max(2, Math.round(L / 0.32));
      for (let j = 0; j < n; j++) {
        const sz = 0.22 - j * 0.012;
        const p = facePos(lot.face, t + s * 0.38 + (r() - 0.5) * 0.1, top - (j / (n - 1)) * L, 0.2);
        tuft(d, p.x, p.y, p.z, sz, sz * 1.25, Math.min(sz, 0.2), (j + s) % 2 ? LEAF : LEAF_LIGHT);
      }
    }
  }
}

/** Palmeira (world/flora.ts): tronco em gomos inclinado e coroa com volume. */
function palm(d: Dress, x: number, base: number, z: number, h: number, r: () => number, far = false) {
  floraPalm(d.b, x, base, z, h, r, { frond: 2.6 + h * 0.06, fronds: far ? 8 : 10, far });
}

/** Bananeira: pseudocaule curto e folhas largas abertas em leque. */
function banana(d: Dress, x: number, base: number, z: number, r: () => number) {
  const h = 2.2 + r() * 0.8;
  d.b.add(place(new THREE.CylinderGeometry(0.16, 0.22, h, 6), x, base + h / 2, z), toon(LEAF), { cast: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r();
    const L = 1.6 + r() * 0.6;
    const g = new THREE.BoxGeometry(0.62, 0.04, L);
    g.translate(0, 0, L / 2);
    g.rotateX(-0.5 + r() * 0.9);
    g.rotateY(a);
    g.translate(x, base + h, z);
    d.b.add(g, toon(i % 2 ? LEAF_LIGHT : LEAF), { cast: false, receive: false });
  }
}

/** Palmeiras e bananeiras nos quintais, no meio dos quarteirões maiores (acima do telhado). */
function yardPalms(d: Dress) {
  const r = rng(515);
  for (const s of d.map.solids) {
    if (s.kind !== 'wall' || s.tint !== 'neutral') continue;
    const { min, max } = s.box;
    const w = max.x - min.x;
    const l = max.z - min.z;
    if (w * l < 120 || Math.min(w, l) < 7) continue;
    const n = w * l > 400 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const x = min.x + w * (n === 1 ? 0.5 : 0.3 + k * 0.4) + (r() - 0.5) * 2;
      const z = (min.z + max.z) / 2 + (r() - 0.5) * (l * 0.3);
      const h = 7 + r() * 3;
      const box: Box = { min: { x: x - 3.4, y: max.y, z: z - 3.4 }, max: { x: x + 3.4, y: max.y + h + 1, z: z + 3.4 } };
      if (!overhang(d, box)) continue;
      palm(d, x, max.y, z, h, r);
    }
  }
}

/** Palmeiras atrás do muro externo (encosta) e na beira do penhasco da baía (oeste). */
function backdropPalms(d: Dress) {
  const r = rng(616);
  const { x0, z0, x1, z1 } = d.map.bounds;
  // Norte e sul
  for (const side of [-1, 1]) {
    for (let x = x0 + r() * 8; x < x1; x += 9 + r() * 10) {
      const z = side < 0 ? z0 - 3 - r() * 4 : z1 + 3 + r() * 4;
      const roll = r();
      if (roll < 0.55) palm(d, x, 2, z, 9 + r() * 5, r);
      else if (roll < 0.8) broadleaf(d.b, x, 3 + r() * 2, z, 8 + r() * 4, r);
      else banana(d, x, 5.5 + r() * 2, z, r);
    }
  }
  // Leste
  for (let z = z0 + r() * 8; z < z1; z += 9 + r() * 10) {
    const x = x1 + 3 + r() * 4;
    if (r() < 0.7) palm(d, x, 2, z, 9 + r() * 5, r, true);
    else banana(d, x, 5.5 + r() * 2, z, r);
  }
  // Beira do penhasco a oeste, contra o pôr do sol
  for (let z = z0 - 10 + r() * 6; z < z1 + 10; z += 7 + r() * 8) palm(d, x0 - 4 - r() * 6, 1, z, 11 + r() * 5, r, true);
}

// ---------------------------------------------------------------- baía, ilha e farol

/** A Baía de Todos-os-Santos a oeste (embaixo do pôr do sol): mar, ilha baixa e farol. */
function bay(d: Dress) {
  const { x0 } = d.map.bounds;
  const sea = new THREE.PlaneGeometry(260, 560);
  sea.rotateX(-Math.PI / 2);
  sea.translate(x0 - 10 - 130, -9, 0);
  d.b.add(sea, toon(PALETTE.bay), { cast: false, receive: false });
  // Brilho do sol na água: faixas claras na direção do sol
  const r = rng(717);
  for (let i = 0; i < 26; i++) {
    const x = x0 - 40 - r() * 190;
    const z = 4 + (r() - 0.5) * (8 + (x0 - x) * 0.08);
    const len = 3 + r() * 9;
    const g = new THREE.BoxGeometry(0.5, 0.05, len);
    g.rotateY(Math.PI / 2);
    g.translate(x, -8.95, z);
    d.b.add(g, toon(PALETTE.horizon), { cast: false, receive: false });
  }
  // Ilha baixa no horizonte (silhueta)
  for (let i = 0; i < 9; i++) {
    const z = -200 + i * 48 + r() * 20;
    const g = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(40 + r() * 30, 7 + r() * 8, 26 + r() * 12);
    g.translate(x0 - 230 - r() * 20, -9, z);
    d.b.add(g, toon(PALETTE.dusk), { cast: false, receive: false });
  }
  lighthouse(d, x0 - 95, 34);
}

/** Farol numa ponta de pedra: listras vermelho/cal, lanterna acesa e cúpula escura. */
function lighthouse(d: Dress, x: number, z: number) {
  const o = { cast: false, receive: false } as const;
  const rock = new THREE.ConeGeometry(8, 17, 7);
  rock.translate(x, -9 + 8.5, z);
  d.b.add(rock, toon(PALETTE.dusk), o);
  const base = 6.5;
  const H = 22;
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const r0 = 2 - (i / bands) * 0.7;
    const r1 = 2 - ((i + 1) / bands) * 0.7;
    const g = new THREE.CylinderGeometry(r1, r0, H / bands, 10);
    g.translate(x, base + (i + 0.5) * (H / bands), z);
    d.b.add(g, toon(i % 2 ? PALETTE.cal : PALETTE.colonialRed), o);
  }
  const top = base + H;
  d.b.add(place(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 10), x, top + 0.15, z), toon(PALETTE.ink), o);
  neonBox(d.ctx, x - 0.9, top + 0.3, z - 0.9, x + 0.9, top + 1.8, z + 0.9, PALETTE.sun);
  const cap = new THREE.ConeGeometry(1.4, 1.6, 10);
  cap.translate(x, top + 2.6, z);
  d.b.add(cap, toon(PALETTE.ink), o);
  // Facho de luz girando devagar (aditivo, sem escrever profundidade)
  const beamMat = new THREE.MeshBasicMaterial({
    // Fraco e estreito: de frente para a câmera, o facho largo parecia um segundo sol.
    color: new THREE.Color(PALETTE.sun).multiplyScalar(0.2 * GLOW),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2, 46, 12, 1, true), beamMat);
  beam.geometry.translate(0, -23, 0);
  beam.geometry.rotateZ(Math.PI / 2);
  const pivot = new THREE.Group();
  pivot.position.set(x, top + 1.05, z);
  beam.raycast = () => {};
  pivot.add(beam);
  d.ctx.scene.add(pivot);
  d.ctx.updaters.push((_dt, time) => {
    pivot.rotation.y = time * 0.6;
  });
}

// ---------------------------------------------------------------- largo e luz

/** Floreira de pedra (veste uma cobertura baixa do largo): caixa, cimalha e folhagem rente. */
export function floreira(d: Dress, b: Box) {
  const { min, max } = b;
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, PALETTE.cobbleStone);
  const e = 0.05;
  d.b.block(min.x - e, max.y - 0.16, min.z - e, max.x + e, max.y - 0.02, max.z + e, PALETTE.cal, deco);
  d.b.block(min.x - e, min.y, min.z - e, max.x + e, min.y + 0.18, max.z + e, PALETTE.stoneJoint, deco);
  // Folhagem: no máximo TRIM acima do topo (não vira cobertura invisível)
  d.b.block(min.x + 0.1, max.y - 0.02, min.z + 0.1, max.x - 0.1, max.y + TRIM * 0.8, max.z - 0.1, LEAF, deco);
  // Folhas caindo pelas laterais (coladas na pedra, dentro do TRIM)
  const r = rng(Math.round(min.x * 31 + min.z * 17));
  for (let i = 0; i < 6; i++) {
    const side = i % 4;
    const u = 0.2 + r() * 0.6;
    const x = side < 2 ? min.x + u * (max.x - min.x) : side === 2 ? min.x - 0.04 : max.x + 0.04;
    const z = side >= 2 ? min.z + u * (max.z - min.z) : side === 0 ? min.z - 0.04 : max.z + 0.04;
    const h = 0.25 + r() * 0.3;
    const sx = side >= 2 ? 0.08 : 0.3;
    const sz = side >= 2 ? 0.3 : 0.08;
    d.b.block(x - sx / 2, max.y - h, z - sz / 2, x + sx / 2, max.y, z + sz / 2, i % 2 ? LEAF : LEAF_LIGHT, deco);
  }
}

/**
 * Luz do Pelourinho: o mesmo sol do bairro, com o céu de preenchimento mais frio, menos
 * rebote lilás por baixo e contraluz magenta mais fraca: as fachadas mostram as próprias cores.
 */
export function pelourinhoLight(scene: THREE.Scene) {
  scene.traverse((o) => {
    if (o instanceof THREE.HemisphereLight) {
      o.groundColor.copy(new THREE.Color(PALETTE.cantaria));
      // Sombra fria (céu azul-lilás), sol quente: o contraste das pinturas, sem tudo virar malva
      o.color.copy(new THREE.Color(PALETTE.cal).lerp(new THREE.Color(PALETTE.colonialSky), 0.4));
    } else if (o instanceof THREE.DirectionalLight && !o.castShadow) {
      o.color.copy(new THREE.Color(PALETTE.colonialSky));
      o.intensity *= 0.35;
    }
  });
  if (scene.fog instanceof THREE.Fog) scene.fog.color.lerp(new THREE.Color(PALETTE.horizon), 0.25);
}
