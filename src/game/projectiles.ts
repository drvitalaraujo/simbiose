import * as THREE from 'three';
import type { Team } from './brain';
import type { Drone } from './drones';
import type { Particles } from './particles';
import { type Box, type Vec3 } from './physics';
import { addOutline, GLOW, PALETTE } from './toon';

export const ORB_SPEED: Record<Team, number> = { enemy: 13, ally: 24 };
const RADIUS = 0.22;
const DRONE_RADIUS = 0.75;
const LIFE = 4;
const GEO = new THREE.SphereGeometry(RADIUS, 12, 8);
// Cor acima de 1 em luz linear: os orbes "estouram" no bloom e ficam fáceis de ver
const MAT: Record<Team, THREE.MeshBasicMaterial> = {
  enemy: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.pink).multiplyScalar(GLOW) }),
  ally: new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.cyan).multiplyScalar(GLOW) }),
};

interface Orb {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  team: Team;
}

export interface OrbHits {
  onHitPlayer: (dir: THREE.Vector3) => void;
  onHitDrone: (drone: Drone, dir: THREE.Vector3) => void;
}

/**
 * Orbes dos drones. Os inimigos (rosa) são lentos de propósito: dá para ver, desviar e
 * destruir com tiro. Os aliados (ciano) são rápidos e só acertam inimigos.
 */
export class Projectiles {
  private orbs: Orb[] = [];

  constructor(private scene: THREE.Scene, private particles: Particles) {}

  spawn(from: THREE.Vector3, dir: THREE.Vector3, team: Team) {
    const mesh = new THREE.Mesh(GEO, MAT[team]);
    addOutline(mesh, 0.05);
    mesh.position.copy(from);
    if (team === 'enemy') mesh.userData.orb = true; // só orbe inimigo pode ser destruído a tiro
    this.scene.add(mesh);
    this.orbs.push({ mesh, vel: dir.clone().normalize().multiplyScalar(ORB_SPEED[team]), life: LIFE, team });
  }

  /** Orbes inimigos que o tiro do jogador pode acertar. */
  get meshes(): THREE.Object3D[] {
    return this.orbs.filter((o) => o.team === 'enemy').map((o) => o.mesh);
  }

  destroy(mesh: THREE.Object3D) {
    const i = this.orbs.findIndex((o) => o.mesh === mesh);
    if (i >= 0) this.remove(i, true);
  }

  clear() {
    for (let i = this.orbs.length - 1; i >= 0; i--) this.remove(i, false);
  }

  update(dt: number, solids: Box[], player: Vec3, playerRadius: number, drones: Drone[], hits: OrbHits) {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      o.mesh.position.addScaledVector(o.vel, dt);
      const p = o.mesh.position;
      o.mesh.scale.setScalar(1 + Math.sin(o.life * 30) * 0.15); // pulsar para chamar atenção
      const dir = o.vel.clone().normalize();

      if (o.team === 'enemy') {
        // Cápsula vertical do jogador: segmento do pé à cabeça
        const cy = Math.min(Math.max(p.y, player.y - 0.5), player.y + 0.5);
        if (Math.hypot(p.x - player.x, p.y - cy, p.z - player.z) < RADIUS + playerRadius) {
          hits.onHitPlayer(dir);
          this.remove(i, true);
          continue;
        }
      }
      const victim = drones.find((d) => d.alive && d.team !== o.team && d.position.distanceTo(p) < DRONE_RADIUS + RADIUS);
      if (victim) {
        hits.onHitDrone(victim, dir);
        this.remove(i, true);
        continue;
      }
      if (o.life <= 0 || solids.some((b) => inside(p, b))) this.remove(i, true);
    }
  }

  private remove(i: number, burst: boolean) {
    const o = this.orbs[i];
    if (burst) this.particles.burst(o.mesh.position, o.team === 'enemy' ? PALETTE.pink : PALETTE.cyan, 5, 4, 0.08);
    this.scene.remove(o.mesh);
    this.orbs.splice(i, 1);
  }
}

function inside(p: Vec3, b: Box) {
  return p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z;
}
