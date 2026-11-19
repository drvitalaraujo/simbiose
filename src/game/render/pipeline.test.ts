import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPipeline } from './pipeline';

afterEach(() => vi.unstubAllGlobals());

function fixture(autoClear = true) {
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  const scene = new THREE.Scene();
  const passes: { scene: boolean; clear: boolean }[] = [];
  const renderer = {
    autoClear,
    getContext: () => ({ getExtension: () => null, getParameter: () => 'Intel' }),
    getDrawingBufferSize: (v: THREE.Vector2) => v.set(320, 180),
    setPixelRatio() {}, setRenderTarget() {},
    shadowMap: { autoUpdate: true, needsUpdate: false },
    info: { autoReset: true, reset() {}, render: { calls: 0, triangles: 0 } },
    render: vi.fn((object: THREE.Object3D) => {
      passes.push({ scene: object === scene, clear: renderer.autoClear });
      renderer.shadowMap.needsUpdate = false;
    }),
  };
  const pipeline = createPipeline(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.PerspectiveCamera());
  return { pipeline, renderer, passes };
}

describe('limpeza dos alvos do pós', () => {
  for (const level of [0, 2, 3] as const) {
    it(`preserva a limpeza da cena e sobrescreve os passes completos no nível ${level}`, () => {
      const { pipeline, renderer, passes } = fixture();
      pipeline.setQuality(level);
      pipeline.render();
      pipeline.render();
      expect(passes.filter((p) => p.scene)).toEqual([{ scene: true, clear: true }, { scene: true, clear: true }]);
      expect(passes.filter((p) => !p.scene).every((p) => !p.clear)).toBe(true);
      expect(passes).toHaveLength((level === 0 ? 13 : level === 2 ? 10 : 2) * 2);
      expect(renderer.autoClear).toBe(true);
      pipeline.dispose();
    });
  }

  for (const autoClear of [true, false]) {
    it(`restaura autoClear=${autoClear} mesmo se o pós falhar`, () => {
      const { pipeline, renderer } = fixture(autoClear);
      const end = vi.spyOn(pipeline.stats, 'end');
      renderer.render.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error('falha no pós'); });
      expect(() => pipeline.render()).toThrow('falha no pós');
      expect(renderer.autoClear).toBe(autoClear);
      expect(end).toHaveBeenCalledOnce();
      pipeline.dispose();
    });
  }

  it('renderização crua mantém o estado original', () => {
    const { pipeline, renderer, passes } = fixture();
    pipeline.enabled = false;
    pipeline.render();
    expect(passes).toEqual([{ scene: true, clear: true }]);
    expect(renderer.autoClear).toBe(true);
    pipeline.dispose();
  });
});
