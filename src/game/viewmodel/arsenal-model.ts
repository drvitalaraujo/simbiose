import type { PartList } from './parts';
import type { WeaponLayout } from './model';
import { rifleBody } from './rifle-model';
import { smgBody } from './smg-model';
import { sniperBody } from './sniper-model';
import { shotgunBody } from './shotgun-model';

/**
 * Corpo da arma pelo índice do `ARSENAL` (sem mãos). Mantido para quem desenha a arma em
 * terceira pessoa (`characters/remote-weapon.ts`); a boca certa vem em `layout.muzzle` (cm).
 */
export function arsenalBody(p: PartList, index: number): WeaponLayout {
  return [rifleBody, smgBody, sniperBody, shotgunBody][index]?.(p) ?? rifleBody(p);
}
