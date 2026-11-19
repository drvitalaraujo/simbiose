import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../sim/events';
import { createPlayer } from '../../sim/player';
import { lineOfSight } from '../../sim/ray';
import { createWeapon, stepWeapon } from '../../sim/weapon';
import { mapShotBlockers, mapSolids, type MapSolid } from '../maps/types';
import { PALETTE } from '../toon';
import { Builder, place } from './builder';

describe('contrato independente de movimento e tiro', () => {
  it('animação no shader mantém o lote visível além da geometria estática sem ampliar a caixa de tiro', () => {
    const scene = new THREE.Scene();
    const b = new Builder(scene);
    const material = new THREE.MeshBasicMaterial();
    b.add(new THREE.BoxGeometry(1, 1, 1), material, { cast: false, shoot: true, boundsPadding: 4 });
    b.add(place(new THREE.BoxGeometry(1, 1, 1), 1, 0, 0), material, { cast: false });
    b.finish();
    const mesh = scene.children[0] as THREE.Mesh;
    const camera = new THREE.OrthographicCamera(3, 5, 1, -1, 0.1, 10);
    camera.position.z = 5;
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    expect(frustum.intersectsObject(mesh)).toBe(true);
    expect(mesh.geometry.boundingBox!.max.x).toBe(5.5);
    expect(b.shotBlockers).toEqual([{ min: { x: -0.5, y: -0.5, z: -0.5 }, max: { x: 0.5, y: 0.5, z: 0.5 } }]);
    expect(b.solids).toEqual([]);
    mesh.geometry.dispose();
    for (const shooter of b.shootables) (shooter as THREE.Mesh).geometry.dispose();
    material.dispose();
  });

  for (const solid of [false, true]) for (const shoot of [false, true]) {
    it(`solid=${solid}, shoot=${shoot}: Builder, arma, visão e dados puros concordam`, () => {
      const b = new Builder(new THREE.Scene());
      const box = b.block(-2, 0, -6, 2, 4, -4, PALETTE.concrete, { solid, shoot });
      expect(b.solids).toHaveLength(solid ? 1 : 0);
      expect(b.shotBlockers).toHaveLength(shoot ? 1 : 0);
      const bus = new EventBus();
      stepWeapon(createWeapon(), createPlayer({ x: 0, y: 1, z: 0 }), true, 1 / 60, { solids: b.shotBlockers, rng: () => 0.5, events: bus });
      expect(bus.drain()[0]).toMatchObject({ type: 'shot', hit: shoot ? 'world' : 'none' });
      expect(lineOfSight({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -10 }, b.shotBlockers)).toBe(!shoot);
      const data = { solids: [{ box, kind: 'wall', tint: 'neutral', solid, shoot } as MapSolid] };
      expect(mapSolids(data)).toEqual(b.solids);
      expect(mapShotBlockers(data)).toEqual(b.shotBlockers);
    });
  }

  it('limites invisíveis colidem mas não bloqueiam tiro', () => {
    const b = new Builder(new THREE.Scene());
    b.invisible(-1, 0, -6, 1, 4, -4);
    expect(b.solids).toHaveLength(1);
    expect(b.shotBlockers).toHaveLength(0);
    expect(b.impactSurfaces).toHaveLength(0);
    expect(mapShotBlockers({ solids: [{ box: b.solids[0], kind: 'bound', tint: 'neutral' }] })).toEqual([]);
  });

  it('acabamento visual recebe marcas sem bloquear tiro ou movimento; formas inclinadas ficam fora', () => {
    const b = new Builder(new THREE.Scene());
    const slab = b.block(-2, 0, -4, 2, 3, -3.97, PALETTE.cal, { solid: false, shoot: false });
    expect(b.impactSurfaces).toHaveLength(1);
    // A geometria guarda posições em Float32; a caixa original usa números de 64 bits.
    for (const side of ['min', 'max'] as const) for (const axis of ['x', 'y', 'z'] as const) {
      expect(b.impactSurfaces[0][side][axis]).toBeCloseTo(slab[side][axis], 6);
    }
    expect(b.solids).toEqual([]); expect(b.shotBlockers).toEqual([]);
    b.add(place(new THREE.BoxGeometry(2, 1, 1), 0, 4, 0, 0, 0, 0.25), new THREE.MeshBasicMaterial());
    expect(b.impactSurfaces).toHaveLength(1);
  });

  it('geometria add com shoot usa AABB do volume em coordenadas de mundo', () => {
    const b = new Builder(new THREE.Scene());
    b.add(place(new THREE.BoxGeometry(2, 3, 4), 10, 5, -8), new THREE.MeshBasicMaterial(), { shoot: true });
    expect(b.shotBlockers).toEqual([{ min: { x: 9, y: 3.5, z: -10 }, max: { x: 11, y: 6.5, z: -6 } }]);
    expect(b.solids).toHaveLength(0);
  });
});
