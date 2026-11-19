import type * as THREE from 'three';
import type { PlayerCommand } from '../sim/command';
import type { Box } from '../sim/physics';
import { CROUCH } from '../sim/crouch';
import { type CameraMotion, MovementCamera, placeEye, WALK_PHASE_PER_METER } from './movement-camera';
import {
  createPlayer, EYE_HEIGHT, isAlive, MAX_HP as SIM_MAX_HP, PLAYER_HALF, type PlayerState, resetPlayer, stepPlayer,
} from '../sim/player';

export const MAX_HP = SIM_MAX_HP;

/**
 * Lado do cliente do jogador: guarda o estado da simulação (src/sim/player.ts) e cuida
 * do que é só visual — interpolação entre ticks, balanço da caminhada e câmera.
 */
export class Player {
  readonly state: PlayerState = createPlayer({ x: 0, y: 3, z: 14 });
  /** Posição/balanço/coice no tick anterior, para interpolar a câmera entre ticks. */
  private readonly prev = { x: 0, y: 3, z: 14 };
  private prevRecoil = 0;
  private prevCrouch = 0;
  private bobTime = 0;
  private readonly movementCamera = new MovementCamera();

  /** Onde o jogador nasce e volta (definido pelo mapa). */
  set spawn(v: { x: number; y: number; z: number }) {
    this.state.spawn = { ...v };
  }

  get center() {
    return this.state.pos;
  }

  get velocity() {
    return this.state.vel;
  }

  get hp() {
    return this.state.hp;
  }

  get alive() {
    return isAlive(this.state);
  }

  get radius() {
    return PLAYER_HALF.x;
  }

  get yaw() {
    return this.state.yaw;
  }

  reset() {
    resetPlayer(this.state);
    this.snap();
  }

  /** Esquece a interpolação (teleporte, renascer). */
  snap() {
    this.movementCamera.reset();
    this.savePrevious();
  }

  private savePrevious() {
    Object.assign(this.prev, this.state.pos);
    this.prevRecoil = this.state.recoil;
    this.prevCrouch = this.state.crouchAmount;
  }

  /** Um tick da simulação + o balanço da caminhada (visual). */
  step(cmd: PlayerCommand, dt: number, solids: Box[]) {
    this.savePrevious();
    stepPlayer(this.state, cmd, dt, solids);
    const v = this.state.vel;
    const horiz = Math.hypot(v.x, v.z);
    if (this.state.onGround && horiz > 0.5 && !this.state.sliding) this.bobTime += dt * horiz * WALK_PHASE_PER_METER;
  }

  /**
   * Posiciona a câmera: olho interpolado entre os dois últimos ticks (`alpha` de 0 a 1)
   * + balanço da passada, afundamento, inclinação e coice. A mira vem direto da entrada
   * (responde no quadro). Devolve o movimento de apresentação (FOV, poeira, linhas).
   */
  applyToCamera(camera: THREE.PerspectiveCamera, alpha: number, yaw: number, pitch: number, dt: number, aim = 0): CameraMotion {
    const p = this.state.pos;
    const recoil = this.prevRecoil + (this.state.recoil - this.prevRecoil) * alpha;
    const crouch = this.prevCrouch + (this.state.crouchAmount - this.prevCrouch) * alpha;
    const x = this.prev.x + (p.x - this.prev.x) * alpha;
    const y = this.prev.y + (p.y - this.prev.y) * alpha;
    const z = this.prev.z + (p.z - this.prev.z) * alpha;
    const motion = this.movementCamera.update({
      x, y, z, onGround: this.state.onGround, alive: this.alive,
      sliding: this.state.sliding, crouch, aim, yaw,
    }, dt);
    placeEye(camera, x, z, motion.y + EYE_HEIGHT - motion.crouch * CROUCH.eyeDrop, motion, yaw, pitch + recoil);
    return motion;
  }

  get bobPhase() {
    return this.bobTime;
  }
}
