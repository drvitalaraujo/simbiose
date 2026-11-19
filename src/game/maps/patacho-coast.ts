import * as THREE from 'three';
import { sceneLit } from '../render/scene-light';
import { PALETTE as P, toon } from '../toon';
import { Builder } from '../world/builder';
import { rng } from '../world/shapes';
import { buildBeachedBoats, buildFloatingJangadas } from './patacho-boats';
import { paintedFaces, type PatachoMaterials } from './patacho-materials';

// Enseada do Patacho: linha d'água orgânica (sem corte reto), piscinas naturais turquesa,
// bancos de areia (crôas), arrecifes de coral/arenito na maré baixa e espuma animada.

const noRaycast = () => {};

/** Contorno orgânico da beira-mar: sempre > 30,02 m na faixa jogável e curvando em enseada ao longe. */
export function patachoShoreX(z: number): number {
  const wave = Math.sin(z * 0.115) * 0.62 + Math.cos(z * 0.26 + 0.8) * 0.22;
  const az = Math.abs(z);
  const bay = az > 37 ? Math.pow(Math.min(1, (az - 37) / 145), 1.85) * 66 : 0;
  return 30.88 + wave + bay;
}

interface ReefSpec {
  x: number;
  z: number;
  len: number;
  wid: number;
  yaw: number;
}

const REEFS: readonly ReefSpec[] = [
  { x: 45, z: -26, len: 15, wid: 3.4, yaw: 0.12 },
  { x: 43, z: -6, len: 12, wid: 2.9, yaw: -0.08 },
  { x: 46, z: 15, len: 16, wid: 3.6, yaw: 0.09 },
  { x: 44, z: 36, len: 13, wid: 3.1, yaw: -0.14 },
  { x: 63, z: -38, len: 22, wid: 4.2, yaw: 0.07 },
  { x: 65, z: -8, len: 26, wid: 4.6, yaw: -0.05 },
  { x: 64, z: 24, len: 24, wid: 4.4, yaw: 0.08 },
  { x: 54, z: -56, len: 18, wid: 3.5, yaw: 0.22 },
];

export function dressPatachoCoast(
  b: Builder,
  scene: THREE.Scene,
  materials: PatachoMaterials,
): (dt: number, time: number) => void {
  buildSeamlessShoreSand(b, materials.sand);
  buildOceanLagoon(b);
  buildCoralReefs(b);
  buildMaritimeBuoys(b);
  buildBeachedBoats(b);

  const animateFoam = buildAnimatedSurf(scene);
  const animateBoats = buildFloatingJangadas(scene);

  return (dt, time) => {
    animateFoam(dt, time);
    animateBoats(dt, time);
  };
}

function buildSeamlessShoreSand(b: Builder, sandMat: THREE.Material) {
  const verts: number[] = [];
  const stepZ = 2;
  for (let z = -38; z < 38; z += stepZ) {
    const z0 = z,
      z1 = z + stepZ;
    const s0 = patachoShoreX(z0) + 1.4,
      s1 = patachoShoreX(z1) + 1.4;
    verts.push(29.92, -0.002, z0, 29.92, -0.002, z1, s1, -0.16, z1);
    verts.push(29.92, -0.002, z0, s1, -0.16, z1, s0, -0.16, z0);
  }
  b.add(paintedFaces(verts, false, 'world', 4.25), sandMat, { cast: false });
}

function buildOceanLagoon(b: Builder) {
  const nx = 64,
    nz = 96;
  const g = new THREE.PlaneGeometry(1, 1, nx, nz);
  g.rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  const colors = new Float32Array(p.count * 3);

  const sandBar = new THREE.Color(P.beachSand).lerp(new THREE.Color(P.seaShallow), 0.48);
  const shallow = new THREE.Color(P.seaShallow);
  const turquoise = new THREE.Color(P.seaTurquoise);
  const deep = new THREE.Color(P.seaDeep);
  const reefShade = new THREE.Color(P.clothTeal).lerp(new THREE.Color(P.seaDeep), 0.4);

  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5;
    const z = p.getZ(i) * 460;
    const shore = patachoShoreX(z) - 0.35;
    const dist = u < 0.7 ? (u / 0.7) * 75 : 75 + Math.pow((u - 0.7) / 0.3, 1.8) * 245;
    const x = shore + dist;
    p.setXYZ(i, x, -0.085, z);

    const c = shallow.clone();
    const sandMix = Math.exp(-Math.max(0, dist) * 0.24);
    const croa =
      Math.max(0, Math.sin(x * 0.14 + Math.sin(z * 0.07) * 1.8) * Math.cos(z * 0.11 - x * 0.04)) *
      (1 - THREE.MathUtils.smoothstep(dist, 12, 48));
    c.lerp(sandBar, Math.min(1, sandMix * 0.75 + croa * 0.55));
    c.lerp(turquoise, THREE.MathUtils.smoothstep(dist, 5, 28) * 0.68);
    c.lerp(deep, THREE.MathUtils.smoothstep(dist, 34, 135) * 0.88);

    const patch = Math.sin(x * 0.23 - z * 0.09) * Math.cos(z * 0.19 + x * 0.07);
    if (patch > 0.35 && dist > 8 && dist < 58) c.lerp(reefShade, ((patch - 0.35) / 0.65) * 0.32);

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mat = toon(P.cal).clone();
  mat.vertexColors = true;
  b.add(g, mat, { cast: false });
}

function buildCoralReefs(b: Builder) {
  const r = rng(8821);
  for (const rf of REEFS) {
    const segs = Math.max(10, Math.round(rf.len / 1.4));
    const foamVerts: number[] = [];
    const mossVerts: number[] = [];
    const rockVerts: number[] = [];
    const cosY = Math.cos(rf.yaw),
      sinY = Math.sin(rf.yaw);

    const profile = (i: number) => {
      const u = i / segs;
      const along = (u - 0.5) * rf.len;
      const env = Math.sin(u * Math.PI);
      const wobble = 0.75 + 0.28 * Math.sin(u * Math.PI * 5 + rf.z * 0.2);
      const halfW = rf.wid * 0.5 * Math.pow(env, 0.55) * wobble;
      const sway = Math.sin(u * Math.PI * 3 + rf.x * 0.3) * 0.45;
      return { cx: rf.x + sinY * along + cosY * sway, cz: rf.z + cosY * along - sinY * sway, halfW };
    };

    const pushBand = (
      target: number[],
      p0: ReturnType<typeof profile>,
      p1: ReturnType<typeof profile>,
      scaleW: number,
      y: number,
      shiftX = 0,
    ) => {
      const l0x = p0.cx + shiftX - cosY * p0.halfW * scaleW,
        l0z = p0.cz + sinY * p0.halfW * scaleW;
      const r0x = p0.cx + shiftX + cosY * p0.halfW * scaleW,
        r0z = p0.cz - sinY * p0.halfW * scaleW;
      const l1x = p1.cx + shiftX - cosY * p1.halfW * scaleW,
        l1z = p1.cz + sinY * p1.halfW * scaleW;
      const r1x = p1.cx + shiftX + cosY * p1.halfW * scaleW,
        r1z = p1.cz - sinY * p1.halfW * scaleW;
      target.push(l0x, y, l0z, l1x, y, l1z, r1x, y, r1z, l0x, y, l0z, r1x, y, r1z, r0x, y, r0z);
    };

    for (let i = 0; i < segs; i++) {
      const p0 = profile(i),
        p1 = profile(i + 1);
      pushBand(foamVerts, p0, p1, 1.48, -0.078, 0.32);
      pushBand(mossVerts, p0, p1, 1.06, -0.068, 0.06);
      if (i > 0 && i < segs - 1 && r() > 0.08) pushBand(rockVerts, p0, p1, 0.72, -0.048, -0.05);
    }
    b.add(paintedFaces(foamVerts, true), toon(P.cal), { cast: false, receive: false });
    b.add(paintedFaces(mossVerts, true), toon(P.colonialMoss), { cast: false });
    if (rockVerts.length) b.add(paintedFaces(rockVerts, true), toon(P.cantaria), { cast: false });
  }
}

function buildMaritimeBuoys(b: Builder) {
  for (let z = -35; z <= 35; z += 5) {
    const bx = 30.52 + Math.sin(z * 0.18) * 0.12;
    const body = new THREE.CylinderGeometry(0.16, 0.14, 0.38, 10);
    body.translate(bx, 0.06, z);
    b.add(body, toon(P.cal), { cast: false });
    const stripe = new THREE.CylinderGeometry(0.172, 0.172, 0.14, 10);
    stripe.translate(bx, 0.14, z);
    b.add(stripe, toon(P.orange), { cast: false });
    const cap = new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.translate(bx, 0.25, z);
    b.add(cap, toon(P.orange), { cast: false });

    if (z < 35) {
      const nextZ = z + 5,
        nextX = 30.52 + Math.sin(nextZ * 0.18) * 0.12;
      const seg: THREE.Vector3[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        seg.push(
          new THREE.Vector3(
            THREE.MathUtils.lerp(bx, nextX, t),
            0.14 - Math.sin(t * Math.PI) * 0.16,
            THREE.MathUtils.lerp(z, nextZ, t),
          ),
        );
      }
      b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seg), 8, 0.022, 5, false), toon(P.ochre), {
        cast: false,
      });
    }
  }
}

function buildAnimatedSurf(scene: THREE.Scene): (dt: number, time: number) => void {
  const makeRibbon = (offset: number, width: number, zRange: number, color: number, scalloped = false) => {
    const v: number[] = [];
    const step = 1.6;
    for (let z = -zRange; z < zRange; z += step) {
      const lace = (zz: number) =>
        scalloped ? Math.abs(Math.sin(zz * 0.26 + offset)) * 0.85 : Math.sin(zz * 0.33 + offset) * 0.22;
      const x0 = patachoShoreX(z) + offset - lace(z) * 0.45;
      const x1 = patachoShoreX(z + step) + offset - lace(z + step) * 0.45;
      const w0 = scalloped ? 0.16 + lace(z) * width : width * (0.65 + 0.35 * Math.sin(z * 0.21 + offset * 2));
      const w1 = scalloped ? 0.16 + lace(z + step) * width : width * (0.65 + 0.35 * Math.sin((z + step) * 0.21 + offset * 2));
      v.push(x0, -0.072, z, x1, -0.072, z + step, x1 + w1, -0.072, z + step);
      v.push(x0, -0.072, z, x1 + w1, -0.072, z + step, x0 + w0, -0.072, z);
    }
    const geo = paintedFaces(v, true);
    geo.deleteAttribute('uv');
    const mat = toon(color).clone();
    sceneLit(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.raycast = noRaycast;
    scene.add(mesh);
    return mesh;
  };

  const swashNear = makeRibbon(0.08, 1.05, 135, P.cal, true);
  const swashMid = makeRibbon(3.2, 0.55, 125, P.seaFoam, true);
  const reefBreak = makeRibbon(34.2, 0.45, 85, P.cal, false);

  return (_dt, time) => {
    swashNear.position.x = Math.sin(time * 1.15) * 0.34;
    swashMid.position.x = Math.sin(time * 1.15 - 1.7) * 0.28;
    reefBreak.position.x = Math.cos(time * 0.9) * 0.26;
  };
}
