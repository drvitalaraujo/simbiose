import * as THREE from 'three';
import { Casings, Tracers } from './effects';
import { MuzzleFlash } from './flash';
import { updateVmUniforms, VM_FOV, vmUniforms } from './material';
import { buildViewmodel, type ViewmodelModel } from './model';
import { type MotionInput, ViewmodelMotion } from './motion';
import { EJECT_DELAY } from './reload-pose';
import { Smoke } from '../smoke';
import { hipAimRotation } from './alignment';

// Arma + mãos em primeira pessoa: modelo (model.ts), animação procedural (motion.ts) e os
// efeitos do disparo (flash.ts, effects.ts). Só visual: reage aos eventos da simulação.

/** Onde fica o gatilho em relação à câmera, parado (metros). */
const REST = new THREE.Vector3(0.19, -0.218, -0.65);
const REST_ROLL = -0.05;
const CM = 0.01;
/** Calor do cano por tiro; acima de 1 o cano solta fiapos de fumaça. */
const HEAT_PER_SHOT = [0.11, 0.08, 0.7, 0.45];

interface PendingEject {
  delay: number;
}

export class Viewmodel {
  model: ViewmodelModel;
  private weaponIndex = 0;
  private aimAmount = 0;
  readonly motion = new ViewmodelMotion();
  /** Pose de descanso (ajustável no console em `?debug`). */
  readonly restPos = REST.clone();
  readonly restRot = new THREE.Euler(0, 0, REST_ROLL, 'YXZ');
  /** Altura do chão sob um ponto (cápsulas quicam nele); sem cenário, 1,5 m abaixo. */
  floorAt: (x: number, y: number, z: number) => number = (_x, y) => y - 1.5;
  private flash: MuzzleFlash;
  private readonly tracers: Tracers;
  readonly casings: Casings;
  readonly smoke: Smoke;
  private pendingShots = 0;
  private readonly smokeDirection = new THREE.Vector3();
  private readonly rest: { bolt: THREE.Vector3; mag: THREE.Vector3; hand: THREE.Vector3 };
  /** Disparos do tick, resolvidos no quadro (com a câmera já no lugar). */
  private readonly pending: THREE.Vector3[] = [];
  private pendingCount = 0;
  private readonly ejects: PendingEject[] = [];
  private heat = 0;
  private wispIn = 0;
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.model = buildViewmodel();
    this.alignRest();
    const m = this.model;
    this.rest = { bolt: m.bolt.position.clone(), mag: m.mag.position.clone(), hand: m.hand.position.clone() };
    this.flash = new MuzzleFlash(m.muzzle, 0);
    this.tracers = new Tracers(scene);
    this.casings = new Casings(scene);
    this.smoke = new Smoke(scene, 32);
    camera.add(m.root);
  }

  /** Um disparo: coice, ferrolho, clarão; rastro até `end` e cápsula saem no próximo quadro. */
  shot(end: THREE.Vector3) {
    this.pendingShots++;
    const i = this.weaponIndex;
    this.motion.shot(i === 1 ? 0.7 : i === 2 ? 2.15 : i === 3 ? 1.5 : 1);
    this.flash.fire();
    if (this.pendingCount >= this.pending.length) this.pending.push(new THREE.Vector3());
    this.pending[this.pendingCount++].copy(end);
    if (this.ejects.length < 8) this.ejects.push({ delay: EJECT_DELAY[i] ?? 0 });
    this.heat = Math.min(2.2, this.heat + (HEAT_PER_SHOT[i] ?? 0.1));
  }

  /** Projétil adicional da escopeta: só rastro, sem repetir coice ou cápsula. */
  pellet(end: THREE.Vector3) {
    if (this.pendingCount >= this.pending.length) this.pending.push(new THREE.Vector3());
    this.pending[this.pendingCount++].copy(end);
  }

  setWeapon(index: number) {
    if (index === this.weaponIndex) return;
    this.reset();
    this.disposeModel();
    this.model = buildViewmodel(index);
    this.weaponIndex = index;
    this.alignRest();
    this.motion.equip();
    this.camera.add(this.model.root);
    this.flash = new MuzzleFlash(this.model.muzzle, index);
    this.rest.bolt.copy(this.model.bolt.position);
    this.rest.mag.copy(this.model.mag.position);
    this.rest.hand.copy(this.model.hand.position);
  }

  private disposeModel() {
    this.flash.dispose();
    const skeletons = new Set(this.model.meshes.filter((mesh): mesh is THREE.SkinnedMesh => mesh instanceof THREE.SkinnedMesh).map(mesh => mesh.skeleton));
    for (const skeleton of skeletons) skeleton.dispose();
    this.camera.remove(this.model.root);
    for (const mesh of this.model.meshes) {
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(m => m.dispose());
    }
  }

  /** Libera também variantes de clarão que não estão anexadas à cena. */
  dispose() {
    this.reset();
    this.disposeModel();
    this.tracers.dispose();
    this.casings.dispose();
    this.smoke.dispose();
  }

  /** Prévia isolada da recarga; no jogo a pose lê o relógio da simulação. */
  reload() {
    this.motion.reload();
  }

  /** Descanso imediato: pose, efeitos e disparos pendentes (renascer, teleporte). */
  reset() {
    this.aimAmount = 0;
    this.motion.reset();
    this.pendingCount = 0;
    this.pendingShots = 0;
    this.ejects.length = 0;
    this.heat = 0;
    this.wispIn = 0;
    this.flash.reset();
    this.tracers.clear();
    this.casings.clear();
    this.smoke.clear();
    this.applyPose();
  }

  /**
   * Por quadro, DEPOIS de posicionar a câmera (dt = 0 congela no hit-stop). `velocity` é a
   * do jogador no mundo, para a cápsula herdar o movimento.
   */
  update(dt: number, input: MotionInput) {
    this.aimAmount = input.aimAmount ?? 0;
    updateVmUniforms(this.camera);
    this.motion.update(dt, { ...input, weaponIndex: this.weaponIndex });
    this.applyPose();

    this.smokeDirection.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (let i = 0; i < this.pendingShots; i++) {
      this.smoke.emit(this.muzzleWorld(this.v), this.smokeDirection, false, this.weaponIndex >= 2 ? 1.35 : 1);
    }
    this.pendingShots = 0;

    for (let i = 0; i < this.pendingCount; i++) this.tracers.spawn(this.muzzleWorld(this.v), this.pending[i], this.weaponIndex);
    this.pendingCount = 0;

    // Cápsulas saem no tempo do ciclo da arma (na hora, no recuo do ferrolho ou da telha)
    for (let i = this.ejects.length - 1; i >= 0; i--) {
      const e = this.ejects[i];
      e.delay -= dt;
      if (e.delay > 0) continue;
      this.ejects.splice(i, 1);
      this.eject(input);
    }

    // Cano quente: depois de rajadas (ou de um tiro pesado) solta fiapos de fumaça
    if (dt > 0) {
      this.heat = Math.max(0, this.heat - dt * 0.55);
      this.wispIn -= dt;
      if (this.heat > 0.6 && this.wispIn <= 0 && this.aimAmount < 0.5) {
        this.wispIn = 0.09 + Math.random() * 0.06;
        this.smoke.wisp(this.muzzleWorld(this.v));
      }
    }

    this.flash.update(dt);
    this.tracers.update(dt);
    this.casings.update(dt);
    this.smoke.update(dt, this.camera);
  }

  private eject(input: MotionInput) {
    const port = this.apparent(this.model.ejectPort, this.w);
    const side = Math.sign(this.model.layout.ejectPort[0]) || 1;
    const heavy = this.weaponIndex >= 2;
    const vel = this.v.set(side * (1.6 + Math.random() * 0.6), 1.5 + Math.random() * 0.7, heavy ? 0.1 : 0.4).applyQuaternion(this.camera.quaternion);
    vel.x += input.vx;
    vel.y += input.vy * 0.5;
    vel.z += input.vz;
    this.casings.eject(port, vel, this.weaponIndex, this.floorAt(port.x, port.y, port.z));
  }

  /** Recalcula o descanso com o eixo do cano do modelo equipado. */
  private alignRest() {
    const r = hipAimRotation(this.restPos, this.model.muzzle.position.y, REST_ROLL);
    this.restRot.set(r.x, r.y, r.z, 'YXZ');
  }

  /** Aplica a pose atual da animação no modelo (raiz e ossos). */
  private applyPose() {
    const pose = this.motion.pose;
    const m = this.model;
    const L = m.layout;
    const a = this.aimAmount;
    const sway = 1 - a * 0.85;
    const sight = m.sight.position;
    // Mirando, o centro óptico fica a `aimDistance` do olho: a coronha sai pela base da tela
    const aimZ = -L.aimDistance - sight.z;
    m.root.position.set(this.restPos.x * (1 - a) - sight.x * a + pose.x * sway,
      this.restPos.y * (1 - a) - sight.y * a + pose.y * sway, this.restPos.z * (1 - a) + aimZ * a + pose.z);
    const r = this.restRot;
    m.root.rotation.set(r.x * (1 - a) + pose.rx, r.y * (1 - a) + pose.ry * sway, r.z * (1 - a) + pose.rz * sway, 'YXZ');
    m.bolt.position.copy(this.rest.bolt).z += pose.bolt * L.boltTravel * CM;
    m.bolt.rotation.z = pose.boltLift * L.boltLift;
    m.mag.position.set(this.rest.mag.x, this.rest.mag.y + pose.magY, this.rest.mag.z + pose.magZ);
    m.mag.rotation.x = pose.magRx;
    m.hand.position.set(this.rest.hand.x + pose.handX, this.rest.hand.y + pose.handY, this.rest.hand.z + pose.handZ + pose.pump * 0.075);
    m.pump.position.z = pose.pump * 0.075;
    vmUniforms.vmCell.value = 0.25 + 0.75 * pose.cell;
    vmUniforms.vmAim.value = a * a * (3 - 2 * a);
    m.root.updateMatrixWorld(true);
  }

  /**
   * Boca da arma no mundo, no ponto em que ela APARECE na tela (o viewmodel usa outro FOV):
   * origem do rastro e do feixe de hack.
   */
  muzzleWorld(out = new THREE.Vector3()): THREE.Vector3 {
    return this.apparent(this.model.muzzle, out);
  }

  /** Converte um ponto do viewmodel para o ponto do mundo que cai no mesmo pixel. */
  private apparent(o: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
    o.updateWorldMatrix(true, false); // atualiza a câmera junto (pais)
    o.getWorldPosition(out);
    this.camera.worldToLocal(out);
    const k = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(VM_FOV / 2));
    out.x *= k;
    out.y *= k;
    return this.camera.localToWorld(out);
  }
}
