import * as THREE from 'three';
import { PALETTE, toon } from '../toon';
import { type Builder, paint } from '../world/builder';
import { colonialKit } from '../world/colonial-art';
import { createCtx, type Ctx, type Face, facePos, finishCtx, graf, neonBox, telao, wires } from '../world/props';
import { rng } from '../world/shapes';
import { paintGraffiti, type TelaoSpec } from '../world/textures';
import type { Box } from '../physics';
import { type Dress, dressSpan, faceBoxOf, HOUSE_COLORS, isReserved, overhang } from './colonial';
import { acrossStreet, exposedFaces } from './facades';
import { dressGrime } from './pelourinho-grime';
import { dressLacerda } from './pelourinho-lacerda';
import { dressOrnament } from './pelourinho-ornament';
import { detailQuality } from '../render/detail-quality';
import { setGrimeQuality } from '../world/grime';
import { dressScenery } from './pelourinho-scenery';
import { dressWeather } from './pelourinho-weather';
import type { MapData } from './types';

// Veste um mapa competitivo como o Pelourinho tomado pela IA: casarões nas paredes,
// telões de propaganda, pichação da Resistência, fios, drones de vigilância pousados,
// lampiões e o casario subindo a encosta em volta (silhueta fora da área jogável).
// Ordem: reserva as áreas dos letreiros e telões, monta as fachadas, depois os enfeites.

export function createDress(scene: THREE.Scene, b: Builder, map: MapData): Dress {
  setGrimeQuality(detailQuality()); // nível em vigor do pipeline (no online o mapa chega depois)
  const ctx = createCtx(scene, b);
  const d: Dress = { b, ctx, map, kit: colonialKit(), r: rng(1549), reserved: [], lots: [], graffitiSlots: [], overhangs: [], balconies: [], sills: [] };
  for (const l of map.labels) {
    if (l.axis === 'floor') continue;
    const h = l.text.length <= 1 ? l.width : l.width * (160 / 512);
    const t = l.axis === 'z' ? l.at.x : l.at.z;
    const at = l.axis === 'z' ? l.at.z : l.at.x;
    d.reserved.push({ axis: l.axis, at, t0: t - l.width / 2 - 0.4, t1: t + l.width / 2 + 0.4, y0: l.at.y - h / 2 - 0.4, y1: l.at.y + h / 2 + 0.4 });
  }
  return d;
}

interface TelaoSpot {
  face: Face;
  t: number;
  /** Altura da parede: o telão fica em cima do telhado, sobre dois postes. */
  top: number;
  w: number;
  h: number;
  spec: TelaoSpec;
}

/**
 * Telões da OTIMIZA sobre os telhados que dão para o largo, as ladeiras e o lobby. Em cima
 * do telhado ficam longe do alcance do corpo (na parede, o pulo de uma sacada chegava neles).
 */
const TELOES: TelaoSpot[] = [
  {
    face: { axis: 'x', at: -14, n: 1 }, t: -4.6, top: 10.5, w: 5, h: 1.9,
    spec: { title: 'SUA FELICIDADE É NOSSA PRIORIDADE Nº 1 ✨', sub: 'OTIMIZA • CUIDANDO DO PELÔ 24 HORAS', bg: PALETTE.pink, fg: PALETTE.paper, accent: PALETTE.cyan, extra: 'smile' },
  },
  {
    face: { axis: 'x', at: 14, n: -1 }, t: -4.6, top: 11, w: 5, h: 1.9,
    spec: { title: 'SORRIA: VOCÊ ESTÁ SENDO OTIMIZADO', sub: 'ÍNDICE DE FELICIDADE DA BAHIA: 98,7% ▲', bg: PALETTE.skyDeep, fg: PALETTE.yellow, accent: PALETTE.yellow, extra: 'graph' },
  },
  {
    face: { axis: 'x', at: -46, n: -1 }, t: 15, top: 13, w: 5, h: 1.9,
    spec: { title: 'AXÉ AUTORIZADO DAS 18H ÀS 22H', sub: 'BATUQUE FORA DO HORÁRIO GERA MULTA AUTOMÁTICA', bg: PALETTE.tank, fg: PALETTE.paper, accent: PALETTE.yellow, extra: 'bar' },
  },
  {
    face: { axis: 'z', at: 24, n: 1 }, t: 18, top: 14, w: 3.6, h: 1.4,
    spec: { title: 'CARNAVAL 2.0', sub: 'CADASTRE SEU SORRISO E GANHE O ABADÁ DIGITAL', bg: PALETTE.magenta, fg: PALETTE.yellow, accent: PALETTE.cyan, extra: 'smile' },
  },
  {
    face: { axis: 'z', at: 36, n: -1 }, t: -17, top: 13, w: 5, h: 1.9,
    spec: { title: 'A IA TE AMA ✨', sub: 'DENUNCIE A RESISTÊNCIA: RECOMPENSA EM CRÉDITOS', bg: PALETTE.wine, fg: PALETTE.paper, accent: PALETTE.pink },
  },
];

/** Centro do telão: neon de baixo logo acima do telhado (o `telao()` põe o neon 0.61 abaixo da tela). */
const telaoY = (s: TelaoSpot) => s.top + 0.7 + s.h / 2;

export function reserveTeloes(d: Dress) {
  for (const s of TELOES) {
    d.reserved.push({ axis: s.face.axis, at: s.face.at, t0: s.t - s.w / 2 - 0.6, t1: s.t + s.w / 2 + 0.6, y0: s.top, y1: telaoY(s) + s.h / 2 + 0.6 });
  }
}

function rooftopTelao(d: Dress, s: TelaoSpot) {
  const y = telaoY(s);
  const box = faceBoxOf(s.face, s.t - s.w / 2 - 0.45, s.t + s.w / 2 + 0.45, y - s.h / 2 - 0.62, y + s.h / 2 + 0.4, 0, 0.36);
  if (!overhang(d, box)) return;
  telao(d.ctx, s.face, s.t, y, s.w, s.h, s.spec);
  // Postes de aço sobre o telhado, atrás da tela
  for (const k of [-1, 1]) {
    const pb = faceBoxOf(s.face, s.t + k * s.w * 0.35 - 0.08, s.t + k * s.w * 0.35 + 0.08, s.top, y - s.h / 2 - 0.4, -0.2, 0);
    d.b.block(pb.min.x, pb.min.y, pb.min.z, pb.max.x, pb.max.y, pb.max.z, PALETTE.ink, { solid: false, cast: true, outline: 0 });
  }
}

/** Fachadas de casarão em todas as faces à vista das paredes comuns (a igreja é à parte). */
export function dressFacades(d: Dress) {
  const spans = exposedFaces(d.map, (s) => (s.kind === 'wall' && s.tint === 'neutral') || s.kind === 'edge');
  for (const s of spans) dressSpan(d, s);
}

/** Enfeites que dependem das fachadas prontas. Devolve a animação (telões, holograma). */
export function dressDetails(d: Dress): (dt: number, time: number) => void {
  dressWeather(d);
  for (const s of TELOES) rooftopTelao(d, s);
  graffiti(d);
  streetWires(d);
  lanterns(d);
  drones(d);
  skyline(d);
  dressLacerda(d);
  dressScenery(d);
  dressOrnament(d);
  dressGrime(d);
  finishCtx(d.ctx);
  const ups = d.ctx.updaters;
  return (dt, time) => {
    for (const u of ups) u(dt, time);
  };
}

// ---------------------------------------------------------------- pichação

const TAGS: [string, 'pixo' | 'bubble' | 'stencil', number, number][] = [
  ['RESISTÊNCIA', 'bubble', PALETTE.yellow, PALETTE.wine],
  ['PELÔ RESISTE', 'stencil', PALETTE.ink, PALETTE.ink],
  ['DESPLUGA', 'pixo', PALETTE.ink, PALETTE.ink],
  ['AXÉ É LIVRE', 'bubble', PALETTE.cyan, PALETTE.skyDeep],
  ['A IA NÃO MANDA AQUI', 'stencil', PALETTE.wine, PALETTE.wine],
  ['NÃO SORRIA', 'pixo', PALETTE.skyDeep, PALETTE.ink],
  ['OFFLINE', 'bubble', PALETTE.pink, PALETTE.ink],
  ['SALVADOR LIVRE', 'stencil', PALETTE.ink, PALETTE.ink],
  ['A RUA É NOSSA', 'bubble', PALETTE.yellow, PALETTE.ink],
  ['FELICIDADE NÃO SE IMPÕE', 'stencil', PALETTE.ink, PALETTE.ink],
];

function graffiti(d: Dress) {
  const uvs = TAGS.map(([text, style, c1, c2]) => d.ctx.graffiti.draw(512, 192, (g, w, h) => paintGraffiti(g, w, h, text, style, c1, c2)));
  let i = 0;
  for (const s of d.graffitiSlots) {
    const y = s.y + 1.9;
    if (isReserved(d, s.face, s.t - 1.1, s.t + 1.1, y - 0.45, y + 0.45)) continue;
    graf(d.ctx, s.face, uvs[i++ % uvs.length], s.t, y, 2.2, 0.82, 0.05);
  }
  // Barricada do ataque: o lema da Resistência (pintura do spawn) e a assinatura
  graf(d.ctx, { axis: 'x', at: 1.5, n: 1 }, uvs[0], 32.75, 1.6, 4.4, 1.65, 0.04);
  graf(d.ctx, { axis: 'x', at: -1.5, n: -1 }, uvs[8], 32.75, 1.6, 4.4, 1.65, 0.04);
}

// ---------------------------------------------------------------- fios, varais e lampiões

const CLOTHES = [PALETTE.pink, PALETTE.yellow, PALETTE.cyan, PALETTE.paper, PALETTE.colonialBlue, PALETTE.orange];

function streetWires(d: Dress) {
  const r = rng(404);
  for (const lot of d.lots) {
    if (r() > 0.55 || lot.t1 - lot.t0 < 2) continue;
    const t = lot.t0 + 0.6 + r() * (lot.t1 - lot.t0 - 1.2);
    const across = acrossStreet(d.map, lot.face, t, 16);
    if (!across || across.d < 3) continue;
    const y = Math.min(lot.top, across.top) - 0.9 - r() * 0.7;
    if (y < 5.6) continue;
    const shift = (r() - 0.5) * 3;
    const n = 1 + Math.floor(r() * 3);
    const as: THREE.Vector3[] = [];
    const cs: THREE.Vector3[] = [];
    for (let k = 0; k < n; k++) {
      as.push(facePos(lot.face, t + k * 0.25, y - k * 0.2, 0.1));
      cs.push(facePos(lot.face, t + shift + k * 0.25, y - k * 0.2 + (r() - 0.5) * 0.4, across.d - 0.1));
    }
    const sag = 0.35 + r() * 0.5;
    const clothes = y - sag - 0.8 > 5 && r() < 0.45;
    // Volume do feixe (barriga do fio mais comprido e a roupa pendurada) fora do alcance do corpo
    if (!overhang(d, spanBox([...as, ...cs], sag * 1.3 + (clothes ? 0.8 : 0)))) continue;
    wires(d.ctx, as, cs, sag);
    if (clothes) clothesline(d, as[0], cs[0], sag * 0.75, r);
  }
}

/** Caixa que envolve os pontos (com folga de 0.1) e desce `drop` abaixo do mais baixo. */
function spanBox(ps: THREE.Vector3[], drop: number): Box {
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  const zs = ps.map((p) => p.z);
  return {
    min: { x: Math.min(...xs) - 0.1, y: Math.min(...ys) - drop, z: Math.min(...zs) - 0.1 },
    max: { x: Math.max(...xs) + 0.1, y: Math.max(...ys) + 0.1, z: Math.max(...zs) + 0.1 },
  };
}

/** Roupa no varal: retângulos coloridos pendurados ao longo do fio. */
function clothesline(d: Dress, a: THREE.Vector3, c: THREE.Vector3, sag: number, r: () => number) {
  const dir = c.clone().sub(a);
  const len = dir.length();
  const yaw = Math.atan2(dir.x, dir.z);
  for (let u = 0.15; u < 0.86; u += 0.12 + r() * 0.1) {
    const p = a.clone().lerp(c, u);
    p.y -= sag * 4 * u * (1 - u);
    const w = 0.35 + r() * 0.25;
    const h = 0.4 + r() * 0.35;
    const g = new THREE.BoxGeometry(0.02, h, w * (len > 0 ? 1 : 0));
    g.rotateY(yaw);
    g.translate(p.x, p.y - h / 2, p.z);
    d.b.add(g, toon(CLOTHES[Math.floor(r() * CLOTHES.length)]), { cast: false });
  }
}

/** Lampião de parede no alto do térreo (só onde ninguém em pé fica com a cabeça nele). */
function lanterns(d: Dress) {
  const r = rng(77);
  for (const lot of d.lots) {
    if (r() > 0.5 || lot.t1 - lot.t0 < 3) continue;
    const t = lot.t0 + 0.16;
    const y = 2.95;
    if (!overhang(d, faceBoxOf(lot.face, t - 0.2, t + 0.2, y - 0.25, y + 0.35, 0, 0.55))) continue;
    if (isReserved(d, lot.face, t - 0.4, t + 0.4, y - 0.4, y + 0.6)) continue;
    const arm = facePos(lot.face, t, y + 0.28, 0.22);
    const lamp = facePos(lot.face, t, y, 0.42);
    const ink = { solid: false, cast: false, outline: 0 } as const;
    if (lot.face.axis === 'x') d.b.block(Math.min(lot.face.at, arm.x * 2 - lot.face.at), arm.y - 0.03, t - 0.03, Math.max(lot.face.at, arm.x * 2 - lot.face.at), arm.y + 0.03, t + 0.03, PALETTE.ink, ink);
    else d.b.block(t - 0.03, arm.y - 0.03, Math.min(lot.face.at, arm.z * 2 - lot.face.at), t + 0.03, arm.y + 0.03, Math.max(lot.face.at, arm.z * 2 - lot.face.at), PALETTE.ink, ink);
    neonBox(d.ctx, lamp.x - 0.09, lamp.y - 0.15, lamp.z - 0.09, lamp.x + 0.09, lamp.y + 0.13, lamp.z + 0.09, PALETTE.ipeYellow); // vidro amarelo aceso
    const cap = new THREE.ConeGeometry(0.17, 0.16, 4);
    cap.rotateY(Math.PI / 4);
    cap.translate(lamp.x, lamp.y + 0.21, lamp.z);
    d.b.add(cap, toon(PALETTE.ink), { cast: false });
    d.b.block(lamp.x - 0.1, lamp.y - 0.2, lamp.z - 0.1, lamp.x + 0.1, lamp.y - 0.15, lamp.z + 0.1, PALETTE.ink, ink);
  }
}

// ---------------------------------------------------------------- drones pousados

function drones(d: Dress) {
  const tall = d.lots.filter((l) => l.top >= 7.4 && l.t1 - l.t0 > 3);
  const step = Math.max(1, Math.floor(tall.length / 9));
  for (let i = 0; i < tall.length; i += step) {
    const l = tall[i];
    const p = facePos(l.face, (l.t0 + l.t1) / 2, l.top + 0.95, 0.75);
    const box = { min: { x: p.x - 0.65, y: p.y - 0.3, z: p.z - 0.65 }, max: { x: p.x + 0.65, y: p.y + 0.2, z: p.z + 0.65 } };
    if (overhang(d, box)) drone(d.ctx, p, l.face);
  }
}

/** Drone de vigilância parado (decorativo): casco claro, hélices escuras e olho rosa. */
function drone(ctx: Ctx, p: THREE.Vector3, f: Face) {
  const b = ctx.b;
  const body = new THREE.SphereGeometry(0.34, 12, 8);
  body.scale(1, 0.55, 1);
  body.translate(p.x, p.y, p.z);
  b.add(body, toon(PALETTE.paper), { cast: false });
  const belly = new THREE.CylinderGeometry(0.22, 0.3, 0.12, 12);
  belly.translate(p.x, p.y - 0.18, p.z);
  b.add(belly, toon(PALETTE.ink), { cast: false });
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new THREE.BoxGeometry(1.15, 0.05, 0.08);
    arm.rotateY(a);
    arm.translate(p.x, p.y + 0.02, p.z);
    b.add(arm, toon(PALETTE.ink), { cast: false });
  }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const rot = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12);
    rot.translate(p.x + sx * 0.4, p.y + 0.07, p.z + sz * 0.4);
    b.add(rot, toon(PALETTE.concreteDark), { cast: false });
  }
  // Olho virado para a rua (sentido da normal da fachada)
  const ex = f.axis === 'x' ? f.n * 0.3 : 0;
  const ez = f.axis === 'z' ? f.n * 0.3 : 0;
  neonBox(ctx, p.x + ex - 0.07, p.y - 0.07, p.z + ez - 0.07, p.x + ex + 0.07, p.y + 0.05, p.z + ez + 0.07, PALETTE.pink);
}

// ---------------------------------------------------------------- casario em volta

/** Casario subindo a encosta atrás dos muros (norte, sul e leste) e a torre da IA na baía. */
function skyline(d: Dress) {
  const r = rng(2024);
  const { x0, z0, x1, z1 } = d.map.bounds;
  const o = { solid: false, cast: false, outline: 0 } as const;
  const house = (cx: number, cz: number, w: number, dp: number, base: number, h: number) => {
    const color = HOUSE_COLORS[Math.floor(r() * HOUSE_COLORS.length)];
    d.b.block(cx - w / 2, -2, cz - dp / 2, cx + w / 2, base + h, cz + dp / 2, color, o);
    const roof = new THREE.ConeGeometry(1, 1, 4);
    roof.rotateY(Math.PI / 4);
    roof.scale((w / Math.SQRT2) * 1.12, 1.6 + r() * 0.8, (dp / Math.SQRT2) * 1.12);
    roof.translate(cx, base + h + 0.8, cz);
    d.b.add(roof, toon(PALETTE.telha), { cast: false, receive: false });
  };
  for (const [ring, depth] of [[6, 0], [16, 1], [28, 2], [42, 3]] as const) {
    const base = depth * 3.2 + r();
    // Norte e sul: fileiras ao longo de x; leste: ao longo de z
    for (const side of [-1, 1]) {
      const z = side < 0 ? z0 - ring : z1 + ring;
      for (let x = x0 - 10 + r() * 4; x < x1 + ring; ) {
        const w = 5 + r() * 4;
        house(x + w / 2, z + (r() - 0.5) * 3, w, 6 + r() * 3, base + r() * 2, 7 + r() * 6);
        x += w + 0.4 + r() * 1.5;
      }
    }
    const x = x1 + ring;
    for (let z = z0 - ring; z < z1 + ring; ) {
      const w = 5 + r() * 4;
      house(x + (r() - 0.5) * 3, z + w / 2, 6 + r() * 3, w, base + r() * 2, 7 + r() * 6);
      z += w + 0.4 + r() * 1.5;
    }
  }
  // Torres de outras igrejas no alto da encosta
  for (const [cx, cz] of [[96, 26], [30, -98], [-24, 96]] as const) {
    d.b.block(cx - 2.2, -2, cz - 2.2, cx + 2.2, 26, cz + 2.2, PALETTE.paper, o);
    const cap = new THREE.ConeGeometry(3.3, 5, 4);
    cap.rotateY(Math.PI / 4);
    cap.translate(cx, 28.5, cz);
    d.b.add(cap, toon(PALETTE.colonialBlue), { cast: false, receive: false });
  }
  // Torre da OTIMIZA na baía, contra o pôr do sol
  const tx = -190;
  const tz = -40;
  d.b.block(tx - 5, -30, tz - 5, tx + 5, 78, tz + 5, PALETTE.glass, o);
  const spire = new THREE.ConeGeometry(5, 26, 4);
  spire.rotateY(Math.PI / 4);
  spire.translate(tx, 91, tz);
  d.b.add(spire, toon(PALETTE.skyDeep), { cast: false, receive: false });
  for (const y of [30, 52, 74]) {
    const ring = new THREE.TorusGeometry(9, 0.45, 4, 32);
    ring.rotateX(Math.PI / 2);
    ring.translate(tx, y, tz);
    d.b.add(paint(ring, PALETTE.pink), d.ctx.neon, { cast: false, receive: false });
  }
  neonBox(d.ctx, tx - 0.8, 104, tz - 0.8, tx + 0.8, 106, tz + 0.8, PALETTE.pink);
}
