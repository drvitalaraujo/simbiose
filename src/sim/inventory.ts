import { ARSENAL, validWeaponIndex } from './weapons';
import type { WeaponState } from './weapon';

/** Escalares para o rollback do Colyseus: nenhuma referência mutável compartilhada. */
export interface InventoryState {
  ammo0: number; ammo1: number; ammo2: number; ammo3: number;
  reserve0: number; reserve1: number; reserve2: number; reserve3: number;
  equipRemaining: number;
}
export const INVENTORY_FIELDS = ['ammo0', 'ammo1', 'ammo2', 'ammo3', 'reserve0', 'reserve1', 'reserve2', 'reserve3', 'equipRemaining'] as const;
const AMMO = ['ammo0', 'ammo1', 'ammo2', 'ammo3'] as const;
const RESERVE = ['reserve0', 'reserve1', 'reserve2', 'reserve3'] as const;
export const EQUIP_TIME = 0.28;

export function createInventory(): InventoryState {
  return { ammo0: ARSENAL[0].magazineSize, ammo1: ARSENAL[1].magazineSize,
    ammo2: ARSENAL[2].magazineSize, ammo3: ARSENAL[3].magazineSize,
    reserve0: ARSENAL[0].reserveAmmo, reserve1: ARSENAL[1].reserveAmmo,
    reserve2: ARSENAL[2].reserveAmmo, reserve3: ARSENAL[3].reserveAmmo, equipRemaining: 0 };
}

/** Reserva adicional aplicada uma vez no nascimento do duelo, antes da replicação. */
export function addReserveMagazine(w: WeaponState) {
  for (const [i, spec] of ARSENAL.entries()) w[RESERVE[i]] += spec.magazineSize;
  w.reserveAmmo = w[RESERVE[w.weaponIndex]];
}

/** Guarda munição, cancela recarga e conserva a cadência pendente da arma anterior. */
export function switchWeapon(w: WeaponState, index: unknown): boolean {
  if (!validWeaponIndex(index) || index === w.weaponIndex) return false;
  w[AMMO[w.weaponIndex]] = w.ammo;
  w[RESERVE[w.weaponIndex]] = w.reserveAmmo;
  w.weaponIndex = index;
  w.ammo = w[AMMO[index]];
  w.reserveAmmo = w[RESERVE[index]];
  w.reloadRemaining = 0;
  w.aimAmount = 0;
  w.equipRemaining = EQUIP_TIME;
  w.cooldown = Math.max(w.cooldown, EQUIP_TIME);
  return true;
}
