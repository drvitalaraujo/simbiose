import * as THREE from 'three';
import { PALETTE, toon } from '../toon';
import type { Builder } from '../world/builder';
import { place } from '../world/builder';
import type { Art, ColonialKit } from '../world/colonial-art';
import { type Ctx, type Face, faceRot, facePos, neonBox } from '../world/props';
import { planeGeo } from '../world/textures';
import type { Box } from '../physics';
import { clearOfBody, type FaceSpan, floorAt, splitLots } from './facades';
import type { MapData } from './types';

// Fileiras de casarões coloniais nas faces à vista das paredes do mapa: cores vivas,
// cunhais e cornijas de cantaria branca, janelas em arco com venezianas, sacadas de ferro,
// beiral de telha ou platibanda com frontão. Tudo é decoração: a colisão continua sendo a
// caixa da parede. Friso fino (até TRIM) pode ficar em qualquer altura; o que sai mais que
// isso (sacada, beiral, cornija, frontão, neon) só entra se ficar inteiro acima do alcance
// do corpo, inclusive pulando de qualquer piso ou cobertura alcançável (`clearOfBody`).

export interface Dress {
  b: Builder;
  ctx: Ctx;
  map: MapData;
  kit: ColonialKit;
  r: () => number;
  /** Áreas de parede reservadas (letreiros, telões): janela e pichação não entram. */
  reserved: Reserved[];
  /** Lotes montados (outros enfeites escolhem parede por aqui). */
  lots: Lot[];
  /** Vãos do térreo deixados livres para pichação (centro na face e altura do piso). */
  graffitiSlots: { face: Face; t: number; y: number }[];
  /** Peças que avançam mais que TRIM da parede (todas conferidas contra o alcance do corpo). */
  overhangs: Box[];
  /** Sacadas montadas (laje em `y`, avanço `depth`): vasos e plantas pendentes vão aqui. */
  balconies: { face: Face; t0: number; t1: number; y: number; depth: number }[];
  /** Janelas do andar de cima (centro t, base y, largura w): escorrido e vasos vão aqui. */
  sills: { face: Face; t: number; y: number; w: number }[];
}

export interface Reserved {
  axis: 'x' | 'z';
  at: number;
  t0: number;
  t1: number;
  y0: number;
  y1: number;
}

export interface Lot {
  face: Face;
  t0: number;
  t1: number;
  top: number;
  color: number;
}

/** Cores reais do casario (foto 05 do dossiê): azul, ocre, areia, salmão, verde, vermelho, cal. */
export const HOUSE_COLORS = [
  PALETTE.colonialSky, PALETTE.ochre, PALETTE.colonialRose, PALETTE.colonialMoss, PALETTE.sand,
  PALETTE.colonialRed, PALETTE.colonialBlue, PALETTE.cal, PALETTE.colonialYellow, PALETTE.colonialSky,
  PALETTE.ochre, PALETTE.colonialRose,
];
const STONE = PALETTE.cal; // cantaria caiada
const deco = { solid: false, cast: false, outline: 0 } as const;
/** Quanto um friso pode sair da parede em qualquer altura (contorno da sola/ombro, não esconde ninguém). */
export const TRIM = 0.12;
/** Escala das portas-janela de sacada (arte de 1 × 2 m vira ~1,15 × 2,3 m, como no dossiê). */
const WIN = 1.15;
const WIN_H = 2 * WIN;
/** Porta do térreo: 1,45 × 2,9 m (dossiê: 1,2–1,5 × 3–4 m). */
const DOOR_W = 1.45;
const DOOR_H = 2.9;

/** Caixa no mundo de uma peça colada na face (t0..t1 ao longo, y0..y1, o0..o1 para fora). */
export function faceBoxOf(f: Face, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number): Box {
  const a = f.at + f.n * o0;
  const c = f.at + f.n * o1;
  const [p0, p1] = [Math.min(a, c), Math.max(a, c)];
  return f.axis === 'x'
    ? { min: { x: p0, y: y0, z: Math.min(t0, t1) }, max: { x: p1, y: y1, z: Math.max(t0, t1) } }
    : { min: { x: Math.min(t0, t1), y: y0, z: p0 }, max: { x: Math.max(t0, t1), y: y1, z: p1 } };
}

/** Pode pôr uma peça saliente aqui? Fora do alcance do corpo: registra e devolve true. */
export function overhang(d: Dress, b: Box): boolean {
  if (!clearOfBody(d.map, b)) return false;
  d.overhangs.push(b);
  return true;
}

/**
 * Caixa decorativa colada na face: de t0 a t1 ao longo, y0 a y1, `o0` a `o1` para fora.
 * Se sair mais que TRIM e o corpo alcançar a peça, ela é aparada para TRIM.
 */
export function faceSlab(d: Dress, f: Face, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number, color: number, cast = false) {
  if (o1 > TRIM && !overhang(d, faceBoxOf(f, t0, t1, y0, y1, o0, o1))) {
    if (o0 >= TRIM) return;
    o1 = TRIM;
  }
  const { min, max } = faceBoxOf(f, t0, t1, y0, y1, o0, o1);
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, color, { ...deco, cast });
}

/** Arte do atlas colada na face (centro em t, base em y). */
export function faceArt(d: Dress, f: Face, art: Art, t: number, y: number, off: number, w = art.w, h = art.h, glow = false) {
  const p = facePos(f, t, y + h / 2, off);
  d.b.add(place(planeGeo(w, h, art.uv), p.x, p.y, p.z, faceRot(f)), glow ? d.kit.glow : d.kit.mat, { cast: false });
}

export function isReserved(d: Dress, f: Face, t0: number, t1: number, y0: number, y1: number): boolean {
  return d.reserved.some((r) => r.axis === f.axis && Math.abs(r.at - f.at) < 0.3 && t1 > r.t0 && t0 < r.t1 && y1 > r.y0 && y0 < r.y1);
}

/** Veste um trecho de face à vista com casarões (ou só reboco e cornija, se for o alto da empena). */
export function dressSpan(d: Dress, s: FaceSpan) {
  const f: Face = { axis: s.axis, at: s.at, n: s.n };
  if (s.base > 0) {
    // Empena acima de uma casa vizinha mais baixa: reboco liso e cornija
    const color = HOUSE_COLORS[Math.floor(d.r() * HOUSE_COLORS.length)];
    faceSlab(d, f, s.t0, s.t1, s.base, s.top, 0, 0.03, color);
    faceSlab(d, f, s.t0, s.t1, s.top - 0.3, s.top, 0, 0.2, STONE, true);
    return;
  }
  for (const [t0, t1] of splitLots(s.t0, s.t1, d.r, 8.5)) casarao(d, f, t0, t1, s.top);
}

function casarao(d: Dress, f: Face, t0: number, t1: number, H: number) {
  const { r, map } = d;
  const W = t1 - t0;
  const color = HOUSE_COLORS[Math.floor(r() * HOUSE_COLORS.length)];
  d.lots.push({ face: f, t0, t1, top: H, color });
  faceSlab(d, f, t0, t1, 0, H, 0, 0.03, color);
  if (W < 1.6) return;
  // Cunhais de cantaria nas divisas do lote
  const pil = Math.min(0.32, W * 0.1);
  // (1,5 cm além da divisa e colado na parede: esconde as pontas da faixa e do reboco,
  // que ficariam no mesmo plano e piscariam vistas de lado)
  faceSlab(d, f, t0 - 0.015, t0 + pil, 0, H, 0, 0.1, STONE);
  faceSlab(d, f, t1 - pil, t1 + 0.015, 0, H, 0, 0.1, STONE);

  const mid = (t0 + t1) / 2;
  const c = (t: number, off = 0.6) => (f.axis === 'x' ? floorAt(map, f.at + f.n * off, t) : floorAt(map, t, f.at + f.n * off));
  const gb = c(mid);
  const floors = [gb];
  // Pé-direito colonial (dossiê: 4–5 m no térreo): o andar de cima ocupa o que sobra
  const g = Math.max(2.9, Math.min(4.4, H - gb - 2.9 - 0.35 - 0.45));
  for (let y = gb + g; y + 0.45 + WIN_H <= H - 0.35; y += 3.6) floors.push(y);
  // Cornijas entre andares e no topo
  for (let k = 1; k < floors.length; k++) faceSlab(d, f, t0, t1, floors[k] - 0.2, floors[k] - 0.04, 0.03, 0.13, STONE);
  faceSlab(d, f, t0 - 0.05, t1 + 0.05, H - 0.32, H, 0, 0.26, STONE, true);

  const cols = Math.max(1, Math.floor((W - 0.9) / 2.3));
  const wide = (W - 2 * pil) / cols >= 2.3;
  const varanda = floors.length > 1 && r() < 0.25;
  const rectangular = r() < 0.7;
  const grafCol = r() < 0.12 ? Math.floor(r() * cols) : -1;
  for (let i = 0; i < cols; i++) {
    const t = t0 + pil + ((W - 2 * pil) * (i + 0.5)) / cols;
    for (let k = 0; k < floors.length; k++) {
      if (k === 0) groundBay(d, f, t, c(t), i === grafCol);
      else upperBay(d, f, t, floors[k], wide, varanda, rectangular);
    }
  }
  if (varanda) {
    for (let k = 1; k < floors.length; k++) {
      // Varanda corrida; se o corpo alcança, fica só um peitoril fino no lote todo
      if (!balcony(d, f, t0 + pil + 0.2, t1 - pil - 0.2, floors[k])) faceSlab(d, f, t0 + pil, t1 - pil, floors[k] + 0.35, floors[k] + 0.45, 0.03, TRIM, STONE);
    }
  }
  crown(d, f, t0, t1, H, color);
  const h = W / 2 - pil;
  if (r() < 0.14 && overhang(d, faceBoxOf(f, mid - h, mid + h, H - 0.49, H - 0.41, 0.12, 0.2))) {
    // Filete de neon sob a cornija (a camada distópica)
    const p = facePos(f, mid, H - 0.45, 0.16);
    const n = r() < 0.5 ? PALETTE.pink : PALETTE.cyan;
    if (f.axis === 'x') neonBox(d.ctx, p.x - 0.04, p.y - 0.04, p.z - h, p.x + 0.04, p.y + 0.04, p.z + h, n);
    else neonBox(d.ctx, p.x - h, p.y - 0.04, p.z - 0.04, p.x + h, p.y + 0.04, p.z + 0.04, n);
  }
}

/** Térreo: porta em arco ou janela com grade; às vezes uma pichação no lugar. */
function groundBay(d: Dress, f: Face, t: number, y: number, graffiti: boolean) {
  const { kit, r } = d;
  if (graffiti) {
    // Vão livre: a pichação entra depois (pelourinho-dress)
    d.graffitiSlots.push({ face: f, t, y });
    return;
  }
  if (y < 1.3 && r() < 0.6) {
    const door = kit.doors[Math.floor(r() * kit.doors.length)];
    if (isReserved(d, f, t - DOOR_W / 2, t + DOOR_W / 2, y, y + DOOR_H)) return;
    faceArt(d, f, door, t, y, 0.075, DOOR_W, DOOR_H);
    faceSlab(d, f, t - DOOR_W / 2 - 0.12, t + DOOR_W / 2 + 0.12, y, y + 0.12, 0.03, 0.1, STONE); // soleira
  } else {
    const a = kit.grille;
    const y0 = y + 0.95;
    if (isReserved(d, f, t - a.w / 2, t + a.w / 2, y0, y0 + a.h)) return;
    faceArt(d, f, a, t, y0, 0.075);
    faceSlab(d, f, t - a.w / 2 - 0.1, t + a.w / 2 + 0.1, y0 - 0.1, y0, 0.03, 0.12, STONE);
  }
}

/** Andar de cima: janela (vidro, veneziana fechada ou aberta, tábuas, cartaz) e sacada. */
function upperBay(d: Dress, f: Face, t: number, fl: number, wide: boolean, varanda: boolean, rectangular: boolean) {
  const { kit, r } = d;
  const y = fl + 0.45;
  const roll = r();
  let art: Art;
  let litOk = false;
  if (rectangular) {
    art = kit.rectWindows[roll < 0.45 ? 0 : 1];
  } else if (wide && roll < 0.22) {
    art = kit.open[Math.floor(r() * kit.open.length)];
    litOk = true;
  } else if (roll < 0.42) {
    art = kit.glass;
    litOk = true;
  } else if (roll < 0.84) art = kit.shutters[Math.floor(r() * kit.shutters.length)];
  else if (roll < 0.92) art = kit.boarded;
  else art = kit.poster;
  const aw = art.w * WIN;
  const ah = art.h * WIN;
  if (isReserved(d, f, t - aw / 2, t + aw / 2, y, y + ah)) return;
  faceArt(d, f, art, t, y, 0.04, aw, ah);
  d.sills.push({ face: f, t, y, w: aw });
  if (litOk && r() < 0.35) {
    const lit = kit.lit[Math.floor(r() * kit.lit.length)];
    faceArt(d, f, lit, t, y + 0.08 * WIN, 0.045, 0.84 * WIN, 1.84 * WIN, true);
  }
  // Fecho (pedra de chave) no topo do arco
  if (rectangular) faceSlab(d, f, t - aw / 2 - 0.08, t + aw / 2 + 0.08, y + ah - 0.08, y + ah + 0.08, 0.03, 0.11, STONE);
  else faceSlab(d, f, t - 0.1, t + 0.1, y + ah - 0.12, y + ah + 0.12, 0.03, 0.11, STONE);
  // Sacada só onde o corpo não alcança nem pulando (senão, peitoril fino)
  const placed = !varanda && r() < 0.55 && balcony(d, f, t - aw / 2 - 0.25, t + aw / 2 + 0.25, fl);
  if (!varanda && !placed) faceSlab(d, f, t - aw / 2 - 0.1, t + aw / 2 + 0.1, y - 0.1, y, 0.03, TRIM, STONE); // peitoril
}

/** Sacada: laje de pedra, consolos e guarda-corpo de ferro. Devolve false se o corpo alcança. */
function balcony(d: Dress, f: Face, t0: number, t1: number, fl: number): boolean {
  const D = 0.6;
  const y0 = fl + 0.3;
  const rh = 0.95;
  // Volume inteiro da sacada: dos consolos (embaixo) ao topo do guarda-corpo
  if (!overhang(d, faceBoxOf(f, t0, t1, y0 - 0.3, y0 + 0.14 + rh, 0, D))) return false;
  faceSlab(d, f, t0, t1, y0, y0 + 0.14, 0.03, D, STONE, true);
  // Mãos-francesas (consolos) embaixo da laje
  for (const t of [t0 + 0.15, t1 - 0.15]) faceSlab(d, f, t - 0.06, t + 0.06, y0 - 0.3, y0, 0.03, D * 0.6, STONE);
  d.balconies.push({ face: f, t0, t1, y: y0 + 0.14, depth: D });
  const rail = d.kit.railing;
  const n = Math.max(1, Math.round((t1 - t0) / 2));
  const seg = (t1 - t0) / n;
  for (let i = 0; i < n; i++) faceArt(d, f, rail, t0 + seg * (i + 0.5), y0 + 0.14, D - 0.02, seg, rh);
  // Laterais: plano perpendicular à parede
  for (const t of [t0 + 0.01, t1 - 0.01]) {
    const p = facePos(f, t, y0 + 0.14 + rh / 2, D / 2);
    const g = planeGeo(D, rh, rail.uv);
    d.b.add(place(g, p.x, p.y, p.z, faceRot(f) + Math.PI / 2), d.kit.mat, { cast: false });
  }
  return true;
}

/** Arremate do topo: beiral de telha, platibanda reta ou platibanda com frontão curvo. */
function crown(d: Dress, f: Face, t0: number, t1: number, H: number, color: number) {
  const roll = d.r();
  // Telão no telhado deste lote: só a platibanda baixa
  const busy = isReserved(d, f, t0, t1, H, H + 3);
  if (roll < 0.62 && !busy && overhang(d, faceBoxOf(f, t0 - 0.15, t1 + 0.15, H, H + 0.9, -1, 0.95))) {
    // Beiral: três fiadas de telha descendo para a rua
    const rot = faceRot(f);
    for (let i = 0; i < 3; i++) {
      const out = 0.55 - i * 0.55;
      const p = facePos(f, (t0 + t1) / 2, H + 0.16 + i * 0.26, out);
      const g = new THREE.BoxGeometry(t1 - t0 + 0.3, 0.08, 0.72);
      d.b.add(place(g, p.x, p.y, p.z, rot, 0.44), toonTelha(i), { cast: true });
    }
    return;
  }
  faceSlab(d, f, t0, t1, H, H + 0.65, 0, 0.24, color);
  faceSlab(d, f, t0 - 0.04, t1 + 0.04, H + 0.65, H + 0.76, -0.02, 0.3, STONE, true);
  if (busy || roll < 0.84 || t1 - t0 < 3) return;
  // Frontão curvo de cantaria com óculo no meio
  const W = Math.min((t1 - t0) * 0.55, 4.4);
  const h = 1.1 + d.r() * 0.5;
  const mid = (t0 + t1) / 2;
  if (!overhang(d, faceBoxOf(f, mid - W / 2, mid + W / 2, H + 0.76, H + 0.76 + h * 1.12, 0, 0.27))) return;
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(-W / 2, h * 0.3);
  s.bezierCurveTo(-W * 0.32, h * 0.3, -W * 0.3, h * 0.72, -W * 0.14, h * 0.8);
  s.quadraticCurveTo(0, h * 1.12, W * 0.14, h * 0.8);
  s.bezierCurveTo(W * 0.3, h * 0.72, W * 0.32, h * 0.3, W / 2, h * 0.3);
  s.lineTo(W / 2, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: false, curveSegments: 6 });
  const p = facePos(f, (t0 + t1) / 2, H + 0.76, 0.02);
  d.b.add(place(g, p.x, p.y, p.z, faceRot(f)), d.r() < 0.5 ? toonColor(STONE) : toonColor(color), { cast: true });
  const o = new THREE.CircleGeometry(0.22, 14);
  const q = facePos(f, (t0 + t1) / 2, H + 0.76 + h * 0.48, 0.27);
  d.b.add(place(o, q.x, q.y, q.z, faceRot(f)), toonColor(PALETTE.ink), { cast: false });
}

const toonColor = (c: number) => toon(c);
const toonTelha = (i: number) => toon(i === 1 ? PALETTE.terracotta : PALETTE.telha);
