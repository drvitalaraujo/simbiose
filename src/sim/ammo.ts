// Munição da MK-2: dados e estado puros, compartilhados pelo treino e pela rede.
export const MAGAZINE_SIZE = 30;
export const RESERVE_AMMO = 120;
export const RELOAD_TIME = 1.35;

export interface AmmoState {
  ammo: number;
  reserveAmmo: number;
  reloadRemaining: number;
  reloadHeld: boolean;
}

export interface AmmoSpec { magazineSize: number; reserveAmmo: number; reloadTime: number }
const DEFAULT_AMMO: AmmoSpec = { magazineSize: MAGAZINE_SIZE, reserveAmmo: RESERVE_AMMO, reloadTime: RELOAD_TIME };

export function createAmmo(spec: AmmoSpec = DEFAULT_AMMO): AmmoState {
  return { ammo: spec.magazineSize, reserveAmmo: spec.reserveAmmo, reloadRemaining: 0, reloadHeld: false };
}

/** Só transfere munição no fim; interromper não cria nem descarta balas. */
export function stepAmmo(w: AmmoState, reload: boolean, _fire: boolean, dt: number, enabled: boolean, spec: AmmoSpec = DEFAULT_AMMO): boolean {
  const pressed = reload && !w.reloadHeld;
  w.reloadHeld = reload;
  if (!enabled) {
    w.reloadRemaining = 0;
    return false;
  }
  if (w.reloadRemaining > 0) {
    w.reloadRemaining = Math.max(0, w.reloadRemaining - dt);
    if (w.reloadRemaining < 1e-8) {
      w.reloadRemaining = 0;
      const amount = Math.min(spec.magazineSize - w.ammo, w.reserveAmmo);
      w.ammo += amount;
      w.reserveAmmo -= amount;
    }
    // O tick de conclusão ainda pertence à recarga; o tiro vem no seguinte.
    return true;
  }
  if ((pressed || w.ammo === 0) && w.ammo < spec.magazineSize && w.reserveAmmo > 0) {
    w.reloadRemaining = spec.reloadTime;
    return true;
  }
  return false;
}

/** O último tiro inicia a recarga no mesmo tick, mesmo que o gatilho seja solto. */
export function reloadIfEmpty(w: AmmoState, spec: AmmoSpec): void {
  if (w.ammo === 0 && w.reserveAmmo > 0 && w.reloadRemaining === 0) w.reloadRemaining = spec.reloadTime;
}
