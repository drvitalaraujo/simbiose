// Reconstitui a trajetória determinística a partir do lançamento autorizado gravado.
import type * as THREE from 'three';
import { TICK } from '../../sim/clock';
import { GRENADE, stepProjectile, type GrenadeProjectile } from '../../sim/grenade';
import type { Box } from '../../sim/physics';
import { GrenadeVisuals } from '../grenades';
import type { ReplayEvent } from './replay-recorder';

export class ReplayGrenades {
  private readonly visuals: GrenadeVisuals;
  private paths: { t: number; id: string; samples: GrenadeProjectile[] }[] = [];
  constructor(scene: THREE.Scene) { this.visuals = new GrenadeVisuals(scene); }
  start(events: readonly ReplayEvent[], blockers: readonly Box[], solids: readonly Box[] = []) {
    this.clear();
    for (const [i, e] of events.entries()) {
      if (e.grenadePhase !== 'throw' || !e.grenadeVelocity) continue;
      const [vx, vy, vz] = e.grenadeVelocity;
      const p: GrenadeProjectile = { owner: e.by, x: e.o[0], y: e.o[1], z: e.o[2], vx, vy, vz, age: 0, seq: i };
      const samples = [{ ...p }];
      while (!stepProjectile(p, TICK, blockers, solids)) samples.push({ ...p });
      samples.push({ ...p });
      this.paths.push({ t: e.t, id: String(i), samples });
    }
  }
  update(time: number) {
    const rows = new Map<string, GrenadeProjectile>();
    for (const path of this.paths) {
      const age = time - path.t;
      if (age < 0 || age >= GRENADE.fuse) continue;
      const tick = age / TICK, index = Math.floor(tick), k = tick - index;
      const a = path.samples[index], b = path.samples[index + 1] ?? a;
      rows.set(path.id, { ...a, age, x: a.x + (b.x-a.x)*k, y: a.y + (b.y-a.y)*k, z: a.z + (b.z-a.z)*k });
    }
    this.visuals.update(rows);
  }
  clear() { this.paths = []; this.visuals.update([]); }
  dispose() { this.visuals.dispose(); }
}
