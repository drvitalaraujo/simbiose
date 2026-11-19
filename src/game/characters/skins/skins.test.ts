import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../toon';
import { isSkinId, SKIN_IDS, SKINS, skinFor } from './index';
import { CUT_PLANES, partOf, REGIONS, regionOf } from './regions';
import { type SplitMesh, splitByPlanes } from './split';

const up = { x: 0, y: 1, z: 0 };
const down = { x: 0, y: -1, z: 0 };

describe('regiões do corpo', () => {
  it('parte do corpo vem do osso', () => {
    expect(partOf('DEF-head')).toBe('head');
    expect(partOf('DEF-spine001')).toBe('torso');
    expect(partOf('DEF-shoulderL')).toBe('torso');
    expect(partOf('DEF-upper_armR')).toBe('arm');
    expect(partOf('DEF-f_index02L')).toBe('hand');
    expect(partOf('DEF-thumb01R')).toBe('hand');
    expect(partOf('DEF-shinL')).toBe('leg');
    expect(partOf('DEF-toeR')).toBe('foot');
  });

  it('pontos conhecidos do manequim caem na região certa', () => {
    expect(regionOf('DEF-head', { x: 0, y: 1.8, z: 0 }, up)).toBe('hair');
    expect(regionOf('DEF-head', { x: 0, y: 1.725, z: 0.11 }, up)).toBe('brow');
    expect(regionOf('DEF-head', { x: 0, y: 1.65, z: 0.11 }, up)).toBe('face');
    expect(regionOf('DEF-head', { x: 0, y: 1.65, z: -0.1 }, up)).toBe('hair');
    expect(regionOf('DEF-spine003', { x: 0, y: 1.3, z: 0.12 }, up)).toBe('chestCenter');
    expect(regionOf('DEF-spine003', { x: 0.12, y: 1.3, z: 0.1 }, up)).toBe('chest');
    expect(regionOf('DEF-spine003', { x: 0, y: 1.3, z: -0.14 }, up)).toBe('chest');
    expect(regionOf('DEF-shoulderL', { x: 0.15, y: 1.48, z: -0.06 }, up)).toBe('shoulder');
    expect(regionOf('DEF-spine001', { x: 0, y: 1.12, z: 0.1 }, up)).toBe('belly');
    expect(regionOf('DEF-hips', { x: 0, y: 1.06, z: 0.1 }, up)).toBe('waist');
    expect(regionOf('DEF-hips', { x: 0, y: 0.9, z: 0.1 }, up)).toBe('pelvis');
    expect(regionOf('DEF-upper_armL', { x: 0.25, y: 1.45, z: -0.06 }, up)).toBe('sleeve');
    expect(regionOf('DEF-forearmR', { x: -0.47, y: 1.45, z: -0.06 }, up)).toBe('elbow');
    expect(regionOf('DEF-forearmR', { x: -0.65, y: 1.45, z: -0.06 }, up)).toBe('forearm');
    expect(regionOf('DEF-handL', { x: 0.8, y: 1.46, z: -0.07 }, up)).toBe('hand');
    expect(regionOf('DEF-handL', { x: 0.8, y: 1.39, z: -0.07 }, down)).toBe('palm');
    expect(regionOf('DEF-f_ring01L', { x: 0.87, y: 1.44, z: -0.08 }, up)).toBe('knuckle');
    expect(regionOf('DEF-f_ring03L', { x: 0.92, y: 1.44, z: -0.08 }, up)).toBe('finger');
    expect(regionOf('DEF-thighL', { x: 0.1, y: 0.8, z: 0 }, up)).toBe('thigh');
    expect(regionOf('DEF-shinL', { x: 0.1, y: 0.5, z: 0 }, up)).toBe('knee');
    expect(regionOf('DEF-shinL', { x: 0.1, y: 0.3, z: 0 }, up)).toBe('shin');
    expect(regionOf('DEF-shinL', { x: 0.1, y: 0.15, z: 0 }, up)).toBe('boot');
    expect(regionOf('DEF-toeL', { x: 0.1, y: 0.04, z: 0.18 }, up)).toBe('toe');
    expect(regionOf('DEF-footL', { x: 0.1, y: 0.01, z: 0 }, down)).toBe('sole');
  });
});

describe('skins', () => {
  const palette = new Set<number>(Object.values(PALETTE));

  it('cada skin pinta todas as regiões, só com cores da PALETTE', () => {
    for (const id of SKIN_IDS) {
      const skin = SKINS[id];
      expect(skin.id).toBe(id);
      for (const r of REGIONS) {
        expect(skin.colors[r], `${id}.${r}`).toBeDefined();
        expect(palette.has(skin.colors[r]), `${id}.${r} fora da PALETTE`).toBe(true);
      }
    }
  });

  it('Sorridentes sem ciano nem amarelo; Resistência com ciano e amarelo', () => {
    const colors = (id: keyof typeof SKINS) => new Set(Object.values(SKINS[id].colors));
    expect(colors('ivo').has(PALETTE.cyan)).toBe(false);
    expect(colors('ivo').has(PALETTE.yellow)).toBe(false);
    for (const id of ['lia', 'caio'] as const) {
      expect(colors(id).has(PALETTE.cyan)).toBe(true);
      expect(colors(id).has(PALETTE.yellow)).toBe(true);
    }
  });

  it('skin por jogador é fixa e espalha entre as três', () => {
    expect(skinFor('jogador-7')).toBe(skinFor('jogador-7'));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => skinFor(`p${i}`)));
    expect(seen.size).toBe(3);
    expect(isSkinId('caio')).toBe(true);
    expect(isSkinId('manequim')).toBe(false);
    expect(isSkinId(null)).toBe(false);
    // nomes herdados do Object não são skins (antes `in` aceitava e quebrava o boneco)
    for (const bad of ['constructor', 'toString', '__proto__', 'hasOwnProperty', '']) expect(isSkinId(bad)).toBe(false);
  });
});

describe('corte da malha nos planos', () => {
  // Um quadrado de 2 triângulos de y = 0 a y = 1, cortado em y = 0,5
  const square = (): SplitMesh => ({
    position: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    normal: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    skinIndex: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    skinWeight: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    rest: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    bone: ['a', 'a', 'b', 'b'],
    index: [0, 1, 2, 0, 2, 3],
  });

  it('nenhum triângulo atravessa o plano e a área se conserva', () => {
    const m = splitByPlanes(square(), [{ axis: 'y', value: 0.5 }]);
    let area = 0;
    for (let i = 0; i < m.index.length; i += 3) {
      const [a, b, c] = [m.index[i], m.index[i + 1], m.index[i + 2]];
      const ys = [a, b, c].map((v) => m.rest[v * 3 + 1]);
      expect(Math.min(...ys) >= 0.5 - 1e-6 || Math.max(...ys) <= 0.5 + 1e-6).toBe(true);
      const [ax, ay, bx, by, cx, cy] = [m.rest[a * 3], ys[0], m.rest[b * 3], ys[1], m.rest[c * 3], ys[2]];
      const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      expect(cross).toBeGreaterThan(0); // winding preservado
      area += cross / 2;
    }
    expect(area).toBeCloseTo(1, 6);
  });

  it('vértices novos são compartilhados e os pesos misturam os dois ossos', () => {
    const m = splitByPlanes(square(), [{ axis: 'y', value: 0.5 }]);
    // 3 arestas cortadas (2 laterais + diagonal) → 3 vértices novos
    expect(m.bone.length).toBe(7);
    const v = 4; // primeiro vértice novo
    const w = [m.skinWeight[v * 4], m.skinWeight[v * 4 + 1]];
    expect(w[0] + w[1]).toBeCloseTo(1, 6);
    expect(w[0]).toBeCloseTo(0.5, 6);
  });

  it('a caixa do plano limita onde ele corta', () => {
    const m = splitByPlanes(square(), [{ axis: 'y', value: 0.5, box: { x: [5, 6] } }]);
    expect(m.index.length).toBe(6);
  });

  it('os planos das regiões são válidos', () => {
    for (const p of CUT_PLANES) expect(Number.isFinite(p.value)).toBe(true);
  });
});
