import * as THREE from 'three';
import { toonWith } from '../toon';
import { place, type Builder } from './builder';
import { ashlarArt, baseBand, cornerWear, crack, curbArt, drip, eaveBand, stain } from './grime-art';
import { brickPatch, grateArt, leavesArt, manholeArt, puddle, ribbonArt, selaronTiles } from './grime-pieces';
import { type Face, facePos, faceRot } from './props';
import { rng } from './shapes';
import { Atlas, planeGeo, type UVRect } from './textures';

// Desgaste de cidade antiga em dois atlas próprios (Pelourinho e Lapa):
//  - `mul`: sujeira que MULTIPLICA a cor de baixo (umidade no pé da parede, musgo, escorridos
//    sob janelas e cornijas, fissuras, quinas gastas, sujeira no piso junto às paredes). Serve
//    para qualquer cor de casa, sem luz no shader: barato e sem cor nova.
//  - `paint`: pedaços opacos com recorte (tijolo aparecendo sob o reboco, tampa de bueiro,
//    grelha de ralo, poça, folhas, fitas do Bonfim, mosaico estilo Selarón), com luz toon.
// Tudo é decoração plana colada em superfícies existentes: nada entra na colisão nem no tiro.

export interface GrimeKit {
  mul: THREE.MeshBasicMaterial;
  paint: THREE.MeshToonMaterial;
  /** Faixa de umidade e musgo no pé da parede (repete na horizontal). */
  base: UVRect[];
  /** Sujeira escorrendo da cornija (repete na horizontal). */
  eave: UVRect[];
  /** Escorrido sob peitoril, sacada ou aparelho de ar. */
  drips: UVRect[];
  cracks: UVRect[];
  /** Quina lascada (faixa vertical estreita). */
  corner: UVRect;
  /** Sujeira do piso junto à parede: escuro embaixo (lado da parede), some para fora. */
  curb: UVRect;
  stains: UVRect[];
  /** Fiadas de cantaria (juntas e tom por bloco) para pilar de pedra. */
  ashlar: UVRect;
  brick: UVRect[];
  manhole: UVRect;
  grate: UVRect;
  puddles: UVRect[];
  leaves: UVRect;
  ribbons: UVRect;
  selaron: UVRect[];
  /** Ocupação dos atlas, para o console. */
  used: string;
}

let shared: GrimeKit | null = null;

/** Kit único por página (as artes não dependem do mapa). */
export function grimeKit(): GrimeKit {
  shared ??= build();
  return shared;
}

/** Nível de qualidade 2 e 3: some a sujeira de multiplicar (camada transparente a mais). */
export function setGrimeQuality(level: number) {
  quality = level;
  if (shared) shared.mul.visible = level < 2;
}
let quality = 0;

function build(): GrimeKit {
  const m = new Atlas(1024, true);
  const p = new Atlas(1024, true);
  // Artes altas primeiro: prateleiras do atlas não desperdiçam altura
  const drips = [11, 12, 13].map((s) => m.draw(64, 256, (g, w, h) => drip(g, w, h, s)));
  const corner = m.draw(32, 256, cornerWear);
  const ashlar = m.draw(256, 256, ashlarArt);
  const cracks = [21, 22].map((s) => m.draw(128, 128, (g, w, h) => crack(g, w, h, s)));
  const stains = [31, 32].map((s) => m.draw(128, 128, (g, w, h) => stain(g, w, h, s)));
  const base = [41, 42].map((s) => m.draw(512, 128, (g, w, h) => baseBand(g, w, h, s)));
  const eave = [51, 52].map((s) => m.draw(512, 96, (g, w, h) => eaveBand(g, w, h, s)));
  const curb = m.draw(256, 64, curbArt);

  const brick = [61, 62, 63].map((s) => p.draw(256, 192, (g, w, h) => brickPatch(g, w, h, s)));
  const selaron = [71, 72].map((s) => p.draw(256, 256, (g, w, h) => selaronTiles(g, w, h, s)));
  const ribbons = p.draw(128, 256, ribbonArt);
  const puddles = [81, 82].map((s) => p.draw(256, 128, (g, w, h) => puddle(g, w, h, s)));
  const manhole = p.draw(128, 128, manholeArt);
  const grate = p.draw(128, 64, grateArt);
  const leaves = p.draw(128, 128, leavesArt);

  const mul = new THREE.MeshBasicMaterial({
    map: m.texture,
    transparent: true,
    premultipliedAlpha: true,
    blending: THREE.MultiplyBlending,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  mul.visible = quality < 2;
  const paint = toonWith({ map: p.texture, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return { mul, paint, base, eave, drips, cracks, corner, curb, stains, ashlar, brick, manhole, grate, puddles, leaves, ribbons, selaron, used: `desgaste ${m.used}, peças ${p.used}` };
}

// ---------------------------------------------------------------- aplicação

/** Decalque colado na face (centro em t, base em y), `off` metros à frente da parede. */
export function wallDecal(b: Builder, mat: THREE.Material, f: Face, uv: UVRect, t: number, y: number, w: number, h: number, off = 0.055) {
  const q = facePos(f, t, y + h / 2, off);
  b.add(place(planeGeo(w, h, uv), q.x, q.y, q.z, faceRot(f)), mat, { cast: false });
}

/** Decalque deitado no piso (centro x, z), girado `yaw` em torno de y. */
export function floorDecal(b: Builder, mat: THREE.Material, uv: UVRect, x: number, y: number, z: number, w: number, d: number, yaw = 0) {
  b.add(place(planeGeo(w, d, uv), x, y, z, yaw, -Math.PI / 2), mat, { cast: false });
}

/** Sub-retângulo da arte (frações 0..1 em u e v), para cortar faixas que repetem. */
export function subUV(uv: UVRect, a0: number, a1: number, b0 = 0, b1 = 1): UVRect {
  return { u0: uv.u0 + (uv.u1 - uv.u0) * a0, u1: uv.u0 + (uv.u1 - uv.u0) * a1, v0: uv.v0 + (uv.v1 - uv.v0) * b0, v1: uv.v0 + (uv.v1 - uv.v0) * b1 };
}

/** Faixa horizontal longa em pedaços de até `tile` m (a arte não estica demais). */
export function wallStrip(b: Builder, mat: THREE.Material, f: Face, uvs: UVRect[], t0: number, t1: number, y: number, h: number, tile: number, seed: number, off = 0.055) {
  const r = rng(seed);
  const n = Math.max(1, Math.round((t1 - t0) / tile));
  const w = (t1 - t0) / n;
  for (let i = 0; i < n; i++) wallDecal(b, mat, f, uvs[Math.floor(r() * uvs.length)], t0 + w * (i + 0.5), y, w, h, off);
}

