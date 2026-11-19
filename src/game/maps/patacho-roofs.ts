import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE as P, toon } from '../toon';
import { Builder } from '../world/builder';
import { box } from '../world/shapes';
import { clearOfBody } from './facades';
import { paintedFaces, type PatachoMaterials } from './patacho-materials';
import type { MapData } from './types';

// Coberturas altas suspensas da Vila dos Pescadores: telhados de piaçava em 3 camadas
// com caibros aparentes e cumeeira roliça, mais varais de luzes quentes e bandeirolas.

export function addSafeOverhang(
  b: Builder,
  map: MapData,
  overhangs: Box[],
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  cast = false,
): boolean {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const bounds = box(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z);
  if (!clearOfBody(map, bounds)) return false;
  overhangs.push(bounds);
  b.add(geo, mat, { cast });
  return true;
}

export function buildThatchRoof(
  b: Builder,
  map: MapData,
  overhangs: Box[],
  a: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
  thatchMat: THREE.Material,
) {
  const cx = (a.x + c.x) / 2,
    cz = (a.z + c.z) / 2;
  const w = c.x - a.x,
    d = c.z - a.z;
  const ridgeHalf = Math.max(0.85, Math.abs(d - w) * 0.5 + 0.75);
  const alongZ = d >= w;

  const wideEnvelope = box(a.x - 0.52, c.y - 0.08, a.z - 0.52, c.x + 0.52, c.y + 2.38, c.z + 0.52);
  const wideOk = clearOfBody(map, wideEnvelope);
  const baseOut = wideOk ? 0.44 : 0.09;

  const tiers = [
    { out: baseOut, y0: c.y + 0.04, y1: c.y + 0.82, inOut: -0.95 },
    { out: -0.78, y0: c.y + 0.78, y1: c.y + 1.54, inOut: -2.15 },
    { out: -1.98, y0: c.y + 1.49, y1: c.y + 2.22, inOut: null },
  ] as const;

  const addRoofPart = (geo: THREE.BufferGeometry, mat: THREE.Material, cast: boolean) => {
    if (wideOk) addSafeOverhang(b, map, overhangs, geo, mat, cast);
    else b.add(geo, mat, { cast });
  };

  for (const t of tiers) {
    const x0 = a.x - t.out,
      x1 = c.x + t.out,
      z0 = a.z - t.out,
      z1 = c.z + t.out;
    if (t.inOut !== null) {
      const ix0 = a.x - t.inOut,
        ix1 = c.x + t.inOut,
        iz0 = a.z - t.inOut,
        iz1 = c.z + t.inOut;
      const A = [x0, t.y0, z0],
        B = [x1, t.y0, z0],
        C = [x1, t.y0, z1],
        D = [x0, t.y0, z1];
      const iA = [ix0, t.y1, iz0],
        iB = [ix1, t.y1, iz0],
        iC = [ix1, t.y1, iz1],
        iD = [ix0, t.y1, iz1];
      const quad = (p0: number[], p1: number[], p2: number[], p3: number[]) => [
        ...p0, ...p1, ...p2, ...p0, ...p2, ...p3,
      ];
      const verts = [...quad(A, B, iB, iA), ...quad(B, C, iC, iB), ...quad(C, D, iD, iC), ...quad(D, A, iA, iD)];
      addRoofPart(paintedFaces(verts, true, 'slope', 1.65), thatchMat, true);
    } else {
      const A = [x0, t.y0, z0],
        B = [x1, t.y0, z0],
        C = [x1, t.y0, z1],
        D = [x0, t.y0, z1];
      const rA = alongZ ? [cx, t.y1, cz - ridgeHalf] : [cx - ridgeHalf, t.y1, cz];
      const rB = alongZ ? [cx, t.y1, cz + ridgeHalf] : [cx + ridgeHalf, t.y1, cz];
      const verts = alongZ
        ? [...A, ...B, ...rA, ...B, ...C, ...rB, ...B, ...rB, ...rA, ...C, ...D, ...rB, ...D, ...A, ...rA, ...D, ...rA, ...rB]
        : [...A, ...B, ...rA, ...B, ...rB, ...rA, ...B, ...C, ...rB, ...C, ...D, ...rB, ...D, ...rA, ...rB, ...D, ...A, ...rA];
      addRoofPart(paintedFaces(verts, true, 'slope', 1.65), thatchMat, true);
    }

    const rimY = t.y0 - 0.055;
    const lip = wideOk ? 0.065 : 0.02;
    for (const [rx0, rz0, rx1, rz1] of [
      [x0, z0 - lip, x1, z0 + lip],
      [x0, z1 - lip, x1, z1 + lip],
      [x0 - lip, z0, x0 + lip, z1],
      [x1 - lip, z0, x1 + lip, z1],
    ]) {
      const g = new THREE.BoxGeometry(rx1 - rx0, 0.11, rz1 - rz0);
      g.translate((rx0 + rx1) / 2, rimY + 0.055, (rz0 + rz1) / 2);
      addRoofPart(g, toon(t.inOut === null ? P.ochre : P.sand), false);
    }
  }

  if (wideOk) {
    const eaveY = c.y - 0.03;
    for (let x = a.x + 0.4; x <= c.x - 0.4; x += 0.95) {
      for (const zOut of [a.z - 0.38, c.z + 0.04]) {
        const g = new THREE.BoxGeometry(0.09, 0.09, 0.36);
        g.translate(x, eaveY, zOut + 0.17);
        addSafeOverhang(b, map, overhangs, g, toon(P.bark), false);
      }
    }
    for (let z = a.z + 0.4; z <= c.z - 0.4; z += 0.95) {
      for (const xOut of [a.x - 0.38, c.x + 0.04]) {
        const g = new THREE.BoxGeometry(0.36, 0.09, 0.09);
        g.translate(xOut + 0.17, eaveY, z);
        addSafeOverhang(b, map, overhangs, g, toon(P.bark), false);
      }
    }
  }

  const ridgeLen = ridgeHalf * 2 + 0.36;
  const ridgeGeo = new THREE.CylinderGeometry(0.11, 0.11, ridgeLen, 8);
  if (alongZ) ridgeGeo.rotateX(Math.PI / 2);
  else ridgeGeo.rotateZ(Math.PI / 2);
  ridgeGeo.translate(cx, c.y + 2.25, cz);
  addRoofPart(ridgeGeo, toon(P.wood), false);
  for (let k = -ridgeHalf; k <= ridgeHalf; k += 0.55) {
    const tie = new THREE.CylinderGeometry(0.135, 0.135, 0.06, 8);
    if (alongZ) {
      tie.rotateX(Math.PI / 2);
      tie.translate(cx, c.y + 2.25, cz + k);
    } else {
      tie.rotateZ(Math.PI / 2);
      tie.translate(cx + k, c.y + 2.25, cz);
    }
    addRoofPart(tie, toon(P.bark), false);
  }
}

export function patachoFestoons(b: Builder, map: MapData, materials: PatachoMaterials, overhangs: Box[]) {
  const poles: [number, number, number, number][] = [
    [-18.15, 4.6, 6.2, -17.15],
    [-8.85, 4.0, 6.2, -17.15],
    [-8.85, 4.0, 6.2, -12.15],
    [-13.15, 4.8, 6.2, -1.0],
    [-13.15, 4.8, 6.2, 3.0],
    [-5.85, 4.0, 6.2, 10.15],
    [-5.85, 4.0, 6.2, 16.0],
    [-16.15, 4.6, 6.2, 16.0],
  ];
  for (const [px, y0, y1, pz] of poles) {
    const pole = new THREE.CylinderGeometry(0.045, 0.055, y1 - y0, 6);
    pole.translate(px, (y0 + y1) / 2, pz);
    b.add(pole, toon(P.wood), { cast: false });
  }

  const spans: [[number, number, number], [number, number, number], boolean][] = [
    [[-18.15, 6.12, -17.15], [-8.85, 6.12, -17.15], true],
    [[-13.15, 6.12, -1.0], [-8.85, 6.12, -12.15], true],
    [[-13.15, 6.12, 3.0], [-5.85, 6.12, 10.15], true],
    [[-16.15, 6.12, 16.0], [-5.85, 6.12, 16.0], true],
    [[-21, 5.1, -4], [-21, 5.1, -17], false],
    [[-20, 5.1, 5], [-20, 5.1, 15], false],
  ];
  const flagColors = [P.colonialSky, P.ochre, P.colonialRose, P.cal, P.seaTurquoise];

  for (const [p0, p1, lights] of spans) {
    const start = new THREE.Vector3(...p0),
      end = new THREE.Vector3(...p1);
    const dist = start.distanceTo(end);
    const sag = Math.min(0.45, dist * 0.035);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const p = start.clone().lerp(end, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
    }
    const wire = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.026, 5, false);
    if (!addSafeOverhang(b, map, overhangs, wire, toon(P.bark), false)) continue;

    const steps = Math.max(4, Math.floor(dist / 1.35));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const p = start.clone().lerp(end, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      if (lights && k % 2 === 1) {
        const socket = new THREE.CylinderGeometry(0.03, 0.035, 0.08, 6);
        socket.translate(p.x, p.y - 0.05, p.z);
        addSafeOverhang(b, map, overhangs, socket, toon(P.inkSoft), false);
        const bulb = new THREE.IcosahedronGeometry(0.065, 1);
        bulb.translate(p.x, p.y - 0.12, p.z);
        addSafeOverhang(b, map, overhangs, bulb, materials.glow, false);
      } else {
        const dir = end.clone().sub(start).setY(0).normalize().multiplyScalar(0.24);
        const a = p.clone().addScaledVector(dir, -1),
          c = p.clone().addScaledVector(dir, 1);
        const tip = p.clone().setY(p.y - 0.42);
        const flag = paintedFaces([...a.toArray(), ...c.toArray(), ...tip.toArray()], true);
        addSafeOverhang(b, map, overhangs, flag, toon(flagColors[k % flagColors.length]), false);
      }
    }
  }
}
