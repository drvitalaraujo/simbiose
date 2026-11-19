import * as THREE from 'three';
import type { Vec } from './kit';

/** Caixa de cantos cortados, sem aumentar as medidas externas da peça. */
export function beveledBox(size: Vec, radius: number): THREE.BufferGeometry {
  const [w, h, d] = size;
  const r = Math.min(radius, Math.min(w, h, d) * 0.45);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2 + r);
  shape.lineTo(w / 2 - r, -h / 2 + r);
  shape.lineTo(w / 2 - r, h / 2 - r);
  shape.lineTo(-w / 2 + r, h / 2 - r);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * r, steps: 1, bevelEnabled: true,
    bevelSize: r, bevelThickness: r, bevelSegments: 1, curveSegments: 1,
  });
  g.translate(0, 0, -d / 2 + r);
  return g;
}

/** Perfil no plano XY com espessura pequena: mechas, lapelas e placas recortadas. */
export function profile(points: readonly (readonly [number, number])[], depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}
