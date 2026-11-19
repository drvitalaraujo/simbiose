// Efeitos do combate online (só visual/som). O tiro do próprio jogador aparece NA HORA
// (clarão, rastro, som e coice vêm da predição); acerto, dano e abate só quando o
// servidor confirma. Tiros dos outros: rastro saindo do boneco e som se estiver perto.
import * as THREE from 'three';
import { grenadeEffect } from '../grenades';
import type { HitPart } from '../characters/hitbox';
import type { ShotEvent } from '../../sim/events';
import type { Vec3 } from '../../sim/vec';
import { Juice, type Sfx } from '../juice';
import { Particles } from '../particles';
import { Player } from '../player';
import { WALK_PHASE_PER_METER } from '../movement-camera';
import { GLOW, PALETTE } from '../toon';
import { Weapon } from '../weapon';
import type { FlatPlayer } from '../../net/protocol';
import type { Box } from '../../sim/physics';
import type { ShotMsg } from '../../net/feed';
import { ARSENAL } from '../../sim/weapons';

const REMOTE_TRACER = {
  ally: new THREE.Color(PALETTE.cyan).multiplyScalar(GLOW),
  enemy: new THREE.Color(PALETTE.pink).multiplyScalar(GLOW),
};
const TRACER_LIFE = 0.08;

export class OnlineFx {
  readonly juice = new Juice();
  readonly particles: Particles;
  private readonly weapon: Weapon;
  private readonly tracers: { line: THREE.Line; life: number; fresh: boolean }[] = [];
  private fxTime = 0;
  private bobPhase = 0;

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera, private readonly sfx: Sfx) {
    this.particles = new Particles(scene);
    // Viewmodel do treino (src/game/weapon.ts): o boneco local não anda na sim do cliente,
    // então um Player parado só serve para o balanço da arma (fica sem balanço).
    this.weapon = new Weapon({ camera, scene, player: new Player(), juice: this.juice, sfx, particles: this.particles });
  }

  /** Arma na mão só quando vivo. */
  setArmed(armed: boolean) {
    this.weapon.viewmodel.model.root.visible = armed;
  }

  /** Disparo previsto do jogador local: tudo na hora, sem esperar o servidor. */
  localShot(e: ShotEvent) {
    this.weapon.onShot(e, false);
  }

  setShotBlockers(blockers: readonly Box[]) { this.weapon.impacts.blockers = blockers; }
  setImpactSurfaces(surfaces: readonly Box[]) { this.weapon.impacts.surfaces = surfaces; }

  /** Só o servidor fixa impactos no cenário; predição não deixa marcas falsas. */
  worldShot(m: ShotMsg) {
    if (m.continuation || m.weapon === 'chinelo' || m.weapon === 'chinelo-arremesso' || m.weapon === 'grenade') return;
    const index = Math.max(0, ARSENAL.findIndex(w => w.id === m.weapon));
    const impact = (m.impacts ?? (m.w ? [m.e] : []))[0];
    if (impact) this.sfx.impact({ x: impact[0], y: impact[1], z: impact[2] });
    for (const end of m.impacts ?? (m.w ? [m.e] : [])) {
      const point = { x: end[0], y: end[1], z: end[2] };
      const direction = { x: end[0] - m.o[0], y: end[1] - m.o[1], z: end[2] - m.o[2] };
      this.weapon.impacts.add(point, direction, index);
    }
  }

  grenade(m: ShotMsg) { grenadeEffect(m, this.sfx, this.particles); }

  remoteMuzzle(from: THREE.Vector3, end: Vec3) {
    const direction = new THREE.Vector3(end.x, end.y, end.z).sub(from).normalize();
    this.weapon.impacts.smoke.emit(from, direction);
  }

  /** Disparo de outro jogador (rastro do boneco até onde o servidor disse que parou). */
  remoteShot(from: THREE.Vector3, end: Vec3, weapon = 'mk2', team: 'ally' | 'enemy' = 'enemy', sound = true, source = 'remote', tracer = true) {
    // O viewmodel do replay já desenha o rastro do ponto de vista; mantém só o áudio aqui.
    if (tracer) {
      const to = new THREE.Vector3(end.x, end.y, end.z);
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: REMOTE_TRACER[team], transparent: true, depthWrite: false }));
      line.raycast = () => {};
      this.scene.add(line);
      this.tracers.push({ line, life: TRACER_LIFE, fresh: true });
    }
    if (sound) this.sfx.shot(weapon, from, source);
  }

  /** O servidor confirmou que o SEU tiro acertou alguém. */
  confirmHit(point: Vec3, part: HitPart, damage: number, killed: boolean) {
    const at = new THREE.Vector3(point.x, point.y, point.z);
    const j = this.juice;
    j.hitMarker();
    if (killed) {
      this.sfx.kill(part === 'head');
      j.impactFrame();
      j.addTrauma(0.45);
      j.onomatopoeia(at, this.camera, true, part === 'head' ? 'NA CABEÇA!' : undefined);
      this.particles.burst(at, PALETTE.paper, 14, 9, 0.18);
      this.particles.burst(at, PALETTE.pink, 10, 7, 0.15);
    } else if (damage > 0) {
      this.sfx.hit(part === 'head');
      j.onomatopoeia(at, this.camera, false, part === 'head' ? 'CABEÇA!' : undefined);
      this.particles.burst(at, PALETTE.pink, 5, 5, 0.09);
    } else {
      // Acertou alguém protegido (acabou de nascer): só faísca, sem dano
      this.particles.burst(at, PALETTE.cyan, 4, 4, 0.07);
    }
  }

  /** Você levou um tiro. */
  hurt() {
    this.juice.addTrauma(0.35);
    this.sfx.hurt();
  }

  /** Você morreu. */
  died() {
    this.weapon.reset();
    this.juice.impactFrame(0.15);
    this.juice.addTrauma(0.6);
    this.sfx.death();
  }

  respawn() { this.weapon.reset(); }

  dispose() {
    this.weapon.impacts.dispose();
    this.weapon.viewmodel.dispose();
  }

  /** Por quadro: juice, viewmodel, partículas, rastros e tremor da câmera (depois de posicioná-la). */
  update(dt: number, yaw: number, pitch: number, state?: FlatPlayer, aimAmount = 0) {
    const fxDt = this.juice.tick(dt);
    if (state?.onGround && !state.sliding) this.bobPhase += fxDt * Math.hypot(state.vx, state.vz) * WALK_PHASE_PER_METER;
    if (state) this.weapon.syncAmmo(state);
    this.weapon.update(fxDt, yaw, pitch, state ? {
      vx: state.vx, vy: state.vy, vz: state.vz, onGround: state.onGround,
      yaw, pitch, bobPhase: this.bobPhase, sliding: state.sliding, crouchAmount: state.crouchAmount,
    } : undefined, state?.reloadRemaining, aimAmount);
    this.particles.update(fxDt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      if (!t.fresh) t.life -= dt;
      t.fresh = false;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / TRACER_LIFE);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    this.fxTime += fxDt;
    this.juice.shakeCamera(this.camera, this.fxTime);
  }
}
