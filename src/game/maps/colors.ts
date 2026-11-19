// Cores de leitura do greybox (só da PALETTE): piso e faixa de parede por zona, peças por tipo.
import { PALETTE } from '../toon';
import type { MapSolid, SolidKind, Tint } from './types';

/** Cor de um sólido: terraço no tom da zona; parede marcada (a igreja) em destaque claro. */
export function solidColor(s: MapSolid): number {
  if (s.kind === 'terrace') return FLOOR[s.tint];
  if (s.kind === 'wall' && s.tint !== 'neutral') return PALETTE.paper;
  return KIND[s.kind];
}

/** Piso de cada zona: sites fortes, rotas no tom do site, meio lilás, times azul/vinho. */
export const FLOOR: Record<Tint, number> = {
  A: PALETTE.yellow,
  routeA: PALETTE.orange,
  B: PALETTE.leafLight,
  routeB: PALETTE.leaf,
  mid: PALETTE.lilac,
  def: PALETTE.tank,
  atk: PALETTE.wine,
  neutral: PALETTE.asphalt,
};

export const KIND: Record<SolidKind, number> = {
  ground: PALETTE.asphalt,
  wall: PALETTE.concreteDark,
  low: PALETTE.cyan,
  tall: PALETTE.pink,
  platform: PALETTE.concrete,
  terrace: PALETTE.concrete,
  stairs: PALETTE.paper,
  edge: PALETTE.dusk,
  bound: PALETTE.ink,
};
