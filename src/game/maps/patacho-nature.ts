import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE as P, toon } from '../toon';
import { Builder } from '../world/builder';
import { broadleaf } from '../world/flora';
import { box, rng } from '../world/shapes';
import { clearOfBody } from './facades';
import { PATACHO_PALMS } from './patacho';
import { patachoShoreX } from './patacho-coast';
import { paintedFaces, type PatachoMaterials } from './patacho-materials';
import type { MapData } from './types';

// Natureza costeira de Alagoas: coqueiros de tronco roliço segmentado, copas volumétricas em V,
// dunas contínuas de restinga, pontas de areia fechando a enseada e cercas rústicas de sisal.

const UP = new THREE.Vector3(0, 1, 0);

export interface PatachoPalmOpts {
  inArena?: boolean;
  far?: boolean;
  baseY?: number;
  yaw?: number;
  lean?: number;
}

export function dressPatachoNature(
  b: Builder,
  map: MapData,
  materials: PatachoMaterials,
  overhangs: Box[],
) {
  buildOuterDunesAndHills(b, materials.sand);

  // 14 coqueiros dentro da arena: tronco roliço em gomos inscrito na coluna 0,46 x 0,46 m
  for (const [x, z] of PATACHO_PALMS) {
    patachoPalm(b, map, overhangs, x, z, 8, { inArena: true });
  }

  // Coqueiral denso a oeste (primeira faixa detalhada projetando sombra + fundo profundo)
  const r = rng(5107);
  for (let i = 0; i < 22; i++) {
    const z = -66 + i * 6.3 + (r() - 0.5) * 2.4;
    const x = -32.8 - (i % 3) * 3.8 - r() * 2.2;
    const baseY = duneHeight(x, z) - 0.12;
    patachoPalm(b, map, overhangs, x, z, 8.2 + r() * 3.2, {
      baseY,
      yaw: (r() - 0.5) * 0.9,
      lean: 1.4 + r() * 1.9,
    });
  }
  for (let i = 0; i < 26; i++) {
    const z = -98 + i * 7.8 + (r() - 0.5) * 3;
    const x = -46 - (i % 4) * 9.5 - r() * 5;
    patachoPalm(b, map, overhangs, x, z, 9.5 + r() * 4.5, {
      far: true,
      baseY: duneHeight(x, z) - 0.15,
      yaw: (r() - 0.5) * 1.4,
      lean: 1.5 + r() * 2.6,
    });
  }

  // Coqueiros nas Pontas Norte e Sul da enseada (abraçam a baía ao olhar ao longo da praia!)
  for (const dir of [-1, 1] as const) {
    for (let i = 0; i < 14; i++) {
      const z = dir * (40 + i * 8.2 + r() * 2.5);
      const shore = patachoShoreX(z);
      const x = shore - 5.5 - (i % 3) * 6.5 - r() * 4;
      const near = i < 3;
      patachoPalm(b, map, overhangs, x, z, 8.5 + r() * 3.8, {
        far: !near,
        baseY: duneHeight(x, z) - 0.1,
        yaw: dir < 0 ? 0.4 + r() * 0.6 : -0.4 - r() * 0.6,
        lean: 1.6 + r() * 2.2,
      });
    }
  }

  // Amendoeiras-da-praia e tufos orgânicos de restinga / dunas
  for (let i = 0; i < 12; i++) {
    const z = -68 + i * 12.2 + (r() - 0.5) * 4;
    const x = -42 - (i % 3) * 8 - r() * 6;
    broadleaf(b, x, duneHeight(x, z) - 0.2, z, 6.8 + r() * 3.8, r);
  }
  buildRestingaFlora(b);
  buildPerimeterFences(b);
}

/** Relevo suave das dunas externas: zero dentro da arena e subindo gradualmente na restinga. */
export function duneHeight(x: number, z: number): number {
  const dx = Math.max(0, -30.8 - x);
  const dz = Math.max(0, Math.abs(z) - 37.2);
  if (dx <= 0 && dz <= 0) return -0.05;
  const westRise =
    THREE.MathUtils.smoothstep(dx, 0, 24) * (1.2 + Math.sin(z * 0.085 + x * 0.06) * 0.48) +
    THREE.MathUtils.smoothstep(dx, 28, 120) * 2.1;
  const spitRise =
    THREE.MathUtils.smoothstep(dz, 0, 35) *
    (0.6 + Math.cos(x * 0.09 + z * 0.06) * 0.28) *
    THREE.MathUtils.clamp((patachoShoreX(z) - x) / 14, 0, 1);
  return westRise + spitRise;
}

/** Malha contínua de areia e tabuleiros costeiros até a borda do domo do céu (sem ilha flutuante). */
function buildOuterDunesAndHills(b: Builder, sandMat: THREE.Material) {
  const nx = 34,
    nz = 48;
  const verts: number[] = [];
  const zMin = -225,
    zMax = 225;
  const xMin = -245;

  const pt = (ix: number, iz: number): [number, number, number] => {
    const vz = iz / nz;
    const z = THREE.MathUtils.lerp(zMin, zMax, vz);
    const xMax = patachoShoreX(z) + 1.35;
    const u = ix / nx;
    // Mais resolução perto das cercas (-48..32) do que no fundo distante (-245)
    const shaped = u < 0.35 ? Math.pow(u / 0.35, 1.7) * 0.72 : 0.72 + ((u - 0.35) / 0.65) * 0.28;
    const x = THREE.MathUtils.lerp(xMin, xMax, shaped);

    // Sob o piso jogável (-30..30, -36..36), fica 5 cm abaixo para não disputar profundidade
    if (x >= -30.2 && x <= 30.05 && Math.abs(z) <= 36.2) return [x, -0.05, z];
    // Beira d'água mergulha suavemente sob o oceano (-0,16 m)
    const toShore = xMax - x;
    if (toShore < 2.2) {
      const t = toShore / 2.2;
      return [x, THREE.MathUtils.lerp(-0.17, Math.max(-0.02, duneHeight(x, z) * 0.35), t), z];
    }
    return [x, duneHeight(x, z), z];
  };

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const p00 = pt(ix, iz),
        p10 = pt(ix + 1, iz),
        p01 = pt(ix, iz + 1),
        p11 = pt(ix + 1, iz + 1);
      // Pula células inteiramente escondidas sob o chão jogável
      if (
        p00[0] > -29.8 &&
        p11[0] < 29.6 &&
        Math.abs(p00[2]) < 35.6 &&
        Math.abs(p11[2]) < 35.6
      ) {
        continue;
      }
      verts.push(...p00, ...p01, ...p11, ...p00, ...p11, ...p10);
    }
  }
  b.add(paintedFaces(verts, false, 'world', 4.25), sandMat, { cast: false });

  // Cortina natural de amendoeiras e coqueiral distante fechando o horizonte oeste (sem esferas gigantes)
  const r = rng(6612);
  for (let i = 0; i < 24; i++) {
    const z = -135 + i * 11.5 + (r() - 0.5) * 4;
    const x = -64 - (i % 3) * 11 - r() * 8;
    broadleaf(b, x, duneHeight(x, z) - 0.25, z, 7.2 + r() * 3.6, r);
  }
}

export function patachoPalm(
  b: Builder,
  map: MapData,
  overhangs: Box[],
  x: number,
  z: number,
  h: number,
  opts: PatachoPalmOpts = {},
) {
  const inArena = opts.inArena ?? false;
  const far = opts.far ?? false;
  const baseY = opts.baseY ?? 0;
  const random = rng(Math.abs(Math.round(x * 131 + z * 719)) + 7);
  const yaw = opts.yaw ?? random() * Math.PI * 2;
  const lean = inArena ? 0 : (opts.lean ?? 1.8);

  const trunkAt = (u: number) =>
    new THREE.Vector3(
      x + Math.cos(yaw) * lean * u * u,
      baseY + h * u,
      z + Math.sin(yaw) * lean * u * u,
    );

  // Tronco roliço segmentado em gomos orgânicos com anéis escuros de cicatriz foliar
  const segs = far ? 5 : 10;
  const baseR = inArena ? 0.225 : 0.24;
  for (let i = 0; i < segs; i++) {
    const u0 = i / segs,
      u1 = (i + 1) / segs;
    const a = trunkAt(u0),
      c = trunkAt(u1);
    const dir = c.clone().sub(a);
    const len = dir.length();
    const taper0 = 1 - u0 * 0.28;
    const taper1 = 1 - u1 * 0.28;
    const gomo = new THREE.CylinderGeometry(baseR * taper1 * 0.94, baseR * taper0 * 1.02, len + 0.02, far ? 6 : 8);
    gomo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
    gomo.translate((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2);
    const col = i % 3 === 0 ? P.cantaria : i % 3 === 1 ? P.wood : P.sand;
    b.add(gomo, toon(col), { cast: !far, receive: !far });

    if (!far && i > 0) {
      const ring = new THREE.CylinderGeometry(baseR * taper0 * 1.05, baseR * taper0 * 1.05, 0.048, 8);
      ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
      ring.translate(a.x, a.y, a.z);
      b.add(ring, toon(P.bark), { cast: false });
    }
  }

  const crown = trunkAt(1);
  const checkOverhang = inArena || (x > -35 && Math.abs(z) < 41);

  const addCrownGeo = (geo: THREE.BufferGeometry, color: number, castShadow: boolean) => {
    if (checkOverhang) {
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const bounds = box(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z);
      if (!clearOfBody(map, bounds)) return;
      if (inArena) overhangs.push(bounds);
    }
    b.add(geo, toon(color), { cast: castShadow && !far, receive: !far });
  };

  // Bainha fibrosa escura (palmito) e cacho farto de cocos-da-baía sob as palmas
  const heart = new THREE.IcosahedronGeometry(0.28, 0);
  heart.scale(1, 0.85, 1);
  heart.translate(crown.x, crown.y - 0.08, crown.z);
  addCrownGeo(heart, P.bark, false);

  if (!far) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + random() * 0.4;
      const nut = new THREE.IcosahedronGeometry(0.145, 1);
      nut.scale(0.95, 1.12, 0.95);
      nut.translate(crown.x + Math.cos(a) * 0.25, crown.y - 0.28 - (i % 2) * 0.08, crown.z + Math.sin(a) * 0.25);
      addCrownGeo(nut, i % 2 ? P.ochre : P.colonialMoss, false);
    }
  }

  // Três andares de palmas arqueadas em V: saia seca inferior, copa principal longa e topo iluminado
  const tiers = far
    ? [{ count: 8, len: 3.7, rise: 0.85, drop: 1.55, colors: [P.leaf, P.leafLight] }]
    : [
        { count: 3, len: 2.55, rise: 0.25, drop: 1.45, colors: [P.ochre, P.colonialMoss] },
        { count: 7, len: 3.85, rise: 0.95, drop: 1.42, colors: [P.leaf, P.leafLight, P.colonialMoss] },
        { count: 4, len: 3.1, rise: 1.45, drop: 0.95, colors: [P.leafLight, P.leaf] },
      ];

  for (const [tierIdx, tier] of tiers.entries()) {
    for (let j = 0; j < tier.count; j++) {
      const a = (j / tier.count) * Math.PI * 2 + tierIdx * 0.7 + random() * 0.28;
      const len = tier.len * (0.88 + random() * 0.24);
      const geo = buildPalmFrond(crown, a, len, tier.rise, tier.drop, far ? 5 : 9);
      const color = tier.colors[(j + tierIdx) % tier.colors.length];
      addCrownGeo(geo, color, tierIdx > 0);
    }
  }
}

/** Palma com nervura arqueada e folíolos dobrados em V (ganha luz cel-shaded de verdade). */
function buildPalmFrond(
  origin: THREE.Vector3,
  angle: number,
  length: number,
  rise: number,
  drop: number,
  segs: number,
): THREE.BufferGeometry {
  const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
  const spineAt = (t: number) =>
    origin
      .clone()
      .addScaledVector(forward, t * length)
      .add(new THREE.Vector3(0, Math.sin(t * Math.PI * 0.82) * rise - t * t * drop, 0));

  const verts: number[] = [];
  for (let k = 0; k < segs; k++) {
    const t0 = k / segs,
      t1 = (k + 1) / segs;
    const s0 = spineAt(t0),
      s1 = spineAt(t1);
    const env = Math.sin(Math.pow(t0 * 0.85 + 0.12, 0.85) * Math.PI);
    const w = env * 0.82;

    // Nervura central estreita até a ponta
    const r0L = s0.clone().addScaledVector(side, 0.03 * (1 - t0 * 0.7));
    const r0R = s0.clone().addScaledVector(side, -0.03 * (1 - t0 * 0.7));
    verts.push(...r0L.toArray(), ...r0R.toArray(), ...s1.toArray());

    if (k === 0) continue;
    // Folíolos laterais inclinados para baixo em "V" e afilados para a frente
    const tipSweep = spineAt(Math.min(1, t0 + 0.14));
    for (const sign of [-1, 1] as const) {
      const leafTip = tipSweep.clone().addScaledVector(side, w * sign);
      leafTip.y -= 0.18 + w * 0.16;
      const nextRoot = spineAt(Math.min(1, t0 + 0.095));
      if (sign > 0) verts.push(...s0.toArray(), ...leafTip.toArray(), ...nextRoot.toArray());
      else verts.push(...s0.toArray(), ...nextRoot.toArray(), ...leafTip.toArray());
    }
  }
  return paintedFaces(verts, true);
}

/** Moitas orgânicas de restinga, salsa-da-praia e troncos trazidos pela maré fora das cercas. */
function buildRestingaFlora(b: Builder) {
  const r = rng(4419);
  for (let i = 0; i < 42; i++) {
    const z = -74 + i * 3.6 + (r() - 0.5) * 2.2;
    const x = -31.8 - (i % 4) * 2.4 - r() * 3.2;
    const y0 = duneHeight(x, z);
    const puffs = 2 + (i % 3);
    for (let p = 0; p < puffs; p++) {
      const px = x + (r() - 0.5) * 1.1;
      const pz = z + (r() - 0.5) * 1.1;
      const rad = 0.42 + r() * 0.45;
      const bush = new THREE.IcosahedronGeometry(rad, 1);
      bush.scale(1.25, 0.58 + r() * 0.25, 1.15);
      bush.translate(px, y0 + rad * 0.36, pz);
      b.add(bush, toon(p === 0 ? P.leaf : p === 1 ? P.colonialMoss : P.leafLight), { cast: false });
    }
  }
  // Moitas esparsas também nas dunas norte e sul fora da cerca
  for (const dir of [-1, 1] as const) {
    for (let i = 0; i < 16; i++) {
      const x = -28 + i * 3.5 + (r() - 0.5) * 1.8;
      const z = dir * (38.2 + (i % 3) * 2.4 + r() * 2.5);
      const y0 = duneHeight(x, z);
      const rad = 0.45 + r() * 0.4;
      const bush = new THREE.IcosahedronGeometry(rad, 1);
      bush.scale(1.3, 0.55, 1.2);
      bush.translate(x, y0 + rad * 0.34, z);
      b.add(bush, toon(i % 2 ? P.leaf : P.colonialMoss), { cast: false });
    }
  }
}

/** Cercas costeiras de mourões roliços de eucalipto e corda dupla de sisal em catenária. */
function buildPerimeterFences(b: Builder) {
  const r = rng(3318);
  const ropeSpan = (p0: THREE.Vector3, p1: THREE.Vector3, sag: number) => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const p = p0.clone().lerp(p1, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
    }
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.024, 5, false), toon(P.sand), {
      cast: false,
    });
  };

  const post = (x: number, z: number) => {
    const h = 1.02 + (r() - 0.5) * 0.08;
    const cyl = new THREE.CylinderGeometry(0.055, 0.068, h, 7);
    cyl.translate(x, h / 2, z);
    b.add(cyl, toon(P.wood), { cast: false });
    const cap = new THREE.ConeGeometry(0.062, 0.06, 7);
    cap.translate(x, h + 0.03, z);
    b.add(cap, toon(P.bark), { cast: false });
  };

  // Norte e Sul (z = -36,05 e +36,05: colado por fora do limite)
  for (const z of [-36.05, 36.05]) {
    for (let x = -30; x <= 30; x += 3) {
      post(x, z);
      if (x < 30) {
        ropeSpan(new THREE.Vector3(x, 0.84, z), new THREE.Vector3(x + 3, 0.84, z), 0.07);
        ropeSpan(new THREE.Vector3(x, 0.46, z), new THREE.Vector3(x + 3, 0.46, z), 0.06);
      }
    }
  }

  // Oeste (x = -30,05: colado por fora do limite)
  for (let z = -36; z <= 36; z += 3) {
    post(-30.05, z);
    if (z < 36) {
      ropeSpan(new THREE.Vector3(-30.05, 0.84, z), new THREE.Vector3(-30.05, 0.84, z + 3), 0.07);
      ropeSpan(new THREE.Vector3(-30.05, 0.46, z), new THREE.Vector3(-30.05, 0.46, z + 3), 0.06);
    }
  }
}
