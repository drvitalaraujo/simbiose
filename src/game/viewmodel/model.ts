import * as THREE from 'three';
import { vmGlow, vmLens, vmToon } from './material';
import { PartList, type Vec } from './parts';
import { leftHand, rightHand, type Handguard } from './hands';
import { rifleBody } from './rifle-model';
import { smgBody } from './smg-model';
import { sniperBody } from './sniper-model';
import { shotgunBody } from './shotgun-model';

// Armas originais da Resistência e luvas, modeladas em centímetros.
// +y acima, -z na direção do cano; três meshes mesclados (toon, brilho e vidro).
// Os ossos rígidos animam ferrolho, carregador, mão e telha sem multiplicar draw calls.

export const BONE = { gun: 0, bolt: 1, mag: 2, hand: 3, pump: 4 } as const;

/** Pontos de referência de cada arma (cm), devolvidos pelo construtor do corpo. */
export interface WeaponLayout {
  handguard: Handguard;
  muzzle: Vec;
  /** Centro óptico (ou linha da mira aberta), para centralizar ao mirar. */
  sight: Vec;
  ejectPort: Vec;
  /** Pivôs dos ossos do ferrolho e do carregador. */
  bolt: Vec;
  mag: Vec;
  /** Quanto o ferrolho corre para trás (cm) e quanto a alavanca gira (rad). */
  boltTravel: number;
  boltLift: number;
  /** Distância do olho ao centro óptico ao mirar (m): a coronha sai pela base da tela. */
  aimDistance: number;
}

export interface ViewmodelModel {
  /** Raiz que a animação move (filha da câmera). */
  root: THREE.Group;
  gun: THREE.Bone;
  bolt: THREE.Bone;
  mag: THREE.Bone;
  hand: THREE.Bone;
  pump: THREE.Bone;
  /** Ponta do cano (filho do osso da arma). */
  muzzle: THREE.Object3D;
  /** Centro óptico (ou linha da mira aberta), para centralizar ao mirar. */
  sight: THREE.Object3D;
  /** Janela de ejeção (lado direito). */
  ejectPort: THREE.Object3D;
  layout: WeaponLayout;
  meshes: THREE.Mesh[];
}

const CM = 0.01;
const BODIES = [rifleBody, smgBody, sniperBody, shotgunBody];

export function buildViewmodel(weaponIndex = 0): ViewmodelModel {
  const parts = new PartList(CM);
  const layout = (BODIES[weaponIndex] ?? rifleBody)(parts);
  rightHand(parts, BONE.gun);
  leftHand(parts, BONE.hand, layout.handguard);
  const { toon, glow, lens } = parts.build();

  const root = new THREE.Group();
  root.name = 'viewmodel';
  const gun = new THREE.Bone();
  const boltBone = new THREE.Bone();
  const mag = new THREE.Bone();
  const hand = new THREE.Bone();
  const pump = new THREE.Bone();
  const m = (v: Vec) => new THREE.Vector3(...v).multiplyScalar(CM);
  boltBone.position.copy(m(layout.bolt));
  mag.position.copy(m(layout.mag));
  hand.position.copy(m([0, layout.handguard.bottom, layout.handguard.z]));
  gun.add(boltBone, mag, hand, pump);

  const body = new THREE.SkinnedMesh(toon, vmToon());
  const shine = new THREE.SkinnedMesh(glow, vmGlow(BONE.mag));
  body.add(gun);
  root.add(body, shine);
  const meshes: THREE.Mesh[] = [body, shine];
  if (lens) {
    const glassMesh = new THREE.SkinnedMesh(lens, vmLens());
    glassMesh.renderOrder = 10; // vidro aditivo por cima da arma e do cenário
    root.add(glassMesh);
    meshes.push(glassMesh);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([gun, boltBone, mag, hand, pump]);
  body.bind(skeleton);
  for (const mesh of meshes.slice(1)) (mesh as THREE.SkinnedMesh).bind(skeleton, body.matrixWorld);

  const muzzle = new THREE.Object3D();
  muzzle.position.copy(m(layout.muzzle));
  const ejectPort = new THREE.Object3D();
  ejectPort.position.copy(m(layout.ejectPort));
  const sight = new THREE.Object3D();
  sight.position.copy(m(layout.sight));
  gun.add(muzzle, ejectPort, sight);

  for (const mesh of meshes) {
    mesh.frustumCulled = false; // sempre na frente da câmera
    mesh.raycast = () => {}; // decorativo: nunca bloqueia tiro
    // Desenha ANTES do cenário: a arma está sempre na frente, então o que fica atrás
    // dela é descartado pelo teste de profundidade (sem pintar pixel duas vezes)
    if (mesh.renderOrder === 0) mesh.renderOrder = -10;
  }
  return { root, gun, bolt: boltBone, mag, hand, pump, muzzle, sight, ejectPort, layout, meshes };
}
