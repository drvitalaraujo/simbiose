import * as THREE from 'three';
import { PALETTE as P, toon } from '../toon';
import { Builder } from '../world/builder';
import { rng } from '../world/shapes';
import { PATACHO_COVERS, PATACHO_PALMS } from './patacho';
import { paintedFaces, type PatachoArt, type PatachoMaterials } from './patacho-materials';
import type { MapSolid } from './types';

// Coberturas costeiras variadas (mesmas AABBs autoritativas) e piso vivo da praia:
// quiosques de bambu e piaçava, ranchos de pesca com caixas térmicas e redes, cargas sob lona,
// módulo solar da OTIMIZA, canteiros de pedra calcária com bromélias e passarelas na areia.

const deco = { solid: false, shoot: false, cast: false, outline: 0 } as const;

export type CoverRole = 'fishery' | 'kiosk' | 'tarp' | 'otimiza' | 'planter';

const ROLES: readonly CoverRole[] = [
  'fishery', // 0: (24, -11) beira-mar norte
  'fishery', // 1: (24, 9) beira-mar sul
  'kiosk',   // 2: (8, -30) quiosque norte
  'kiosk',   // 3: (9, 24) quiosque sul
  'tarp',    // 4: (-24, 7) coqueiral A
  'tarp',    // 5: (3, -17) carga colônia
  'fishery', // 6: (9, -24) banca pescado/gelo
  'otimiza', // 7: (12, 19) módulo OTIMIZA
  'kiosk',   // 8: (4, -4) quiosque central da vila
  'fishery', // 9: (18, 3) estaleiro central da praia
  'planter', // 10: (13, -13) canteiro baixo norte
  'planter', // 11: (7, 10) canteiro baixo sul
  'tarp',    // 12: (-12, 28) cooperativa sul
  'tarp',    // 13: (-15, -31) cooperativa norte
];

export function patachoCoverBase(solid: MapSolid, materials: PatachoMaterials): number | THREE.Material {
  const idx = PATACHO_COVERS.indexOf(solid);
  const role = ROLES[idx] ?? 'tarp';
  if (role === 'planter' || role === 'otimiza') return P.cal;
  if (role === 'kiosk') return P.cantaria;
  return materials.wood;
}

export function dressPatachoCovers(b: Builder, art: PatachoArt, materials: PatachoMaterials) {
  for (const [idx, s] of PATACHO_COVERS.entries()) {
    const role = ROLES[idx] ?? 'tarp';
    if (role === 'planter') dressPlanter(b, s, idx);
    else if (role === 'kiosk') dressKiosk(b, art, materials, s, idx);
    else if (role === 'otimiza') dressOtimizaBooth(b, art, s);
    else if (role === 'fishery') dressFisheryStack(b, art, s, idx);
    else dressTarpCargo(b, art, s, idx);
  }
}

/** Canteiro baixo (1,05 m) em pedra calcária caiada, friso de azulejo e bromélias de restinga. */
function dressPlanter(b: Builder, s: MapSolid, seed: number) {
  const { min: a, max: c } = s.box;
  const r = rng(900 + seed * 31);
  b.block(a.x - 0.04, 0, a.z - 0.04, c.x + 0.04, 0.18, c.z + 0.04, P.stoneJoint, deco);
  b.block(a.x - 0.03, 0.34, a.z - 0.03, c.x + 0.03, 0.48, c.z + 0.03, P.clothTeal, deco);
  b.block(a.x - 0.05, c.y - 0.14, a.z - 0.05, c.x + 0.05, c.y - 0.01, c.z + 0.05, P.cantaria, deco);
  b.block(a.x + 0.14, c.y - 0.02, a.z + 0.14, c.x - 0.14, c.y + 0.02, c.z - 0.14, P.bark, deco);

  // Rosetas baixas de restinga e bromélias (até +7 cm acima do topo: não altera linha de tiro)
  for (let x = a.x + 0.48; x < c.x - 0.35; x += 0.72) {
    for (let z = a.z + 0.48; z < c.z - 0.35; z += 0.72) {
      const jx = x + (r() - 0.5) * 0.18;
      const jz = z + (r() - 0.5) * 0.18;
      const tuft = new THREE.IcosahedronGeometry(0.24, 0);
      tuft.scale(1.15, 0.28, 1.15);
      tuft.translate(jx, c.y + 0.035, jz);
      b.add(tuft, toon(r() < 0.5 ? P.leaf : P.leafLight), { cast: false });
      if (r() < 0.42) {
        const bloom = new THREE.IcosahedronGeometry(0.085, 0);
        bloom.scale(1, 0.55, 1);
        bloom.translate(jx, c.y + 0.065, jz);
        b.add(bloom, toon(r() < 0.5 ? P.orange : P.ipe), { cast: false });
      }
    }
  }
}

/** Quiosque rústico de praia: esteira de bambu, balcão de madeira, cocos verdes e testeira de palha. */
function dressKiosk(b: Builder, art: PatachoArt, materials: PatachoMaterials, s: MapSolid, idx: number) {
  const { min: a, max: c } = s.box;
  const w = c.x - a.x;
  const d = c.z - a.z;
  const cx = (a.x + c.x) / 2;
  const cz = (a.z + c.z) / 2;
  const longZ = d > w;

  // Revestimento em esteira de bambu nos quatro lados
  art.panel(art.bamboo, cx, c.y / 2, a.z - 0.014, w - 0.08, c.y - 0.1, Math.PI);
  art.panel(art.bamboo, cx, c.y / 2, c.z + 0.014, w - 0.08, c.y - 0.1, 0);
  art.panel(art.bamboo, a.x - 0.014, c.y / 2, cz, d - 0.08, c.y - 0.1, -Math.PI / 2);
  art.panel(art.bamboo, c.x + 0.014, c.y / 2, cz, d - 0.08, c.y - 0.1, Math.PI / 2);

  // Mourões de madeira nos cantos e testeira de piaçava no topo (dentro do volume + <= 6 cm)
  for (const px of [a.x, c.x - 0.22]) {
    for (const pz of [a.z, c.z - 0.22]) {
      b.block(px - 0.035, 0, pz - 0.035, px + 0.255, c.y, pz + 0.255, P.wood, deco);
    }
  }
  b.block(a.x - 0.055, c.y - 0.34, a.z - 0.055, c.x + 0.055, c.y, c.z + 0.055, materials.thatch, deco);
  const awningColor = idx === 8 ? P.colonialBlue : idx === 2 ? P.terracotta : P.colonialMoss;
  b.block(a.x - 0.06, c.y - 0.44, a.z - 0.06, c.x + 0.06, c.y - 0.33, c.z + 0.06, awningColor, deco);

  const info =
    idx === 8
      ? { t: 'BARRACA DO JANGADEIRO', sub: 'ÁGUA DE COCO • TAPIOCA NA CHAPA', bg: P.colonialBlue }
      : idx === 2
        ? { t: 'QUIOSQUE MARÉ MANSA', sub: 'CALDINHO • PEIXE NA BRASA', bg: P.terracotta }
        : { t: 'PONTO DO AÇAÍ', sub: 'SOMBRA FRESCA • FRUTA DO DIA', bg: P.colonialMoss };
  const signUv = art.sign(info.t, info.sub, info.bg, P.cal, P.ochre);

  // Balcão sombreado + fileira de cocos verdes nas duas faces principais
  if (longZ) {
    for (const side of [-1, 1] as const) {
      const xx = side < 0 ? a.x : c.x;
      const mn = Math.min(xx, xx + side * 0.065),
        mx = Math.max(xx, xx + side * 0.065);
      b.block(mn, 0.96, a.z + 0.45, mx, 1.72, c.z - 0.45, P.inkSoft, deco);
      b.block(Math.min(xx, xx + side * 0.08), 0.88, a.z + 0.35, Math.max(xx, xx + side * 0.08), 0.98, c.z - 0.35, P.wood, deco);
      for (let z = a.z + 0.85; z < c.z - 0.75; z += 0.9) {
        const nut = new THREE.IcosahedronGeometry(0.11, 1);
        nut.translate(xx + side * 0.045, 1.09, z);
        b.add(nut, toon(P.colonialMoss), { cast: false });
      }
      art.panel(signUv, xx + side * 0.065, c.y - 0.68, cz, Math.min(3.4, d - 0.5), 0.62, side > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  } else {
    for (const side of [-1, 1] as const) {
      const zz = side < 0 ? a.z : c.z;
      const mn = Math.min(zz, zz + side * 0.065),
        mx = Math.max(zz, zz + side * 0.065);
      b.block(a.x + 0.45, 0.96, mn, c.x - 0.45, 1.68, mx, P.inkSoft, deco);
      b.block(a.x + 0.35, 0.88, Math.min(zz, zz + side * 0.08), c.x - 0.35, 0.98, Math.max(zz, zz + side * 0.08), P.wood, deco);
      for (let x = a.x + 0.85; x < c.x - 0.75; x += 0.9) {
        const nut = new THREE.IcosahedronGeometry(0.11, 1);
        nut.translate(x, 1.09, zz + side * 0.045);
        b.add(nut, toon(P.colonialMoss), { cast: false });
      }
      art.panel(signUv, cx, c.y - 0.66, zz + side * 0.065, Math.min(3.6, w - 0.5), 0.6, side > 0 ? 0 : Math.PI);
    }
  }
}

/** Rancho de pesca: caixas térmicas azuis/cal, engradados, boias de cortiça, redes e toras de piúba. */
function dressFisheryStack(b: Builder, art: PatachoArt, s: MapSolid, idx: number) {
  const { min: a, max: c } = s.box;
  const w = c.x - a.x;
  const d = c.z - a.z;
  const cx = (a.x + c.x) / 2;
  const cz = (a.z + c.z) / 2;

  // Divide visualmente o volume em módulos: caixa isotérmica azul com fechos/alças e engradados
  const splitX = a.x + w * 0.42;
  b.block(a.x - 0.025, 0.04, a.z - 0.025, splitX, c.y * 0.68, c.z + 0.025, P.colonialBlue, deco);
  b.block(a.x - 0.04, 0, a.z - 0.04, splitX + 0.01, 0.14, c.z + 0.04, P.inkSoft, deco);
  b.block(a.x - 0.042, c.y * 0.6, a.z - 0.042, splitX + 0.02, c.y * 0.71, c.z + 0.042, P.cal, deco);
  // Dobradiças, travas verticais e alça branca da caixa isotérmica
  for (const fx of [a.x + (splitX - a.x) * 0.28, a.x + (splitX - a.x) * 0.72]) {
    b.block(fx - 0.05, 0.14, a.z - 0.05, fx + 0.05, c.y * 0.72, c.z + 0.05, P.steelLight, deco);
  }
  b.block(a.x - 0.06, c.y * 0.36, cz - 0.28, a.x + 0.02, c.y * 0.44, cz + 0.28, P.cal, deco);
  // Módulo superior sobre a caixa térmica: bandejas de pescado ripadas
  b.block(a.x + 0.06, c.y * 0.71, a.z + 0.06, splitX - 0.04, c.y + 0.01, c.z - 0.06, P.cantaria, deco);
  for (let y = c.y * 0.76; y < c.y - 0.04; y += 0.22) {
    b.block(a.x + 0.03, y, a.z + 0.03, splitX - 0.02, y + 0.045, c.z - 0.03, P.wood, deco);
  }

  // Ripas horizontais, montantes e estêncil da colônia de pesca
  for (let y = 0.28; y < c.y - 0.1; y += 0.42) {
    b.block(splitX - 0.02, y, a.z - 0.03, c.x + 0.03, y + 0.05, c.z + 0.03, P.sand, deco);
  }
  for (let x = splitX + 0.15; x < c.x; x += 1.25) {
    b.block(x - 0.05, 0.04, a.z - 0.04, x + 0.05, c.y - 0.04, c.z + 0.04, P.bark, deco);
  }

  const label = idx === 6 ? 'GELO MARINHO • Z-14' : idx === 9 ? 'ESTALEIRO PATACHO' : 'PESCADO FRESCO • Z-14';
  const crateUv = art.crate(label, P.sand, idx % 2 ? P.clothTeal : P.colonialBlue);
  for (const side of [-1, 1] as const) {
    art.panel(crateUv, (splitX + c.x) / 2, 1.05, (side < 0 ? a.z : c.z) + side * 0.042, w * 0.5, 1.05, side > 0 ? 0 : Math.PI);
  }

  // Rede turquesa estendida na lateral e boias de cortiça laranja (<= 7,5 cm)
  for (const side of [-1, 1] as const) {
    const xx = side < 0 ? a.x : c.x;
    b.block(
      Math.min(xx, xx + side * 0.045),
      0.35,
      a.z + 0.35,
      Math.max(xx, xx + side * 0.045),
      c.y - 0.35,
      c.z - 0.35,
      P.clothTeal,
      deco,
    );
    for (let z = a.z + 0.55; z < c.z - 0.45; z += 0.55) {
      b.block(
        Math.min(xx, xx + side * 0.072),
        c.y - 0.48,
        z - 0.06,
        Math.max(xx, xx + side * 0.072),
        c.y - 0.32,
        z + 0.06,
        P.orange,
        deco,
      );
    }
  }

  // Toras roliças de piúba e rolo de corda apoiados rente ao topo (<= 6 cm)
  for (const dz of [-0.32, 0, 0.32]) {
    const log = new THREE.CylinderGeometry(0.085, 0.095, w - 0.4, 7);
    log.rotateZ(Math.PI / 2);
    log.translate(cx, c.y + 0.02, cz + dz * Math.min(1, d / 3));
    b.add(log, toon(P.sand), { cast: false });
  }
}

/** Pilha de cooperativa agrícola/pesqueira coberta por lona amarrada com cintas. */
function dressTarpCargo(b: Builder, art: PatachoArt, s: MapSolid, idx: number) {
  const { min: a, max: c } = s.box;
  const w = c.x - a.x;
  const cx = (a.x + c.x) / 2;
  const tarpColors = [P.ochre, P.colonialSky, P.colonialRose, P.colonialMoss];
  const tarp = tarpColors[idx % tarpColors.length];

  // Metade superior encapada por lona costeira com cintas de amarração
  const capY = c.y * 0.54;
  b.block(a.x - 0.04, capY, a.z - 0.04, c.x + 0.04, c.y + 0.015, c.z + 0.04, tarp, deco);
  b.block(a.x - 0.048, capY - 0.06, a.z - 0.048, c.x + 0.048, capY + 0.04, c.z + 0.048, P.cal, deco);
  for (let x = a.x + 0.7; x < c.x - 0.4; x += 1.35) {
    b.block(x - 0.045, 0.02, a.z - 0.055, x + 0.045, c.y + 0.025, c.z + 0.055, P.bark, deco);
  }
  for (let y = 0.24; y < capY - 0.1; y += 0.36) {
    b.block(a.x - 0.025, y, a.z - 0.025, c.x + 0.025, y + 0.045, c.z + 0.025, P.sand, deco);
  }
  const uv = art.crate('COOP-COCO • ALAGOAS', P.cantaria, tarp);
  for (const side of [-1, 1] as const) {
    art.panel(uv, cx, capY * 0.52, (side < 0 ? a.z : c.z) + side * 0.038, Math.min(2.2, w - 0.5), 0.9, side > 0 ? 0 : Math.PI);
  }
}

/** Módulo corporativo OTIMIZA SOL™: contraste irônico da IA na areia da vila. */
function dressOtimizaBooth(b: Builder, art: PatachoArt, s: MapSolid) {
  const { min: a, max: c } = s.box;
  const w = c.x - a.x;
  const cx = (a.x + c.x) / 2;

  b.block(a.x - 0.035, 0, a.z - 0.035, c.x + 0.035, 0.26, c.z + 0.035, P.inkSoft, deco);
  b.block(a.x - 0.045, c.y - 0.28, a.z - 0.045, c.x + 0.045, c.y + 0.01, c.z + 0.045, P.inkSoft, deco);
  b.block(a.x - 0.05, c.y - 0.35, a.z - 0.05, c.x + 0.05, c.y - 0.27, c.z + 0.05, P.seaTurquoise, deco);
  for (const px of [a.x, c.x - 0.24]) {
    b.block(px - 0.04, 0.24, a.z - 0.04, px + 0.28, c.y - 0.26, c.z + 0.04, P.steel, deco);
  }

  const signUv = art.sign('OTIMIZA SOL™', 'RESERVE SUA SOMBRA • IFB +12%', P.inkSoft, P.paper, P.cyan);
  const tagUv = art.sign('DESPLUGA', 'A PRAIA É DE TODOS', P.colonialRed, P.cal, P.yellow);
  art.panel(signUv, cx, 1.38, a.z - 0.042, Math.min(3.4, w - 0.7), 0.95, Math.PI);
  art.panel(signUv, cx, 1.38, c.z + 0.042, Math.min(3.4, w - 0.7), 0.95, 0);
  art.panel(tagUv, a.x + 0.95, 0.62, c.z + 0.05, 1.25, 0.42, 0);
}

/** Passarelas de dormentes na areia, faixa orgânica úmida da maré e colares nos coqueiros. */
export function dressPatachoGround(b: Builder, art: PatachoArt, materials: PatachoMaterials) {
  // Passarelas de madeira rústica conectando as entradas da Vila dos Pescadores (y = 0,008 m: sem vinco falso)
  const paths: [number, number, number, number, boolean][] = [
    [-13.5, -14, 2.2, 18, false], // trilha norte-centro da vila
    [-13.5, 10.5, 2.2, 14, false], // trilha centro-sul da vila
    [-6.5, -3.5, 14.2, 2.2, true], // travessa leste rumo às barracas
    [-17.5, -10.5, 8, 2.1, true],  // ramal ligando a trilha à Casa do Coqueiral
  ];
  let tileIdx = 0;
  for (const [cx, cz, w, d, alongX] of paths) {
    const length = alongX ? w : d;
    const width = alongX ? d : w;
    const tiles = Math.max(1, Math.round(length / 2.6));
    const step = length / tiles;
    for (let k = 0; k < tiles; k++) {
      const offset = -length / 2 + step * (k + 0.5);
      const x = alongX ? cx + offset : cx;
      const z = alongX ? cz : cz + offset;
      art.panel(art.boardwalk(tileIdx++), x, 0.008, z, width, step + 0.02, alongX ? Math.PI / 2 : 0, -Math.PI / 2);
    }
  }

  // Transição orgânica de areia úmida na maré baixa: borda interna sinuosa e mesma textura da areia
  // (cor 1,1,1 na borda interna = transição 100% invisível, sem linha reta!)
  const zSegs = 48;
  const xSegs = 6;
  const wetVerts: number[] = [];
  const wetPoint = (ix: number, iz: number): [number, number, number, number] => {
    const z = -36 + (iz / zSegs) * 72;
    const xInner = 25.8 + Math.sin(z * 0.14) * 1.15 + Math.cos(z * 0.29 + 0.9) * 0.48;
    const t = ix / xSegs;
    return [THREE.MathUtils.lerp(xInner, 30.0, t), 0.004, z, t];
  };
  const wetT: number[] = [];
  for (let iz = 0; iz < zSegs; iz++) {
    for (let ix = 0; ix < xSegs; ix++) {
      const p00 = wetPoint(ix, iz),
        p10 = wetPoint(ix + 1, iz),
        p01 = wetPoint(ix, iz + 1),
        p11 = wetPoint(ix + 1, iz + 1);
      for (const p of [p00, p01, p11, p00, p11, p10]) {
        wetVerts.push(p[0], p[1], p[2]);
        wetT.push(p[3]);
      }
    }
  }
  const wetGeo = paintedFaces(wetVerts, false, 'world', 60 / 14);
  // Alinha a fase UV exata com o BoxGeometry do chão (-30..30 -> u=0..14, -36..36 -> v=17..0)
  const wetUv = wetGeo.getAttribute('uv');
  const wetPos = wetGeo.getAttribute('position');
  const wetCols = new Float32Array(wetPos.count * 3);
  for (let i = 0; i < wetPos.count; i++) {
    const x = wetPos.getX(i),
      z = wetPos.getZ(i);
    wetUv.setXY(i, ((x + 30) / 60) * 14, ((36 - z) / 72) * 17);
    const s = wetT[i] * wetT[i] * (3 - 2 * wetT[i]);
    wetCols[i * 3] = 1 - s * 0.19;
    wetCols[i * 3 + 1] = 1 - s * 0.23;
    wetCols[i * 3 + 2] = 1 - s * 0.26;
  }
  wetGeo.setAttribute('color', new THREE.BufferAttribute(wetCols, 3));
  const wetMat = materials.sand.clone();
  wetMat.vertexColors = true;
  b.add(wetGeo, wetMat, { cast: false });

  // Colar de areia soprada e cocos caídos encostados no pé dos 14 coqueiros (<= 11 cm da caixa)
  const r = rng(7741);
  for (const [px, pz] of PATACHO_PALMS) {
    const mound = new THREE.ConeGeometry(0.34, 0.07, 8);
    mound.translate(px, 0.025, pz);
    b.add(mound, toon(P.sand), { cast: false });
    const count = 1 + (Math.abs(px + pz) % 2);
    for (let k = 0; k < count; k++) {
      const ang = r() * Math.PI * 2;
      const nut = new THREE.IcosahedronGeometry(0.095, 0);
      nut.scale(1.15, 0.9, 1);
      nut.translate(px + Math.cos(ang) * 0.24, 0.075, pz + Math.sin(ang) * 0.24);
      b.add(nut, toon(k % 2 ? P.ochre : P.bark), { cast: false });
    }
  }
}
