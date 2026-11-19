// Formas de colisão do bairro (lógica pura, sem Three.js): escadas, lajes com buraco, sorteio.
import type { Box } from '../physics';

/** Degrau máximo que o jogador sobe andando é 0.45 (player.ts); usamos folga. */
export const MAX_RISE = 0.4;

export function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box {
  return {
    min: { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) },
    max: { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) },
  };
}

export interface StairSpec {
  /** Eixo em que a escada avança. */
  axis: 'x' | 'z';
  /** Coordenada (no eixo) onde começa o primeiro degrau, o mais baixo. */
  start: number;
  /** Sentido da subida no eixo: +1 ou -1. */
  dir: 1 | -1;
  /** Faixa no outro eixo (largura da escada). */
  across: [number, number];
  /** Altura do chão de onde sai e altura do topo onde chega. */
  base: number;
  top: number;
  /** Fundo das colunas dos degraus (padrão: `base`). */
  floor?: number;
  depth?: number;
  maxRise?: number;
}

/** Escada sem rampa: colunas maciças de degraus iguais, cada um com altura <= maxRise. */
export function stairs(spec: StairSpec): Box[] {
  const depth = spec.depth ?? 0.6;
  const maxRise = spec.maxRise ?? MAX_RISE;
  const n = Math.max(1, Math.ceil((spec.top - spec.base) / maxRise - 1e-9));
  const rise = (spec.top - spec.base) / n;
  const floor = spec.floor ?? spec.base;
  const out: Box[] = [];
  for (let k = 0; k < n; k++) {
    const a0 = spec.start + spec.dir * k * depth;
    const a1 = spec.start + spec.dir * (k + 1) * depth;
    const y1 = spec.base + rise * (k + 1);
    out.push(
      spec.axis === 'x'
        ? box(a0, floor, spec.across[0], a1, y1, spec.across[1])
        : box(spec.across[0], floor, a0, spec.across[1], y1, a1),
    );
  }
  return out;
}

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Laje retangular de y0 a y1 com um buraco retangular (vira até 4 caixas). */
export function slabWithHole(outer: Rect, hole: Rect, y0: number, y1: number): Box[] {
  const out: Box[] = [];
  const push = (x0: number, z0: number, x1: number, z1: number) => {
    if (x1 - x0 > 1e-6 && z1 - z0 > 1e-6) out.push(box(x0, y0, z0, x1, y1, z1));
  };
  push(outer.x0, outer.z0, outer.x1, hole.z0); // lado de -z
  push(outer.x0, hole.z1, outer.x1, outer.z1); // lado de +z
  push(outer.x0, hole.z0, hole.x0, hole.z1); // lado de -x
  push(hole.x1, hole.z0, outer.x1, hole.z1); // lado de +x
  return out;
}

/** Sorteio determinístico (mulberry32): o mapa sai igual toda vez. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ponto dentro de alguma caixa? (para validar spawns) */
export function insideAny(p: { x: number; y: number; z: number }, solids: Box[]): boolean {
  return solids.some(
    (s) => p.x > s.min.x && p.x < s.max.x && p.y > s.min.y && p.y < s.max.y && p.z > s.min.z && p.z < s.max.z,
  );
}
