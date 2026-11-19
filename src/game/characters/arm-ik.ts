import * as THREE from 'three';

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const dir = new THREE.Vector3(), bend = new THREE.Vector3(), elbow = new THREE.Vector3();
const current = new THREE.Vector3(), wanted = new THREE.Vector3();
const parentQ = new THREE.Quaternion(), worldQ = new THREE.Quaternion(), delta = new THREE.Quaternion();

/** Leva um osso até a direção desejada sem alterar comprimento nem posição da articulação. */
function point(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
  bone.getWorldPosition(a);
  child.getWorldPosition(b);
  current.copy(b).sub(a).normalize();
  wanted.copy(target).sub(a).normalize();
  delta.setFromUnitVectors(current, wanted);
  bone.getWorldQuaternion(worldQ);
  bone.parent!.getWorldQuaternion(parentQ).invert();
  bone.quaternion.copy(parentQ.multiply(delta).multiply(worldQ));
  bone.updateWorldMatrix(false, true);
}

/**
 * Mão de apoio acompanha o guarda-mão; cotovelo conserva o lado da pose animada, ou vai para
 * o lado de `pole` (direção de mundo para onde o cotovelo deve apontar) quando informado.
 */
export function supportHand(upper: THREE.Object3D, fore: THREE.Object3D, hand: THREE.Object3D, target: THREE.Vector3, pole?: THREE.Vector3) {
  upper.getWorldPosition(a);
  fore.getWorldPosition(b);
  hand.getWorldPosition(c);
  const upperLength = a.distanceTo(b), foreLength = b.distanceTo(c);
  dir.copy(target).sub(a);
  const distance = THREE.MathUtils.clamp(dir.length(), Math.abs(upperLength - foreLength) + 0.001, upperLength + foreLength - 0.001);
  dir.normalize();
  if (pole) bend.copy(pole);
  else bend.copy(b).sub(a);
  bend.addScaledVector(dir, -bend.dot(dir));
  if (bend.lengthSq() < 1e-8) bend.set(0, -1, 0).addScaledVector(dir, dir.y);
  bend.normalize();
  const along = (upperLength ** 2 + distance ** 2 - foreLength ** 2) / (2 * distance);
  elbow.copy(a).addScaledVector(dir, along).addScaledVector(bend, Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)));
  point(upper, fore, elbow);
  point(fore, hand, target);
}
