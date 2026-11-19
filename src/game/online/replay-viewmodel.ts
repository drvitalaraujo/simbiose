import * as THREE from 'three';
import { gunSpec } from '../../sim/weapons';
import { aimedFov } from '../aim';
import { WALK_PHASE_PER_METER } from '../movement-camera';
import { Viewmodel } from '../viewmodel';
import type { ReplaySample } from './replay-recorder';

/** Arma própria do replay: nunca altera munição, pose nem efeitos da arma ao vivo. */
export class ReplayViewmodel {
  readonly viewmodel: Viewmodel;
  private bobPhase = 0;
  scoped = false;
  reflex = false;

  constructor(private readonly camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.viewmodel = new Viewmodel(camera, scene);
    this.hide();
  }

  reset(index: number) {
    this.viewmodel.setWeapon(index);
    this.viewmodel.reset();
    this.bobPhase = 0;
    this.hide();
  }

  present(s: ReplaySample, dt: number, baseFov: number) {
    const spec = gunSpec(s.weapon);
    const aim = s.alive ? s.aim : 0;
    this.camera.fov = aimedFov(baseFov, spec.zoom, aim);
    this.camera.updateProjectionMatrix();
    this.viewmodel.setWeapon(s.weapon);
    if (s.onGround && !s.sliding) this.bobPhase += dt * Math.hypot(s.vx, s.vz) * WALK_PHASE_PER_METER;
    this.viewmodel.update(dt, {
      vx: s.vx, vy: s.vy, vz: s.vz, onGround: s.onGround, bobPhase: this.bobPhase,
      yaw: s.yaw, pitch: s.pitch, sliding: s.sliding, crouchAmount: s.crouch,
      aimAmount: aim, reloadRemaining: s.reload, reloadDuration: spec.reloadTime,
    });
    this.scoped = s.alive && spec.id === 'sniper' && aim > 0.96;
    // Mesmo limiar e retículo do AimPresentation; replay não depende do mouse travado.
    this.reflex = s.alive && spec.id === 'mk2' && aim > 0.85;
    this.viewmodel.model.root.visible = s.alive && !this.scoped;
  }

  hide() {
    this.viewmodel.model.root.visible = false;
    this.scoped = false;
    this.reflex = false;
  }

  stop() { this.viewmodel.reset(); this.hide(); }
  dispose() { this.viewmodel.dispose(); }
}
