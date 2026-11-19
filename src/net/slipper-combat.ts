// Chinelo autoritativo: golpe curto, projétil balístico e coleta pelo dono.
import { raycastBody } from '../game/characters/hitbox';
import type { Box } from '../sim/physics';
import { eyeOffset } from '../sim/crouch';
import { lineOfSight, raycastBoxes, raySphere } from '../sim/ray';
import { SLIPPER, type SlipperAction } from '../sim/slipper';
import { forward, type Vec3 } from '../sim/vec';
import { hitboxState, type Pose } from './combat';
import type { ShotMsg } from './feed';

export interface SlipperPlayer extends Pose {
  hp: number;
  life: number;
  slipperReady: boolean;
  /** Só no treino: drones são esferas; personagens sempre usam as cápsulas de dados. */
  sphereRadius?: number;
}
export interface SlipperProjectile {
  owner: string;
  life: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  resting: boolean;
  age: number;
  seq: number;
  hitTarget: string;
}
export interface SlipperStore {
  [Symbol.iterator](): IterableIterator<[string, SlipperProjectile]>;
  set(id: string, p: SlipperProjectile): unknown;
  delete(id: string): unknown;
}

export class SlipperCombat {
  private serial = 0;
  constructor(
    readonly projectiles: SlipperStore,
    private readonly create: (p: SlipperProjectile) => SlipperProjectile = p => p,
  ) {}

  action(id: string, p: SlipperPlayer, action: SlipperAction, seq: number, blockers: readonly Box[], targets: Iterable<[string, SlipperPlayer]>, hit: (msg: ShotMsg, damage: number) => void) {
    const origin = { x: p.x, y: p.y + eyeOffset(p), z: p.z };
    const dir = forward(p.yaw, p.pitch);
    if (action === 'throw') {
      this.projectiles.set(`chinelo-${++this.serial}`, this.create({
        owner: id, life: p.life, ...origin, vx: dir.x * SLIPPER.speed, vy: dir.y * SLIPPER.speed, vz: dir.z * SLIPPER.speed,
        resting: false, age: 0, seq, hitTarget: '',
      }));
      hit({ by: id, seq, o: tuple(origin), e: tuple(origin), weapon: 'chinelo-arremesso' }, 0);
      return;
    }
    const candidates = [...targets];
    const msg = cast(id, seq, origin, dir, SLIPPER.meleeRange, blockers, candidates, 'chinelo');
    const victim = msg.t ? candidates.find(([tid]) => tid === msg.t)?.[1] : undefined;
    const distance = victim ? Math.hypot(p.x - victim.x, p.z - victim.z) : 0;
    const back = victim && distance > 1e-6 && (-Math.sin(victim.yaw) * (p.x - victim.x) - Math.cos(victim.yaw) * (p.z - victim.z)) / distance < -0.5;
    hit(msg, back ? SLIPPER.backDamage : SLIPPER.meleeDamage);
  }

  tick(dt: number, blockers: readonly Box[], players: Map<string, SlipperPlayer> | { get(id: string): SlipperPlayer | undefined; [Symbol.iterator](): IterableIterator<[string, SlipperPlayer]> }, hit: (msg: ShotMsg, damage: number) => void) {
    for (const [id, p] of this.projectiles) {
      const owner = players.get(p.owner);
      if (!owner || owner.life !== p.life || p.y < -20) { this.projectiles.delete(id); continue; }
      p.age += dt;
      if (!p.resting) {
        p.vy -= SLIPPER.gravity * dt;
        const speed = Math.hypot(p.vx, p.vy, p.vz);
        const origin = { x: p.x, y: p.y, z: p.z };
        const dir = { x: p.vx / speed, y: p.vy / speed, z: p.vz / speed };
        const msg = cast(p.owner, p.seq, origin, dir, speed * dt, blockers, p.hitTarget ? [] : players, 'chinelo-arremesso');
        [p.x, p.y, p.z] = msg.e;
        if (msg.t || msg.w) {
          hit(msg, msg.part === 'head' ? SLIPPER.headDamage : SLIPPER.throwDamage);
          // Continua caindo depois de acertar alguém; não fica pendurado no ar.
          p.vx = 0; p.vz = 0; p.vy = 0;
          const wall = msg.w ? raycastBoxes(origin, dir, blockers, speed * dt) : null;
          p.resting = !!wall && dir.y < 0 && Math.abs(p.y - blockers[wall.index].max.y) < 0.01;
          if (msg.w && !p.resting) {
            p.x -= dir.x * 0.02; p.y -= dir.y * 0.02; p.z -= dir.z * 0.02;
          }
          if (msg.t) p.y -= 0.15;
          if (msg.t) p.hitTarget = msg.t;
        }
        // No máximo um acerto por voo; após o alvo, cai até o chão sem ferir outro.
      }
      if (p.resting && owner.hp > 0 && Math.hypot(owner.x - p.x, owner.y - p.y, owner.z - p.z) <= SLIPPER.pickupRange && lineOfSight(
        { x: owner.x, y: owner.y, z: owner.z }, { x: p.x, y: p.y + 0.03, z: p.z }, blockers,
      )) {
        owner.slipperReady = true;
        this.projectiles.delete(id);
      }
    }
  }

  /** Chinelo do dono parado no chão (para o bot ir buscar), ou null. */
  restingOf(owner: string): SlipperProjectile | null {
    for (const [, p] of this.projectiles) if (p.owner === owner && p.resting) return p;
    return null;
  }

  removeOwner(owner: string) {
    for (const [id, p] of this.projectiles) if (p.owner === owner) this.projectiles.delete(id);
  }
}

function cast(by: string, seq: number, origin: Vec3, dir: Vec3, range: number, blockers: readonly Box[], players: Iterable<[string, SlipperPlayer]>, weapon: 'chinelo' | 'chinelo-arremesso'): ShotMsg {
  const wall = raycastBoxes(origin, dir, blockers, range);
  let far = wall?.t ?? range;
  const msg: ShotMsg = { by, seq, o: tuple(origin), e: [0, 0, 0], weapon };
  if (wall) msg.w = true;
  for (const [id, p] of players) {
    if (id === by || p.hp <= 0) continue;
    const sphereT = p.sphereRadius ? raySphere(origin, dir, p, p.sphereRadius) : null;
    const body = p.sphereRadius
      ? (sphereT !== null && sphereT <= far ? { t: sphereT, part: 'torso' as const } : null)
      : raycastBody(origin, dir, hitboxState(p), far);
    if (!body || body.t >= far) continue;
    far = body.t;
    msg.t = id; msg.part = body.part; delete msg.w;
  }
  msg.e = tuple({ x: origin.x + dir.x * far, y: origin.y + dir.y * far, z: origin.z + dir.z * far });
  return msg;
}
const tuple = (p: Vec3): [number, number, number] => [p.x, p.y, p.z];
