import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sceneLit } from '../render/scene-light';
import { PALETTE as P, toon } from '../toon';
import { Builder, paintColor, place } from '../world/builder';
import { paintedFaces } from './patacho-materials';

// Jangadas artesanais de Porto de Pedras / Patacho: 6 toras de piúba, carlinga, samburá,
// remo de governo e vela latina abaulada pelo vento, balançando nas piscinas naturais.

const noRaycast = () => {};

function buildJangadaParts(
  addPart: (geo: THREE.BufferGeometry, color: number) => void,
  sailMain: number,
  sailStripe: number,
  raisedSail = true,
) {
  for (let i = 0; i < 6; i++) {
    const lx = (i - 2.5) * 0.31;
    const outer = Math.abs(i - 2.5) > 1.8;
    const len = outer ? 4.4 : 4.9;
    const log = new THREE.CylinderGeometry(0.13, 0.15, len, 7);
    log.rotateX(Math.PI / 2);
    log.translate(lx, 0.06, outer ? -0.1 : 0.08);
    addPart(log, i % 2 ? P.wood : P.cantaria);
    const nose = new THREE.ConeGeometry(0.125, 0.55, 7);
    nose.rotateX(Math.PI / 2 - 0.18);
    nose.translate(lx, 0.11, len / 2 + 0.18);
    addPart(nose, P.sand);
  }
  for (const tz of [-1.5, -0.15, 1.35]) {
    const beam = new THREE.BoxGeometry(1.92, 0.08, 0.14);
    beam.translate(0, 0.21, tz);
    addPart(beam, P.bark);
  }
  const bench = new THREE.BoxGeometry(1.55, 0.34, 0.42);
  bench.translate(0, 0.38, 0.55);
  addPart(bench, P.wood);

  const basket = new THREE.CylinderGeometry(0.24, 0.2, 0.36, 8);
  basket.translate(-0.42, 0.38, -0.65);
  addPart(basket, P.ochre);

  const oar = new THREE.CylinderGeometry(0.035, 0.04, 3.1, 6);
  oar.rotateX(Math.PI / 2 + 0.16);
  oar.rotateY(0.12);
  oar.translate(0.32, 0.34, -2.1);
  addPart(oar, P.sand);

  if (!raisedSail) {
    const furled = new THREE.CylinderGeometry(0.09, 0.12, 4.8, 8);
    furled.rotateX(Math.PI / 2 - 0.06);
    furled.translate(0, 0.58, 0.1);
    addPart(furled, P.cal);
    return;
  }

  const mast = new THREE.CylinderGeometry(0.045, 0.07, 5.4, 7);
  mast.rotateX(-0.08);
  mast.translate(0, 2.85, 0.85);
  addPart(mast, P.wood);

  const boom = new THREE.CylinderGeometry(0.03, 0.045, 3.8, 6);
  boom.rotateX(Math.PI / 2 - 0.22);
  boom.translate(0.18, 1.18, -0.75);
  addPart(boom, P.sand);

  const N = 6;
  const mainVerts: number[] = [];
  const stripeVerts: number[] = [];
  const sailPt = (u: number, w: number): number[] => {
    const span = 1 - u;
    const z = THREE.MathUtils.lerp(0.85 - u * 0.42, -2.45 + u * 2.85, w);
    const y = THREE.MathUtils.lerp(0.75 + u * 4.75, 1.35 + u * 4.15, w * span + u * (1 - span));
    const belly = Math.sin(Math.PI * Math.min(1, w * 0.85 + u * 0.25)) * Math.sin(Math.PI * (0.15 + u * 0.8)) * 0.52;
    return [belly, y, z];
  };
  for (let i = 0; i < N; i++) {
    const u0 = i / N,
      u1 = (i + 1) / N;
    const target = i === 1 || i === 2 ? stripeVerts : mainVerts;
    for (let j = 0; j < N - i; j++) {
      const w0 = i === N - 1 ? 0 : j / (N - i);
      const w1 = i === N - 1 ? 1 : (j + 1) / (N - i);
      const p00 = sailPt(u0, w0),
        p01 = sailPt(u0, w1);
      const p10 = u1 >= 1 ? sailPt(1, 0) : sailPt(u1, Math.min(1, j / Math.max(1, N - i - 1)));
      target.push(...p00, ...p01, ...p10);
      if (j < N - i - 1 && u1 < 1) {
        const p11 = sailPt(u1, (j + 1) / Math.max(1, N - i - 1));
        target.push(...p01, ...p11, ...p10);
      }
    }
  }
  if (mainVerts.length) addPart(paintedFaces(mainVerts, true), sailMain);
  if (stripeVerts.length) addPart(paintedFaces(stripeVerts, true), sailStripe);
}

export function buildFloatingJangadas(scene: THREE.Scene): (dt: number, time: number) => void {
  const fleet: [number, number, number, number, number][] = [
    [37.5, -14, 0.28, P.cal, P.colonialRed],
    [41.5, 12, -0.34, P.cal, P.colonialBlue],
    [54, -31, 0.52, P.ochre, P.cal],
    [59, 25, -0.22, P.cal, P.colonialMoss],
    [76, -3, 0.15, P.colonialRose, P.cal],
  ];
  const groups: { group: THREE.Mesh; phase: number }[] = [];
  const mat = toon(P.cal).clone();
  mat.vertexColors = true;
  sceneLit(mat);

  for (const [idx, [x, z, yaw, sailMain, sailStripe]] of fleet.entries()) {
    const geos: THREE.BufferGeometry[] = [];
    buildJangadaParts(
      (geo, color) => {
        if (!geo.index) geo.setIndex(Array.from({ length: geo.attributes.position.count }, (_, k) => k));
        if (!geo.attributes.normal) geo.computeVertexNormals();
        for (const attr of Object.keys(geo.attributes)) {
          if (attr !== 'position' && attr !== 'normal') geo.deleteAttribute(attr);
        }
        paintColor(geo, new THREE.Color(color));
        geos.push(geo);
      },
      sailMain,
      sailStripe,
      true,
    );
    const mesh = new THREE.Mesh(mergeGeometries(geos, false)!, mat);
    mesh.position.set(x, -0.07, z);
    mesh.rotation.y = yaw;
    mesh.raycast = noRaycast;
    scene.add(mesh);
    groups.push({ group: mesh, phase: idx * 1.37 });
  }

  return (_dt, time) => {
    for (const { group, phase } of groups) {
      group.position.y = -0.07 + Math.sin(time * 1.45 + phase) * 0.032;
      group.rotation.z = Math.sin(time * 1.15 + phase) * 0.042;
      group.rotation.x = Math.cos(time * 0.9 + phase) * 0.024;
    }
  };
}

export function buildBeachedBoats(b: Builder) {
  const placeStatic = (x: number, z: number, yaw: number, main: number, stripe: number, raised: boolean) => {
    buildJangadaParts((geo, color) => b.add(place(geo, x, 0.06, z, yaw), toon(color), { cast: false }), main, stripe, raised);
  };
  placeStatic(21.5, -41.5, 0.42, P.cal, P.terracotta, false);
  placeStatic(19.5, 42.5, -0.38, P.cal, P.ochre, true);
}
