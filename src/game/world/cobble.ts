import * as THREE from 'three';
import type { Box } from '../physics';
import { hex, PALETTE, toonWith } from '../toon';
import { mix } from './colonial-art';
import { boxGeo } from './builder';
import { rng } from './shapes';
import { canvas, texture } from './textures';
import { paintFieldstone } from './cobble-art';

// Calçamento de pedra (paralelepípedo) em textura de canvas que repete, mais caixas com UV
// em coordenadas do mundo: o piso emenda sem costura entre peças vizinhas. A textura é
// clara e sem cor: a cor de cada peça vem do vértice (o mapa tinge pelo tom da zona).

/**
 * Metros cobertos por uma repetição da textura. O pé-de-moleque desenha 14 × 14 pedras numa
 * textura de 1024 px: pedras de ~18 cm, como antes, mas a repetição só aparece a cada 2,5 m.
 */
export const COBBLE_TILE = 2.5;

/** Textura cinza-clara de paralelepípedos em fiadas desencontradas, com luz "cel" na pedra. */
export function cobbleTexture(seed = 11, fieldstone = false): THREE.CanvasTexture {
  const S = fieldstone ? 1024 : 512;
  const [c, g] = canvas(S, S);
  const r = rng(seed);
  // Rejunte (o que fica escuro entre as pedras)
  g.fillStyle = hex(PALETTE.stoneJoint);
  g.fillRect(0, 0, S, S);
  if (fieldstone) {
    paintFieldstone(g, S, seed);
    const t = texture(c, true);
    t.anisotropy = 8;
    return t;
  }
  const rows = 8;
  const rh = S / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * rh;
    // Larguras que somam S exatamente: a fiada emenda sem costura na repetição
    const ws = Array.from({ length: 5 }, () => 0.8 + r() * 0.4);
    const sum = ws.reduce((a, v) => a + v, 0);
    let x = row % 2 ? -48 : 0;
    for (const k of ws) {
      const w = (k / sum) * S;
      const tone = 214 + Math.floor(r() * 30) - (r() < 0.14 ? 16 : 0);
      const spots = [r(), r(), r(), r()];
      // Cópia deslocada de S: a pedra cortada na borda continua do outro lado
      for (const ox of [0, S]) stone(g, x + ox, y, w, rh, tone, spots);
      x += w;
    }
  }
  const t = texture(c, true);
  t.anisotropy = 8;
  return t;
}

/** Uma pedra: corpo, aresta de luz em cima/esquerda e sombra embaixo (três tons, sem degradê). */
function stone(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone: number, spots: number[]) {
  const gap = 3.5 + spots[0] * 2.5;
  const x0 = x + gap / 2;
  const y0 = y + gap / 2;
  const sw = w - gap;
  const sh = h - gap;
  const rad = 5 + spots[1] * 7;
  const path = () => {
    g.beginPath();
    g.moveTo(x0 + rad, y0);
    g.arcTo(x0 + sw, y0, x0 + sw, y0 + sh, rad);
    g.arcTo(x0 + sw, y0 + sh, x0, y0 + sh, rad);
    g.arcTo(x0, y0 + sh, x0, y0, rad);
    g.arcTo(x0, y0, x0 + sw, y0, rad);
    g.closePath();
  };
  // Tom da pedra: do papel (claro) puxando para o nanquim conforme `v` cai de 255
  const c = (v: number) => mix(PALETTE.paper, PALETTE.ink, Math.max(0, (255 - v) / 255) * 1.1);
  path();
  g.fillStyle = c(tone - 34);
  g.fill();
  g.save();
  path();
  g.clip();
  g.fillStyle = c(tone);
  g.fillRect(x0, y0, sw - 6, sh - 7);
  g.fillStyle = c(Math.min(255, tone + 18));
  g.fillRect(x0, y0, sw, 5);
  g.fillRect(x0, y0, 5, sh);
  // Lascas e manchas (pedra gasta)
  g.fillStyle = c(tone - 18);
  for (let i = 0; i < 2; i++) g.fillRect(x0 + 10 + spots[i * 2] * (sw - 30), y0 + 10 + spots[i * 2 + 1] * (sh - 24), 6 + spots[i] * 10, 3 + spots[3 - i] * 4);
  g.restore();
}

let cobbleMat: THREE.MeshToonMaterial | null = null;
let fieldstoneMat: THREE.MeshToonMaterial | null = null;

/** Material único do calçamento (textura que repete + cor por vértice). */
export function cobbleMaterial(fieldstone = false): THREE.MeshToonMaterial {
  if (fieldstone) {
    fieldstoneMat ??= toonWith({ map: cobbleTexture(43, true), vertexColors: true });
    return fieldstoneMat;
  }
  cobbleMat ??= toonWith({ map: cobbleTexture(), vertexColors: true });
  return cobbleMat;
}

/**
 * Caixa com UV em metros do mundo (divididos por `tile`): topo usa (x, z), laterais usam
 * (x ou z, y). Peças vizinhas emendam a textura sem costura.
 */
export function worldUVBox(b: Box, tile = COBBLE_TILE): THREE.BufferGeometry {
  const g = boxGeo(b);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x / tile, -z / tile);
    else if (nx > 0.5) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  return g;
}
