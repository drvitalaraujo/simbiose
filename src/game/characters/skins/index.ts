import { CAIO } from './caio';
import { IVO } from './ivo';
import { LIA } from './lia';
import type { SkinDef, SkinId } from './types';

export type { SkinDef, SkinId } from './types';

/** Skins jogáveis, na ordem em que aparecem no seletor. */
export const SKINS: Record<SkinId, SkinDef> = { lia: LIA, caio: CAIO, ivo: IVO };
export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

/** Só os ids da lista (nada de `constructor`, `toString`, `__proto__` herdados do objeto). */
export function isSkinId(v: unknown): v is SkinId {
  return typeof v === 'string' && (SKIN_IDS as string[]).includes(v);
}

/** Skin "aleatória" mas fixa por jogador: hash FNV-1a do id/nome. */
export function skinFor(seed: string): SkinId {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return SKIN_IDS[(h >>> 0) % SKIN_IDS.length];
}
