import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE as P, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { PATACHO_HUTS } from './patacho';
import type { PatachoArt, PatachoMaterials } from './patacho-materials';
import { buildThatchRoof, patachoFestoons } from './patacho-roofs';
import type { MapData } from './types';

// Fachadas das pousadas alagoanas e casas da Vila dos Pescadores: paredes caiadas com barrado
// de azulejo, pilares de madeira, portas almofadadas, venezianas, arandelas e adereços.

const deco = { solid: false, shoot: false, cast: false, outline: 0 } as const;

const HUT_SPECS = [
  {
    wall: P.cal,
    trim: P.wood,
    shutter: P.clothTeal,
    door: P.wood,
    title: 'POUSADA VENTO LESTE',
    sub: 'ROTA DOS MILAGRES • REDÁRIO & CAFÉ',
    signBg: P.wood,
    prop: 'surf' as const,
  },
  {
    wall: P.colonialMoss,
    trim: P.cal,
    shutter: P.cal,
    door: P.terracotta,
    title: 'VILA DO PATACHO',
    sub: 'RENDA FILÉ • TAPIOCA • ARTESANATO',
    signBg: P.terracotta,
    prop: 'oars' as const,
  },
  {
    wall: P.colonialSky,
    trim: P.cal,
    shutter: P.colonialBlue,
    door: P.wood,
    title: 'COLÔNIA Z-14',
    sub: 'JANGADEIROS DE PORTO DE PEDRAS',
    signBg: P.colonialBlue,
    prop: 'buoy' as const,
  },
  {
    wall: P.colonialRose,
    trim: P.cal,
    shutter: P.clothTeal,
    door: P.inkSoft,
    title: 'OTIMIZA BEACH CLUB',
    sub: 'SOL COM HORA MARCADA • IFB +99%',
    signBg: P.inkSoft,
    prop: 'resort' as const,
  },
  {
    wall: P.ochre,
    trim: P.wood,
    shutter: P.colonialMoss,
    door: P.clothTeal,
    title: 'CASA DO COQUEIRAL',
    sub: 'PATACHO • PORTO DE PEDRAS — AL',
    signBg: P.colonialMoss,
    prop: 'net' as const,
  },
] as const;

export function dressPatachoHuts(
  b: Builder,
  map: MapData,
  art: PatachoArt,
  materials: PatachoMaterials,
  overhangs: Box[],
) {
  for (const [i, s] of PATACHO_HUTS.entries()) {
    const spec = HUT_SPECS[i % HUT_SPECS.length];
    const { min: a, max: c } = s.box;
    const w = c.x - a.x,
      d = c.z - a.z,
      h = c.y - a.y;
    const cx = (a.x + c.x) / 2,
      cz = (a.z + c.z) / 2;

    const plasterUv = art.plaster(spec.wall, 401 + i * 17);
    art.panel(plasterUv, cx, h / 2, a.z - 0.014, w - 0.08, h - 0.04, Math.PI);
    art.panel(plasterUv, cx, h / 2, c.z + 0.014, w - 0.08, h - 0.04, 0);
    art.panel(plasterUv, a.x - 0.014, h / 2, cz, d - 0.08, h - 0.04, -Math.PI / 2);
    art.panel(plasterUv, c.x + 0.014, h / 2, cz, d - 0.08, h - 0.04, Math.PI / 2);

    b.block(a.x - 0.04, 0, a.z - 0.04, c.x + 0.04, 0.22, c.z + 0.04, P.cantaria, deco);
    b.block(a.x - 0.05, c.y - 0.2, a.z - 0.05, c.x + 0.05, c.y, c.z + 0.05, P.wood, deco);
    for (const px of [a.x, c.x - 0.28]) {
      for (const pz of [a.z, c.z - 0.28]) {
        b.block(px - 0.045, 0.2, pz - 0.045, px + 0.325, c.y - 0.18, pz + 0.325, spec.trim, deco);
      }
    }

    buildThatchRoof(b, map, overhangs, a, c, materials.thatch);

    for (const side of [-1, 1] as const) {
      const zz = side < 0 ? a.z : c.z;
      const rot = side < 0 ? Math.PI : 0;
      const muralSide = (i === 2 && side === 1) || (i === 3 && side === 1);

      if (muralSide) {
        const uv = i === 3 ? art.muralResort : art.muralViva;
        art.panel(uv, cx, 2.32, zz + side * 0.036, 4.1, 2.05, rot);
        b.block(cx - 2.15, 1.22, zz - 0.048, cx + 2.15, 1.3, zz + 0.048, P.wood, deco);
        b.block(cx - 2.15, 3.35, zz - 0.048, cx + 2.15, 3.43, zz + 0.048, P.wood, deco);
        for (const ux of [a.x + 0.95, c.x - 0.95]) hutNarrowVent(b, ux, 1.55, zz, side);
      } else {
        hutDoor(b, materials, cx, zz, side, false, spec.door);
        if (side === 1 || i === 0 || i === 4) {
          const signUv =
            i === 4 && side === -1
              ? art.sign('PATACHO • ALAGOAS', 'PISCINAS NATURAIS →', P.colonialSky, P.ink, P.cal)
              : art.sign(spec.title, spec.sub, spec.signBg, P.cal, i === 3 ? P.cyan : P.ochre);
          art.panel(signUv, cx, 3.32, zz + side * 0.042, 3.3, 0.96, rot);
        }
        hutWindow(b, a.x + 1.65, 1.38, zz, side, false, spec.shutter, i);
        hutWindow(b, c.x - 1.65, 1.38, zz, side, false, spec.shutter, i + 2);
      }
    }

    for (const side of [-1, 1] as const) {
      const xx = side < 0 ? a.x : c.x;
      hutWindow(b, xx, 1.38, a.z + 2.1, side, true, spec.shutter, i + 1);
      hutWindow(b, xx, 1.38, c.z - 2.1, side, true, spec.shutter, i + 3);
      if (side === 1) wallStoryProp(b, xx, cz, side, spec.prop);
      else if (i === 4) hutDoor(b, materials, xx, cz, side, true, spec.door);
    }
  }

  patachoFestoons(b, map, materials, overhangs);
}

function hutDoor(
  b: Builder,
  materials: PatachoMaterials,
  u: number,
  wallCoord: number,
  side: -1 | 1,
  onX: boolean,
  doorColor: number,
) {
  const slab = (u0: number, y0: number, u1: number, y1: number, d0: number, d1: number, col: number | THREE.Material) => {
    const a = wallCoord + side * d0,
      c = wallCoord + side * d1;
    const mn = Math.min(a, c),
      mx = Math.max(a, c);
    if (onX) b.block(mn, y0, u + u0, mx, y1, u + u1, col, deco);
    else b.block(u + u0, y0, mn, u + u1, y1, mx, col, deco);
  };
  slab(-0.88, 0.02, 0.88, 0.18, 0, 0.08, P.cantaria);
  slab(-0.82, 0.18, 0.82, 2.58, 0, 0.055, P.wood);
  slab(-0.92, 2.54, 0.92, 2.7, 0, 0.08, P.wood);
  slab(-0.68, 0.18, 0.68, 2.46, 0.01, 0.032, P.inkSoft);
  for (const leaf of [-1, 1] as const) {
    const u0 = leaf < 0 ? -0.65 : 0.02,
      u1 = leaf < 0 ? -0.02 : 0.65;
    slab(u0, 0.2, u1, 2.43, 0.02, 0.048, doorColor);
    slab(u0 + 0.08, 1.38, u1 - 0.08, 2.28, 0.045, 0.062, P.sand);
    slab(u0 + 0.08, 0.34, u1 - 0.08, 1.18, 0.045, 0.062, P.cantaria);
  }
  slab(-0.09, 1.2, -0.04, 1.32, 0.05, 0.072, P.ochre);
  slab(0.04, 1.2, 0.09, 1.32, 0.05, 0.072, P.ochre);
  for (const lx of [-1.06, 1.06]) {
    slab(lx - 0.06, 2.18, lx + 0.06, 2.44, 0.01, 0.055, P.bark);
    slab(lx - 0.09, 2.38, lx + 0.09, 2.44, 0.03, 0.085, P.wood);
    slab(lx - 0.055, 2.22, lx + 0.055, 2.37, 0.04, 0.08, materials.glow);
  }
}

function hutWindow(
  b: Builder,
  xOrWall: number,
  y: number,
  zOrWall: number,
  side: -1 | 1,
  onX: boolean,
  shutterColor: number,
  seed: number,
) {
  const wallCoord = onX ? xOrWall : zOrWall;
  const u = onX ? zOrWall : xOrWall;
  const slab = (u0: number, v0: number, u1: number, v1: number, d0: number, d1: number, col: number) => {
    const a = wallCoord + side * d0,
      c = wallCoord + side * d1;
    const mn = Math.min(a, c),
      mx = Math.max(a, c);
    if (onX) b.block(mn, y + v0, u + u0, mx, y + v1, u + u1, col, deco);
    else b.block(u + u0, y + v0, mn, u + u1, y + v1, mx, col, deco);
  };
  slab(-0.68, -0.08, 0.68, 1.26, 0, 0.034, P.cal);
  slab(-0.74, -0.14, 0.74, -0.04, 0, 0.078, P.wood);
  slab(-0.72, 1.24, 0.72, 1.33, 0, 0.07, P.wood);
  slab(-0.56, 0.02, 0.56, 1.16, 0.034, 0.048, P.glass);
  slab(-0.44, 0.72, -0.14, 1.02, 0.046, 0.052, P.colonialSky);
  slab(-0.028, 0.02, 0.028, 1.16, 0.048, 0.06, P.cal);
  slab(-0.56, 0.57, 0.56, 0.62, 0.048, 0.06, P.cal);

  const open = seed % 2 === 0;
  const pairs: [number, number][] = open
    ? [
        [-1.08, -0.62],
        [0.62, 1.08],
      ]
    : [
        [-0.55, -0.03],
        [0.03, 0.55],
      ];
  for (const [u0, u1] of pairs) {
    slab(u0, 0.03, u1, 1.15, 0.05, 0.068, shutterColor);
    for (let v = 0.14; v < 1.08; v += 0.16) slab(u0 + 0.05, v, u1 - 0.05, v + 0.045, 0.065, 0.078, P.cal);
  }

  if (seed % 3 !== 2) {
    slab(-0.52, -0.32, 0.52, -0.14, 0.01, 0.082, P.terracotta);
    for (let k = -2; k <= 2; k++) {
      slab(k * 0.19 - 0.08, -0.15, k * 0.19 + 0.08, 0.02, 0.025, 0.085, k % 2 ? P.leaf : P.leafLight);
    }
    slab(-0.22, -0.05, -0.12, 0.05, 0.045, 0.088, seed % 2 ? P.ipe : P.ipeYellow);
    slab(0.16, -0.04, 0.26, 0.06, 0.045, 0.088, P.ipeYellow);
  }
}

function hutNarrowVent(b: Builder, x: number, y: number, wallZ: number, side: -1 | 1) {
  const mn = Math.min(wallZ, wallZ + side * 0.045),
    mx = Math.max(wallZ, wallZ + side * 0.045);
  b.block(x - 0.34, y - 0.06, mn, x + 0.34, y + 1.18, mx, P.cal, deco);
  const gmn = Math.min(wallZ + side * 0.032, wallZ + side * 0.054),
    gmx = Math.max(wallZ + side * 0.032, wallZ + side * 0.054);
  b.block(x - 0.24, y + 0.04, gmn, x + 0.24, y + 1.08, gmx, P.inkSoft, deco);
  for (let v = 0.2; v < 1.02; v += 0.22) {
    b.block(x - 0.25, y + v, gmn, x + 0.25, y + v + 0.045, gmx + (side > 0 ? 0.012 : 0), P.terracotta, deco);
  }
}

function wallStoryProp(b: Builder, wallX: number, cz: number, side: -1 | 1, kind: string) {
  const x = wallX + side * 0.055;
  if (kind === 'buoy') {
    const ring = new THREE.TorusGeometry(0.42, 0.11, 6, 16);
    ring.scale(0.32, 1, 1);
    b.add(place(ring, x, 1.95, cz), toon(P.orange), { cast: false });
    for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
      const band = new THREE.BoxGeometry(0.08, 0.16, 0.16);
      band.translate(x, 1.95 + Math.sin(a) * 0.42, cz + Math.cos(a) * 0.42);
      b.add(band, toon(P.cal), { cast: false });
    }
  } else if (kind === 'surf') {
    const board = new THREE.SphereGeometry(1, 10, 8);
    board.scale(0.032, 1.18, 0.28);
    b.add(place(board, x, 1.32, cz), toon(P.seaTurquoise), { cast: false });
    b.block(wallX, 0.35, cz - 0.04, wallX + side * 0.075, 2.32, cz + 0.04, P.cal, deco);
  } else if (kind === 'oars') {
    for (const dz of [-0.22, 0.22]) {
      b.block(wallX, 0.35, cz + dz - 0.025, wallX + side * 0.065, 2.45, cz + dz + 0.025, P.wood, deco);
      b.block(wallX, 1.95, cz + dz - 0.11, wallX + side * 0.072, 2.52, cz + dz + 0.11, dz < 0 ? P.colonialBlue : P.ochre, deco);
    }
  } else if (kind === 'net') {
    b.block(wallX, 2.35, cz - 0.95, wallX + side * 0.07, 2.43, cz + 0.95, P.wood, deco);
    b.block(wallX, 0.65, cz - 0.85, wallX + side * 0.048, 2.35, cz + 0.85, P.clothTeal, deco);
    for (let k = -3; k <= 3; k++) {
      b.block(wallX, 2.32, cz + k * 0.25 - 0.04, wallX + side * 0.08, 2.42, cz + k * 0.25 + 0.04, P.orange, deco);
    }
  } else {
    b.block(wallX, 0.9, cz - 0.45, wallX + side * 0.065, 2.35, cz + 0.45, P.inkSoft, deco);
    b.block(wallX, 1.1, cz - 0.32, wallX + side * 0.078, 2.15, cz + 0.32, P.seaTurquoise, deco);
  }
}
