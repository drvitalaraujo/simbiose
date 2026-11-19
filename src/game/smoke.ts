import * as THREE from 'three';
import { PALETTE, toonWith } from './toon';
import { instanceFade, shotTexture } from './shot-textures';

interface Puff {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
  opacity: number;
  rotation: number;
}

/** Nuvens leves em pool fixo; ordenadas de trás para frente antes de desenhar. */
export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private readonly texture = shotTexture('smoke');
  private readonly opacity: THREE.InstancedBufferAttribute;
  private readonly items: Puff[];
  private readonly sorted: Puff[] = [];
  private live = 0;
  private readonly transform = new THREE.Object3D();
  private readonly rotation = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3(0, 0, 1);

  constructor(scene: THREE.Scene, size = 48) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(size), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('instanceOpacity', this.opacity);
    const mat = toonWith({ color: PALETTE.cal, map: this.texture, transparent: true, depthWrite: false, opacity: 1 });
    instanceFade(mat);
    this.mesh = new THREE.InstancedMesh(geo, mat, size);
    this.mesh.name = 'shot-smoke';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.items = Array.from({ length: size }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 1, opacity: 0, rotation: 0 }));
    scene.add(this.mesh);
  }

  emit(at: THREE.Vector3, direction: THREE.Vector3, dust = false, strength = 1) {
    const count = dust ? 2 : 3;
    for (let i = 0; i < count; i++) {
      if (this.live === this.items.length) {
        let oldest = 0;
        for (let j = 1; j < this.live; j++) {
          if (this.items[j].age / this.items[j].life > this.items[oldest].age / this.items[oldest].life) oldest = j;
        }
        this.remove(oldest);
      }
      const p = this.items[this.live++];
      p.pos.copy(at).addScaledVector(direction, 0.025 + i * 0.015);
      p.vel.copy(direction).multiplyScalar((dust ? 0.25 : 0.45) + i * 0.12);
      p.vel.x += (Math.random() - 0.5) * 0.12;
      p.vel.z += (Math.random() - 0.5) * 0.12;
      p.vel.y += 0.12;
      p.age = 0;
      p.life = (dust ? 0.36 : 0.5) + i * 0.07;
      p.size = (dust ? 0.12 : 0.055) * strength;
      p.opacity = dust ? 0.22 : 0.12;
      p.rotation = Math.random() * Math.PI * 2;
    }
  }

  /** Fiapo de fumaça do cano quente: um só, fino, sobe devagar e dura mais. */
  wisp(at: THREE.Vector3) {
    if (this.live === this.items.length) return;
    const p = this.items[this.live++];
    p.pos.copy(at);
    p.vel.set((Math.random() - 0.5) * 0.04, 0.22 + Math.random() * 0.08, (Math.random() - 0.5) * 0.04);
    p.age = 0;
    p.life = 0.9 + Math.random() * 0.4;
    p.size = 0.03;
    p.opacity = 0.09;
    p.rotation = Math.random() * Math.PI * 2;
  }

  update(dt: number, camera: THREE.Camera) {
    for (let i = this.live - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.age >= p.life) { this.remove(i); continue; }
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-dt * 3));
      p.vel.y += dt * 0.2;
    }
    this.sorted.length = this.live;
    for (let i = 0; i < this.live; i++) this.sorted[i] = this.items[i];
    this.sorted.sort((a, b) => b.pos.distanceToSquared(camera.position) - a.pos.distanceToSquared(camera.position));
    for (let i = 0; i < this.live; i++) {
      const p = this.sorted[i];
      const k = p.age / p.life;
      this.transform.position.copy(p.pos);
      this.transform.quaternion.copy(camera.quaternion).multiply(this.rotation.setFromAxisAngle(this.axis, p.rotation + k * 0.3));
      this.transform.scale.setScalar(p.size * (1 + k * 2.5));
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(i, this.transform.matrix);
      this.opacity.setX(i, p.opacity * Math.min(1, p.age / 0.035) * (1 - k) ** 2);
    }
    this.mesh.count = this.live;
    this.mesh.instanceMatrix.needsUpdate = this.opacity.needsUpdate = true;
  }

  clear() { this.live = 0; this.mesh.count = 0; }

  dispose() {
    this.clear();
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }

  private remove(i: number) {
    const last = --this.live;
    [this.items[i], this.items[last]] = [this.items[last], this.items[i]];
  }
}
