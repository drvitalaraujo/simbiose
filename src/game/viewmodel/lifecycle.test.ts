import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Viewmodel } from './index';
import { RemoteWeapon } from '../characters/remote-weapon';
import { toonVertexColors } from '../toon';

describe('contrato visual das armas', () => {
  it.each([0, 1, 2, 3])('boca remota acompanha o modelo da arma %i, inclusive no cache', index => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const vm = new Viewmodel(camera, scene);
    vm.setWeapon(index);
    const remote = new RemoteWeapon();
    for (let pass = 0; pass < 2; pass++) {
      remote.equip(index);
      expect(remote.muzzle.position.toArray()).toEqual(vm.model.muzzle.position.toArray());
      remote.equip((index + 1) % 4);
    }
    remote.dispose();
    vm.dispose();
  });

  it('descarta recursos próprios e preserva o material compartilhado do cenário', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const vm = new Viewmodel(camera, scene);
    const geometry = vi.spyOn(vm.model.meshes[0].geometry, 'dispose');
    const skeleton = vi.spyOn((vm.model.meshes[0] as THREE.SkinnedMesh).skeleton, 'dispose');
    const shared = vi.spyOn(toonVertexColors(), 'dispose');
    const casingGeometries = vm.casings.meshes.map(m => vi.spyOn(m.geometry, 'dispose'));
    vm.dispose();
    expect(scene.children).toHaveLength(0);
    expect(camera.children).toHaveLength(0);
    expect(geometry).toHaveBeenCalledOnce();
    expect(skeleton).toHaveBeenCalledOnce();
    for (const dispose of casingGeometries) expect(dispose).toHaveBeenCalledOnce();
    expect(shared).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
