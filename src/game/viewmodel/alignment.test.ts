import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HIP_AIM_DISTANCE } from './alignment';
import { Viewmodel } from './index';
import { VM_FOV } from './material';

const still = { vx: 0, vy: 0, vz: 0, onGround: true, bobPhase: 0, yaw: 0, pitch: 0 };

function setup(index: number, fov: number, aspect: number) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.05, 300);
  camera.position.set(4, 2, -8);
  camera.rotation.set(0.3, -0.7, 0, 'YXZ');
  const scene = new THREE.Scene();
  scene.add(camera);
  const vm = new Viewmodel(camera, scene);
  vm.setWeapon(index);
  vm.update(0.3, still); // termina o gesto de equipar
  vm.reset();
  return { camera, vm };
}

describe.each([0, 1, 2, 3])('alinhamento da arma %i', index => {
  it.each([[60, 1], [80, 16 / 9], [110, 21 / 9]])('cano converge na mira com FOV %i e aspecto %f', (fov, aspect) => {
    const { camera, vm } = setup(index, fov, aspect);
    const muzzle = vm.model.muzzle.position.clone().applyMatrix4(vm.model.root.matrix);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(vm.model.root.quaternion);
    const distance = (-HIP_AIM_DISTANCE - muzzle.z) / direction.z;
    expect(distance).toBeGreaterThan(0);
    const target = camera.localToWorld(muzzle.addScaledVector(direction, distance)).project(camera);
    expect(target.x).toBeCloseTo(0, 8);
    expect(target.y).toBeCloseTo(0, 8);

    // O rastro deve sair do pixel da boca, apesar do FOV próprio da arma.
    const opticalCamera = new THREE.PerspectiveCamera(VM_FOV, aspect, camera.near, camera.far);
    opticalCamera.position.copy(camera.position);
    opticalCamera.quaternion.copy(camera.quaternion);
    opticalCamera.updateMatrixWorld();
    const visibleMuzzle = vm.model.muzzle.getWorldPosition(new THREE.Vector3()).project(opticalCamera);
    const tracerMuzzle = vm.muzzleWorld().project(camera);
    expect(tracerMuzzle.x).toBeCloseTo(visibleMuzzle.x, 8);
    expect(tracerMuzzle.y).toBeCloseTo(visibleMuzzle.y, 8);
  });

  it('centro óptico coincide com o ponto da mira ao aproximar', () => {
    const { camera, vm } = setup(index, 30, 16 / 9);
    vm.update(0, { ...still, aimAmount: 1 });
    const sight = vm.model.sight.getWorldPosition(new THREE.Vector3()).project(camera);
    expect(sight.x).toBeCloseTo(0, 8);
    expect(sight.y).toBeCloseTo(0, 8);
    // O cano fica abaixo da óptica; a mira não precisa olhar pela boca da arma.
    const muzzle = vm.model.muzzle.getWorldPosition(new THREE.Vector3());
    expect(camera.worldToLocal(muzzle).y).toBeLessThan(0);
  });
});
