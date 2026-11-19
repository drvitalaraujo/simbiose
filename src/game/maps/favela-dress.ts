import * as THREE from 'three';
import { PALETTE as C, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { planeGeo } from '../world/textures';
import { box } from '../world/shapes';
import { solidColor } from './colors';
import { clearOfBody } from './facades';
import { FAVELA_COVERS, FAVELA_GOALS, FAVELA_HOUSES, FAVELA_TERRACES } from './favela';
import { FavelaArt, FAVELA_COLORS } from './favela-art';
import { favelaBackdrop, favelaRoof, favelaWires } from './favela-scenery';
import { favelaLandmarks, favelaPaving } from './favela-details';
import { favelaRoofs, favelaWindowLife, type FavelaWindow } from './favela-roofs';
import { behindShop, favelaRails, favelaShops, favelaTangle } from './favela-life';
import { favelaGround } from './favela-ground';
import { favelaGraffiti } from './favela-graffiti';
import { favelaHill, favelaKites } from './favela-hill';
import type { MapData } from './types';

const deco = { solid: false, shoot: false, cast: false, outline: 0 };
/** Janelas da montagem atual (para vasos, grades e ar-condicionado). */
const windows: FavelaWindow[] = [];
export function dressFavela(b: Builder, map: MapData, dressed: boolean) {
  for (const s of map.solids) {
    const { min: p, max: q } = s.box;
    if (s.kind === 'bound') { b.invisible(p.x, p.y, p.z, q.x, q.y, q.z); continue; }
    const home = FAVELA_HOUSES.find(h => h.solid === s);
    const cover = FAVELA_COVERS.find(c => c.solid === s);
    const color = FAVELA_GOALS.includes(s) ? C.cal : home ? home.brick ? C.terracotta : FAVELA_COLORS[home.paint] : cover?.type === 'tank' ? C.tank :
      cover?.type === 'stall' ? C.clothTeal : s.kind === 'ground' ? C.stoneJoint : C.cobbleStone;
    b.block(p.x, p.y, p.z, q.x, q.y, q.z, dressed ? color : solidColor(s), { solid: s.solid ?? true, shoot: s.shoot ?? true, cast: s.kind !== 'ground' });
  }
  if (!dressed) return;
  const art = new FavelaArt(b);
  windows.length = 0;
  for (let i = 0; i < FAVELA_HOUSES.length; i++) facade(b, art, map, i);
  favelaLandmarks(b, art);
  for (const terrace of FAVELA_TERRACES) {
    const { min: p, max: q } = terrace.box;
    art.plaster(p.x < 0 ? 0 : 1, (p.x + q.x) / 2, 0, p.z - 0.012, q.x - p.x, q.y, Math.PI, true);
    art.plaster(p.x < 0 ? 0 : 1, (p.x + q.x) / 2, 0, q.z + 0.012, q.x - p.x, q.y, 0, true);
    art.brickPanel(p.x - 0.012, q.y / 2, (p.z + q.z) / 2, q.z - p.z, q.y, -Math.PI / 2);
    art.brickPanel(q.x + 0.012, q.y / 2, (p.z + q.z) / 2, q.z - p.z, q.y, Math.PI / 2);
    b.block(p.x, q.y - 0.02, p.z, q.x, q.y + 0.01, q.z, C.sand, deco);
    for (let z = p.z + 1; z < q.z; z += 2) b.block(p.x, q.y + 0.012, z, q.x, q.y + 0.018, z + 0.035, C.cantaria, deco);
  }
  favelaPaving(b, art);
  for (const cover of FAVELA_COVERS) {
    const { min: p, max: q } = cover.solid.box;
    if (cover.type === 'tank') {
      // Reservatório quadrado: o invólucro visual corresponde à AABB, inclusive a tampa.
      for (let y = p.y + 0.3; y < q.y; y += 0.4) b.block(p.x - 0.02, y, p.z - 0.02, q.x + 0.02, y + 0.045, q.z + 0.02, C.colonialSky, deco);
      b.block(p.x, q.y - 0.12, p.z, q.x, q.y, q.z, C.glass, deco);
    } else if (cover.type === 'planter') {
      b.block(p.x + 0.12, q.y - 0.05, p.z + 0.12, q.x - 0.12, q.y + 0.015, q.z - 0.12, C.leaf, deco);
      for (let y = 0.2; y < q.y; y += 0.23) b.block(p.x - 0.015, y, p.z - 0.015, q.x + 0.015, y + 0.025, q.z + 0.015, C.cantaria, deco);
    } else {
      marketStall(b, art, p, q);
      for (let x = p.x; x < q.x - 0.1; x += 0.5) b.block(x, q.y - 0.25, p.z - 0.02, Math.min(x + 0.25, q.x), q.y, q.z + 0.02, C.ochre, deco);
    }
  }
  // Marquises só no alto: o envelope inclui saltos partindo das lajes.
  for (const [x, z] of [[-19, -13], [17, -23], [5, 15]]) {
    const canopy = box(x - 4.2, 6, z - 0.8, x + 4.2, 6.12, z + 0.8);
    if (clearOfBody(map, canopy)) b.block(canopy.min.x, canopy.min.y, canopy.min.z, canopy.max.x, canopy.max.y, canopy.max.z, C.colonialMoss, deco);
  }
  favelaRoofs(b, map); favelaWindowLife(b, map, windows);
  favelaTangle(b, map); favelaRails(b, map); favelaShops(b, map, art); favelaGround(b, map, windows);
  favelaGraffiti(b, map); favelaHill(b); favelaKites(b);
  favelaWires(b, map); favelaBackdrop(b); art.finish();
}

function facade(b: Builder, art: FavelaArt, map: MapData, index: number) {
  const home = FAVELA_HOUSES[index], { min: p, max: q } = home.solid.box;
  // O mural ocupa uma empena cega; janelas/portão não podem cortar sua mensagem.
  const muralFront = p.y === 0 && p.x === -13 && p.z === 25;
  const w = q.x - p.x, d = q.z - p.z, h = q.y - p.y;
  const wall = (x: number, y: number, z: number, width: number, height: number, angle = 0) => home.brick
    ? art.brickPanel(x, y, z, width, height, angle) : art.plaster(home.paint, x, y - height / 2, z, width, height, angle, p.y === 0);
  wall((p.x + q.x) / 2, (p.y + q.y) / 2, p.z - 0.012, w, h, Math.PI);
  wall((p.x + q.x) / 2, (p.y + q.y) / 2, q.z + 0.012, w, h);
  wall(p.x - 0.012, (p.y + q.y) / 2, (p.z + q.z) / 2, d, h, -Math.PI / 2);
  wall(q.x + 0.012, (p.y + q.y) / 2, (p.z + q.z) / 2, d, h, Math.PI / 2);
  // Rodapé claro de reboco e faixas altas variam lotes, sem disputar contraste com o inimigo.
  if (p.y === 0) for (const z of [p.z - 0.03, q.z + 0.015]) {
    if (muralFront && z < p.z) continue;
    b.block(p.x, 0.05, z, q.x, 0.42, z + 0.015, index % 3 ? C.cantaria : C.cal, deco);
    b.block(p.x, 3.04, z, q.x, 3.11, z + 0.02, C.cal, deco);
  }
  // Lajes delgadas, pilares e vergas revelam a construção por etapas.
  b.block(p.x - 0.045, q.y - 0.16, p.z - 0.045, q.x + 0.045, q.y, q.z + 0.045, C.cobbleStone, deco);
  for (const x of [p.x + 0.12, q.x - 0.25]) for (const z of [p.z - 0.025, q.z - 0.025]) b.block(x, p.y, z, x + 0.13, q.y, z + 0.05, C.stoneJoint, deco);
  for (let y = p.y + 1.1; y + 1.3 < q.y; y += 3) {
    for (const n of [-1, 1]) {
      const z = n < 0 ? p.z : q.z;
      if (!(muralFront && n === -1))
        for (let x = p.x + 1.1; x < q.x - 1; x += 2.8) { if (y < 3 && behindShop(home.solid.box, 'z', n, x)) continue; window(b, x, y, z + n * 0.05, n, false, index); windows.push({ x, y, z, n, side: false, seed: index * 7 + windows.length }); }
      const x = n < 0 ? p.x : q.x;
      for (let zc = p.z + 1.2; zc < q.z - 1; zc += 3) { if (y < 3 && behindShop(home.solid.box, 'x', n, zc)) continue; window(b, x + n * 0.05, y, zc, n, true, index + 1); windows.push({ x, y, z: zc, n, side: true, seed: index * 7 + windows.length }); }
    }
  }
  if (p.y === 0) for (const n of [-1, 1]) {
    if (muralFront && n === -1) continue;
    const z = n < 0 ? p.z : q.z, x = (p.x + q.x) / 2;
    b.block(x - 0.62, 0.02, z - 0.04, x + 0.62, 2.2, z + 0.04, index % 3 ? C.clothTeal : C.steel, deco);
    for (let y = 0.2; y < 2.1; y += 0.22) b.block(x - 0.55, y, z - 0.06, x + 0.55, y + 0.025, z + 0.06, C.inkSoft, deco);
    // Medidor, conduíte e número: detalhes rasos não roubam largura do beco.
    b.block(p.x + 0.3, 1.3, z - 0.07, p.x + 0.62, 1.8, z + 0.07, C.steelLight, deco);
    b.block(p.x + 0.42, 1.78, z - 0.045, p.x + 0.46, q.y - 0.2, z + 0.045, C.steel, deco);
  }
  // Reservatórios no skyline ficam apoiados em telhados inacessíveis.
  if (p.y > 0 && index % 2 === 0) {
    const g = new THREE.CylinderGeometry(0.7, 0.85, 1.5, 12);
    b.add(place(g, (p.x + q.x) / 2, q.y + 0.75, (p.z + q.z) / 2), toon(C.tank));
    b.add(place(new THREE.CylinderGeometry(0.78, 0.78, 0.13, 12), (p.x + q.x) / 2, q.y + 1.53, (p.z + q.z) / 2), toon(C.glass));
  }
  if (p.y > 0 && index % 2 === 1) favelaRoof(b, map, p, q);
}

/** Banca fechada com caixotes e balcão: a mesma cobertura é legível de qualquer lado. */
function marketStall(b: Builder, art: FavelaArt, p: THREE.Vector3Like, q: THREE.Vector3Like) {
  const cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2;
  const sign = art.sign('FEIRA DO SOL', 'DA HORTA PRA MESA', C.colonialMoss);
  for (const f of [
    { x: cx, z: p.z, w: q.x - p.x, angle: Math.PI },
    { x: cx, z: q.z, w: q.x - p.x, angle: 0 },
    { x: p.x, z: cz, w: q.z - p.z, angle: -Math.PI / 2 },
    { x: q.x, z: cz, w: q.z - p.z, angle: Math.PI / 2 },
  ]) {
    const piece = (x: number, y: number, w: number, h: number, color: number, out = 0.06) => {
      const geo = new THREE.PlaneGeometry(w, h).translate(x, y, out);
      b.add(place(geo, f.x, 0, f.z, f.angle), toon(color), { cast: false });
    };
    piece(0, 0.5, f.w - 0.1, 0.9, C.cantaria);
    for (let x = -f.w / 2 + 0.18; x < f.w / 2; x += 0.38) piece(x, 0.5, 0.022, 0.85, C.bark, 0.07);
    for (const x of [-f.w / 2 + 0.07, f.w / 2 - 0.07]) piece(x, q.y / 2, 0.12, q.y, C.ochre, 0.08);
    piece(0, 1.26, f.w - 0.24, 0.51, C.bark, 0.075);
    for (let x = -f.w / 2 + 0.4, i = 0; x < f.w / 2 - 0.25; x += 0.52, i++) {
      piece(x, 1.16, 0.46, 0.16, C.cantaria, 0.085);
      for (const dx of [-0.12, 0.1]) {
        const fruit = new THREE.CircleGeometry(0.11, 10).translate(x + dx, 1.35, 0.09);
        b.add(place(fruit, f.x, 0, f.z, f.angle), toon(i % 2 ? C.leafLight : C.ochre), { cast: false });
      }
    }
    piece(0, 0.99, f.w - 0.08, 0.1, C.ochre, 0.1);
    // Painel acima dos produtos, sem projetar uma abertura atravessável.
    const panel = planeGeo(f.w - 0.25, 0.38, sign);
    b.add(place(panel.translate(0, q.y - 0.38, 0.09), f.x, 0, f.z, f.angle), art.material, { cast: false });
  }
}

function window(b: Builder, x: number, y: number, z: number, n: number, side: boolean, seed: number) {
  const piece = (u0: number, v0: number, u1: number, v1: number, depth: number, color: number) => {
    if (side) b.block(x - depth, y + v0, z + u0, x + depth, y + v1, z + u1, color, deco);
    else b.block(x + u0, y + v0, z - depth, x + u1, y + v1, z + depth, color, deco);
  };
  piece(-0.68, -0.08, 0.68, 1.28, 0.02, C.cal);
  piece(-0.57, 0, 0.57, 1.17, 0.03, seed % 4 ? C.glass : C.sand);
  piece(-0.025, 0, 0.025, 1.17, 0.04, C.steelLight);
  piece(-0.57, 0.54, 0.57, 0.59, 0.04, C.steelLight);
  for (const u of [-0.38, 0.38]) piece(u, 0, u + 0.028, 1.17, 0.045, n < 0 ? C.steel : C.inkSoft);
  if (seed % 3 === 0) {
    for (const u of [-0.55, 0.08]) {
      piece(u, 0, u + 0.47, 1.17, 0.045, C.clothTeal);
      for (let v = 0.13; v < 1.1; v += 0.15) piece(u + 0.04, v, u + 0.43, v + 0.025, 0.055, C.colonialMoss);
    }
  }
}
