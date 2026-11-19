import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { Viewmodel } from './index';

it('trocar arma libera flash, materiais e skeleton compartilhado uma única vez', () => {
  const camera = new THREE.PerspectiveCamera(80, 1, 0.05, 300);
  const scene = new THREE.Scene(); scene.add(camera);
  const vm = new Viewmodel(camera, scene);
  const old = vm.model;
  const body = old.meshes[0] as THREE.SkinnedMesh;
  const skeleton = vi.spyOn(body.skeleton, 'dispose');
  const geometries = old.meshes.map(mesh => vi.spyOn(mesh.geometry, 'dispose'));
  const flashMesh = old.muzzle.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
  const flashGeometry = vi.spyOn(flashMesh.geometry, 'dispose');
  const flashMaterial = vi.spyOn(flashMesh.material as THREE.Material, 'dispose');
  vm.setWeapon(1);
  expect(skeleton).toHaveBeenCalledTimes(1);
  for (const dispose of geometries) expect(dispose).toHaveBeenCalledTimes(1);
  expect(flashGeometry).toHaveBeenCalledTimes(1); expect(flashMaterial).toHaveBeenCalledTimes(1);
  expect(old.root.parent).toBeNull(); expect(vm.model.root.parent).toBe(camera);
  vm.setWeapon(1);
  expect(skeleton).toHaveBeenCalledTimes(1);
});
