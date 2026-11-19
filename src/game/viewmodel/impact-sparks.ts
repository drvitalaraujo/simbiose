import * as THREE from 'three';
import { GLOW, PALETTE } from '../toon';

// Impacto de tiro no cenário: faíscas (riscos que brilham, voam, caem e esticam na direção
// do movimento) e um "estouro" de anime (estrela achatada na parede por 2–3 quadros).
// Dois InstancedMesh em pool fixo: no máximo dois draw calls, só enquanto há impacto vivo.

interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

interface Pop {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  life: number;
  size: number;
  spin: number;
}

const POP_LIFE = 0.075;
const SPARK_COLORS = [PALETTE.yellow, PALETTE.orange, PALETTE.paper].map(c => new THREE.Color(c).multiplyScalar(GLOW));

/** Risco em cruz de comprimento 1 ao longo de +z, afinando na cauda. */
function streakGeometry(): THREE.BufferGeometry {
  const p: number[] = [];
  for (const [ax, ay] of [[1, 0], [0, 1]]) {
    p.push(-ax * 0.2, -ay * 0.2, 0, ax * 0.2, ay * 0.2, 0, 0, 0, 1);
    p.push(-ax, -ay, 1, ax, ay, 1, 0, 0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}

/** Estrela de 6 pontas no plano XY (encosta na parede pela normal). */
function popGeometry(): THREE.BufferGeometry {
  const p: number[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const r0 = i % 2 === 0 ? 1 : 0.32;
    const r1 = (i + 1) % 2 === 0 ? 1 : 0.32;
    p.push(0, 0, 0, Math.cos(a0) * r0, Math.sin(a0) * r0, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}

export class ImpactSparks {
  readonly sparks: THREE.InstancedMesh;
  readonly pops: THREE.InstancedMesh;
  private readonly items: Spark[];
  private readonly popItems: Pop[];
  private live = 0;
  private livePops = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3(0, 0, 1);
  private readonly spinQ = new THREE.Quaternion();
  private readonly tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, size = 72, pops = 12) {
    const material = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.sparks = new THREE.InstancedMesh(streakGeometry(), material(), size);
    this.pops = new THREE.InstancedMesh(popGeometry(), material(), pops);
    for (const mesh of [this.sparks, this.pops]) {
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.name = 'impact-sparks';
      scene.add(mesh);
    }
    for (let i = 0; i < pops; i++) this.pops.setColorAt(i, new THREE.Color(PALETTE.paper).multiplyScalar(GLOW));
    this.items = Array.from({ length: size }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, color: new THREE.Color() }));
    this.popItems = Array.from({ length: pops }, () => ({ pos: new THREE.Vector3(), normal: new THREE.Vector3(), life: 0, size: 1, spin: 0 }));
  }

  /**
   * Faíscas saindo da parede (cone em torno da normal, rebatidas contra o tiro) e o estouro.
   * `count` e `speed` variam por arma; chão solta menos faísca (poeira faz o trabalho).
   */
  burst(at: THREE.Vector3, normal: THREE.Vector3, shot: THREE.Vector3, count: number, speed: number, popSize: number) {
    for (let i = 0; i < count; i++) {
      if (this.live === this.items.length) this.remove(0);
      const p = this.items[this.live++];
      p.pos.copy(at).addScaledVector(normal, 0.01);
      // Reflexo do tiro + espalhamento: a maioria volta na direção de quem atirou
      const reflect = this.tmp.copy(shot).addScaledVector(normal, -2 * shot.dot(normal)).normalize();
      p.vel.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(1.3)
        .addScaledVector(normal, 0.8).addScaledVector(reflect, 0.9).normalize()
        .multiplyScalar(speed * (0.5 + Math.random() * 0.8));
      p.maxLife = p.life = 0.12 + Math.random() * 0.2;
      p.color.copy(SPARK_COLORS[i % SPARK_COLORS.length]);
    }
    if (popSize > 0) {
      if (this.livePops === this.popItems.length) this.removePop(0);
      const pop = this.popItems[this.livePops++];
      pop.pos.copy(at).addScaledVector(normal, 0.012);
      pop.normal.copy(normal);
      pop.life = POP_LIFE;
      pop.size = popSize * (0.8 + Math.random() * 0.4);
      pop.spin = Math.random() * Math.PI;
    }
  }

  update(dt: number) {
    for (let i = this.live - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) { this.remove(i); continue; }
      p.vel.y -= 9 * dt;
      p.vel.multiplyScalar(Math.exp(-dt * 2.5));
      p.pos.addScaledVector(p.vel, dt);
    }
    for (let i = 0; i < this.live; i++) {
      const p = this.items[i];
      const k = p.life / p.maxLife;
      const speed = p.vel.length();
      this.dir.copy(p.vel).multiplyScalar(-1 / Math.max(speed, 1e-4)); // cauda para trás
      this.q.setFromUnitVectors(this.fwd, this.dir);
      const w = 0.009 * (0.4 + k * 0.6);
      this.m.compose(p.pos, this.q, this.s.set(w, w, Math.max(0.01, speed * 0.028 * k)));
      this.sparks.setMatrixAt(i, this.m);
      this.sparks.setColorAt(i, p.color);
    }
    this.sparks.count = this.live;
    this.sparks.visible = this.live > 0;
    this.sparks.instanceMatrix.needsUpdate = true;
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;

    for (let i = this.livePops - 1; i >= 0; i--) {
      const pop = this.popItems[i];
      pop.life -= dt;
      if (pop.life <= 0) this.removePop(i);
    }
    for (let i = 0; i < this.livePops; i++) {
      const pop = this.popItems[i];
      const k = 1 - pop.life / POP_LIFE;
      this.q.setFromUnitVectors(this.fwd, pop.normal).multiply(this.spinQ.setFromAxisAngle(this.fwd, pop.spin + k * 0.6));
      this.m.compose(pop.pos, this.q, this.s.setScalar(pop.size * (0.6 + k * 0.8)));
      this.pops.setMatrixAt(i, this.m);
    }
    this.pops.count = this.livePops;
    this.pops.visible = this.livePops > 0;
    this.pops.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.live = this.livePops = 0;
    this.sparks.count = this.pops.count = 0;
    this.sparks.visible = this.pops.visible = false;
  }

  dispose() {
    this.clear();
    for (const mesh of [this.sparks, this.pops]) {
      mesh.removeFromParent();
      mesh.dispose();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  private remove(i: number) {
    const last = --this.live;
    [this.items[i], this.items[last]] = [this.items[last], this.items[i]];
  }

  private removePop(i: number) {
    const last = --this.livePops;
    [this.popItems[i], this.popItems[last]] = [this.popItems[last], this.popItems[i]];
  }
}
