import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE, toon } from '../toon';
import { place } from './builder';
import { type Ctx, type Face, faceBox, graf, neonBox } from './props';
import { box, rng } from './shapes';
import { lambeLambe, paintNeonBlade } from './signs';
import { pixo, type UVRect } from './textures';

// Prédio paulistano com silhueta: recuos escalonados, platibanda, caixa d'água azul,
// casa de máquinas, antenas, varandas, ar-condicionados pendurados, marquise e letreiro
// vertical de neon. Tudo vira geometria mesclada no Builder (poucos draw calls).

export interface Lot {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
  /** Entra na colisão e bloqueia tiro (prédios da borda da praça). */
  near: boolean;
  color: number;
  /** Fachadas que alguém vê de perto (avenida ou praça). */
  faces: { face: Face; kind: 'street' | 'plaza' }[];
  /** Fachada (caixa com UV de janelas) já com cor por vértice. */
  facade: (b: Box) => THREE.BufferGeometry;
  facadeMat: THREE.Material;
}

const FLOOR = 3; // pé-direito: casa com as janelas da textura (24 m / 8 andares)

export const BLADE_WORDS = ['HOTEL', 'FARMÁCIA', 'PASTEL', 'LAN HOUSE', 'ACADEMIA', 'KARAOKÊ', 'BAR', 'PENSÃO', 'BOTECO', 'AÇAÍ', 'SALÃO', 'DROGARIA'];
const BLADE_COLORS = [PALETTE.pink, PALETTE.cyan, PALETTE.yellow, PALETTE.orange, PALETTE.magenta];

interface Kit {
  blades: UVRect[];
  tags: UVRect[];
  posters: UVRect[];
}
const kits = new WeakMap<Ctx, Kit>();

function kit(ctx: Ctx): Kit {
  let k = kits.get(ctx);
  if (!k) {
    k = {
      blades: BLADE_WORDS.map((t, i) => ctx.glowSigns.draw(96, 448, (g, w, h) => paintNeonBlade(g, w, h, t, BLADE_COLORS[i % BLADE_COLORS.length]))),
      tags: [21, 22, 23].map((s) => ctx.graffiti.draw(1024, 96, (g, w, h) => {
        const rr = rng(s);
        const words = ['VILA', 'DESPLUGA', 'Ñ SORRIA', 'OFF', 'KAIA', 'BIT', 'ZL', 'ZN', 'LIVRES', 'SP', 'CRU', 'ANALÓGICO'];
        const inks = [PALETTE.ink, PALETTE.ink, PALETTE.wine, PALETTE.skyDeep];
        for (let x = 40; x < w; x += 80 + rr() * 70) pixo(g, words[Math.floor(rr() * words.length)], x, h * (0.45 + rr() * 0.15), h * (0.3 + rr() * 0.15), inks[Math.floor(rr() * inks.length)]);
      })),
      posters: [31, 32].map((s) => ctx.graffiti.draw(1024, 192, (g, w, h) => lambeLambe(g, w, h, s))),
    };
    kits.set(ctx, k);
  }
  return k;
}

/** UVs dos letreiros verticais de neon (desenhados uma vez no atlas `glowSigns`). */
export function bladeUVs(ctx: Ctx): UVRect[] {
  return kit(ctx).blades;
}

/** Faixas de lambe-lambe (cartazes colados), para reaproveitar em outras paredes. */
export function posterUVs(ctx: Ctx): UVRect[] {
  return kit(ctx).posters;
}

export function building(ctx: Ctx, lot: Lot, r: () => number) {
  const { b } = ctx;
  const x0 = Math.min(lot.x0, lot.x1);
  const x1 = Math.max(lot.x0, lot.x1);
  const z0 = Math.min(lot.z0, lot.z1);
  const z1 = Math.max(lot.z0, lot.z1);
  const h = lot.h;
  const tiers: Box[] = [];
  if (h > 20 && r() < 0.8) {
    // Recuo escalonado: o corpo de baixo segura a rua, a torre sobe recuada
    const hb = Math.max(9, Math.round((h * (0.4 + r() * 0.25)) / FLOOR) * FLOOR);
    tiers.push(box(x0, 0, z0, x1, hb, z1));
    const ins = 1.2 + r() * 1.4;
    const shift = (r() - 0.5) * 1.5;
    let tb = box(x0 + ins + shift, hb, z0 + ins - shift, x1 - ins + shift, h, z1 - ins - shift);
    if (h > 38 && r() < 0.65) {
      const h2 = Math.round((hb + (h - hb) * (0.55 + r() * 0.2)) / FLOOR) * FLOOR;
      tiers.push(box(tb.min.x, hb, tb.min.z, tb.max.x, h2, tb.max.z));
      const ins2 = 1 + r() * 1.2;
      tb = box(tb.min.x + ins2, h2, tb.min.z + ins2, tb.max.x - ins2, h, tb.max.z - ins2);
    }
    tiers.push(tb);
  } else {
    tiers.push(box(x0, 0, z0, x1, h, z1));
  }

  for (const t of tiers) {
    if (lot.near) b.solids.push(t);
    b.add(lot.facade(t), lot.facadeMat, { shoot: lot.near });
    parapet(ctx, t, r() < 0.3 ? PALETTE.paper : PALETTE.concreteDark);
  }
  const top = tiers[tiers.length - 1];
  roof(ctx, top, r);
  for (let i = 0; i < tiers.length - 1; i++) terrace(ctx, tiers[i], tiers[i + 1], r);

  const base = tiers[0];
  const balconies = r() < 0.4;
  for (const { face, kind } of lot.faces) {
    const [t0, t1] = face.axis === 'x' ? [base.min.z, base.max.z] : [base.min.x, base.max.x];
    facadeDetail(ctx, face, t0, t1, base.max.y, kind, balconies, r);
  }
}

/** Platibanda: mureta em volta do telhado (dá recorte à silhueta contra o céu). */
function parapet(ctx: Ctx, t: Box, color: number) {
  const y = t.max.y;
  const H = 0.7;
  const T = 0.3;
  const o = { solid: false, cast: false };
  const { min, max } = t;
  ctx.b.block(min.x - 0.1, y, min.z - 0.1, max.x + 0.1, y + H, min.z + T, color, o);
  ctx.b.block(min.x - 0.1, y, max.z - T, max.x + 0.1, y + H, max.z + 0.1, color, o);
  ctx.b.block(min.x - 0.1, y, min.z + T, min.x + T, y + H, max.z - T, color, o);
  ctx.b.block(max.x - T, y, min.z + T, max.x + 0.1, y + H, max.z - T, color, o);
}

/** Telhado: caixas d'água azuis, casa de máquinas, antenas e parabólica. */
function roof(ctx: Ctx, t: Box, r: () => number) {
  const { b } = ctx;
  const y = t.max.y;
  const cx = (t.min.x + t.max.x) / 2;
  const cz = (t.min.z + t.max.z) / 2;
  const w = t.max.x - t.min.x;
  const d = t.max.z - t.min.z;
  const o = { solid: false };
  // Casa de máquinas do elevador
  const mw = Math.min(w * 0.45, 3.4);
  const md = Math.min(d * 0.4, 2.8);
  const mx = cx + (r() - 0.5) * (w - mw - 1.5);
  const mz = cz + (r() - 0.5) * (d - md - 1.5);
  const mh = 2.2 + r() * 1.4;
  b.block(mx - mw / 2, y, mz - md / 2, mx + mw / 2, y + mh, mz + md / 2, r() < 0.5 ? PALETTE.concrete : PALETTE.paper, o);
  // Caixas d'água (cilindro azul de fibra, a cara do telhado brasileiro)
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const R = 0.7 + r() * 0.5;
    const px = THREE.MathUtils.clamp(cx + (r() - 0.5) * w * 0.7, t.min.x + R + 0.4, t.max.x - R - 0.4);
    const pz = THREE.MathUtils.clamp(cz + (r() - 0.5) * d * 0.7, t.min.z + R + 0.4, t.max.z - R - 0.4);
    const onTop = i === 0 && r() < 0.6;
    const base = onTop ? y + mh : y;
    const ox = onTop ? mx : px;
    const oz = onTop ? mz : pz;
    const body = new THREE.CylinderGeometry(R, R * 0.9, R * 1.3, 10);
    body.translate(ox, base + R * 0.65, oz);
    b.add(body, toon(PALETTE.tank), { cast: true });
    const lid = new THREE.CylinderGeometry(R * 0.55, R * 1.05, R * 0.35, 10);
    lid.translate(ox, base + R * 1.3 + R * 0.17, oz);
    b.add(lid, toon(PALETTE.tank), { cast: true });
  }
  // Antena de TV (mastro + travessas)
  if (r() < 0.75) {
    const ax = t.min.x + 0.8 + r() * (w - 1.6);
    const az = t.min.z + 0.8 + r() * (d - 1.6);
    const ah = 3 + r() * 5;
    const ink = { solid: false, cast: false };
    b.block(ax - 0.05, y, az - 0.05, ax + 0.05, y + ah, az + 0.05, PALETTE.ink, ink);
    for (let k = 0; k < 3; k++) {
      const yy = y + ah - 0.4 - k * 0.6;
      const half = 0.9 - k * 0.2;
      b.block(ax - half, yy, az - 0.03, ax + half, yy + 0.06, az + 0.03, PALETTE.ink, ink);
    }
    if (r() < 0.25) neonBox(ctx, ax - 0.12, y + ah, az - 0.12, ax + 0.12, y + ah + 0.24, az + 0.12, PALETTE.pink);
  }
  // Parabólica
  if (r() < 0.45) {
    const dish = new THREE.SphereGeometry(0.75, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.32);
    const px = t.min.x + 1 + r() * (w - 2);
    const pz = t.min.z + 1 + r() * (d - 2);
    dish.rotateX(-Math.PI / 2 + 0.6);
    place(dish, px, y + 0.9, pz, r() * Math.PI * 2);
    b.add(dish, toon(PALETTE.paper), { cast: false });
    b.block(px - 0.05, y, pz - 0.05, px + 0.05, y + 0.8, pz + 0.05, PALETTE.ink, { solid: false, cast: false });
  }
  // Condensadoras de ar no telhado
  for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
    const px = t.min.x + 0.8 + r() * (w - 1.6);
    const pz = t.min.z + 0.8 + r() * (d - 1.6);
    b.block(px - 0.45, y, pz - 0.3, px + 0.45, y + 0.7, pz + 0.3, PALETTE.paper, { solid: false, cast: false });
  }
}

/** Terraço do recuo: floreiras e vasos com mato (a cidade verde que sobra). */
function terrace(ctx: Ctx, lower: Box, upper: Box, r: () => number) {
  const y = lower.max.y;
  const spots: [number, number][] = [
    [(lower.min.x + upper.min.x) / 2, (lower.min.z + lower.max.z) / 2],
    [(lower.max.x + upper.max.x) / 2, (lower.min.z + lower.max.z) / 2],
    [(lower.min.x + lower.max.x) / 2, (lower.min.z + upper.min.z) / 2],
    [(lower.min.x + lower.max.x) / 2, (lower.max.z + upper.max.z) / 2],
  ];
  for (const [x, z] of spots) {
    if (r() < 0.45) continue;
    bush(ctx, x + (r() - 0.5) * 4, y, z + (r() - 0.5) * 4, 0.7 + r() * 0.5, r() < 0.3 ? PALETTE.ipe : PALETTE.leaf);
  }
}

/** Arbusto toon: vaso e duas bolhas de folhagem. */
export function bush(ctx: Ctx, x: number, y: number, z: number, s: number, color: number) {
  ctx.b.block(x - s * 0.5, y, z - s * 0.5, x + s * 0.5, y + s * 0.6, z + s * 0.5, PALETTE.wine, { solid: false });
  for (const [ox, oy, oz, k] of [[0, 0.95, 0, 0.7], [s * 0.3, 0.75, -s * 0.2, 0.5]]) {
    const g = new THREE.SphereGeometry(s * k, 10, 7);
    g.scale(1, 0.85, 1);
    g.translate(x + ox, y + s * oy, z + oz);
    ctx.b.add(g, toon(color), { cast: true });
  }
}

/** Detalhes numa fachada visível: marquise, varandas, ar-condicionados, letreiro e pixo. */
function facadeDetail(ctx: Ctx, f: Face, t0: number, t1: number, hb: number, kind: 'street' | 'plaza', balconies: boolean, r: () => number) {
  const k = kit(ctx);
  const len = t1 - t0;
  const mid = (t0 + t1) / 2;
  const concrete = toon(PALETTE.concrete);
  const paper = toon(PALETTE.paper);
  const dark = toon(PALETTE.concreteDark);

  if (kind === 'street') {
    // Marquise de concreto sobre a calçada, com faixa colorida e lojas embaixo
    faceBox(ctx, f, mid, 3.75, len - 0.6, 0.22, 1.7, concrete, 0);
    faceBox(ctx, f, mid, 3.55, len - 0.6, 0.18, 0.08, toon(r() < 0.5 ? PALETTE.pink : PALETTE.yellow), 1.7);
    // Pixo na parte de baixo (até onde a mão alcança)
    graf(ctx, f, k.tags[Math.floor(r() * k.tags.length)], mid, 2.1 + r() * 0.6, Math.min(len * 0.85, 9), 0.85);
    if (r() < 0.6) graf(ctx, f, k.posters[Math.floor(r() * k.posters.length)], t0 + 1.5 + r() * (len - 5), 1.5, 3.4, 0.64, 0.04);
  }

  // Varandas de concreto com guarda-corpo, andar por andar
  if (balconies && hb > 9) {
    const bw = Math.min(len * (0.35 + r() * 0.25), 6);
    const cols = len > 9 ? [mid - len * 0.25, mid + len * 0.25] : [mid];
    for (let y = 6; y < hb - 1; y += FLOOR) {
      for (const c of cols) {
        faceBox(ctx, f, c, y, bw, 0.18, 1.0, concrete, 0);
        faceBox(ctx, f, c, y + 0.5, bw, 0.85, 0.08, r() < 0.15 ? toon(PALETTE.pink) : dark, 0.92);
      }
    }
  }

  // Ar-condicionados pendurados embaixo das janelas
  const nAC = Math.floor((len * hb) / 28);
  for (let i = 0; i < nAC; i++) {
    const t = t0 + 0.8 + r() * (len - 1.6);
    const y = 4.6 + Math.floor(r() * Math.max(1, (hb - 6) / FLOOR)) * FLOOR + 0.2;
    if (y > hb - 0.8) continue;
    faceBox(ctx, f, t, y, 0.8, 0.5, 0.5, paper, 0);
    faceBox(ctx, f, t, y - 0.32, 0.12, 0.12, 0.12, dark, 0.05); // suporte
  }

  // Letreiro vertical de neon (dupla face, perpendicular à parede)
  if (r() < (kind === 'plaza' ? 0.55 : 0.4)) {
    const t = t0 + 1.5 + r() * (len - 3);
    const y = Math.min(hb - 3, 6.5 + r() * 5);
    if (y > 5) blade(ctx, f, t, y, k.blades[Math.floor(r() * k.blades.length)]);
  }
}

/** Letreiro de neon vertical saindo da parede. */
export function blade(ctx: Ctx, f: Face, t: number, y: number, uv: UVRect, w = 1.15, h = 5.2) {
  const out = 0.35 + w / 2;
  const pos = f.axis === 'z' ? new THREE.Vector3(t, y, f.at + f.n * out) : new THREE.Vector3(f.at + f.n * out, y, t);
  // Plano no plano vertical que contém a normal da parede
  const rot = f.axis === 'z' ? Math.PI / 2 : 0;
  for (const flip of [0, Math.PI]) {
    const p = new THREE.PlaneGeometry(w, h);
    const a = p.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) < 0.5 ? uv.u0 : uv.u1, a.getY(i) < 0.5 ? uv.v0 : uv.v1);
    p.translate(0, 0, 0.05);
    p.rotateY(rot + flip);
    p.translate(pos.x, pos.y, pos.z);
    ctx.b.add(p, ctx.glowMat, { cast: false, receive: false });
  }
  // Caixa escura fina entre as duas faces + braços presos na parede
  const g = new THREE.BoxGeometry(0.06, h + 0.2, w + 0.12);
  g.rotateY(rot + Math.PI / 2);
  g.translate(pos.x, pos.y, pos.z);
  ctx.b.add(g, toon(PALETTE.ink), { cast: false });
  for (const dy of [h / 2 - 0.3, -h / 2 + 0.3]) faceBox(ctx, f, t, y + dy, 0.08, 0.08, 0.4, toon(PALETTE.ink), 0);
}
