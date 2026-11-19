// Ponte autoritativa da HE. O cliente só envia a intenção Q no comando de movimento.
import { grenadeDamage, launchGrenade, stepProjectile, type GrenadeProjectile } from '../sim/grenade';
import { eyeOffset } from '../sim/crouch';
import type { Box } from '../sim/physics';
import type { ShotMsg } from './feed';
import type { Vec3 } from '../sim/vec';

export interface GrenadeStore {
  [Symbol.iterator](): IterableIterator<[string, GrenadeProjectile]>;
  set(id: string, p: GrenadeProjectile): unknown;
  delete(id: string): unknown;
}
interface Target extends Vec3 { hp: number; crouchAmount?: number }
export class GrenadeCombat {
  private serial = 0;
  constructor(readonly projectiles: GrenadeStore, private create = (p: GrenadeProjectile) => p) {}
  launch(id: string, p: Target & { yaw: number; pitch: number }, seq: number, emit: (msg: ShotMsg) => void) {
    const g = launchGrenade(id, { x: p.x, y: p.y + eyeOffset(p), z: p.z }, p.yaw, p.pitch, seq);
    this.projectiles.set(`he-${++this.serial}`, this.create(g));
    emit({ by: id, seq, o: tuple(g), e: tuple(g), weapon: 'grenade', grenadePhase: 'throw', grenadeVelocity: [g.vx, g.vy, g.vz] });
  }
  tick(dt: number, blockers: readonly Box[], targets: Iterable<[string, Target]>, hit: (m: ShotMsg, damage: number) => void, afterExplosion: () => boolean = () => true, solids: readonly Box[] = []) {
    for (const [id, g] of [...this.projectiles]) {
      if (!stepProjectile(g, dt, blockers, solids)) continue;
      this.projectiles.delete(id);
      hit({ by: g.owner, seq: g.seq, o: tuple(g), e: tuple(g), weapon: 'grenade', grenadePhase: 'explode' }, 0);
      for (const [tid, target] of targets) {
        if (target.hp <= 0) continue;
        const center = { x: target.x, y: target.y - (target.crouchAmount ?? 0) * 0.35, z: target.z };
        const dmg = grenadeDamage(g, center, blockers);
        if (dmg > 0) hit({ by: g.owner, seq: g.seq, o: tuple(g), e: tuple(center), weapon: 'grenade', t: tid, part: 'torso', continuation: true }, dmg);
      }
      if (!afterExplosion()) break;
    }
  }
  removeOwner(owner: string) { for (const [id, p] of this.projectiles) if (p.owner === owner) this.projectiles.delete(id); }
  clear() { for (const [id] of this.projectiles) this.projectiles.delete(id); }
}
const tuple = (p: Vec3): [number, number, number] => [p.x, p.y, p.z];
