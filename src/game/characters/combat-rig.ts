import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CharacterAsset } from './model';
import { gunSpec } from '../../sim/weapons';

/** Só braços e dedos: tiro/recarga não podem substituir a passada nem a postura. */
const ARM = /^DEF-(?:shoulder|upper_arm|forearm|hand|thumb|f_index|f_middle|f_ring|f_pinky)/;
export const armTrack = (track: THREE.KeyframeTrack) => ARM.test(track.name);

export function locomotionClip(c: THREE.AnimationClip): THREE.AnimationClip {
  return new THREE.AnimationClip(`${c.name}-body`, c.duration, c.tracks.filter(t => !armTrack(t)));
}

/** Camada independente dos braços no mesmo mixer, com pesos exclusivos. */
export class CombatRig {
  private readonly aim: THREE.AnimationAction;
  private readonly shot: THREE.AnimationAction;
  private readonly reload: THREE.AnimationAction;
  private shotLeft = 0;
  private shotDuration = 0.18;
  private freshShot = false;
  private reloadWeight = 0;

  constructor(asset: CharacterAsset, mixer: THREE.AnimationMixer) {
    const action = (name: string) => {
      const clip = asset.clips.get(name)!;
      const a = mixer.clipAction(new THREE.AnimationClip(`${name}-arms`, clip.duration, clip.tracks.filter(armTrack)));
      a.play().setEffectiveWeight(0);
      a.timeScale = 0;
      return a;
    };
    this.aim = action('Pistol_Aim_Neutral');
    this.shot = action('Pistol_Shoot');
    this.reload = action('Pistol_Reload');
  }

  fire(index: number) {
    this.shotDuration = Math.min(0.24, gunSpec(index).fireInterval);
    this.shotLeft = this.shotDuration;
    this.freshShot = true;
  }

  update(dt: number, dead: boolean, deathWeight: number, index: number, reloadRemaining: number) {
    if (dead) { this.shotLeft = 0; this.reloadWeight = 0; this.freshShot = false; }
    // Um disparo novo precisa chegar ao coice mesmo se outra bala vier antes do próximo
    // quadro. Limita o primeiro avanço para não pular o clipe inteiro em FPS baixo.
    this.shotLeft = Math.max(0, this.shotLeft - (this.freshShot ? Math.min(dt, this.shotDuration * 0.35) : dt));
    this.freshShot = false;
    const shotWeight = this.shotLeft > 0 ? Math.min(1, this.shotLeft / (this.shotDuration * 0.35)) : 0;
    this.shot.time = (1 - this.shotLeft / this.shotDuration) * this.shot.getClip().duration;
    const reloading = !dead && reloadRemaining > 0;
    this.reloadWeight += ((reloading ? 1 : 0) - this.reloadWeight) * Math.min(1, dt * 18);
    if (reloading) this.reload.time = THREE.MathUtils.clamp(1 - reloadRemaining / gunSpec(index).reloadTime, 0, 0.999) * this.reload.getClip().duration;
    const alive = 1 - deathWeight;
    this.reload.setEffectiveWeight(this.reloadWeight * alive);
    this.shot.setEffectiveWeight(shotWeight * (1 - this.reloadWeight) * alive);
    this.aim.setEffectiveWeight((1 - shotWeight) * (1 - this.reloadWeight) * alive);
  }
}

const grips = new WeakMap<CharacterAsset, THREE.Quaternion>();
/** Calibra uma vez a orientação da arma no punho da pose original do asset. */
export function gripRotation(asset: CharacterAsset): THREE.Quaternion {
  let q = grips.get(asset);
  if (!q) {
    const root = clone(asset.scene);
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(asset.clips.get('Pistol_Aim_Neutral')!).play();
    mixer.update(0);
    const hand = root.getObjectByName('DEF-handR')!;
    q = hand.getWorldQuaternion(new THREE.Quaternion()).invert()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    grips.set(asset, q);
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
  }
  return q;
}
