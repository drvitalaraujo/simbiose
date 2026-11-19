import * as THREE from 'three';
import { afterEach, expect, it } from 'vitest';
import { characterShading, setCharacterQuality } from './shading';

afterEach(() => setCharacterQuality(0));

it('qualidade reduzida desliga acabamento em materiais existentes e futuros sem recompilar', () => {
  const compile = (shading: ReturnType<typeof characterShading>) => {
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: THREE.ShaderLib.toon.vertexShader,
      fragmentShader: THREE.ShaderLib.toon.fragmentShader,
    };
    shading.material.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer);
    return shader;
  };
  const first = characterShading();
  const shader = compile(first);
  expect(shader.uniforms.charDetail.value).toBe(1);
  for (const level of [1, 2, 3, 0] as const) {
    const version = first.material.version;
    setCharacterQuality(level);
    const next = characterShading();
    const nextShader = compile(next);
    expect(shader.uniforms.charDetail.value).toBe(level < 2 ? 1 : 0);
    expect(nextShader.uniforms.charDetail).toBe(shader.uniforms.charDetail);
    expect(nextShader.uniforms.charHit).not.toBe(shader.uniforms.charHit);
    expect(first.material.version).toBe(version);
    next.material.dispose();
  }
  first.material.dispose();
});
