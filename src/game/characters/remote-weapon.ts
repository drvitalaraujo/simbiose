import * as THREE from 'three';
import { GLOW, PALETTE, toonVertexColors } from '../toon';
import { PartList } from '../viewmodel/parts';
import { arsenalBody } from '../viewmodel/arsenal-model';
import { validWeaponIndex } from '../../sim/weapons';

const cache = new Map<number, { toon: THREE.BufferGeometry; glow: THREE.BufferGeometry; muzzle: THREE.Vector3 }>();
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
const flashGeometry = new THREE.OctahedronGeometry(1, 0);
const flashMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.yellow).multiplyScalar(GLOW), transparent: true, depthWrite: false });
const emptyGeometry = new THREE.BufferGeometry();

/** Geometria das armas existentes, sem mãos extras nem shader de primeira pessoa. */
export class RemoteWeapon {
  readonly root = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  private readonly body = new THREE.Mesh(emptyGeometry, toonVertexColors());
  private readonly glow = new THREE.Mesh(emptyGeometry, glowMaterial);
  private readonly flash = new THREE.Mesh(flashGeometry, flashMaterial);
  private flashLeft = 0;
  private fresh = false;
  private index = -1;

  constructor() {
    this.root.name = 'remote-weapon';
    this.root.add(this.body, this.glow, this.muzzle);
    this.muzzle.add(this.flash);
    this.flash.visible = false;
    this.root.traverse(o => { o.raycast = () => {}; });
    this.equip(0);
  }

  equip(index: number) {
    index = validWeaponIndex(index) ? index : 0;
    if (index === this.index) return;
    this.index = index;
    let geo = cache.get(index);
    if (!geo) {
      const parts = new PartList(0.01);
      const layout = arsenalBody(parts, index);
      const { toon, glow, lens } = parts.build();
      lens?.dispose(); // terceira pessoa não desenha o vidro da óptica
      geo = { toon, glow, muzzle: new THREE.Vector3(...layout.muzzle).multiplyScalar(0.01) };
      cache.set(index, geo);
    }
    this.body.geometry = geo.toon;
    this.glow.geometry = geo.glow;
    this.muzzle.position.copy(geo.muzzle);
    this.flash.scale.set(0.085, 0.085, index >= 2 ? 0.24 : 0.16);
    this.flash.position.z = -this.flash.scale.z * 0.5;
  }

  fire(index: number) {
    this.equip(index);
    this.flashLeft = 0.065;
    this.fresh = true;
    this.flash.visible = true;
    this.flash.rotation.z += 1.7;
  }

  update(dt: number, dead: boolean) {
    this.root.visible = !dead;
    // Garante um quadro de clarão mesmo se a mensagem chegar antes de um quadro lento.
    if (!this.fresh) this.flashLeft = Math.max(0, this.flashLeft - dt);
    this.fresh = false;
    if (dead) this.flashLeft = 0;
    this.flash.visible = this.flashLeft > 0;
  }

  muzzleWorld(target = new THREE.Vector3()) { return this.muzzle.getWorldPosition(target); }
  dispose() { this.root.removeFromParent(); } // geometrias/materiais em cache, compartilhados
}
