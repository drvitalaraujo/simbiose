// Protocolo compartilhado do modo online (sem Three.js e sem DOM): nomes, portas e o
// passo do jogador em forma "achatada", que roda IGUAL no servidor (autoritativo) e na
// predição do cliente. Mesma função dos dois lados = predição bate com o servidor.
import { createGrenade, stepGrenade, type GrenadeState } from '../sim/grenade';
import { INVENTORY_FIELDS, switchWeapon } from '../sim/inventory';
import type { PlayerCommand } from '../sim/command';
import { EventBus, type ShotEvent } from '../sim/events';
import type { Box } from '../sim/physics';
import { createPlayer, PITCH_LIMIT, type PlayerState, stepPlayer } from '../sim/player';
import type { Rng } from '../sim/rng';
import type { Vec3 } from '../sim/vec';
import { createWeapon, stepWeapon, type WeaponState } from '../sim/weapon';
import { type SlideState } from '../sim/slide';
import type { CrouchState } from '../sim/crouch';
import { createSlipper, type SlipperAction, type SlipperState, stepSlipper } from '../sim/slipper';

export const ROOM_NAME = 'arena';
export const DEFAULT_PORT = 2567;
export const TICK_HZ = 60;
/** Intervalo de envio do estado (ms): ~30 por segundo. */
export const PATCH_MS = 33;
/** Quanto no passado os outros jogadores são desenhados (interpolação). */
export const INTERP_DELAY_MS = 100;
export const MAX_PLAYERS = 8;
export const MAX_NAME = 16;
/**
 * Janela máxima do rewind (lag compensation). O atirador vê os outros ~100 ms no passado
 * (interpolação) + metade do ping, e o comando ainda leva a outra metade para chegar: com
 * 150 ms de ping o servidor volta ~300 ms (medido no teste). 350 ms cobre até ~200 ms de
 * ping; acima disso o acerto fica "mais no presente" (quem tem ping alto não ganha vantagem).
 */
export const REWIND_MAX_MS = 350;

/** Campos do jogador que a simulação lê/escreve (o que a predição reconcilia). */
export interface FlatPlayer extends GrenadeState, SlideState, SlipperState, CrouchState, WeaponState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  walking: boolean;
  onGround: boolean;
  sinceGround: number;
  recoil: number;
  hp: number;
  sinceHurt: number;
  /** Tempo até a arma poder disparar de novo (cadência de src/sim/weapon.ts). */
  cooldown: number;
}

export const FLAT_FIELDS = [
  'x', 'y', 'z', 'vx', 'vy', 'vz', 'yaw', 'pitch', 'onGround', 'sinceGround', 'recoil', 'hp', 'sinceHurt', 'cooldown',
  'sliding', 'slideTime', 'slideCooldown', 'slideHeld', 'slipperReady', 'slipperCooldown', 'meleeHeld', 'throwHeld',
  'grenadeReady', 'grenadeHeld',
  'walking', 'crouching', 'crouchAmount',
  'ammo', 'reserveAmmo', 'reloadRemaining', 'reloadHeld',
  'weaponIndex', 'aimAmount', 'fireHeld', ...INVENTORY_FIELDS,
] as const satisfies readonly (keyof FlatPlayer)[];

/** Entrada como chega pela rede (campos de `MoveInput`). */
export interface WireInput {
  weaponSlot?: number;
  moveX: number;
  moveZ: number;
  sprint: boolean;
  jump: boolean;
  crouch: boolean;
  yaw: number;
  pitch: number;
  fire: boolean;
  reload?: boolean;
  aim?: boolean;
  alt: boolean;
  melee?: boolean;
  throwSlipper?: boolean;
  grenade?: boolean;
}

/** Limites que o servidor impõe na entrada (valores fora disso são presos, nunca aceitos). */
export const INPUT_LIMITS = {
  moveX: [-1, 1],
  moveZ: [-1, 1],
  yaw: [-Math.PI, Math.PI],
  pitch: [-PITCH_LIMIT, PITCH_LIMIT],
} as const;

export function commandFromWire(w: WireInput, seq: number): PlayerCommand {
  return {
    seq,
    weaponSlot: w.weaponSlot,
    moveX: w.moveX,
    moveZ: w.moveZ,
    sprint: !!w.sprint,
    jump: !!w.jump,
    crouch: !!w.crouch,
    yaw: w.yaw,
    pitch: w.pitch,
    fire: !!w.fire,
    reload: !!w.reload,
    aim: !!w.aim,
    alt: !!w.alt,
    melee: !!w.melee,
    throwSlipper: !!w.throwSlipper,
    grenade: !!w.grenade,
  };
}

/** Folga para o ângulo em float32 não sair de [-π, π] (o servidor prenderia e mudaria o valor). */
const ANGLE_EDGE = 1e-6;

/**
 * Copia um `PlayerCommand` local para a entrada que vai pela rede, JÁ no formato do fio:
 * yaw/pitch em float32 (como `MoveInput` transmite) e dentro dos limites que o servidor
 * impõe. A predição re-simula com esta mesma entrada, então cliente e servidor calculam com
 * números idênticos (sem a diferença float64 × float32 que dava ~1 µm de deriva).
 */
export function writeWire(w: WireInput, cmd: PlayerCommand) {
  w.weaponSlot = cmd.weaponSlot ?? 0;
  w.moveX = Math.sign(cmd.moveX);
  w.moveZ = Math.sign(cmd.moveZ);
  w.sprint = cmd.sprint;
  w.jump = cmd.jump;
  w.crouch = !!cmd.crouch;
  const yaw = Math.min(Math.PI - ANGLE_EDGE, Math.max(-Math.PI + ANGLE_EDGE, wrapAngle(cmd.yaw)));
  w.yaw = Math.fround(yaw);
  w.pitch = Math.fround(Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, cmd.pitch)));
  w.fire = cmd.fire;
  w.reload = !!cmd.reload;
  w.aim = !!cmd.aim;
  w.alt = cmd.alt;
  w.melee = !!cmd.melee;
  w.throwSlipper = !!cmd.throwSlipper;
  w.grenade = !!cmd.grenade;
}

/** Ângulo em [-π, π) (a mira acumula voltas; na rede vai só o ângulo). */
export function wrapAngle(a: number): number {
  const two = Math.PI * 2;
  return a - two * Math.floor((a + Math.PI) / two);
}

/** Jogador recém-nascido em `spawn`, na forma achatada. */
export function flatAt(spawn: Vec3, weaponIndex = 0): FlatPlayer {
  const f = {} as FlatPlayer;
  writeFlat(f, createPlayer(spawn));
  Object.assign(f, createWeapon(weaponIndex));
  Object.assign(f, createSlipper(), createGrenade());
  return f;
}

function readFlat(f: FlatPlayer, spawn: Vec3): PlayerState {
  return {
    pos: { x: f.x, y: f.y, z: f.z },
    vel: { x: f.vx, y: f.vy, z: f.vz },
    yaw: f.yaw,
    pitch: f.pitch,
    walking: f.walking,
    onGround: f.onGround,
    sinceGround: f.sinceGround,
    recoil: f.recoil,
    hp: f.hp,
    sinceHurt: f.sinceHurt,
    spawn: { ...spawn },
    sliding: f.sliding, slideTime: f.slideTime, slideCooldown: f.slideCooldown, slideHeld: f.slideHeld,
    crouching: f.crouching, crouchAmount: f.crouchAmount,
  };
}

function writeFlat(f: FlatPlayer, s: PlayerState) {
  f.x = s.pos.x;
  f.y = s.pos.y;
  f.z = s.pos.z;
  f.vx = s.vel.x;
  f.vy = s.vel.y;
  f.vz = s.vel.z;
  f.yaw = s.yaw;
  f.pitch = s.pitch;
  f.walking = s.walking;
  f.onGround = s.onGround;
  f.sinceGround = s.sinceGround;
  f.recoil = s.recoil;
  f.hp = s.hp;
  f.sinceHurt = s.sinceHurt;
  f.sliding = s.sliding;
  f.slideTime = s.slideTime;
  f.slideCooldown = s.slideCooldown;
  f.slideHeld = s.slideHeld;
  f.crouching = s.crouching;
  f.crouchAmount = s.crouchAmount;
}

/** Um tick do jogador sobre o estado achatado: `stepPlayer` de src/sim, sem mudar nada. */
export function stepFlat(f: FlatPlayer, cmd: PlayerCommand, dt: number, solids: readonly Box[], spawn: Vec3) {
  const s = readFlat(f, spawn);
  stepPlayer(s, cmd, dt, solids);
  writeFlat(f, s);
}

/** Cooldown parado não precisa crescer para sempre (abaixo de 0 a arma já está pronta). */
const COOLDOWN_FLOOR = -1;

/**
 * Um tick completo do jogador na rede: movimento (`stepPlayer`) + cadência/coice/espalhamento
 * da arma (`stepWeapon`, só contra o mundo). Roda igual no servidor e na predição do cliente.
 * Devolve o disparo (o servidor ainda testa o raio contra os outros jogadores) ou null.
 * Morto (hp <= 0): só cai parado, sem andar, atirar nem regenerar.
 *
 * `spreadRng` sorteia o espalhamento e só é consumido quando dispara. No servidor é um rng
 * SECRETO por jogador (o cliente não consegue prever nem anular o espalhamento); na predição
 * do cliente é um rng local qualquer: o rastro previsto sai um pouco diferente, e o acerto de
 * verdade vem do servidor. Movimento, cadência e coice não dependem dele (predição exata).
 */
export function stepNet(
  f: FlatPlayer, cmd: PlayerCommand, dt: number, solids: readonly Box[], spawn: Vec3, spreadRng: Rng,
  shotBlockers: readonly Box[] = solids, onSlipper?: (action: SlipperAction) => void, onGrenade?: () => void,
): ShotEvent | null {
  const s = readFlat(f, spawn);
  const grenade = stepGrenade(f, cmd, s.hp > 0);
  const action = stepSlipper(f, cmd, dt, s.hp > 0 && !grenade);
  if (s.hp <= 0) {
    f.aimAmount = 0;
    f.fireHeld = cmd.fire;
    f.reloadRemaining = 0;
    f.reloadHeld = !!cmd.reload;
    const still = { ...cmd, moveX: 0, moveZ: 0, jump: false, crouch: false, sprint: false, fire: false, yaw: f.yaw, pitch: f.pitch };
    stepPlayer(s, still, dt, solids);
    writeFlat(f, s);
    f.hp = 0;
    return null;
  }
  if (cmd.weaponSlot) switchWeapon(f, cmd.weaponSlot - 1);
  stepPlayer(s, cmd, dt, solids);
  const bus = new EventBus();
  const fired = stepWeapon(f, s, cmd.fire, dt, { solids: shotBlockers, rng: spreadRng, events: bus }, !!cmd.reload, !grenade && !action && f.slipperCooldown === 0, !!cmd.aim);
  writeFlat(f, s);
  f.cooldown = Math.max(COOLDOWN_FLOOR, f.cooldown);
  if (action) onSlipper?.(action);
  if (grenade) onGrenade?.();
  if (!fired) return null;
  return (bus.drain().find((e) => e.type === 'shot') as ShotEvent | undefined) ?? null;
}

/** Apelido limpo: sem controle, até MAX_NAME caracteres; vazio vira `fallback`. */
export function cleanName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, MAX_NAME);
  return name || fallback;
}
