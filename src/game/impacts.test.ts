import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { Impacts } from './impacts';
import { Smoke } from './smoke';
import { Viewmodel } from './viewmodel';

const camera = new THREE.PerspectiveCamera(80, 1, 0.05, 300);
const direction = { x: 0, y: 0, z: -1 };
const wall = { min: { x: -2, y: 0, z: -2 }, max: { x: 2, y: 3, z: -1 } };

it('mantém um lote limitado, substitui a marca mais antiga e desvanece antes de expirar', () => {
  const scene = new THREE.Scene();
  const effects = new Impacts(scene, 2); effects.blockers = [wall];
  for (const x of [-0.5, 0, 0.5]) effects.add({ x, y: 1, z: -1 }, direction);
  effects.update(0, camera);
  expect(effects.mesh.count).toBe(2);
  const matrix = new THREE.Matrix4(); effects.mesh.getMatrixAt(0, matrix);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBe(0);
  const opacity = effects.mesh.geometry.getAttribute('instanceOpacity');
  effects.update(40, camera);
  expect(opacity.getX(0)).toBeCloseTo(0.5);
  effects.update(5, camera);
  expect(effects.mesh.count).toBe(0);
  expect(effects.sparks.sparks.visible || effects.sparks.pops.visible).toBe(false);
  expect(scene.children).toHaveLength(4); // marcas, poeira, faíscas e estouro
  effects.dispose();
});

it('efeitos não bloqueiam raios, não escrevem profundidade e liberam recursos', () => {
  const scene = new THREE.Scene(); const effects = new Impacts(scene);
  effects.blockers = [wall]; effects.add({ x: 0, y: 1, z: -1 }, direction); effects.update(0, camera);
  scene.updateMatrixWorld(true);
  expect(new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)).intersectObjects(scene.children)).toEqual([]);
  expect(effects.sparks.sparks.count).toBeGreaterThan(0);
  expect(effects.sparks.pops.count).toBe(1);
  for (const mesh of [effects.mesh, effects.smoke.mesh, effects.sparks.sparks, effects.sparks.pops]) {
    expect((mesh.material as THREE.Material).depthWrite).toBe(false);
    expect(mesh.castShadow).toBe(false);
  }
  const geometry = vi.spyOn(effects.mesh.geometry, 'dispose');
  const material = vi.spyOn(effects.mesh.material as THREE.Material, 'dispose');
  effects.dispose();
  expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
  expect(scene.children).toHaveLength(0);
});

it('rajadas de fumaça têm memória limitada, congelam com dt zero e somem', () => {
  const scene = new THREE.Scene(); const smoke = new Smoke(scene, 4);
  for (let i = 0; i < 200; i++) smoke.emit(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
  smoke.update(0.05, camera);
  expect(smoke.mesh.count).toBe(4); expect(scene.children).toHaveLength(1);
  const before = smoke.mesh.instanceMatrix.array.slice();
  smoke.update(0, camera);
  expect(smoke.mesh.instanceMatrix.array).toEqual(before);
  smoke.update(1, camera); expect(smoke.mesh.count).toBe(0);
  smoke.dispose(); expect(scene.children).toHaveLength(0);
});

it('escopeta emite fumaça uma vez por cartucho; trocar arma e reset limpam a fumaça', () => {
  const scene = new THREE.Scene(); const cam = camera.clone(); scene.add(cam);
  const vm = new Viewmodel(cam, scene); vm.setWeapon(3);
  const input = { vx: 0, vy: 0, vz: 0, onGround: true, bobPhase: 0, yaw: 0, pitch: 0, sliding: false };
  vm.shot(new THREE.Vector3(0, 0, -10));
  for (let i = 0; i < 7; i++) vm.pellet(new THREE.Vector3(i * 0.1, 0, -10));
  vm.update(1 / 60, input);
  expect(vm.smoke.mesh.count).toBe(3);
  vm.reset(); expect(vm.smoke.mesh.count).toBe(0);
  vm.shot(new THREE.Vector3(0, 0, -10)); vm.update(1 / 60, input);
  vm.setWeapon(0); expect(vm.smoke.mesh.count).toBe(0);
  vm.smoke.dispose();
});
