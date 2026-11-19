// Movimento do jogador, puro e determinístico: `stepPlayer(estado, comando, dt, sólidos)`.
// Roda igual no cliente e no servidor. Câmera, balanço da caminhada e viewmodel ficam
// no cliente (src/game/player.ts). Movimento tático autorizado em 2026-11-14:
// sem corrida/slide; Shift anda em silêncio. Trajetória protegida por feel.test.ts.
import type { PlayerCommand } from './command';
import type { EventBus } from './events';
import { type Box, moveAndCollide } from './physics';
import type { Vec3 } from './vec';
import { createSlide, type SlideState } from './slide';
import { bodyHalf, CROUCH, eyeOffset, updateCrouch, type CrouchState } from './crouch';

export const PLAYER_HALF: Readonly<Vec3> = { x: 0.35, y: 0.85, z: 0.35 };
export const EYE_HEIGHT = 0.65; // altura do olho acima do centro
export const WALK = 6;
// Referência histórica da curva de dispersão; não é uma velocidade de movimento.
export const SPRINT = 9.5;
export const SILENT_WALK = 3;
const ACCEL_GROUND = 60;
const ACCEL_AIR = 18;
const GRAVITY = 26;
const JUMP = 9;
const COYOTE = 0.1; // tempo para ainda pular depois de sair da borda
const STEP = 0.45; // degrau máximo que se sobe andando
export const PITCH_LIMIT = 1.5;
export const MAX_HP = 100;
const REGEN_DELAY = 4;
const REGEN_RATE = 25;
const RECOIL_RECOVERY = 5; // amortecimento por segundo; 95% de recuperação em ~0,6 s
const FALL_LIMIT = -20;

export interface PlayerState extends SlideState, CrouchState {
  /** Centro de referência em pé, inclusive agachado (pés = y - 0.85). */
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  walking: boolean;
  onGround: boolean;
  sinceGround: number;
  /** Coice da arma acumulado (radianos), somado ao pitch da mira e devolvido aos poucos. */
  recoil: number;
  hp: number;
  sinceHurt: number;
  /** Onde nasce e volta (definido pelo mapa). */
  spawn: Vec3;
}

export function createPlayer(spawn: Vec3): PlayerState {
  return {
    pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, walking: false, onGround: false, sinceGround: 0,
    recoil: 0, hp: MAX_HP, sinceHurt: 99, spawn: { ...spawn }, ...createSlide(), crouching: false, crouchAmount: 0,
  };
}

export function resetPlayer(s: PlayerState) {
  Object.assign(s, createSlide());
  s.walking = false;
  s.crouching = false;
  s.crouchAmount = 0;
  Object.assign(s.pos, s.spawn);
  Object.assign(s.vel, { x: 0, y: 0, z: 0 });
  s.yaw = 0;
  s.pitch = 0;
  s.recoil = 0;
  s.hp = MAX_HP;
  s.sinceHurt = 99;
}

export function eyePosition(s: PlayerState): Vec3 {
  return { x: s.pos.x, y: s.pos.y + eyeOffset(s), z: s.pos.z };
}

export function isAlive(s: PlayerState) {
  return s.hp > 0;
}

/** Aplica dano e anuncia no barramento. */
export function hurtPlayer(s: PlayerState, amount: number, events?: EventBus) {
  if (s.hp <= 0) return;
  s.hp = Math.max(0, s.hp - amount);
  s.sinceHurt = 0;
  events?.emit({ type: 'hurt', amount, hp: s.hp, fatal: s.hp <= 0 });
}

/** Avança o jogador um tick. */
export function stepPlayer(s: PlayerState, cmd: PlayerCommand, dt: number, solids: readonly Box[]) {
  // Regeneração depois de um tempo sem levar dano: fácil de jogar, sem caçar kit médico
  s.sinceHurt += dt;
  if (s.sinceHurt > REGEN_DELAY) s.hp = Math.min(MAX_HP, s.hp + REGEN_RATE * dt);

  if (Number.isFinite(cmd.yaw)) s.yaw = cmd.yaw;
  if (Number.isFinite(cmd.pitch)) s.pitch = clamp(cmd.pitch, -PITCH_LIMIT, PITCH_LIMIT);

  // Direção desejada no plano, girada pelo yaw (frente local = -z)
  let wx = clamp(cmd.moveX || 0, -1, 1);
  let wz = -clamp(cmd.moveZ || 0, -1, 1);
  const len = Math.hypot(wx, wz);
  if (len > 0) {
    // entrada digital (±1) sempre vira velocidade cheia, como antes
    wx /= len;
    wz /= len;
  }
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  // O campo de entrada sprint conserva o nome do protocolo: Shift agora anda em silêncio.
  s.walking = !!cmd.sprint && s.hp > 0;
  Object.assign(s, createSlide());
  updateCrouch(s, s.pos, !!cmd.crouch && s.hp > 0, dt, solids);
  const speed = Math.min(s.crouching ? CROUCH.speed : WALK, s.walking ? SILENT_WALK : WALK);
  const tx = (wx * c + wz * sn) * speed;
  const tz = (-wx * sn + wz * c) * speed;

  // Aceleração rápida = controle responsivo (sensação "arcade")
  const accel = s.onGround ? (s.crouching ? 18 : ACCEL_GROUND) : ACCEL_AIR;
  s.vel.x = approach(s.vel.x, tx, accel * dt);
  s.vel.z = approach(s.vel.z, tz, accel * dt);

  s.sinceGround = s.onGround ? 0 : s.sinceGround + dt;
  if (cmd.jump && s.sinceGround < COYOTE) {
    s.vel.y = JUMP;
    s.sinceGround = COYOTE;
  }
  s.vel.y -= GRAVITY * dt;

  const half = bodyHalf(s.crouchAmount);
  const center = { ...s.pos, y: s.pos.y + half.y - PLAYER_HALF.y };
  const r = moveAndCollide(center, half, {
    x: s.vel.x * dt,
    y: s.vel.y * dt,
    z: s.vel.z * dt,
  }, solids as Box[], s.onGround ? STEP : 0);
  Object.assign(s.pos, center, { y: center.y - half.y + PLAYER_HALF.y });
  s.onGround = r.onGround;
  if (r.onGround || r.hitCeiling) s.vel.y = 0;

  // Rede de segurança: caiu do mapa, volta
  if (s.pos.y < FALL_LIMIT) {
    Object.assign(s.pos, s.spawn);
    Object.assign(s.vel, { x: 0, y: 0, z: 0 });
  }

  // Acumula entre tiros, mas converge para um patamar controlável na rajada.
  // A mesma recuperação roda na predição e no servidor, sem depender do FPS.
  s.recoil *= Math.exp(-RECOIL_RECOVERY * dt);
  if (s.recoil < 0.00001) s.recoil = 0;
}

export function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
