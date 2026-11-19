import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { supportHand } from './arm-ik';
import type { CharacterAsset } from './model';
import { lowReady, recoilFeel, reloadEnvelope } from './motion';
import type { RemoteWeapon } from './remote-weapon';

// Empunhadura de fuzil em 3ª pessoa: a arma é posta no mundo (coronha no ombro direito, cano
// na direção da mira) e os dois braços vão até ela por IK — mão direita no punho, esquerda no
// guarda-mão. O clipe de pistola do asset só dá os dedos; posição e giro das mãos vêm daqui.

/** Pontos de cada arma, em metros no espaço do modelo (antes da escala), ordem do `ARSENAL`. */
// `support` é o pulso esquerdo: à esquerda e abaixo do guarda-mão, com a palma por baixo.
const POINTS = [
  { butt: [0, 0.025, 0.26], support: [-0.04, -0.005, -0.22], mag: [-0.03, -0.09, -0.04] },
  { butt: [0, 0.025, 0.21], support: [-0.045, 0, -0.15], mag: [-0.03, -0.1, -0.05] },
  { butt: [0, 0.025, 0.25], support: [-0.04, -0.005, -0.2], mag: [-0.03, -0.06, -0.05] },
  { butt: [0, 0.025, 0.25], support: [-0.045, -0.015, -0.19], mag: [-0.035, -0.01, -0.03] },
] as const;

/** Onde a mão de apoio segura a arma (espaço do modelo da arma, antes da escala). */
export function supportPoint(index: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.fromArray((POINTS[index] ?? POINTS[0]).support);
}

/** Pulso da mão direita no espaço da arma (o punho fica 4 cm abaixo e 6 cm atrás da origem). */
const WRIST = new THREE.Vector3(0, -0.04, 0.06);

const _aim = new THREE.Quaternion();
const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _parent = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _pocket = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _mi = new THREE.Matrix4();
const _s = new THREE.Vector3();

export interface GunRigInput {
  yaw: number;
  pitch: number;
  weaponIndex: number;
  speed: number;
  /** Progresso da recarga (0 → 1) ou negativo fora dela. */
  reload: number;
  /** Segundos desde o último disparo. */
  sinceShot: number;
  /** Envelope do coice (1 no disparo, decai até 0). */
  recoil: number;
  /** Quedas e trancos do corpo somados (rad, cano desce). */
  dip: number;
}

export class GunRig {
  private readonly right: THREE.Object3D[];
  private readonly left: THREE.Object3D[];
  private readonly shoulderR: THREE.Object3D | null;
  private readonly chest: THREE.Object3D | null;
  private readonly rightRel: THREE.Quaternion;
  private readonly leftRel: THREE.Quaternion;
  readonly ok: boolean;

  constructor(model: THREE.Object3D, asset: CharacterAsset, private readonly weapon: RemoteWeapon) {
    const get = (n: string) => model.getObjectByName(n) ?? null;
    this.right = ['DEF-upper_armR', 'DEF-forearmR', 'DEF-handR'].map(get).filter(Boolean) as THREE.Object3D[];
    this.left = ['DEF-upper_armL', 'DEF-forearmL', 'DEF-handL'].map(get).filter(Boolean) as THREE.Object3D[];
    this.shoulderR = get('DEF-upper_armR');
    this.chest = get('DEF-spine003');
    const { right, left } = handFrames(asset);
    this.rightRel = right;
    this.leftRel = left;
    this.ok = this.right.length === 3 && this.left.length === 3 && !!this.shoulderR && !!this.chest;
  }

  /** `body` = rotação de mundo do grupo do boneco (antes do giro das pernas). */
  update(body: THREE.Quaternion, i: GunRigInput): void {
    const gun = this.weapon.root;
    if (!this.ok || !gun.parent) return;
    const pts = POINTS[i.weaponIndex] ?? POINTS[0];
    const feel = recoilFeel(i.weaponIndex);
    const reload = i.reload >= 0 ? reloadEnvelope(i.reload) : { lower: 0, mag: 0, drop: 0 };
    const low = i.reload >= 0 ? 0 : lowReady(i.speed, i.sinceShot);

    // Direção da mira em mundo, e a mesma sem o pitch (para os deslocamentos do corpo)
    _aim.copy(body).multiply(_q.setFromEuler(_e.set(i.pitch, i.yaw, 0)));
    _qp.copy(body).multiply(_q.setFromEuler(_e.set(0, i.yaw, 0)));
    _right.set(1, 0, 0).applyQuaternion(_qp);
    _up.set(0, 1, 0).applyQuaternion(_qp);
    _fwd.set(0, 0, -1).applyQuaternion(_qp);

    // Bolso do ombro: um pouco para dentro, à frente e abaixo da articulação do ombro direito.
    // Na guarda baixa a coronha desce para o peito.
    this.shoulderR!.getWorldPosition(_pocket);
    // Ombro erguido: a linha de mira fica perto da altura do olho (leitura de "pronto para atirar").
    _pocket.addScaledVector(_right, -0.06 - low * 0.05)
      .addScaledVector(_fwd, 0.05 + low * 0.05)
      .addScaledVector(_up, 0.05 - low * 0.2 - reload.lower * 0.1);

    // Giro da arma: mira + coice (cano sobe) + guarda baixa/recarga (abaixa, cruza e tomba)
    const gunQ = _q.copy(_aim)
      .multiply(_qp.setFromEuler(_e.set(
        i.recoil * feel.rise - i.dip - low * 0.5 - reload.lower * 0.5,
        low * 0.55 + reload.lower * 0.25,
        reload.lower * 0.55 + low * 0.25,
      )));
    const scale = gun.scale.x;
    _v.fromArray(pts.butt).multiplyScalar(scale).applyQuaternion(gunQ);
    const pos = _w.copy(_pocket).sub(_v);
    // Coice: a arma corre para trás ao longo do cano
    pos.addScaledVector(_v.set(0, 0, 1).applyQuaternion(gunQ), i.recoil * feel.back);

    // Aplica no pai da arma (o grupo do boneco)
    gun.parent.updateWorldMatrix(true, false);
    _m.compose(pos, gunQ, _s.setScalar(scale)).premultiply(_mi.copy(gun.parent.matrixWorld).invert());
    _m.decompose(gun.position, gun.quaternion, gun.scale);
    gun.updateWorldMatrix(false, false);

    // Mão direita no punho; cotovelo para fora e para baixo
    gun.getWorldQuaternion(_qp);
    _pole.copy(_right).multiplyScalar(1).addScaledVector(_up, -0.45);
    gun.localToWorld(_v.copy(WRIST));
    supportHand(this.right[0], this.right[1], this.right[2], _v, _pole);
    setWorldQuaternion(this.right[2], _q.copy(_qp).multiply(this.rightRel));

    // Mão esquerda no guarda-mão (ou no carregador durante a recarga)
    _v.fromArray(pts.support);
    if (reload.mag > 0) {
      _w.fromArray(pts.mag);
      _v.lerp(_w, reload.mag);
      _v.y -= reload.drop * 0.14;
      _v.x += reload.drop * 0.03;
    }
    gun.localToWorld(_v);
    _pole.copy(_right).multiplyScalar(-0.5).addScaledVector(_up, -1);
    supportHand(this.left[0], this.left[1], this.left[2], _v, _pole);
    setWorldQuaternion(this.left[2], _q.copy(_qp).multiply(this.leftRel));
  }
}

function setWorldQuaternion(bone: THREE.Object3D, world: THREE.Quaternion) {
  // Não sobrescrever _qp: ele guarda a orientação da arma para as DUAS mãos.
  bone.parent!.getWorldQuaternion(_parent).invert();
  bone.quaternion.copy(_parent.multiply(world));
  bone.updateWorldMatrix(false, true);
}

const frames = new WeakMap<CharacterAsset, { right: THREE.Quaternion; left: THREE.Quaternion }>();

/**
 * Giro de cada mão relativo à arma, calibrado uma vez na pose de pistola do asset: a direita
 * segura o punho como no clipe; a esquerda (montada à mão) vira a palma para cima, sob o guarda-mão.
 */
function handFrames(asset: CharacterAsset) {
  let f = frames.get(asset);
  if (!f) {
    const root = clone(asset.scene);
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(asset.clips.get('Pistol_Aim_Neutral')!).play();
    mixer.update(0);
    root.updateMatrixWorld(true);
    const handR = root.getObjectByName('DEF-handR')!.getWorldQuaternion(new THREE.Quaternion());
    // Mesma convenção do `gripRotation`: a arma = mão × grip, com o cano para -Z do modelo
    const grip = handR.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    const gunQ = handR.clone().multiply(grip);
    const right = gunQ.clone().invert().multiply(handR);
    // Mão de apoio por baixo do guarda-mão: dedos (+Y do osso) vão à frente, cruzando um pouco
    // para a direita e subindo; o +X do osso aponta para baixo (palma para cima, berço da arma).
    const fingers = new THREE.Vector3(0.3, 0.4, -1).normalize();
    const down = new THREE.Vector3(0, -1, 0).addScaledVector(fingers, fingers.y).normalize();
    const left = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(down, fingers, new THREE.Vector3().crossVectors(down, fingers)));
    f = { right, left };
    frames.set(asset, f);
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
  }
  return f;
}
