// Ponte do chinelo determinístico para os drones e efeitos do treino.
import * as THREE from 'three';
import type { PlayerCommand } from '../sim/command';
import type { PlayerState } from '../sim/player';
import { createSlipper, stepSlipper } from '../sim/slipper';
import type { SlipperAction } from '../sim/slipper';
import type { Box } from '../sim/physics';
import { MK2 } from '../sim/weapons';
import { SlipperCombat, type SlipperPlayer, type SlipperProjectile } from '../net/slipper-combat';
import type { ShotMsg } from '../net/feed';
import type { Drone } from './drones';
import { SlipperVisuals } from './online/slippers';

export class TrainingSlipper {
  readonly state = createSlipper();
  readonly drops = new Map<string, SlipperProjectile>();
  private readonly combat = new SlipperCombat(this.drops);
  private readonly visuals: SlipperVisuals;
  private readonly ids = new WeakMap<Drone, string>();
  private serial = 0;
  private life = 1;

  constructor(scene: THREE.Scene, camera: THREE.Camera, private readonly onHit: (d: Drone, point: THREE.Vector3, damage: number, dir: THREE.Vector3) => void, private readonly onAction: (action: SlipperAction) => void = () => {}) {
    this.visuals = new SlipperVisuals(scene, camera);
  }

  tick(cmd: PlayerCommand, dt: number, player: PlayerState, drones: readonly Drone[], blockers: readonly Box[]) {
    const p: SlipperPlayer & typeof this.state = {
      ...this.state, ...player.pos, yaw: player.yaw, pitch: player.pitch,
      vx: player.vel.x, vz: player.vel.z, hp: player.hp, life: this.life, sliding: player.sliding,
      crouchAmount: player.crouchAmount,
    };
    const rows = new Map<string, SlipperPlayer>([['player', p]]);
    const targets = new Map<string, Drone>();
    for (const d of drones) {
      if (!d.alive || d.team !== 'enemy') continue;
      let id = this.ids.get(d);
      if (!id) { id = `drone-${++this.serial}`; this.ids.set(d, id); }
      targets.set(id, d);
      rows.set(id, { ...d.position, x: d.position.x, y: d.position.y, z: d.position.z, yaw: d.group.rotation.y, pitch: 0, vx: d.vel.x, vz: d.vel.z, hp: d.hp, life: 1, slipperReady: false, sphereRadius: d.kind === 'boss' ? 1.82 : 0.7 });
    }
    const receive = (msg: ShotMsg, damage: number) => {
      const d = msg.t ? targets.get(msg.t) : undefined;
      if (d) this.onHit(d, new THREE.Vector3(...msg.e), damage / MK2.bodyDamage, new THREE.Vector3(...msg.e).sub(new THREE.Vector3(...msg.o)).normalize());
    };
    const action = stepSlipper(p, cmd, dt, player.hp > 0);
    if (action) {
      this.visuals.play(action);
      this.onAction(action);
      this.combat.action('player', p, action, cmd.seq, blockers, rows, receive);
    }
    this.combat.tick(dt, blockers, rows, receive);
    for (const key of ['slipperReady', 'slipperCooldown', 'meleeHeld', 'throwHeld'] as const) Object.assign(this.state, { [key]: p[key] });
  }

  update(dt: number, alive: boolean) { this.visuals.update(dt, this.drops, alive); }
  reset() { Object.assign(this.state, createSlipper()); this.drops.clear(); this.life++; }
}
