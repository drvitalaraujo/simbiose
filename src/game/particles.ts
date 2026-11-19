import * as THREE from 'three';
import { toon } from './toon';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const GEO = new THREE.BoxGeometry(1, 1, 1);
const noRaycast = () => {};

function newParticle(): Particle {
  const mesh = new THREE.Mesh(GEO);
  mesh.raycast = noRaycast; // estilhaço não bloqueia tiro
  return { mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 };
}

/** Estilhaços cartunescos: cubinhos que voam, giram e encolhem. Reaproveita tudo (pool). */
export class Particles {
  private live: Particle[] = [];
  private pool: Particle[] = [];

  constructor(private scene: THREE.Scene) {}

  burst(at: THREE.Vector3, color: number, count: number, speed: number, size = 0.15) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop() ?? newParticle();
      const mesh = p.mesh;
      mesh.material = toon(color);
      mesh.position.copy(at);
      mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      this.scene.add(mesh);
      p.vel.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(speed * (0.5 + Math.random()));
      p.maxLife = p.life = 0.4 + Math.random() * 0.4;
      this.live.push(p);
    }
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.pool.push(p);
        this.live[i] = this.live[this.live.length - 1]; // troca com o último (ordem não importa)
        this.live.pop();
        continue;
      }
      p.vel.y -= 20 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.vel.y *= -0.4;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }
      p.mesh.rotation.x += dt * 10;
      p.mesh.rotation.y += dt * 7;
      const k = p.life / p.maxLife;
      p.mesh.scale.multiplyScalar(k < 0.3 ? 0.9 : 1);
    }
  }
}
