// Granada HE: estoque previsto; física e dano puros, executados a 60 Hz.
import type { PlayerCommand } from './command';
import type { Box } from './physics';
import { lineOfSight, raycastBoxes } from './ray';
import { forward, type Vec3 } from './vec';

export const GRENADE = { fuse: 1.5, speed: 16, gravity: 18, radius: 0.09, bounce: 0.45, blastRadius: 6, damage: 110 } as const;
export interface GrenadeState { grenadeReady: boolean; grenadeHeld: boolean }
export const createGrenade = (): GrenadeState => ({ grenadeReady: true, grenadeHeld: false });
export function stepGrenade(s: GrenadeState, cmd: PlayerCommand, alive: boolean): boolean {
  const pressed = !!cmd.grenade && !s.grenadeHeld;
  s.grenadeHeld = !!cmd.grenade;
  if (!alive || !s.grenadeReady || !pressed) return false;
  s.grenadeReady = false;
  return true;
}
export interface GrenadeProjectile extends Vec3 {
  owner: string; vx: number; vy: number; vz: number; age: number; seq: number;
}
export function launchGrenade(owner: string, eye: Vec3, yaw: number, pitch: number, seq: number): GrenadeProjectile {
  const d = forward(yaw, pitch);
  // Nasce no olho: nunca deslocar a origem através da parede diante do jogador.
  return { owner, ...eye, vx: d.x * GRENADE.speed, vy: d.y * GRENADE.speed + 2, vz: d.z * GRENADE.speed, age: 0, seq };
}
export function stepProjectile(p: GrenadeProjectile, dt: number, blockers: readonly Box[], solids: readonly Box[] = []): boolean {
  p.age += dt;
  p.vy -= GRENADE.gravity * dt;
  const r = GRENADE.radius;
  let left = dt;
  // Varredura contínua: parede fina não pode ser atravessada num tick rápido.
  for (let i = 0; i < 4 && left > 1e-6; i++) {
    const speed = Math.hypot(p.vx, p.vy, p.vz);
    if (speed < 1e-8) break;
    const d = { x: p.vx/speed, y: p.vy/speed, z: p.vz/speed };
    // Expansão nas contas do raio, sem copiar centenas de caixas por tick.
    const shotHit = raycastBoxes(p, d, blockers, speed * left, r);
    const solidHit = solids === blockers ? null : raycastBoxes(p, d, solids, speed * left, r);
    const useSolid = !!solidHit && (!shotHit || solidHit.t < shotHit.t);
    const hit = useSolid ? solidHit : shotHit;
    if (!hit) { p.x += p.vx*left; p.y += p.vy*left; p.z += p.vz*left; break; }
    const b = (useSolid ? solids : blockers)[hit.index];
    let axis: 'x'|'y'|'z' = 'x', sign = -1, near = Infinity;
    for (const a of ['x','y','z'] as const) for (const side of [-1,1]) {
      const gap = Math.abs(hit.point[a] - (side < 0 ? b.min[a] - r : b.max[a] + r));
      if (gap < near) { near = gap; axis = a; sign = side; }
    }
    Object.assign(p, hit.point);
    p[axis] = (sign < 0 ? b.min[axis] - r : b.max[axis] + r) + sign * 0.001;
    const key = axis === 'x' ? 'vx' : axis === 'y' ? 'vy' : 'vz';
    p[key] = Math.abs(p[key]) * sign * GRENADE.bounce;
    if (axis === 'y' && sign > 0) { p.vx *= 0.72; p.vz *= 0.72; if (Math.abs(p.vy) < 0.5) p.vy = 0; }
    left -= hit.t / speed;
  }
  return p.age + 1e-9 >= GRENADE.fuse;
}
export function grenadeDamage(at: Vec3, target: Vec3, blockers: readonly Box[]): number {
  const distance = Math.hypot(target.x-at.x, target.y-at.y, target.z-at.z);
  if (distance >= GRENADE.blastRadius || !lineOfSight(at, target, blockers)) return 0;
  return Math.round(GRENADE.damage * Math.min(1, (GRENADE.blastRadius-distance)/(GRENADE.blastRadius-1)));
}
