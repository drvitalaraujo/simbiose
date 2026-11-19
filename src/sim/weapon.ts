// Regras da arma hitscan, puras: cadência, espalhamento (rng com semente), coice e o raio
// contra o mundo. Clarão, rastro, som e juice ficam no cliente, reagindo aos eventos.
// Tuning aprovado pelo dono: não mexer sem os testes de caracterização (feel.test.ts).
import { createInventory, type InventoryState } from './inventory';
import type { EventBus } from './events';
import { createAmmo, reloadIfEmpty, stepAmmo, type AmmoState } from './ammo';
import type { Box } from './physics';
import { eyePosition, type PlayerState } from './player';
import { raycastBoxes } from './ray';
import type { Rng } from './rng';
import { addScaled, fromView, normalize, type Vec3 } from './vec';
import { gunSpec, MK2, validWeaponIndex, weaponDamage, weaponSpread } from './weapons';

export const FIRE_INTERVAL = MK2.fireInterval;
export const SPREAD = MK2.spread;
export const RANGE = MK2.range;
export const RECOIL_KICK = MK2.recoilKick;

export interface WeaponState extends AmmoState, InventoryState {
  cooldown: number;
  weaponIndex: number;
  aimAmount: number;
  fireHeld: boolean;
}

export function createWeapon(weaponIndex = 0): WeaponState {
  const spec = gunSpec(weaponIndex);
  return { cooldown: 0, weaponIndex: validWeaponIndex(weaponIndex) ? weaponIndex : 0, aimAmount: 0, fireHeld: false, ...createAmmo(spec), ...createInventory() };
}

/** Alvo móvel atingido (drone, outro jogador) a `t` metros da origem. */
export interface TargetHit {
  id: number;
  t: number;
}

/** Quem tem alvos além do mundo (hoje os drones do treino; na rede, os jogadores). */
export interface ShotTargets {
  beginShot?(): void;
  /** Alvo mais próximo até `far` (o mundo já bloqueou o resto), ou null. */
  raycast(origin: Vec3, dir: Vec3, far: number): TargetHit | null;
  /** Aplica o dano do tiro. Retorna true se destruiu o alvo. */
  damage(id: number, dir: Vec3, amount?: number): boolean;
}

export interface ShotContext {
  solids: readonly Box[];
  rng: Rng;
  events: EventBus;
  targets?: ShotTargets;
}

/** Direção do tiro com espalhamento: consome dois sorteios do rng (x e depois y). */
export function shotDirection(yaw: number, pitch: number, rng: Rng, spread = SPREAD): Vec3 {
  const local = normalize({ x: (rng() - 0.5) * spread, y: (rng() - 0.5) * spread, z: -1 });
  return fromView(local, yaw, pitch);
}

/** Avança a arma um tick. Retorna true se disparou. */
export function stepWeapon(w: WeaponState, shooter: PlayerState, fire: boolean, dt: number, ctx: ShotContext, reload = false, enabled = true, aim = false): boolean {
  const spec = gunSpec(w.weaponIndex);
  const pressed = fire && !w.fireHeld;
  w.fireHeld = fire;
  w.cooldown -= dt;
  w.equipRemaining = Math.max(0, w.equipRemaining - dt);
  const blocked = stepAmmo(w, reload, fire, dt, enabled && shooter.hp > 0, spec);
  // Transição autoritativa: não basta declarar ADS para ganhar precisão no primeiro tick.
  // Ferrolho baixa a luneta; pulando/caindo ela perde estabilidade e assenta ao pousar.
  // Usa estado já replicado: treino, servidor e predição recuperam a mesma precisão.
  // Descer degraus de até 0,4 m causa queda curta; não é um pulo voluntário.
  const supported = shooter.onGround || (shooter.sinceGround < 0.2 && shooter.vel.y <= 0 && shooter.vel.y > -5);
  const sniperReady = spec.id !== 'sniper' || (supported && w.cooldown <= spec.aimTime);
  const aiming = aim && sniperReady && w.equipRemaining === 0 && enabled && shooter.hp > 0 && !blocked && !shooter.sliding;
  w.aimAmount = Math.max(0, Math.min(1, w.aimAmount + (aiming ? 1 : -1) * dt / spec.aimTime));
  if (!enabled || shooter.hp <= 0 || blocked || !fire || w.ammo <= 0 || w.cooldown > 0) return false;
  if (!spec.automatic && !pressed) return false;
  w.cooldown = spec.fireInterval;
  w.ammo--;
  fireShot(w, shooter, ctx);
  reloadIfEmpty(w, spec);
  return true;
}

function fireShot(w: WeaponState, shooter: PlayerState, ctx: ShotContext) {
  const spec = gunSpec(w.weaponIndex);
  const spread = weaponSpread(w.weaponIndex, w.aimAmount, shooter.onGround, Math.hypot(shooter.vel.x, shooter.vel.z));
  const origin = eyePosition(shooter);
  const shots: import('./events').ShotEvent[] = [];
  const hits = [];
  ctx.targets?.beginShot?.();
  for (let i = 0; i < spec.pellets; i++) {
    const dir = shotDirection(shooter.yaw, shooter.pitch + shooter.recoil, ctx.rng, spread);
    const wall = raycastBoxes(origin, dir, ctx.solids, spec.range);
    const far = wall ? wall.t : spec.range;
    const target = ctx.targets?.raycast(origin, dir, far) ?? null;
    const end = addScaled(origin, dir, target ? target.t : far);
    shots.push({ type: 'shot', origin, dir, end, hit: target ? 'target' : wall ? 'world' : 'none',
      ...(target ? { target: target.id } : {}), weaponIndex: w.weaponIndex });
    if (target) hits.push({ target, dir, end });
  }
  shooter.recoil += spec.recoilKick;
  ctx.events.emit({ ...shots[0], ...(shots.length > 1 ? { pellets: shots } : {}) });
  // Resolve a salva antes de aplicar dano: os ids dos alvos permanecem estáveis.
  const grouped = new Map<number, { amount: number; dir: Vec3; point: Vec3 }>();
  for (const h of hits) {
    const previous = grouped.get(h.target.id);
    // Treino mantém o dano aprovado da MK-2 nos drones; PvP resolve falloff no servidor.
    const amount = spec.id === 'mk2' ? spec.bodyDamage : weaponDamage(spec, 'torso', h.target.t);
    grouped.set(h.target.id, { amount: (previous?.amount ?? 0) + amount, dir: h.dir, point: h.end });
  }
  for (const [id, hit] of grouped) {
    const killed = ctx.targets!.damage(id, hit.dir, hit.amount);
    ctx.events.emit({ type: killed ? 'kill' : 'hit', target: id, point: hit.point, dir: hit.dir });
  }
}
