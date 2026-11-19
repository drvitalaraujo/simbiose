import * as THREE from 'three';
import { PALETTE as C, hex, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { box, rng } from '../world/shapes';
import { fit } from '../world/textures';
import { rgba } from '../world/colonial-art';
import { acrossStreet, clearOfBody, coverAt, exposedFaces, facePoint, type FaceSpan } from './facades';
import { FAVELA_HOUSES, FAVELA_STAIRWAYS } from './favela';
import type { FavelaArt } from './favela-art';
import type { MapData } from './types';

// Vida de rua da Favela do Sol: emaranhado de fios entre as casas, varais com roupa colorida,
// corrimão nas escadinhas, biroscas com balcão e toldos sobre as portas. Fios, varais e toldos
// ficam acima do alcance do corpo (`clearOfBody`); balcão e corrimão ficam rentes à parede.

const deco = { solid: false, shoot: false, cast: false, outline: 0 };
const wireMat = new THREE.MeshBasicMaterial({ color: C.ink });

/** Frente de birosca: casa (pela caixa), face e trecho ocupado (janelas e porta saem dali). */
export interface Shopfront {
  x0: number;
  z0: number;
  axis: 'x' | 'z';
  n: 1 | -1;
  t0: number;
  t1: number;
  title: string;
  sub: string;
  color: number;
}

export const FAVELA_SHOPS: Shopfront[] = [
  { x0: -24, z0: -22, axis: 'z', n: 1, t0: -16.3, t1: -12.6, title: 'BIROSCA DO SEU ZÉ', sub: 'CERVEJA GELADA • SALGADO • FIADO NÃO', color: C.colonialRed },
  { x0: 12, z0: -23, axis: 'x', n: 1, t0: -20.4, t1: -16.6, title: 'BAR DO SAMBA', sub: 'CALDO • PASTEL • RODA DE SEXTA', color: C.clothTeal },
];

/** A janela/porta da casa `solid` em `t` (na face `n`/`axis`) fica atrás de uma birosca? */
export function behindShop(solid: { min: { x: number; z: number } }, axis: 'x' | 'z', n: number, t: number, half = 0.7) {
  return FAVELA_SHOPS.some((s) => s.x0 === solid.min.x && s.z0 === solid.min.z && s.axis === axis && s.n === n && t + half > s.t0 && t - half < s.t1);
}

function wire(b: Builder, map: MapData, a: THREE.Vector3, c: THREE.Vector3, sag: number, radius = 0.022) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const p = a.clone().lerp(c, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, radius, 4, false);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  if (!clearOfBody(map, box(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z))) { geo.dispose(); return false; }
  b.add(geo, wireMat, { cast: false, receive: false });
  return true;
}

/** Roupa no varal: camiseta, bermuda ou toalha, pendurada a partir de `top`. */
function garment(b: Builder, map: MapData, x: number, top: number, z: number, along: 'x' | 'z', kind: number, color: number) {
  const parts: [number, number, number, number][] = kind === 0
    ? [[-0.24, -0.62, 0.24, 0], [-0.4, -0.22, -0.24, 0], [0.24, -0.22, 0.4, 0]] // camiseta com mangas
    : kind === 1
      ? [[-0.22, -0.28, 0.22, 0], [-0.22, -0.55, -0.02, -0.28], [0.02, -0.55, 0.22, -0.28]] // bermuda
      : [[-0.3, -0.75, 0.3, 0]]; // toalha
  for (const [u0, v0, u1, v1] of parts) {
    const bx = along === 'x' ? box(x + u0, top + v0, z - 0.012, x + u1, top + v1, z + 0.012) : box(x - 0.012, top + v0, z + u0, x + 0.012, top + v1, z + u1);
    if (!clearOfBody(map, bx)) return;
  }
  for (const [u0, v0, u1, v1] of parts) {
    if (along === 'x') b.block(x + u0, top + v0, z - 0.012, x + u1, top + v1, z + 0.012, color, deco);
    else b.block(x - 0.012, top + v0, z + u0, x + 0.012, top + v1, z + u1, color, deco);
  }
  // Prendedor
  if (along === 'x') b.block(x - 0.03, top - 0.02, z - 0.02, x + 0.03, top + 0.06, z + 0.02, C.colonialYellow, deco);
  else b.block(x - 0.02, top - 0.02, z - 0.03, x + 0.02, top + 0.06, z + 0.03, C.colonialYellow, deco);
}

const CLOTHES = [C.pink, C.cyan, C.colonialYellow, C.cal, C.colonialRed, C.lilac, C.orange, C.leafLight, C.colonialBlue];

/** Fios de um lado ao outro dos becos e varais mais baixos, onde ninguém alcança. */
export function favelaTangle(b: Builder, map: MapData) {
  const r = rng(31337);
  const homes = new Set(FAVELA_HOUSES.filter((h) => h.solid.box.min.y === 0).map((h) => h.solid));
  const faces = exposedFaces(map, (s) => homes.has(s)).filter((f) => f.base === 0 && f.n === 1);
  let lines = 0;
  for (const f of faces) {
    for (let t = f.t0 + 1.5 + r() * 2; t < f.t1 - 1; t += 3.5 + r() * 3) {
      const across = acrossStreet(map, f, t, 13);
      if (!across || across.d < 2.5) continue;
      const top = Math.min(f.top, across.top);
      const h = top - 0.6 - r() * 1.6;
      const a = facePoint(f, t, 0.05);
      const shift = (r() - 0.5) * 3;
      const c = facePoint(f, t + shift, across.d - 0.05);
      // Feixe: dois a quatro fios com barrigas diferentes saindo da mesma "gambiarra"
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        wire(b, map, new THREE.Vector3(a.x, h + i * 0.12, a.z), new THREE.Vector3(c.x, h + (r() - 0.5) * 0.6 + i * 0.1, c.z), 0.25 + r() * 0.7 + i * 0.12);
      }
      // Caixinha de ligação na parede, rente (6 cm)
      if (f.axis === 'x') b.block(f.at, h - 0.25, t - 0.15, f.at + 0.06, h + 0.12, t + 0.15, C.steelLight, deco);
      else b.block(t - 0.15, h - 0.25, f.at, t + 0.15, h + 0.12, f.at + 0.06, C.steelLight, deco);
      // Varal: um a cada três vãos, mais baixo e reto, com roupa colorida
      if (lines++ % 3 === 1) clothesline(b, map, f, t, across.d, Math.min(top - 1.2, 4.6 + r() * 1.2), r);
    }
  }
}

function clothesline(b: Builder, map: MapData, f: FaceSpan, t: number, d: number, y: number, r: () => number) {
  const a = facePoint(f, t, 0.05);
  const c = facePoint(f, t, d - 0.05);
  if (!wire(b, map, new THREE.Vector3(a.x, y, a.z), new THREE.Vector3(c.x, y, c.z), 0.12, 0.012)) return;
  for (let s = 0.7; s < d - 0.5; s += 0.75 + r() * 0.35) {
    const p = facePoint(f, t, s);
    const k = s / d;
    // A roupa fica no plano do varal (que corre na direção da normal da face)
    garment(b, map, p.x, y - 0.12 * 4 * k * (1 - k), p.z, f.axis, Math.floor(r() * 3), CLOTHES[Math.floor(r() * CLOTHES.length)]);
  }
}

/** Corrimão de cano preso na parede ao lado da escadinha (sai 4 a 10 cm da parede). */
export function favelaRails(b: Builder, map: MapData) {
  for (const stair of FAVELA_STAIRWAYS) {
    const steps = stair.steps.map((s) => s.box);
    const first = steps[0];
    const last = steps[steps.length - 1];
    const alongX = Math.abs(stair.top.x - stair.bottom.x) > Math.abs(stair.top.z - stair.bottom.z);
    const [c0, c1] = alongX ? [first.min.z, first.max.z] : [first.min.x, first.max.x];
    const mid = steps[Math.floor(steps.length / 2)];
    const midT = alongX ? (mid.min.x + mid.max.x) / 2 : (mid.min.z + mid.max.z) / 2;
    for (const [edge, out] of [[c0, -1], [c1, 1]] as const) {
      const probe = alongX ? coverAt(map, midT, edge + out * 0.3) : coverAt(map, edge + out * 0.3, midT);
      if (probe < 4) continue;
      const side = edge - out * 0.07;
      // Do degrau de baixo ao de cima, 0,9 m acima do bocel
      const dir = alongX ? Math.sign(stair.top.x - stair.bottom.x) : Math.sign(stair.top.z - stair.bottom.z);
      const startT = alongX ? (dir > 0 ? first.min.x : first.max.x) : dir > 0 ? first.min.z : first.max.z;
      const endT = alongX ? (dir > 0 ? last.max.x : last.min.x) : dir > 0 ? last.max.z : last.min.z;
      const y0 = first.max.y + 0.9;
      const y1 = last.max.y + 0.9;
      const at = (t: number, y: number) => (alongX ? new THREE.Vector3(t, y, side) : new THREE.Vector3(side, y, t));
      const pipe = new THREE.TubeGeometry(new THREE.LineCurve3(at(startT, y0), at(endT, y1)), 1, 0.03, 6, false);
      b.add(pipe, toon(C.colonialYellow), { cast: false });
      const n = Math.max(2, Math.round(Math.abs(endT - startT) / 1.2));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const t = startT + (endT - startT) * k;
        const y = y0 + (y1 - y0) * k;
        if (alongX) b.block(t - 0.02, y - 0.03, Math.min(edge, side), t + 0.02, y + 0.01, Math.max(edge, side), C.steel, deco);
        else b.block(Math.min(edge, side), y - 0.03, t - 0.02, Math.max(edge, side), y + 0.01, t + 0.02, C.steel, deco);
      }
    }
    // Espelho do degrau mais escuro (sujeira de sola) e bocel gasto
    for (const s of steps) {
      if (alongX) {
        const front = dir(stair) > 0 ? s.min.x - 0.012 : s.max.x + 0.012;
        b.block(front - 0.006, s.max.y - 0.4, s.min.z, front + 0.006, s.max.y - 0.03, s.max.z, C.stoneJoint, deco);
      } else {
        const front = dir(stair) > 0 ? s.min.z - 0.012 : s.max.z + 0.012;
        b.block(s.min.x, s.max.y - 0.4, front - 0.006, s.max.x, s.max.y - 0.03, front + 0.006, C.stoneJoint, deco);
      }
    }
  }
}

function dir(stair: { bottom: { x: number; z: number }; top: { x: number; z: number } }) {
  const dx = stair.top.x - stair.bottom.x;
  const dz = stair.top.z - stair.bottom.z;
  return Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : Math.sign(dz);
}

/** Birosca: frente pintada com balcão, prateleiras e geladeira; letreiro e toldo listrado. */
export function favelaShops(b: Builder, map: MapData, art: FavelaArt) {
  const front = art.birosca;
  for (const s of FAVELA_SHOPS) {
    const home = FAVELA_HOUSES.find((h) => h.solid.box.min.x === s.x0 && h.solid.box.min.z === s.z0)!;
    const bb = home.solid.box;
    const at = s.axis === 'z' ? (s.n > 0 ? bb.max.z : bb.min.z) : s.n > 0 ? bb.max.x : bb.min.x;
    const angle = s.axis === 'z' ? (s.n > 0 ? 0 : Math.PI) : s.n > 0 ? Math.PI / 2 : -Math.PI / 2;
    const mid = (s.t0 + s.t1) / 2;
    const w = s.t1 - s.t0;
    const pos = (t: number, out: number) => (s.axis === 'z' ? [t, at + s.n * out] : [at + s.n * out, t]);
    const [px, pz] = pos(mid, 0.04);
    art.panel(front, px, 1.22, pz, w, 2.4, angle);
    const [sx, sz] = pos(mid, 0.045);
    art.panel(art.sign(s.title, s.sub, s.color), sx, 2.78, sz, w + 0.2, 0.62, angle);
    // Balcão de azulejo rente à parede
    const ledge = (t0: number, t1: number, y0: number, y1: number, o0: number, o1: number, color: number) => {
      if (s.axis === 'z') b.block(t0, y0, Math.min(at + s.n * o0, at + s.n * o1), t1, y1, Math.max(at + s.n * o0, at + s.n * o1), color, deco);
      else b.block(Math.min(at + s.n * o0, at + s.n * o1), y0, t0, Math.max(at + s.n * o0, at + s.n * o1), y1, t1, color, deco);
    };
    ledge(s.t0 + 0.2, s.t1 - 0.2, 1.02, 1.08, 0, 0.11, C.cal);
    ledge(s.t0, s.t0 + 0.08, 0, 2.45, 0, 0.09, C.steel);
    ledge(s.t1 - 0.08, s.t1, 0, 2.45, 0, 0.09, C.steel);
    // Toldo listrado acima do alcance do pulo
    awning(b, map, s.axis, at, s.n, mid, w + 0.4, 4.0, [s.color, C.cal]);
  }
}

function awning(b: Builder, map: MapData, axis: 'x' | 'z', at: number, n: number, t: number, w: number, y: number, colors: [number, number]) {
  // Tenta 1,1 m de aba; se o pulo alcança, encurta; se nem assim, desiste.
  for (const depth of [1.1, 0.7]) {
    const drop = depth * 0.35;
    const bx = axis === 'z'
      ? box(t - w / 2, y - drop - 0.25, Math.min(at, at + n * depth) - 0.02, t + w / 2, y + 0.05, Math.max(at, at + n * depth) + 0.02)
      : box(Math.min(at, at + n * depth) - 0.02, y - drop - 0.25, t - w / 2, Math.max(at, at + n * depth) + 0.02, y + 0.05, t + w / 2);
    if (!clearOfBody(map, bx)) continue;
    const tilt = Math.atan2(drop, depth);
    const len = Math.hypot(depth, drop);
    const stripes = Math.max(2, Math.round(w / 0.45));
    const rot = axis === 'z' ? (n > 0 ? 0 : Math.PI) : n > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let i = 0; i < stripes; i++) {
      const u = -w / 2 + (i + 0.5) * (w / stripes);
      const geo = new THREE.BoxGeometry(w / stripes, 0.03, len);
      geo.rotateX(tilt);
      geo.translate(u, y - drop / 2, depth / 2);
      b.add(place(geo, axis === 'z' ? t : at, 0, axis === 'z' ? at : t, rot), toon(colors[i % 2]), { cast: true });
      // Franja recortada na ponta
      const flap = new THREE.BoxGeometry(w / stripes, 0.22, 0.02);
      flap.translate(u, y - drop - 0.11, depth);
      b.add(place(flap, axis === 'z' ? t : at, 0, axis === 'z' ? at : t, rot), toon(colors[(i + 1) % 2]), { cast: false });
    }
    return;
  }
}

/** Frente de birosca vista de fora: porta de aço enrolada, prateleiras, balcão e geladeira. */
export function paintBirosca(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(616);
  g.fillStyle = hex(C.inkSoft);
  g.fillRect(0, 0, w, h);
  // Porta de aço enrolada no alto
  g.fillStyle = hex(C.steel);
  g.fillRect(0, 0, w, 34);
  g.fillStyle = hex(C.steelLight);
  for (let y = 4; y < 34; y += 6) g.fillRect(0, y, w, 2);
  // Prateleiras com garrafas e salgadinhos
  for (const y of [70, 112]) {
    g.fillStyle = hex(C.bark);
    g.fillRect(14, y, w - 130, 6);
    for (let x = 20; x < w - 125; x += 11 + r() * 5) {
      const bh = 18 + r() * 14;
      g.fillStyle = hex([C.leaf, C.colonialRed, C.ochre, C.cal, C.colonialSky, C.pink][Math.floor(r() * 6)]);
      g.fillRect(x, y - bh, 8, bh);
      g.fillRect(x + 2, y - bh - 6, 4, 6);
    }
  }
  // Pacotinhos pendurados no varal da birosca
  for (let x = 24; x < w - 140; x += 26) {
    g.fillStyle = hex([C.colonialYellow, C.orange, C.pink][Math.floor(r() * 3)]);
    g.fillRect(x, 40, 18, 22);
  }
  // Geladeira branca de porta de vidro
  g.fillStyle = hex(C.cal);
  g.fillRect(w - 110, 44, 92, h - 54);
  g.fillStyle = hex(C.glass);
  g.fillRect(w - 102, 70, 76, h - 120);
  g.fillStyle = hex(C.colonialSky);
  for (let y = 80; y < h - 60; y += 24) for (let x = w - 98; x < w - 32; x += 11) g.fillRect(x, y, 7, 18);
  g.fillStyle = hex(C.colonialRed);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fit(g, 'GELADA', 18, 80);
  g.fillText('GELADA', w - 64, 58);
  // Balcão de azulejo
  g.fillStyle = hex(C.cal);
  g.fillRect(0, h - 92, w - 120, 92);
  g.fillStyle = hex(C.colonialSky);
  for (let y = h - 86; y < h; y += 18) for (let x = (y % 36) / 2; x < w - 124; x += 18) g.fillRect(x + 2, y + 2, 14, 14);
  g.fillStyle = rgba(C.ink, 0.28);
  g.fillRect(0, h - 22, w - 120, 22);
}

