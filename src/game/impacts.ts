import * as THREE from 'three';
import type { Box } from '../sim/physics';
import type { Vec3 } from '../sim/vec';
import { impactSurface, visibleImpact } from './impact-surface';
import { instanceFade, shotTexture } from './shot-textures';
import { Smoke } from './smoke';
import { toonWith } from './toon';
import { ImpactSparks } from './viewmodel/impact-sparks';

const LIFE = 45;
const FADE = 10;
interface Mark { matrix: THREE.Matrix4; age: number }

/** Faíscas, estouro e poeira por arma: MK-2, Faísca, Linha Morta, Quebra-Beco (por projétil). */
const IMPACT_FX = [
  { sparks: 7, speed: 5.5, pop: 0.11, dust: 1 },
  { sparks: 5, speed: 5, pop: 0.09, dust: 0.8 },
  { sparks: 14, speed: 7.5, pop: 0.2, dust: 1.6 },
  { sparks: 3, speed: 4.5, pop: 0.07, dust: 0.7 },
];

/**
 * Marcas cosméticas: 128 no máximo, 45 s de duração e substituição da mais antiga.
 * Cada impacto também solta faíscas, um estouro de anime e poeira; no chão (normal para
 * cima) a poeira é maior e as faíscas menos numerosas.
 */
export class Impacts {
  readonly mesh: THREE.InstancedMesh;
  readonly smoke: Smoke;
  readonly sparks: ImpactSparks;
  blockers: readonly Box[] = [];
  surfaces: readonly Box[] = [];
  private readonly marks: Mark[];
  private live = 0;
  private readonly opacity: THREE.InstancedBufferAttribute;
  private readonly texture = shotTexture('mark');
  private readonly transform = new THREE.Object3D();
  private readonly normal = new THREE.Vector3();
  private readonly forward = new THREE.Vector3(0, 0, 1);
  private readonly spin = new THREE.Quaternion();
  private readonly shot = new THREE.Vector3();

  constructor(scene: THREE.Scene, size = 128) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(size), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('instanceOpacity', this.opacity);
    const mat = toonWith({ color: 0xffffff, map: this.texture, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    instanceFade(mat);
    this.mesh = new THREE.InstancedMesh(geo, mat, size);
    this.mesh.name = 'bullet-marks';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.marks = Array.from({ length: size }, () => ({ matrix: new THREE.Matrix4(), age: 0 }));
    this.smoke = new Smoke(scene);
    this.sparks = new ImpactSparks(scene);
    scene.add(this.mesh);
  }

  add(point: Vec3, direction: Vec3, weaponIndex = 0) {
    const physical = impactSurface(point, direction, this.blockers, weaponIndex === 2 ? 0.085 : weaponIndex === 3 ? 0.045 : 0.065);
    if (!physical) return;
    const visual = visibleImpact(point, physical, this.surfaces);
    const surface = visual.surface;
    this.normal.set(surface.normal.x, surface.normal.y, surface.normal.z);
    this.transform.position.set(visual.point.x, visual.point.y, visual.point.z).addScaledVector(this.normal, 0.003);
    const fx = IMPACT_FX[weaponIndex] ?? IMPACT_FX[0];
    const floor = this.normal.y > 0.7;
    this.smoke.emit(this.transform.position, this.normal, true, fx.dust * (floor ? 1.5 : 1));
    this.shot.set(direction.x, direction.y, direction.z).normalize();
    this.sparks.burst(this.transform.position, this.normal, this.shot, floor ? Math.ceil(fx.sparks / 2) : fx.sparks, fx.speed, fx.pop);
    if (surface.radius < 0.008) return;
    if (this.live === this.marks.length) {
      // Preserva a ordem de chegada para substituir a mais antiga mesmo após expirar.
      const oldest = this.marks.shift()!;
      this.marks.push(oldest);
      this.live--;
    }
    const mark = this.marks[this.live++];
    this.transform.quaternion.setFromUnitVectors(this.forward, this.normal).multiply(this.spin.setFromAxisAngle(this.forward, Math.random() * Math.PI * 2));
    this.transform.scale.setScalar(surface.radius * 2);
    this.transform.updateMatrix();
    mark.matrix.copy(this.transform.matrix);
    mark.age = 0;
  }

  update(dt: number, camera: THREE.Camera) {
    for (let i = this.live - 1; i >= 0; i--) {
      const mark = this.marks[i];
      mark.age += dt;
      if (mark.age >= LIFE) {
        this.marks.splice(i, 1);
        this.marks.push(mark);
        this.live--;
      }
    }
    for (let i = 0; i < this.live; i++) {
      this.mesh.setMatrixAt(i, this.marks[i].matrix);
      this.opacity.setX(i, Math.min(1, (LIFE - this.marks[i].age) / FADE));
    }
    this.mesh.count = this.live;
    this.mesh.instanceMatrix.needsUpdate = this.opacity.needsUpdate = true;
    this.smoke.update(dt, camera);
    this.sparks.update(dt);
  }

  clear() { this.live = 0; this.mesh.count = 0; this.smoke.clear(); this.sparks.clear(); }

  dispose() {
    this.clear();
    this.smoke.dispose();
    this.sparks.dispose();
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}
