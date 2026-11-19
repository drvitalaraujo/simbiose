import * as THREE from 'three';
import { createGrenade, stepGrenade } from '../sim/grenade';
import { GrenadeCombat } from '../net/grenade-combat';
import type { PlayerCommand } from '../sim/command';
import type { PlayerState } from '../sim/player';
import type { Box } from '../sim/physics';
import type { ShotMsg } from '../net/feed';
import type { Drone } from './drones';
import { MK2 } from '../sim/weapons';

export class TrainingGrenade {
  readonly state = createGrenade();
  readonly combat = new GrenadeCombat(new Map());
  constructor(private effect: (m: ShotMsg) => void, private hitDrone: (d: Drone, damage: number, dir: THREE.Vector3) => void, private hurt: (damage: number) => void) {}
  tick(cmd: PlayerCommand, dt: number, p: PlayerState, drones: readonly Drone[], blockers: readonly Box[], solids: readonly Box[] = []): boolean {
    const thrown = stepGrenade(this.state, cmd, p.hp > 0);
    if (thrown) this.combat.launch('local', { ...p.pos, hp: p.hp, yaw: p.yaw, pitch: p.pitch, crouchAmount: p.crouchAmount }, cmd.seq, this.effect);
    const targets = new Map(drones.filter(d => d.alive && d.team === 'enemy').map((d, i) => [String(i), d]));
    const rows = new Map([...targets].map(([id, d]) => [id, { x: d.position.x, y: d.position.y, z: d.position.z, hp: d.hp }]));
    rows.set('local', { ...p.pos, y: p.pos.y - p.crouchAmount * 0.35, hp: p.hp });
    this.combat.tick(dt, blockers, rows, (m, damage) => {
      this.effect(m);
      if (m.t === 'local') this.hurt(damage);
      const d = m.t ? targets.get(m.t) : undefined;
      if (d?.alive) this.hitDrone(d, damage / MK2.bodyDamage, new THREE.Vector3(...m.e).sub(new THREE.Vector3(...m.o)).normalize());
    }, undefined, solids);
    return thrown;
  }
  reset() { Object.assign(this.state, createGrenade()); this.combat.clear(); }
}
