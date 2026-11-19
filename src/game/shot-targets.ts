import * as THREE from 'three';
import type { Vec3 } from '../sim/vec';
import type { ShotTargets, TargetHit } from '../sim/weapon';
import type { Drone } from './drones';
import type { Projectiles } from './projectiles';
import { MK2 } from '../sim/weapons';

/** O que um id de alvo do último tiro representa. */
export type ShotTarget = { kind: 'drone'; drone: Drone } | { kind: 'orb' };

/**
 * Alvos móveis do treino para a arma da simulação: drones inimigos e orbes. O mundo já
 * foi testado na sim (raio contra AABB); aqui só sobra o raycast nas malhas dos drones.
 * O id de cada alvo é o índice na lista do último tiro: leia com `resolve` no mesmo tick.
 */
export class DroneShotTargets implements ShotTargets {
  private readonly list: THREE.Object3D[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly ids = new WeakMap<THREE.Object3D, number>();
  private readonly objects = new Map<number, THREE.Object3D>();
  private nextId = 0;

  constructor(private readonly drones: Drone[], private readonly projectiles: Projectiles) {}

  beginShot() { this.objects.clear(); }

  raycast(origin: Vec3, dir: Vec3, far: number): TargetHit | null {
    const list = this.list;
    list.length = 0;
    for (const d of this.drones) if (d.alive && d.team === 'enemy') list.push(d.body); // tiro atravessa aliados
    list.push(...this.projectiles.meshes);
    for (const o of list) o.updateWorldMatrix(true, false); // vários ticks por quadro: matriz em dia
    this.raycaster.set(toV3(origin), toV3(dir));
    this.raycaster.far = far;
    const hit = this.raycaster.intersectObjects(list, false)[0];
    if (!hit) return null;
    let id = this.ids.get(hit.object);
    if (id === undefined) { id = this.nextId++; this.ids.set(hit.object, id); }
    this.objects.set(id, hit.object);
    return { id, t: hit.distance };
  }

  damage(id: number, dir: Vec3, amount = MK2.bodyDamage): boolean {
    const obj = this.objects.get(id);
    if (!obj) return false;
    if (obj.userData.orb) {
      this.projectiles.destroy(obj);
      return false;
    }
    return (obj.userData.drone as Drone).damage(toV3(dir), amount / MK2.bodyDamage);
  }

  resolve(id: number): ShotTarget | null {
    const obj = this.objects.get(id);
    if (!obj) return null;
    if (obj.userData.orb) return { kind: 'orb' };
    const drone = obj.userData.drone as Drone | undefined;
    return drone ? { kind: 'drone', drone } : null;
  }
}

export const toV3 = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z);
