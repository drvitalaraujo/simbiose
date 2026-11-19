import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../toon';
import { Builder } from './builder';
import { car } from './cars';
import type { Ctx } from './props';

describe('carro: acabamento preserva cobertura e colisão', () => {
  for (const alongX of [false, true]) it(`dois AABBs e tiro intactos (${alongX ? 'X' : 'Z'})`, () => {
    const scene = new THREE.Scene();
    const b = new Builder(scene);
    car({ b } as Ctx, 0, 0, alongX, PALETTE.ochre);
    expect(b.solids).toHaveLength(2);
    expect(b.shotBlockers).toHaveLength(2);
    for (let i = 0; i < 2; i++) for (const edge of ['min','max'] as const) for (const axis of ['x','y','z'] as const) {
      expect(b.shotBlockers[i][edge][axis]).toBeCloseTo(b.solids[i][edge][axis], 6);
    }
    const chassis = b.solids[0];
    expect(chassis.min.y).toBe(0.25); expect(chassis.max.y).toBe(1.05);
    expect(chassis.max.x).toBe(alongX ? 2.1 : 0.95);
    expect(chassis.max.z).toBe(alongX ? 0.95 : 2.1);
    const cabin = b.solids[1];
    expect(cabin.min.y).toBe(1.05); expect(cabin.max.y).toBe(1.75);
    expect(alongX ? cabin.max.x : cabin.max.z).toBeCloseTo(0.85);
    expect(alongX ? cabin.min.x : cabin.min.z).toBeCloseTo(-1.35);
    b.finish();
    const ray = new THREE.Raycaster(alongX ? new THREE.Vector3(5, 1.4, 0) : new THREE.Vector3(0, 1.4, 5),
      alongX ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObjects(b.shootables)[0].distance).toBeCloseTo(4.15);
    expect(scene.children.every(o => !('raycast' in o) || ray.intersectObject(o).length === 0)).toBe(true);
  });
});
