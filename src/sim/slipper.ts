// Disponibilidade e cadência do chinelo são previstas; acerto/pickup só no servidor.
import type { PlayerCommand } from './command';
import { SLIPPER_DAMAGE } from './weapons';

export interface SlipperState {
  slipperReady: boolean;
  slipperCooldown: number;
  meleeHeld: boolean;
  throwHeld: boolean;
}
export type SlipperAction = 'melee' | 'throw';
export const SLIPPER = { meleeRange: 2.2, meleeDamage: SLIPPER_DAMAGE.melee, backDamage: SLIPPER_DAMAGE.back, throwDamage: SLIPPER_DAMAGE.thrown, headDamage: SLIPPER_DAMAGE.head, speed: 26, gravity: 9, cooldown: 0.55, pickupRange: 1.5 } as const;

export function createSlipper(): SlipperState {
  return { slipperReady: true, slipperCooldown: 0, meleeHeld: false, throwHeld: false };
}

export function stepSlipper(s: SlipperState, cmd: PlayerCommand, dt: number, alive: boolean): SlipperAction | null {
  s.slipperCooldown = Math.max(0, s.slipperCooldown - dt);
  const melee = !!cmd.melee && !s.meleeHeld;
  const throwing = !!cmd.throwSlipper && !s.throwHeld;
  s.meleeHeld = !!cmd.melee;
  s.throwHeld = !!cmd.throwSlipper;
  if (!alive || s.slipperCooldown > 0 || !s.slipperReady) return null;
  if (!melee && !throwing) return null;
  s.slipperCooldown = SLIPPER.cooldown;
  if (throwing) { s.slipperReady = false; return 'throw'; }
  return 'melee';
}
