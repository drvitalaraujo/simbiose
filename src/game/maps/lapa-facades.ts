import * as THREE from 'three';
import { PALETTE as C, hex, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { box } from '../world/shapes';
import { clearOfBody } from './facades';
import { LAPA_BUILDINGS } from './lapa';
import { LapaArt } from './lapa-art';
import type { MapData } from './types';

const deco = { solid: false, shoot: false, cast: false, outline: 0 };
const colors = [C.ochre, C.colonialMoss, C.colonialRose, C.sand, C.colonialSky, C.terracotta];
const shops = [
  ['BAR DO ARCO', 'PF • CAFÉ • CONVERSA'], ['RÁDIO LIVRE', 'CONSERTO • SINTONIA • RESISTÊNCIA'],
  ['ARMAZÉM DA LAPA', 'FIADO SÓ DEPOIS DA REVOLUÇÃO'], ['SEBO ÚLTIMA PÁGINA', 'LIVROS SEM ALGORITMO'],
  ['CASA DO CHORO', 'HOJE TEM RODA • ENTRADA FRANCA'], ['PENSÃO BOM DESCANSO', 'QUARTOS • ÁGUA • SOSSEGO'],
  ['OFICINA DO ZÉ', 'REPARA-SE QUASE TUDO'], ['PADARIA AURORA', 'PÃO QUENTE • DESDE ANTES DO IFB'],
  ['BOTECO ANALÓGICO', 'DESLIGUE A TELA • PUXE UMA CADEIRA'], ['COSTURA DA NINA', 'REMENDOS • AJUSTES • FUTUROS'],
  ['DISCOS E FITAS', 'SOM DE GENTE'], ['FARMÁCIA POPULAR', 'CUIDAR NÃO É ASSINATURA'],
  ['CAFÉ DA ESQUINA', 'COADO NA HORA'], ['MERCEARIA ESPERANÇA', 'A GENTE CONTINUA AQUI'],
];

export function lapaFacades(b: Builder, map: MapData, art: LapaArt) {
  let serial = 0;
  for (const building of LAPA_BUILDINGS) {
    if (building.name !== 'casario') continue;
    const { min: p, max: q } = building.solid.box;
    const count = Math.round((q.x - p.x) / 6), span = (q.x - p.x) / count;
    for (let i = 0; i < count; i++, serial++) {
      const left = p.x + i * span, right = left + span, cx = (left + right) / 2;
      const color = colors[serial % colors.length], z = p.z;
      // Molduras/venezianas rasas são faces, não caixas com cinco lados invisíveis.
      const flat = (x0: number, y0: number, x1: number, y1: number, c: number, off = 0.07) =>
        b.add(place(new THREE.PlaneGeometry(x1 - x0, y1 - y0), (x0 + x1) / 2, (y0 + y1) / 2, z - off, Math.PI), toon(c), { cast: false });
      art.panel(art.plaster(color, serial + 21), cx, q.y / 2, z - 0.022, span, q.y, -1);
      flat(left, 0, left + 0.18, q.y + 0.2, C.cal);
      flat(right - 0.18, 0, right, q.y + 0.2, C.cal);
      for (const y of [0.16, 3.3, q.y - 0.18]) flat(left, y, right, y + 0.14, C.cal, 0.11);
      const shop = shops[serial % shops.length];
      art.panel(art.sign(shop[0], shop[1], serial % 2 ? C.clothTeal : C.bark), cx, 2.93, z - 0.09, span - 0.5, 0.66, -1);
      const shutter = art.shutter(serial);
      for (const dx of [-span * 0.24, span * 0.24]) {
        flat(cx + dx - 1.04, 0.12, cx + dx + 1.04, 2.53, C.cantaria, 0.055);
        art.panel(shutter, cx + dx, 1.36, z - 0.085, 1.82, 2.2, -1);
      }
      for (let y = 4.05; y + 1.8 < q.y; y += 2.9) for (const dx of [-span * 0.24, span * 0.24]) {
        const x = cx + dx;
        flat(x - 0.89, y - 0.12, x + 0.89, y + 1.86, C.cal, 0.065);
        flat(x - 0.7, y, x + 0.7, y + 1.7, C.glass, 0.08);
        flat(x - 0.035, y, x + 0.035, y + 1.7, C.cantaria, 0.1);
        flat(x - 0.7, y + 1.15, x + 0.7, y + 1.23, C.cal, 0.105);
        // Venezianas estreitas e cortinas: relevo raso que não cria falso abrigo.
        for (const side of [-1, 1]) {
          flat(x + side * 0.65 - 0.18, y, x + side * 0.65 + 0.18, y + 1.67, serial % 2 ? C.clothTeal : C.bark, 0.11);
          for (let sy = y + 0.12; sy < y + 1.6; sy += 0.19)
            flat(x + side * 0.65 - 0.16, sy, x + side * 0.65 + 0.16, sy + 0.025, C.cantaria, 0.115);
        }
        // Sacada francesa em ferro, só onde o envelope conservador permite.
        const balcony = box(x - 0.94, y - 0.18, z - 0.48, x + 0.94, y + 0.73, z);
        if (clearOfBody(map, balcony)) {
          b.block(x - 0.94, y - 0.18, z - 0.48, x + 0.94, y - 0.08, z, C.cantaria, deco);
          for (const yy of [y, y + 0.7]) b.block(x - 0.9, yy, z - 0.46, x + 0.9, yy + 0.045, z - 0.42, C.steel, deco);
          for (let xx = x - 0.85; xx < x + 0.9; xx += 0.22)
            b.block(xx, y, z - 0.46, xx + 0.032, y + 0.7, z - 0.42, C.steel, deco);
        }
      }
      // Platibandas e frontões distintos quebram a barra contínua sem mudar a planta.
      const cap = q.y + 0.35 + (serial % 3) * 0.26;
      flat(left + 0.15, q.y, right - 0.15, cap, color, 0.1);
      flat(left + 0.1, cap, right - 0.1, cap + 0.14, C.cal, 0.115);
      if (serial % 3 === 0) {
        const shape = new THREE.Shape([new THREE.Vector2(-1.4, 0), new THREE.Vector2(1.4, 0), new THREE.Vector2(0, 0.8)]);
        b.add(place(new THREE.ShapeGeometry(shape), cx, cap, z - 0.06, Math.PI), toon(C.cal), { cast: false });
      }
      // Telhado de duas águas: malha simples, juntas de telha no vértice/lote comum.
      const roof = new THREE.BufferGeometry();
      const mid = (p.z + q.z) / 2;
      roof.setAttribute('position', new THREE.Float32BufferAttribute([
        left, q.y + 0.18, p.z, right, q.y + 0.18, p.z, right, q.y + 1.35, mid, left, q.y + 1.35, mid,
        left, q.y + 1.35, mid, right, q.y + 1.35, mid, right, q.y + 0.18, q.z, left, q.y + 0.18, q.z,
      ], 3)); roof.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]); roof.computeVertexNormals();
      b.add(roof, toon(serial % 2 ? C.telha : C.terracotta), { cast: false });
      b.block(left, q.y + 1.32, mid - 0.08, right, q.y + 1.45, mid + 0.08, C.cantaria, deco);
      if (serial % 3 === 1) {
        const tank = new THREE.CylinderGeometry(0.64, 0.58, 0.85, 10);
        b.add(place(tank, cx, q.y + 1.25, q.z - 1.8), toon(C.tank), { cast: false });
        b.block(cx - 0.7, q.y + 1.68, q.z - 2.5, cx + 0.7, q.y + 1.77, q.z - 1.1, C.steel, deco);
      }
      // Calha vertical colada à parede, visível até o chão.
      flat(right - 0.35, 0.15, right - 0.28, q.y, C.steel, 0.115);
    }
  }
}

export function lapaHeritage(b: Builder, map: MapData, art: LapaArt) {
  // Cantaria e umidade da base dos arcos: desgaste localizado, sem sujar a silhueta branca.
  const wear = art.mural((g, w, h) => {
    g.fillStyle = hex(C.cal); g.fillRect(0, 0, w, h);
    for (let row = 0; row < 6; row++) {
      g.globalAlpha = 0.13 + row * 0.035;
      for (let col = 0; col < 10; col++) {
        const x = col * 57 + (row % 2) * 21, y = 32 + row * 38;
        g.fillStyle = hex(row < 3 ? C.cal : C.cantaria);
        g.fillRect(x, y, 45, 30);
        g.fillStyle = hex(C.stoneJoint); g.fillRect(x, y + 30, 45, 1);
      }
    }
    g.globalAlpha = 0.3; g.fillStyle = hex(C.cantaria);
    for (let i = 0; i < 20; i++) g.fillRect(i * 27, h - 15 - (i * 13 % 34), 23, 55);
  });
  for (let x = -42; x <= 42; x += 6) for (const n of [-1, 1])
    art.panel(wear, x, 1.68, n * 1.125, 1.25, 3.3, n);

  // Frontão com óculo radial: identidade industrial da Fundição.
  const disc = new THREE.CircleGeometry(0.88, 32);
  b.add(place(disc, 24, 10.6, -24.88), toon(C.cal), { cast: false });
  b.add(place(new THREE.CircleGeometry(0.68, 24), 24, 10.6, -24.87), toon(C.colonialMoss), { cast: false });
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const bar = new THREE.PlaneGeometry(0.035, 1.26);
    b.add(place(bar, 24, 10.6, -24.86, 0, 0, a), toon(C.cal), { cast: false });
  }
  // Dutos rasos e tijolos aparentes em áreas sem portas, com alturas coerentes.
  for (const x of [5.4, 42.5]) {
    b.block(x, 0.05, -25, x + 0.08, 9.6, -24.91, C.steel, deco);
    for (let y = 0.2; y < 1.8; y += 0.24) for (let col = 0; col < 3; col++) {
      const xx = x + (x < 24 ? 1 : -1) * (0.2 + col * 0.24);
      b.block(xx, y, -24.98, xx + 0.2, y + 0.18, -24.95, C.terracotta, deco);
    }
  }
  // Nervuras da lona: geometria acompanha exatamente a cúpula existente.
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, points = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16 * Math.PI / 2;
      points.push(new THREE.Vector3(-25 + Math.cos(a) * Math.sin(t) * 11.53, 3.4 + Math.cos(t) * 5.83, -31.5 + Math.sin(a) * Math.sin(t) * 6.23));
    }
    const seam = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.026, 3, false);
    seam.computeBoundingBox(); const bb = seam.boundingBox!;
    if (!clearOfBody(map, box(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z)))
      throw new Error('Lapa: costura da lona invade o pulo');
    b.add(seam, toon(C.cantaria), { cast: false });
  }
}
