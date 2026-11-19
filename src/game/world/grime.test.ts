import * as THREE from 'three';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ARENA1 } from '../maps/arena1';
import { LAPA } from '../maps/lapa';
import { grimeKit, setGrimeQuality } from './grime';
import { createGrime } from './street-grime';
function fakeCanvas() {
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'measureText') return (t: string) => ({ width: t.length * 10 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  return { width: 0, height: 0, style: {}, getContext: () => ctx };
}

const g = globalThis as unknown as { document?: unknown; location?: unknown };
let search = '';
beforeAll(() => {
  g.document = { createElement: () => fakeCanvas() };
  g.location = { get search() { return search; } };
});
afterAll(() => {
  delete g.document;
  delete g.location;
});

it('desgaste do Bairro/Favela acompanha qualidade antes e depois da construção e reutiliza o atlas', async () => {
  const { applyDetailQuality } = await import('../render/detail-quality');
  applyDetailQuality(2);
  const kit = createGrime();
  kit.finish();
  expect(kit.mat.visible).toBe(false);
  expect(kit.puddleMat.visible).toBe(false);
  for (const level of [0, 1, 2, 3, 0] as const) {
    applyDetailQuality(level);
    expect(createGrime()).toBe(kit);
    expect(kit.mat.visible).toBe(level < 2);
    expect(kit.puddleMat.visible).toBe(level < 2);
  }
});

it('reaplica a qualidade em vigor do pipeline ao trocar de mapa sem recarregar a página', async () => {
  const { buildMap } = await import('../maps/build');
  const { applyDetailQuality } = await import('../render/detail-quality');
  for (const map of [ARENA1, LAPA, ARENA1]) {
    // Estado velho de outro jogo não vaza: o mapa lê o nível em vigor do pipeline
    applyDetailQuality(0);
    setGrimeQuality(3);
    buildMap(new THREE.Scene(), map);
    expect(grimeKit().mul.visible).toBe(true);
    // Online: o pipeline já baixou para o nível 2 antes de o mapa chegar
    applyDetailQuality(2);
    setGrimeQuality(0);
    buildMap(new THREE.Scene(), map);
    expect(grimeKit().mul.visible).toBe(false);
    for (const level of [0, 1, 2, 3, 0]) {
      setGrimeQuality(level);
      expect(grimeKit().mul.visible).toBe(level < 2);
    }
  }
}, 20000);
