import * as THREE from 'three';
import { GLOW, PALETTE, toonVertexColors } from '../toon';

// Efeitos do disparo no mundo, todos reaproveitados (nada é criado por tiro):
//  - rastro: faixa em cruz que encolhe da boca até o impacto, com cor/espessura por arma;
//  - cápsulas ejetadas: latão (e cartucho vinho da escopeta) com quique no chão.
// O clarão de boca mora em flash.ts.

const glow = (c: number, k = GLOW) => new THREE.Color(c).multiplyScalar(k);

/** Rastro por arma: cor, espessura (m), vida (s). */
const TRACER_STYLE = [
  { color: glow(PALETTE.yellow), width: 0.018, life: 0.07 },
  { color: glow(PALETTE.sky, 2.6), width: 0.012, life: 0.055 },
  { color: glow(PALETTE.paper, 2.6), width: 0.03, life: 0.16 },
  { color: glow(PALETTE.orange), width: 0.011, life: 0.06 },
];

/** Faixa em cruz de comprimento 1 ao longo de +z (afina na boca da arma). */
function tracerGeometry(): THREE.BufferGeometry {
  const p: number[] = [];
  const w0 = 0.35;
  for (const [ax, ay] of [[1, 0], [0, 1]]) {
    const a = [-ax * w0, -ay * w0, 0];
    const b = [ax * w0, ay * w0, 0];
    const c = [ax, ay, 1];
    const d = [-ax, -ay, 1];
    p.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}

interface Tracer {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  maxLife: number;
  width: number;
}

/** Rastros de tiro em pool fixo (a escopeta usa vários de uma vez). */
export class Tracers {
  private readonly pool: Tracer[] = [];
  private next = 0;
  private readonly tmp = new THREE.Vector3();

  dispose() {
    this.pool[0]?.mesh.geometry.dispose();
    for (const t of this.pool) {
      t.mesh.removeFromParent();
      t.mat.dispose();
    }
  }

  constructor(scene: THREE.Scene, size = 12) {
    const geo = tracerGeometry();
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: TRACER_STYLE[0].color, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      scene.add(mesh);
      this.pool.push({ mesh, mat, from: new THREE.Vector3(), to: new THREE.Vector3(), life: 0, maxLife: 1, width: 0.018 });
    }
  }

  spawn(from: THREE.Vector3, to: THREE.Vector3, weaponIndex = 0) {
    const style = TRACER_STYLE[weaponIndex] ?? TRACER_STYLE[0];
    const t = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    t.from.copy(from);
    t.to.copy(to);
    t.maxLife = t.life = style.life * (0.85 + Math.random() * 0.3);
    t.width = style.width;
    t.mat.color.copy(style.color);
    t.mesh.visible = true;
    this.place(t, 0);
  }

  clear() {
    for (const t of this.pool) t.mesh.visible = false;
  }

  update(dt: number) {
    for (const t of this.pool) {
      if (!t.mesh.visible) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.mesh.visible = false;
        continue;
      }
      this.place(t, 1 - t.life / t.maxLife);
    }
  }

  /** k de 0 a 1: a cauda corre da boca até o impacto e a faixa afina e some. */
  private place(t: Tracer, k: number) {
    const tail = this.tmp.copy(t.from).lerp(t.to, k * k * 0.85);
    const len = tail.distanceTo(t.to);
    t.mesh.position.copy(tail);
    t.mesh.lookAt(t.to);
    const w = t.width * (1 - k * 0.6);
    t.mesh.scale.set(w, w, Math.max(len, 1e-3));
    t.mat.opacity = 1 - k * k;
  }
}

interface Casing {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  life: number;
  floor: number;
  size: number;
  bounces: number;
}

const CASING_LIFE = 1.4;
const GRAVITY = 13;

/** Cilindro com faixas de cor por vértice (latão + base, ou cartucho + base de latão). */
function shellGeometry(radius: number, length: number, body: number, base: number, baseLength: number): THREE.BufferGeometry {
  const parts: [number, number, number][] = [[body, length - baseLength, (baseLength) / 2], [base, baseLength, -(length - baseLength) / 2]];
  const geos = parts.map(([color, len, y]) => {
    const g = new THREE.CylinderGeometry(radius, radius * (color === base ? 1.08 : 1), len, 7, 1).toNonIndexed();
    g.translate(0, y, 0);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    return g;
  });
  const pos = geos.flatMap(g => [...(g.attributes.position.array as Float32Array)]);
  const nor = geos.flatMap(g => [...(g.attributes.normal.array as Float32Array)]);
  const col = geos.flatMap(g => [...(g.attributes.color.array as Float32Array)]);
  for (const g of geos) g.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Um tipo de cápsula (pool + InstancedMesh, 1 draw call quando há alguma no ar/chão). */
class CasingPool {
  readonly mesh: THREE.InstancedMesh;
  private readonly items: Casing[] = [];
  private live = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();

  constructor(scene: THREE.Scene, geo: THREE.BufferGeometry, size: number) {
    this.mesh = new THREE.InstancedMesh(geo, toonVertexColors(), size);
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < size; i++) {
      this.items.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0, floor: -1e9, size: 1, bounces: 0 });
    }
    scene.add(this.mesh);
  }

  eject(at: THREE.Vector3, vel: THREE.Vector3, floor: number, size: number) {
    if (this.live >= this.items.length) this.remove(0); // a mais velha dá lugar
    const c = this.items[this.live++];
    c.pos.copy(at);
    c.vel.copy(vel);
    c.rot.set(Math.random() * 3, Math.random() * 3, 0);
    c.spin.set(18 + Math.random() * 10, 10 * (Math.random() - 0.5), 14);
    c.life = CASING_LIFE;
    c.floor = floor;
    c.size = size;
    c.bounces = 0;
  }

  update(dt: number) {
    for (let i = this.live - 1; i >= 0; i--) {
      const c = this.items[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.remove(i);
        continue;
      }
      c.vel.y -= GRAVITY * dt;
      c.pos.addScaledVector(c.vel, dt);
      // Quique no chão: perde energia, gira menos e deita (rola) depois do 2º toque
      const ground = c.floor + 0.006 * c.size;
      if (c.pos.y < ground && c.vel.y < 0) {
        c.pos.y = ground;
        c.bounces++;
        c.vel.y = c.bounces < 3 ? -c.vel.y * 0.38 : 0;
        c.vel.x *= 0.55;
        c.vel.z *= 0.55;
        c.spin.multiplyScalar(0.45);
        if (c.bounces >= 2) c.rot.x = Math.PI / 2;
      }
      if (c.pos.y <= ground + 1e-4 && c.bounces >= 3) {
        c.vel.multiplyScalar(Math.exp(-dt * 6));
        c.spin.multiplyScalar(Math.exp(-dt * 8));
      }
      c.rot.x += c.spin.x * dt;
      c.rot.y += c.spin.y * dt;
      c.rot.z += c.spin.z * dt;
    }
    for (let i = 0; i < this.live; i++) {
      const c = this.items[i];
      const k = Math.min(1, c.life / 0.25) * c.size; // encolhe no fim
      this.m.compose(c.pos, this.q.setFromEuler(c.rot), this.s.setScalar(k));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = this.live;
    this.mesh.visible = this.live > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.live = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  /** Troca com a última viva (a ordem não importa). */
  private remove(i: number) {
    const last = this.live - 1;
    const tmp = this.items[i];
    this.items[i] = this.items[last];
    this.items[last] = tmp;
    this.live--;
  }
}

/** Cápsulas ejetadas: latão (fuzil, SMG, sniper maior) e cartucho vinho da escopeta. */
export class Casings {
  private readonly brass: CasingPool;
  private readonly shells: CasingPool;

  constructor(scene: THREE.Scene, size = 14) {
    this.brass = new CasingPool(scene, shellGeometry(0.0055, 0.024, PALETTE.ochre, PALETTE.yellow, 0.005), size);
    this.shells = new CasingPool(scene, shellGeometry(0.0105, 0.032, PALETTE.wine, PALETTE.ochre, 0.01), 6);
  }

  get meshes() {
    return [this.brass.mesh, this.shells.mesh];
  }

  dispose() {
    this.clear();
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.dispose();
      mesh.geometry.dispose();
      // toonVertexColors é compartilhado com o cenário e os chinelos.
    }
  }

  /** Ejeta em `at` com velocidade `vel` (já com a do jogador); quica em `floor` (y). */
  eject(at: THREE.Vector3, vel: THREE.Vector3, weaponIndex: number, floor: number) {
    if (weaponIndex === 3) this.shells.eject(at, vel, floor, 1);
    else this.brass.eject(at, vel, floor, weaponIndex === 2 ? 1.6 : weaponIndex === 1 ? 0.85 : 1);
  }

  update(dt: number) {
    this.brass.update(dt);
    this.shells.update(dt);
  }

  clear() {
    this.brass.clear();
    this.shells.clear();
  }
}
