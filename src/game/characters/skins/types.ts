import type { Kit } from './kit';
import type { Region } from './regions';

export type SkinId = 'lia' | 'caio' | 'ivo';

export interface SkinDef {
  id: SkinId;
  /** Nome que aparece no jogo. */
  name: string;
  faction: 'resistencia' | 'sorridentes';
  /** Cor (da PALETTE) de cada região do corpo do manequim. */
  colors: Record<Region, number>;
  /** Peças presas aos ossos (cabelo, máscara, mochila...). */
  pieces(k: Kit): void;
}
