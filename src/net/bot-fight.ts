// Combate dos bots (puro): escolhe a arma pela distância, aperta o gatilho do jeito certo
// (rajada na automática, soltar e apertar na semiautomática), mira pela arma, recarrega pelo
// pente da arma atual, usa o chinelo (golpe e arremesso) e se mexe conforme o estilo:
// atirador para e agacha, brigão avança contornando e desliza, pressão faz strafe forte.
import type { PlayerCommand } from '../sim/command';
import { CROUCH } from '../sim/crouch';
import type { Box } from '../sim/physics';
import { lineOfSight } from '../sim/ray';
import type { Rng } from '../sim/rng';
import type { Vec3 } from '../sim/vec';
import { gunSpec } from '../sim/weapons';
import {
  type BotLevel, type BotPersona, chooseWeapon, isBehind, MELEE_REACH, reloadFor, SLOT, slipperChoice, throwPitch, triggerFor,
} from './bot-persona';
import type { BotMover } from './bot-mover';
import type { BotView } from './bot';
import type { FlatPlayer } from './protocol';

const SLIPPER_THINK = 0.35;
const INTENT_TIME = 0.9;
const CALM_SWAP = 2;

export interface Aim {
  yaw: number;
  pitch: number;
}

export class BotFight {
  /** Arma desejada (índice do ARSENAL): vai no comando como `weaponSlot` persistente. */
  slot: number;
  private lastFire = false;
  private lastReload = false;
  private lastSlipper = false;
  private burst = 0;
  private pause = 0;
  private strafe = 1;
  private strafeTimer = 0;
  private slipperTimer = 0;
  private intent: 'melee' | 'throw' | null = null;
  private intentLeft = 0;
  private flankDir = 1;
  private flankTimer = 0;
  private lowViewTimer = 0;
  private lowView = false;
  private calm = 0;

  constructor(
    readonly persona: BotPersona,
    private readonly level: BotLevel,
    private readonly rng: Rng,
    private readonly solids: readonly Box[],
  ) {
    this.slot = persona.primary;
  }

  reset() {
    this.slot = this.persona.primary;
    this.calm = CALM_SWAP;
    this.intent = null;
    this.burst = 0;
    this.pause = 0;
  }

  /** Para onde mirar: o ponto visível, ou acima dele para o chinelo cair no alvo. */
  aimFor(eye: Vec3, point: Vec3): Aim {
    const dx = point.x - eye.x;
    const dz = point.z - eye.z;
    const flat = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz);
    let pitch = Math.atan2(point.y - eye.y, flat);
    if (this.intent === 'throw') pitch = throwPitch(flat, point.y - eye.y) ?? pitch;
    return { yaw, pitch };
  }

  /**
   * Decide o tick de combate. `off` = quanto a mira está longe do ponto desejado (rad);
   * `ready` = já passou o tempo de reação.
   */
  act(cmd: PlayerCommand, self: FlatPlayer, eye: Vec3, target: BotView, off: number, ready: boolean, dt: number, mover: BotMover, skillCone: number) {
    const p = this.persona;
    this.calm = 0;
    const dist = Math.hypot(target.x - self.x, target.z - self.z);
    this.slot = chooseWeapon(p, dist, self);
    const spec = gunSpec(self.weaponIndex);
    const switching = self.weaponIndex !== this.slot || self.equipRemaining > 0;
    const reloading = self.reloadRemaining > 0;
    const behind = isBehind({ x: target.x, z: target.z, yaw: target.yaw ?? 0 }, self);

    // Chinelo: pensa de tempos em tempos; a intenção dura um pouco (tempo de mirar/chegar)
    this.slipperTimer -= dt;
    this.intentLeft -= dt;
    if (this.intentLeft <= 0) this.intent = null;
    if (this.slipperTimer <= 0 && !this.intent) {
      this.slipperTimer = SLIPPER_THINK;
      this.intent = slipperChoice(p, {
        distance: dist, behind, gunBusy: reloading || switching || self.ammo === 0, slowShot: self.cooldown > 0.5, targetHp: target.hp ?? 100, ready: self.slipperReady, off: Math.min(off, 0.3),
      }, this.rng(), this.level.slipper);
      if (this.intent) this.intentLeft = INTENT_TIME;
    }
    if (!self.slipperReady) this.intent = null;
    let slipper = false;
    if (ready && this.intent === 'melee' && dist <= MELEE_REACH && off < 0.3) {
      slipper = true;
      cmd.melee = !this.lastSlipper;
    } else if (ready && this.intent === 'throw' && off < 0.05) {
      slipper = true;
      cmd.throwSlipper = !this.lastSlipper;
    }
    if (slipper && !this.lastSlipper) { this.intent = null; this.intentLeft = 0; }
    this.lastSlipper = slipper && !this.lastSlipper;

    // Gatilho: só com a mira no alvo, depois da reação, fora de troca/recarga
    const sniper = self.weaponIndex === SLOT.sniper;
    const steady = !sniper || (self.aimAmount > 0.85 && Math.hypot(self.vx, self.vz) < 1.2);
    let want = ready && !switching && !reloading && !slipper && steady && off < this.cone(self.weaponIndex, dist, skillCone);
    if (spec.automatic) {
      if (this.pause > 0) { this.pause -= dt; want = false; }
      else if (want) {
        this.burst += dt;
        if (this.burst > 0.4 + this.rng() * 0.55) {
          this.burst = 0;
          this.pause = 0.12 + this.rng() * 0.3 + this.level.pause;
        }
      }
    }
    cmd.fire = triggerFor(self.weaponIndex, want, this.lastFire, self.cooldown, dt);
    this.lastFire = cmd.fire;
    cmd.reload = reloadFor(self, true, this.lastReload);
    this.lastReload = !!cmd.reload;
    cmd.aim = !reloading && !switching && self.weaponIndex !== SLOT.shotgun && dist >= p.adsFrom && this.intent === null;

    this.move(cmd, self, eye, target, dist, behind, reloading, dt, mover);
  }

  /** Sem alvo: volta para a arma principal e completa o pente dela. */
  idle(cmd: PlayerCommand, self: FlatPlayer, dt: number) {
    // Só volta para a principal depois de um tempo sem ninguém (não troca a cada perda de vista)
    this.calm += dt;
    if (this.calm > CALM_SWAP) this.slot = chooseWeapon(this.persona, null, self);
    this.intent = null;
    this.lastFire = false;
    const swapping = self.weaponIndex !== this.slot;
    cmd.reload = !swapping && reloadFor(self, false, this.lastReload);
    this.lastReload = !!cmd.reload;
  }

  /** Abertura do "pode atirar": semi precisa estar no corpo; escopeta perdoa de perto. */
  private cone(weapon: number, dist: number, skillCone: number): number {
    if (weapon === SLOT.sniper) return Math.max(Math.atan(0.3 / Math.max(dist, 0.5)), skillCone * 0.35);
    if (weapon === SLOT.shotgun && dist < 12) return Math.max(skillCone, 0.12);
    return skillCone;
  }

  private move(cmd: PlayerCommand, self: FlatPlayer, eye: Vec3, target: BotView, dist: number, behind: boolean, reloading: boolean, dt: number, mover: BotMover) {
    const p = this.persona;
    const aggr = p.aggression * this.level.aggression;
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafe = this.rng() < 0.5 ? -1 : 1;
      const [lo, hi] = p.strafeEvery;
      this.strafeTimer = lo + (hi - lo) * this.rng();
    }
    let [near, far] = p.range;
    far = far / Math.max(0.4, aggr * 0.5 + 0.5);
    near = near * Math.min(1, 0.5 + aggr * 0.5);
    cmd.moveX = this.strafe * p.strafe;
    cmd.moveZ = dist > far ? 1 : dist < near ? -0.7 : 0;

    // Recarregando: agacha se a mureta cobre; senão recua de lado
    if (reloading) {
      const low = { x: self.x, y: self.y + 0.6 - CROUCH.eyeDrop, z: self.z };
      if (lineOfSight({ x: target.x, y: target.y + 0.6, z: target.z }, eye, this.solids) && !lineOfSight({ x: target.x, y: target.y + 0.6, z: target.z }, low, this.solids)) {
        cmd.crouch = true;
        cmd.moveX = 0;
        cmd.moveZ = 0;
        return;
      }
      if (aggr < 0.9) cmd.moveZ = dist < 15 ? -1 : 0;
    }

    // Chinelada: corre para colar (pelas costas, o brigão chega mesmo sem intenção)
    if (this.intent === 'melee' || (behind && dist < 9 && p.melee >= 0.5 && self.slipperReady)) {
      cmd.moveZ = dist > 1.4 ? 1 : 0; // colado já está no alcance: não atropela o alvo
      cmd.moveX = 0;
      cmd.sprint = false;
    } else if (p.flank && dist > near + 2 && !reloading) {
      // Contorna: vem na diagonal, trocando de lado de vez em quando
      this.flankTimer -= dt;
      if (this.flankTimer <= 0) {
        this.flankDir = this.rng() < 0.5 ? -1 : 1;
        this.flankTimer = 1.2 + this.rng() * 1.5;
      }
      cmd.moveZ = 1;
      cmd.moveX = this.flankDir * 0.6;
      cmd.sprint = false;
    } else if (cmd.moveZ > 0 && dist > far + 6 && !cmd.fire) {
      cmd.sprint = false;
    }

    // Quem para para atirar fica parado (e agachado, se for o estilo) enquanto mira
    const settling = p.stopToShoot && (cmd.fire || (cmd.aim && self.aimAmount > 0.2) || this.lastFire);
    if (settling && dist > (p.close !== undefined ? p.closeRange : 0)) {
      cmd.moveX = 0;
      cmd.moveZ = 0;
      cmd.sprint = false;
      // Só agacha se dali de baixo ainda dá para ver o alvo (senão some atrás da mureta)
      this.lowViewTimer -= dt;
      if (p.crouchShoot && this.lowViewTimer <= 0) {
        this.lowViewTimer = 0.3;
        this.lowView = lineOfSight({ x: self.x, y: self.y + 0.6 - CROUCH.eyeDrop, z: self.z }, { x: target.x, y: target.y + 0.3, z: target.z }, this.solids);
      }
      if (p.crouchShoot && this.lowView) cmd.crouch = true;
    }
    if (p.hop > 0 && self.onGround && this.rng() < p.hop * dt) cmd.jump = true;
    if (cmd.moveX !== 0 || cmd.moveZ !== 0) mover.unstick(cmd, self, dt);
  }
}
