import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { Avatar } from './avatar';
import type { CharacterAsset } from './model';
import { SKIN_IDS } from './skins';
import { supportPoint } from './gun-rig';
import { WEAPON_SCALE } from './avatar';

// Boneco real (o mesmo GLB do jogo), carregado sem navegador.
let asset: CharacterAsset;

beforeAll(async () => {
  const buf = readFileSync('public/assets/characters/mannequin.glb');
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  asset = { scene: gltf.scene, clips: new Map(gltf.animations.map((c) => [c.name, c])) };
});

const skinned = (a: Avatar) => {
  const list: THREE.SkinnedMesh[] = [];
  a.root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) list.push(o as THREE.SkinnedMesh);
  });
  return list;
};

describe('Avatar com skin', () => {
  it('cano acompanha yaw/pitch inclusive dentro de um pai girado; mira não acumula', () => {
    const a = new Avatar(asset, 'enemy');
    const parent = new THREE.Group();
    parent.rotation.y = 1.2;
    parent.add(a.root);
    a.state.pitch = 0.6;
    a.state.yaw = -0.7;
    for (let i = 0; i < 90; i++) a.update(1 / 60);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(a.weapon.root.getWorldQuaternion(new THREE.Quaternion()));
    const expected = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0.6, 0.5, 0, 'YXZ'));
    expect(direction.distanceTo(expected)).toBeLessThan(1e-5);
    const bone = a.root.getObjectByName('DEF-shoulderR')!;
    const before = bone.quaternion.clone();
    for (let i = 0; i < 120; i++) a.update(1 / 60);
    expect(bone.quaternion.angleTo(before)).toBeLessThan(0.025);
    a.dispose();
  });

  it('tiro move o punho sem interromper a passada e deixa clarão num quadro lento', () => {
    const a = new Avatar(asset, 'enemy');
    const control = new Avatar(asset, 'enemy');
    a.state.vz = control.state.vz = -4;
    for (let i = 0; i < 60; i++) { a.update(1 / 60); control.update(1 / 60); }
    a.fire(0);
    for (let i = 0; i < 3; i++) { a.update(1 / 60); control.update(1 / 60); }
    const hand = (v: Avatar) => v.root.getObjectByName('DEF-handR')!.getWorldPosition(new THREE.Vector3());
    expect(hand(a).distanceTo(hand(control))).toBeGreaterThan(0.005);
    expect(a.pose).toBe('move');
    const leg = (v: Avatar) => v.root.getObjectByName('DEF-thighL')!.quaternion;
    expect(leg(a).angleTo(leg(control))).toBeLessThan(1e-5);
    a.fire(0);
    a.update(0.1);
    expect(a.weapon.muzzle.children[0].visible).toBe(true);
    a.update(0.1);
    expect(a.weapon.muzzle.children[0].visible).toBe(false);
    a.dispose(); control.dispose();
  });

  it('quatro armas válidas, recarga, morte e renascimento sem prender pose/clarão', () => {
    const a = new Avatar(asset, 'ally');
    const hand = a.root.getObjectByName('DEF-handR')!;
    for (let index = 0; index < 4; index++) {
      a.state.weaponIndex = index;
      a.update(0.1);
      a.weapon.root.traverse(o => {
        if ((o as THREE.Mesh).isMesh) expect((o as THREE.Mesh).geometry.getAttribute('position').count).toBeGreaterThan(0);
      });
    }
    const before = hand.getWorldPosition(new THREE.Vector3());
    a.state.reloadRemaining = 1;
    for (let i = 0; i < 20; i++) a.update(1 / 60);
    expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeGreaterThan(0.04);
    a.fire(3);
    a.state.dead = true;
    a.update(0.1);
    expect(a.weapon.root.visible).toBe(false);
    a.state.dead = false;
    a.state.reloadRemaining = 0;
    a.update(0.1);
    expect(a.weapon.root.visible).toBe(true);
    expect(a.weapon.muzzle.children[0].visible).toBe(false);
    a.dispose();
  });

  it('renascer correndo não herda disparo, dano ou aterrissagem da vida anterior', () => {
    const a = new Avatar(asset, 'enemy');
    const control = new Avatar(asset, 'enemy');
    a.state.vz = control.state.vz = -7;
    a.state.grounded = false;
    a.update(1 / 60);
    a.react('head');
    a.fire(0);
    a.state.dead = true;
    a.update(1 / 60);
    a.state.dead = false;
    a.state.grounded = true;
    a.update(1 / 60);
    control.update(1 / 60);
    expect(a.weapon.root.quaternion.angleTo(control.weapon.root.quaternion)).toBeLessThan(1e-5);
    a.dispose(); control.dispose();
  });

  it('rajada da SMG a 10 FPS ainda mostra coice em cada novo disparo', () => {
    const a = new Avatar(asset, 'enemy');
    const control = new Avatar(asset, 'enemy');
    a.state.weaponIndex = control.state.weaponIndex = 1;
    for (let i = 0; i < 60; i++) { a.update(1 / 60); control.update(1 / 60); }
    const hand = (v: Avatar) => v.root.getObjectByName('DEF-handR')!.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < 5; i++) {
      a.fire(1);
      a.update(0.1); control.update(0.1);
      expect(hand(a).distanceTo(hand(control))).toBeGreaterThan(0.005);
      expect(a.weapon.muzzle.children[0].visible).toBe(true);
    }
    a.dispose(); control.dispose();
  });

  it('mão de apoio alcança o guarda-mão na postura de combate', () => {
    const a = new Avatar(asset, 'enemy');
    for (let i = 0; i < 60; i++) a.update(1 / 60);
    const support = a.root.getObjectByName('DEF-handL')!.getWorldPosition(new THREE.Vector3());
    const grip = a.weapon.root.localToWorld(supportPoint(0));
    expect(support.distanceTo(grip)).toBeLessThan(0.02);
    // Coronha no ombro: a arma não fica mais "na frente do peito" com o braço esticado
    const shoulder = a.root.getObjectByName('DEF-upper_armR')!.getWorldPosition(new THREE.Vector3());
    const butt = a.weapon.root.localToWorld(new THREE.Vector3(0, 0.025, 0.26));
    expect(butt.distanceTo(shoulder)).toBeLessThan(0.14);
    // Fuzil em escala real (~0,9 m da coronha ao cano)
    const muzzle = a.weapon.muzzle.getWorldPosition(new THREE.Vector3());
    expect(muzzle.distanceTo(butt)).toBeGreaterThan(0.85 * WEAPON_SCALE / 1.15);
    a.dispose();
  });

  it('dedos da mão de apoio conservam orientação relativa à arma ao mirar e recarregar', () => {
    const a = new Avatar(asset, 'enemy');
    const parent = new THREE.Group();
    parent.rotation.y = 1.2;
    parent.add(a.root);
    const hand = a.root.getObjectByName('DEF-handL')!;
    const expected = new THREE.Vector3(0.3, 0.4, -1).normalize();
    for (const pitch of [-1.2, 0, 1.2]) {
      for (const reload of [0, 1]) {
        a.state.pitch = pitch;
        a.state.yaw = -0.7;
        a.state.reloadRemaining = reload;
        for (let i = 0; i < 30; i++) a.update(1 / 60);
        const fingers = new THREE.Vector3(0, 1, 0)
          .applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()))
          .applyQuaternion(a.weapon.root.getWorldQuaternion(new THREE.Quaternion()).invert());
        expect(fingers.distanceTo(expected)).toBeLessThan(1e-5);
      }
    }
    a.dispose();
  });

  it('cada skin veste o boneco com 4 malhas num esqueleto só', () => {
    for (const skin of SKIN_IDS) {
      const a = new Avatar(asset, 'enemy', skin);
      a.update(1 / 60);
      const meshes = skinned(a);
      expect(meshes.length).toBe(4);
      expect(new Set(meshes.map((m) => m.skeleton)).size).toBe(1);
      a.dispose();
    }
  });

  it('peças e contornos não recebem tiro', () => {
    const a = new Avatar(asset, 'ally', 'lia');
    a.root.updateMatrixWorld(true);
    const hits: THREE.Intersection[] = [];
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1.7, 5), new THREE.Vector3(0, 0, -1));
    for (const m of skinned(a)) if (m.name !== 'skin-body') m.raycast(ray, hits);
    expect(hits.length).toBe(0);
    a.dispose();
  });

  it('descartar libera a textura de ossos uma vez e preserva geometria/material compartilhados', () => {
    let texturesFreed = 0;
    let sharedFreed = 0;
    let ownFreed = 0;
    for (let i = 0; i < 10; i++) {
      const a = new Avatar(asset, i % 2 ? 'ally' : 'enemy', 'caio');
      const meshes = skinned(a);
      const skeleton = meshes[0].skeleton;
      skeleton.computeBoneTexture(); // o renderer faz isso no 1º desenho
      skeleton.boneTexture!.addEventListener('dispose', () => texturesFreed++);
      for (const m of meshes) {
        m.geometry.addEventListener('dispose', () => sharedFreed++);
        // Corpo e peças têm material do próprio boneco (piscar, dano); contornos são comuns
        if (m.name.startsWith('skin-')) (m.material as THREE.Material).addEventListener('dispose', () => ownFreed++);
        else (m.material as THREE.Material).addEventListener('dispose', () => sharedFreed++);
      }
      a.dispose();
      expect(skeleton.boneTexture).toBeNull();
    }
    expect(texturesFreed).toBe(10);
    expect(sharedFreed).toBe(0);
    expect(ownFreed).toBeGreaterThanOrEqual(10);
  });
});
