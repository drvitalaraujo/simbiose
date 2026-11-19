import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { configureSceneLight, resetSceneLight, SCENE_LIGHT, sceneHasSky, sceneLit } from './scene-light';
import { NO_LEVEL } from './ground-levels';

describe('ciclo de vida da luz do cenário', () => {
  it('novo pipeline limpa céu e pisos e libera a textura anterior', () => {
    configureSceneLight(new THREE.Vector3(1, 1, 0), { tintStrength: 0.65 });
    const old = SCENE_LIGHT.tLuzFloors.value;
    const dispose = vi.spyOn(old, 'dispose');
    resetSceneLight();
    expect(dispose).toHaveBeenCalledOnce();
    expect(sceneHasSky()).toBe(false);
    expect(SCENE_LIGHT.uLuzTintStrength.value).toBe(1);
    expect(Array.from((SCENE_LIGHT.tLuzFloors.value as THREE.DataTexture).image.data!)).toEqual(Array(4).fill(NO_LEVEL));
  });

  it('céu diurno restaura a sombra fria e a base após Bairro ou mapa tropical', () => {
    const sun = new THREE.Vector3(1, 1, 0);
    configureSceneLight(sun, { tintStrength: 0.65, base: 1.05, baseTint: new THREE.Vector3(0.84, 0.81, 0.91) });
    expect(SCENE_LIGHT.uLuzShade.value.z).toBeCloseTo(1.065);
    expect(SCENE_LIGHT.uLuzBase.value).toBeCloseTo(1.05);
    configureSceneLight(sun);
    expect(SCENE_LIGHT.uLuzShade.value.z).toBeCloseTo(1.1);
    expect(SCENE_LIGHT.uLuzBase.value).toBeCloseTo(1.6);
    expect(SCENE_LIGHT.uLuzBaseTint.value.x).toBeCloseTo(0.66);
  });

  it('não aplica luz pintada a decalques transparentes nem sujeira multiplicativa', () => {
    for (const m of [new THREE.MeshToonMaterial({ transparent: true, depthWrite: false }), new THREE.MeshBasicMaterial({ blending: THREE.MultiplyBlending })]) {
      const shader = m.onBeforeCompile;
      sceneLit(m);
      expect(m.onBeforeCompile).toBe(shader);
      m.dispose();
    }
  });
});
