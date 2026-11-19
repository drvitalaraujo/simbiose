import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../toon';
import { beveledBox } from './forms';
import { Kit, type Vec } from './kit';

describe('construção das peças', () => {
  it('chanfro preserva a caixa externa, inclusive em placas finas', () => {
    for (const size of [[0.2, 0.26, 0.08], [0.063, 0.09, 0.013]] as Vec[]) {
      const g = beveledBox(size, 0.02);
      g.computeBoundingBox();
      const actual = g.boundingBox!.getSize(new THREE.Vector3()).toArray();
      actual.forEach((n, i) => expect(n).toBeCloseTo(size[i], 6));
      const normals = g.getAttribute('normal');
      for (let i = 0; i < normals.count; i++) {
        expect(new THREE.Vector3().fromBufferAttribute(normals, i).length()).toBeCloseTo(1, 5);
      }
      g.dispose();
    }
  });

  it('a fita tem frente correta e conserva pesos normalizados ao dobrar', () => {
    for (const z of [-0.13, 0.13]) {
      const k = new Kit(new Map([
        ['lower', { index: 0, rest: new THREE.Matrix4() }],
        ['upper', { index: 1, rest: new THREE.Matrix4().makeTranslation(0, 0.1, 0) }],
      ]));
      k.ribbon([
        { at: [-0.1, 1.1, z], bone: 'lower' },
        { at: [0, 1.3, z], bone: 'lower', bone2: 'upper', mix: 0.5 },
        { at: [0.1, 1.5, z], bone: 'upper' },
      ], 0.033, PALETTE.yellow);
      const { geometry, shell } = k.finish();
      const p = geometry.getAttribute('position');
      const w = geometry.getAttribute('skinWeight');
      const idx = geometry.index!;
      for (let i = 0; i < w.count; i++) expect(w.getX(i) + w.getY(i)).toBeCloseTo(1, 6);
      const a = new THREE.Vector3().fromBufferAttribute(p, idx.getX(0));
      const b = new THREE.Vector3().fromBufferAttribute(p, idx.getX(1));
      const c = new THREE.Vector3().fromBufferAttribute(p, idx.getX(2));
      expect(b.sub(a).cross(c.sub(a)).z * z).toBeGreaterThan(0);
      expect(p.count).toBeLessThan(idx.count);
      geometry.dispose();
      shell.dispose();
    }
  });
});
