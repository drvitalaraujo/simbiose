import * as THREE from 'three';
import { hex, PALETTE as C, toon, toonWith } from '../toon';
import { place } from '../world/builder';
import { neonBox } from '../world/props';
import { rng } from '../world/shapes';
import { canvas, fit, texture } from '../world/textures';
import { type Dress, HOUSE_COLORS } from './colonial';

// Elevador Lacerda, escarpa e Cidade Baixa, a oeste do muro (lado da baía). Na cidade
// real o elevador fica a sudoeste do Pelourinho e liga a Cidade Alta à Cidade Baixa,
// com o Mercado Modelo na beira do mar. Escala de cenário: a torre passa do casario
// (~26 m acima do largo) para ser vista do lobby e da ladeira A. Fora da área jogável
// (o limite invisível vai até x = −62): só decoração, sem colisão, tiro ou sombra.

const deco = { solid: false, shoot: false, cast: false, receive: false, outline: 0 } as const;
/** Torre principal: face da cidade (+x) quase colada na beira da escarpa. */
// Ao sul da torre da OTIMIZA (z −40): vista do lobby, uma não fica atrás da outra.
const T = { x0: -77, x1: -71, z0: 20, z1: 28, top: 24 };
const SEA = -9;
const LOW_TOWN = -8.6;

export function dressLacerda(d: Dress) {
  escarpment(d);
  lowerTown(d);
  elevator(d);
}

/** Escarpa verde: topo plano até a beira e queda íngreme até a Cidade Baixa. */
function escarpment(d: Dress) {
  const profile = new THREE.Shape([
    new THREE.Vector2(-61, 1), new THREE.Vector2(-71, 1), new THREE.Vector2(-73, -1.5),
    new THREE.Vector2(-75.5, -5), new THREE.Vector2(-78, LOW_TOWN), new THREE.Vector2(-61, LOW_TOWN),
  ]);
  const cliff = new THREE.ExtrudeGeometry(profile, { depth: 150, bevelEnabled: false });
  cliff.translate(0, 0, -75);
  d.b.add(cliff, toon(C.leaf), { cast: false, receive: false });
  // Afloramentos de pedra na face, alternando com a mata.
  const r = rng(1873);
  for (let z = -70; z < 75; z += 6 + r() * 6) {
    const rock = new THREE.IcosahedronGeometry(1, 0);
    rock.scale(1.2 + r(), 2 + r() * 2, 2 + r() * 2.5);
    d.b.add(place(rock, -74.6 - r() * 1.5, -4 - r() * 2.5, z), toon(r() < 0.5 ? C.cantaria : C.stoneJoint), { cast: false, receive: false });
  }
}

/** Faixa da Cidade Baixa: cais, sobrados baixos e o Mercado Modelo diante do elevador. */
function lowerTown(d: Dress) {
  d.b.block(-93, LOW_TOWN - 0.6, -75, -78, LOW_TOWN, 75, C.stoneJoint, deco);
  d.b.block(-93.6, SEA - 0.4, -75, -93, LOW_TOWN, 75, C.cantaria, deco);
  const r = rng(1549);
  for (let z = -70; z < 72; ) {
    const w = 6 + r() * 5;
    // Abre espaço para o pé do elevador e o largo do mercado.
    if (z + w > 4 && z < 34) { z = 34; continue; }
    const h = 5 + r() * 6;
    const x0 = -84 - r() * 2;
    d.b.block(x0, LOW_TOWN, z, -78.5, LOW_TOWN + h, z + w - 0.4, HOUSE_COLORS[Math.floor(r() * HOUSE_COLORS.length)], deco);
    d.b.block(x0 - 0.15, LOW_TOWN + h, z - 0.15, -78.35, LOW_TOWN + h + 0.6, z + w - 0.25, C.telha, deco);
    for (let y = LOW_TOWN + 1.5; y < LOW_TOWN + h - 1; y += 2.6)
      for (let k = z + 1; k < z + w - 1.4; k += 2) d.b.block(x0 - 0.04, y, k, x0, y + 1.3, k + 0.8, C.glass, deco);
    z += w;
  }
  // Mercado Modelo: casarão alfandegário com a rotunda virada para o mar.
  const mx0 = -91, mx1 = -82, mz0 = 17, mz1 = 27;
  d.b.block(mx0, LOW_TOWN, mz0, mx1, LOW_TOWN + 7, mz1, C.sand, deco);
  d.b.block(mx0 - 0.2, LOW_TOWN + 7, mz0 - 0.2, mx1 + 0.2, LOW_TOWN + 7.5, mz1 + 0.2, C.cal, deco);
  const rotunda = new THREE.CylinderGeometry(4, 4, 7, 20, 1, false, Math.PI, Math.PI);
  d.b.add(place(rotunda, mx0, LOW_TOWN + 3.5, (mz0 + mz1) / 2), toon(C.sand), { cast: false, receive: false });
  for (let i = 0; i < 4; i++) {
    const x = mx0 + 1.2 + i * 2.1;
    d.b.block(x, LOW_TOWN + 0.4, mz1, x + 1.1, LOW_TOWN + 3.2, mz1 + 0.05, C.colonialMoss, deco);
    d.b.block(x, LOW_TOWN + 4.2, mz1, x + 1.1, LOW_TOWN + 6, mz1 + 0.05, C.glass, deco);
  }
}

/** Torre art déco: frisos verticais, coroa escalonada, letreiro e passarela da Cidade Alta. */
function elevator(d: Dress) {
  const { x0, x1, z0, z1, top } = T;
  const cx = (x0 + x1) / 2;
  // Fuste principal e o segundo poço colado ao lado sul, um pouco mais baixo.
  d.b.block(x0, LOW_TOWN, z0, x1, top, z1, C.cal, deco);
  d.b.block(x0 + 0.6, LOW_TOWN, z1, x1 - 0.6, top - 3, z1 + 3.2, C.paper, deco);
  // Frisos verticais nas três faces vistas do largo, com vidro entre eles.
  for (let z = z0 + 0.6; z < z1 - 0.4; z += 1.15) {
    d.b.block(x1, LOW_TOWN + 1, z, x1 + 0.18, top - 1.2, z + 0.28, C.paper, deco);
    d.b.block(x1, LOW_TOWN + 1, z + 0.4, x1 + 0.04, top - 1.6, z + 0.9, C.colonialSky, deco);
  }
  for (const zf of [z0, z1 + 3.2]) {
    const n = zf === z0 ? -1 : 1;
    for (let x = x0 + 0.9; x < x1 - 0.5; x += 1.2) {
      const h = zf === z0 ? top - 1.2 : top - 4;
      d.b.block(x, LOW_TOWN + 1, Math.min(zf, zf + n * 0.18), x + 0.28, h, Math.max(zf, zf + n * 0.18), C.paper, deco);
    }
  }
  // Coroa escalonada: cimalha, recuo e casa de máquinas.
  d.b.block(x0 - 0.3, top, z0 - 0.3, x1 + 0.3, top + 0.7, z1 + 0.3, C.paper, deco);
  d.b.block(x0 + 0.8, top + 0.7, z0 + 0.8, x1 - 0.8, top + 2.4, z1 - 0.8, C.cal, deco);
  d.b.block(x0 + 1.8, top + 2.4, z0 + 2, x1 - 1.8, top + 3.3, z1 - 2, C.colonialSky, deco);
  // Janelas acesas do fim de tarde: duas faixas verticais quentes na face da cidade.
  for (const z of [z0 + 2.4, z1 - 2.9]) neonBox(d.ctx, x1 + 0.05, 3, z, x1 + 0.1, top - 2.5, z + 0.5, C.sun);
  neonBox(d.ctx, x0 + 0.85, top + 1.2, z0 + 0.75, x1 - 0.85, top + 1.5, z1 - 0.75, C.sun);
  sign(d, x1 + 0.2, top - 0.6, (z0 + z1) / 2);
  // Passarela até a Cidade Alta, apoiada num pavilhão na beira da escarpa.
  const bz = (z0 + z1) / 2;
  d.b.block(x1, -0.4, bz - 1.6, -64, 2.6, bz + 1.6, C.cal, deco);
  d.b.block(x1, 0.9, bz - 1.64, -64, 1.8, bz + 1.64, C.glass, deco);
  d.b.block(x1, 2.6, bz - 1.75, -64, 2.85, bz + 1.75, C.paper, deco);
  d.b.block(-66, 1, bz - 4, -61.2, 6, bz + 4, C.ochre, deco);
  d.b.block(-66.2, 6, bz - 4.2, -61.2, 6.4, bz + 4.2, C.cal, deco);
  // Pé da torre: embasamento de pedra e a porta da Cidade Baixa, voltada ao mercado.
  d.b.block(x0 - 0.4, LOW_TOWN, z0 - 0.4, x1 + 0.4, LOW_TOWN + 1.2, z1 + 0.4, C.cantaria, deco);
  d.b.block(x0 - 0.05, LOW_TOWN + 1.2, z0 + 2.5, x0, LOW_TOWN + 4, z1 - 2.5, C.inkSoft, deco);
  // Hastes de antena e para-raios no topo: silhueta fina contra o céu.
  d.b.add(place(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 5), cx, top + 4.9, bz), toon(C.steel), { cast: false, receive: false });
}

/** Letreiro "ELEVADOR LACERDA" em letras art déco, na cimalha virada para o largo. */
function sign(d: Dress, x: number, y: number, z: number) {
  const [c, g] = canvas(512, 64);
  g.fillStyle = hex(C.cal); g.fillRect(0, 0, 512, 64);
  g.fillStyle = hex(C.inkSoft); g.textAlign = 'center'; g.textBaseline = 'middle';
  fit(g, 'ELEVADOR LACERDA', 46, 488, '900 Xpx Arial');
  g.fillText('ELEVADOR LACERDA', 256, 35);
  const mat = toonWith({ map: texture(c), color: C.paper });
  const plate = new THREE.PlaneGeometry(7.2, 0.9);
  d.b.add(place(plate, x + 0.02, y, z, Math.PI / 2), mat, { cast: false, receive: false });
}
