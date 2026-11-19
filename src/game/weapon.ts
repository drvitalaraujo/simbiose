import * as THREE from 'three';
import type { ShotEvent } from '../sim/events';
import type { WeaponState } from '../sim/weapon';
import type { AmmoState } from '../sim/ammo';
import { gunSpec } from '../sim/weapons';
import type { Drone } from './drones';
import type { Juice, Sfx } from './juice';
import type { Particles } from './particles';
import type { Player } from './player';
import { PALETTE } from './toon';
import { Viewmodel } from './viewmodel';
import type { MotionInput } from './viewmodel/motion';
import type { Box } from '../sim/physics';
import { Impacts } from './impacts';
import { raycastBoxes } from '../sim/ray';

export interface WeaponDeps {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  player: Player;
  juice: Juice;
  sfx: Sfx;
  particles: Particles;
  shotBlockers?: readonly Box[];
  impactSurfaces?: readonly Box[];
}

/**
 * Lado visual da arma: viewmodel (arma + mãos, src/game/viewmodel/), clarão, rastro e
 * juice. As regras (cadência, espalhamento, raio) estão em src/sim/weapon.ts; aqui só
 * reagimos aos eventos.
 */
export class Weapon {
  private wasSliding = false;
  private reloadProgress = -1;
  private weaponIndex = 0;
  readonly viewmodel: Viewmodel;
  readonly impacts: Impacts;
  private readonly muzzlePos = new THREE.Vector3();
  private readonly shotEnd = new THREE.Vector3();

  constructor(private d: WeaponDeps) {
    this.viewmodel = new Viewmodel(d.camera, d.scene);
    this.impacts = new Impacts(d.scene);
    this.impacts.blockers = d.shotBlockers ?? [];
    this.impacts.surfaces = d.impactSurfaces ?? [];
    // Cápsulas quicam no primeiro sólido abaixo da janela de ejeção (até 3 m)
    const down = { x: 0, y: -1, z: 0 };
    this.viewmodel.floorAt = (x, y, z) => {
      const hit = raycastBoxes({ x, y, z }, down, this.impacts.blockers, 3);
      return hit ? hit.point.y : y - 3;
    };
  }

  /** Posição da boca da arma no mundo, onde ela aparece na tela (ex.: origem do feixe de hack). */
  get muzzle(): THREE.Vector3 {
    return this.viewmodel.muzzleWorld(this.muzzlePos);
  }

  /**
   * Animação do viewmodel, clarão e rastros. Chamar por quadro DEPOIS de posicionar a
   * câmera; dt = 0 congela no hit-stop. `yaw`/`pitch` são os da mira (por quadro).
   */
  update(dt: number, yaw: number, pitch: number, motion?: MotionInput, reloadRemaining?: number, aimAmount = 0) {
    const st = this.d.player.state;
    const sliding = motion?.sliding ?? st.sliding;
    if (sliding && !this.wasSliding) this.d.sfx.slide();
    this.wasSliding = sliding;
    this.viewmodel.update(dt, { ...(motion ?? {
      vx: st.vel.x, vy: st.vel.y, vz: st.vel.z,
      onGround: st.onGround,
      bobPhase: this.d.player.bobPhase,
      yaw, pitch,
      sliding: st.sliding, crouchAmount: st.crouchAmount,
    }), reloadRemaining, reloadDuration: gunSpec(this.weaponIndex).reloadTime, aimAmount });
    this.impacts.update(dt, this.d.camera);
  }

  /** Evento `shot` da simulação: coice visual, clarão, som, rastro e faísca na parede. */
  onShot(e: ShotEvent, worldEffects = true) {
    this.setWeapon(e.weaponIndex ?? 0);
    const { juice, sfx } = this.d;
    juice.addTrauma(0.09);
    sfx.shot(gunSpec(this.weaponIndex).id);
    const end = this.shotEnd.set(e.end.x, e.end.y, e.end.z);
    this.viewmodel.shot(end); // copia: pode reaproveitar `end`
    if (worldEffects && (e.pellets ?? [e]).some(ray => ray.hit === 'world')) {
      const wall = (e.pellets ?? [e]).find(ray => ray.hit === 'world')!;
      sfx.impact(wall.end);
    }
    if (worldEffects) for (const ray of e.pellets ?? [e]) {
      if (ray.hit === 'world') {
        this.impacts.add(ray.end, ray.dir, this.weaponIndex);
        this.d.particles.burst(this.shotEnd.set(ray.end.x, ray.end.y, ray.end.z), PALETTE.concreteDark, 2, 3, 0.06);
      }
    }
    for (const pellet of e.pellets?.slice(1) ?? []) this.viewmodel.pellet(this.shotEnd.set(pellet.end.x, pellet.end.y, pellet.end.z));
  }

  /** Prévia visual isolada; no jogo a pose segue reloadRemaining. */
  onReload() {
    this.viewmodel.reload();
  }

  /** Sons por fase, sem timers que sobrevivam à morte ou repitam no replay da rede. */
  setWeapon(index: number) {
    if (index === this.weaponIndex) return;
    this.weaponIndex = index;
    this.reloadProgress = -1;
    this.d.sfx.equip();
    this.viewmodel.setWeapon(index);
  }

  syncAmmo(state: AmmoState & Partial<WeaponState>) {
    this.setWeapon(state.weaponIndex ?? 0);
    const progress = state.reloadRemaining > 0 ? 1 - state.reloadRemaining / gunSpec(state.weaponIndex ?? 0).reloadTime : -1;
    if (progress >= 0) {
      if (this.reloadProgress < 0) this.d.sfx.reload('out');
      if (progress >= 0.64 && this.reloadProgress < 0.64) this.d.sfx.reload('in');
      if (progress >= 0.81 && this.reloadProgress < 0.81) this.d.sfx.reload('bolt');
    }
    // Correções podem voltar alguns ticks: cada fase sonora toca uma vez por recarga.
    this.reloadProgress = progress < 0 ? -1 : Math.max(this.reloadProgress, progress);
  }

  /** Renasceu/teleportou: arma volta ao descanso. */
  reset() {
    this.reloadProgress = -1;
    this.viewmodel.reset();
  }

  /** Destruir orbe no ar: recompensa de habilidade. */
  onOrbHit() {
    this.d.sfx.hit();
    this.d.juice.hitMarker();
  }

  /** Tiro acertou um drone (`killed` se destruiu). */
  onDroneHit(drone: Drone, at: { x: number; y: number; z: number }, killed: boolean) {
    const { camera, juice, sfx } = this.d;
    const point = new THREE.Vector3(at.x, at.y, at.z);
    juice.hitMarker();
    if (killed) {
      sfx.kill();
      juice.freeze(0.07);
      juice.impactFrame();
      juice.addTrauma(0.5);
      juice.onomatopoeia(point, camera, true);
      this.d.particles.burst(drone.position, PALETTE.paper, 14, 9, 0.2);
      this.d.particles.burst(drone.position, PALETTE.pink, 10, 7, 0.16);
    } else {
      sfx.hit();
      juice.freeze(0.02);
      if (drone.glitched) juice.onomatopoeia(point, camera, false, 'PANE!', 'glitch');
      else juice.onomatopoeia(point, camera, false);
      this.d.particles.burst(point, PALETTE.pink, 5, 5, 0.09);
    }
  }
}
