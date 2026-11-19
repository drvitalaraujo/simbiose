import * as THREE from 'three';
import { PALETTE as C, hex, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { box } from '../world/shapes';
import { planeGeo } from '../world/textures';
import { clearOfBody, exposedFaces, facePoint } from './facades';
import { LAPA_BUILDINGS, LAPA_COVERS, LAPA_STAIRS, LAPA_TERRACE } from './lapa';
import { LapaArt } from './lapa-art';
import type { MapData } from './types';

const deco = { solid: false, shoot: false, cast: false, outline: 0 };

/** Acabamento segue as ruas novas: quinas, fundos habitados e acessos do terraço. */
export function lapaUrbanDetails(b: Builder, map: MapData, art: LapaArt) {
  const buildings = new Map(LAPA_BUILDINGS.filter(s => s.name !== 'circo' && s.name !== 'fundicao')
    .map(s => [s.solid, s]));
  for (const f of exposedFaces(map, s => buildings.has(s))) {
    const building = buildings.get(f.solid)!;
    if (f.axis === 'z' && f.n === -1 && building.name === 'casario') continue;
    const width = f.t1 - f.t0;
    if (width < 1) continue;
    const rotation = f.axis === 'x' ? f.n * Math.PI / 2 : f.n === 1 ? 0 : Math.PI;
    const flat = (t: number, y: number, w: number, h: number, color: number, off = 0.065) => {
      const p = facePoint(f, t, off);
      b.add(place(new THREE.PlaneGeometry(w, h), p.x, y, p.z, rotation), toon(color), { cast: false });
    };
    const center = (f.t0 + f.t1) / 2, p = facePoint(f, center, 0.025);
    b.add(place(planeGeo(width, f.top - f.base, art.plaster(C[building.color], 47)),
      p.x, (f.top + f.base) / 2, p.z, rotation), art.material, { cast: false });
    for (const t of [f.t0 + 0.12, f.t1 - 0.12]) flat(t, (f.base + f.top) / 2, 0.2, f.top - f.base, C.cal);
    for (const y of [0.3, 3.2, f.top - 0.18]) if (y > f.base)
      flat(center, y, width, 0.18, C.cal, 0.09);
    const count = Math.max(1, Math.floor(width / 3.3)), pitch = width / count;
    for (let i = 0; i < count; i++) {
      const t = f.t0 + pitch * (i + 0.5);
      if (f.base < 0.2) {
        flat(t, 1.35, Math.min(1.6, pitch - 0.3), 2.5, C.cantaria);
        flat(t, 1.36, Math.min(1.35, pitch - 0.5), 2.3, C.clothTeal, 0.09);
        // Barras discretas no portão dão escala sem embaralhar a silhueta do alvo.
        for (let y = 0.35; y < 2.4; y += 0.45) flat(t, y, Math.min(1.28, pitch - 0.6), 0.028, C.colonialMoss, 0.105);
      }
      for (let y = Math.max(4.8, f.base + 1.1); y + 0.9 < f.top; y += 2.8) {
        flat(t, y, 1.65, 1.95, C.cal);
        flat(t, y, 1.35, 1.68, C.glass, 0.09);
        flat(t, y, 0.065, 1.7, C.cal, 0.1);
        flat(t, y - 0.15, 1.35, 0.065, C.cal, 0.1);
      }
    }
  }

  publicFountains(b, art);

  // Toldo alto e estreito em cada comércio interior: não cria túnel inalcançável.
  for (const [x0, x1, z, color] of [[-34.5, -23.5, 15, C.ochre], [26.5, 35.5, 12, C.colonialRose]]) {
    const canopy = box(x0, 4.5, z - 1.3, x1, 4.8, z);
    if (!clearOfBody(map, canopy)) continue;
    const count = Math.ceil((x1 - x0) / 0.65), span = (x1 - x0) / count;
    for (let i = 0; i < count; i++) {
      const x = x0 + i * span;
      b.block(x, 4.64, z - 1.3, x + span, 4.78, z, i % 2 ? C.cal : color, deco);
      b.block(x, 4.5, z - 1.3, x + span, 4.65, z - 1.24, i % 2 ? C.cal : color, deco);
    }
  }

  const { min: p, max: q } = LAPA_TERRACE.box;
  // Pisos/espelhos distintos tornam o primeiro degrau legível correndo.
  b.block(p.x, q.y + 0.004, p.z, q.x, q.y + 0.009, q.z, C.sand, deco);
  for (const s of LAPA_STAIRS) {
    const a = s.box.min, z = s.box.max;
    b.block(a.x, z.y + 0.006, a.z, z.x, z.y + 0.012, z.z, C.cal, deco);
    const alongX = z.x - a.x < z.z - a.z;
    if (alongX) b.block(a.x, z.y + 0.013, a.z, a.x + 0.1, z.y + 0.018, z.z, C.cantaria, deco);
    else b.block(a.x, z.y + 0.013, a.z, z.x, z.y + 0.018, a.z + 0.1, C.cantaria, deco);
  }
  art.panel(art.sign('TERRAÇO DO CHORO', 'A MÚSICA SOBE. A GENTE TAMBÉM.', C.clothTeal), 19.8, 2.65, 38.37, 6.8, 0.75, -1);
  for (const n of [-1, 1]) {
    const z = n === 1 ? 25.04 : 14.96;
    art.panel(art.sign('SEBO DO BECO', 'LIVROS • TROCAS • IDEIAS LIVRES', C.bark), -29, 3.65, z, 7.5, 0.75, n);
  }
  for (const [x, z, text] of [[-27.5, -11.96, 'BILHETERIA • CIRCO'], [24.5, -10.96, 'FUNDIÇÃO • ACESSO']] as const)
    art.panel(art.sign(text, 'CULTURA LIVRE / ENTRADA PELA PRAÇA', C.colonialMoss), x, 2.62, z, 6.1, 0.55);

  // Paginação acompanha as três praças e o beco em vez de riscar um tabuleiro.
  for (const [x0, z0, x1, z1, y] of [[-42, 26, -15, 30, 0], [-22, 15, -15, 38, 0], [0, 39.5, 27, 43, 0], [9, 27, 24, 39, 1.6]]) {
    for (const z of [z0, z1]) b.block(x0, y + 0.02, z, x1, y + 0.026, z + 0.1, C.cantaria, deco);
    for (const x of [x0, x1]) b.block(x, y + 0.02, z0, x + 0.1, y + 0.026, z1, C.cantaria, deco);
  }
}

/** Estações públicas de cantaria e azulejo: nichos fechados, bicas e mural autoral. */
function publicFountains(b: Builder, art: LapaArt) {
  const ceramic = art.mural((g, w, h) => {
    g.fillStyle = hex(C.cal); g.fillRect(0, 0, w, h);
    g.strokeStyle = hex(C.stoneJoint); g.globalAlpha = 0.24; g.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // Desenho contínuo atravessa os azulejos; grandes áreas claras conservam a leitura.
    g.globalAlpha = 0.6; g.strokeStyle = hex(C.clothTeal); g.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      const x = 24 + i * 78;
      g.beginPath(); g.moveTo(x, 220); g.lineTo(x, 129);
      g.arc(x + 36, 129, 36, Math.PI, 0); g.lineTo(x + 72, 220); g.stroke();
    }
    g.lineWidth = 4;
    for (const y of [71, 81]) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); }
    g.globalAlpha = 0.35;
    for (let i = 0; i < 6; i++) {
      g.beginPath(); g.arc(62 + i * 78, 45, 12, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  });
  const arch = (width: number, base: number, spring: number) => {
    const shape = new THREE.Shape(), r = width / 2;
    shape.moveTo(-r, base); shape.lineTo(r, base); shape.lineTo(r, spring);
    shape.absarc(0, spring, r, 0, Math.PI, false); shape.lineTo(-r, base); shape.closePath();
    return new THREE.ShapeGeometry(shape, 20);
  };
  for (const c of LAPA_COVERS.filter(c => c.type === 'memory')) {
    const { min: p, max: q } = c.solid.box, cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2;
    const water = cx > 0;
    const uv = art.sign(water ? 'ÁGUA & ENCONTRO' : 'MEMÓRIA DA LAPA',
      water ? 'PRAÇA CARDEAL CÂMARA' : 'A CIDADE PERTENCE A QUEM VIVE NELA', C.clothTeal);
    const faces = [
      { x: cx, z: q.z, w: q.x - p.x, angle: 0, end: true },
      { x: cx, z: p.z, w: q.x - p.x, angle: Math.PI, end: true },
      { x: q.x, z: cz, w: q.z - p.z, angle: Math.PI / 2, end: false },
      { x: p.x, z: cz, w: q.z - p.z, angle: -Math.PI / 2, end: false },
    ];
    for (const f of faces) {
      const add = (g: THREE.BufferGeometry, color: number, x: number, y: number, out = 0.065) => {
        g.translate(x, y, out);
        b.add(place(g, f.x, 0, f.z, f.angle), toon(color), { cast: false });
      };
      const rect = (x: number, y: number, w: number, h: number, color: number, out = 0.065) =>
        add(new THREE.PlaneGeometry(w, h), color, x, y, out);
      b.add(place(planeGeo(Math.min(3.5, f.w - 0.5), 0.38, uv).translate(0, 2.54, 0.075),
        f.x, 0, f.z, f.angle), art.material, { cast: false });
      for (const x of [-f.w / 2 + 0.13, f.w / 2 - 0.13]) {
        rect(x, 1.37, 0.2, 2.65, C.cantaria);
        for (const y of [0.24, 2.3]) rect(x, y, 0.28, 0.1, C.cal, 0.085);
      }
      rect(0, 0.17, f.w - 0.12, 0.18, C.cantaria);
      rect(0, 2.8, f.w, 0.12, C.colonialMoss);
      if (water && f.end) {
        // Duas bicas a altura humana; curvas são relevos de até 11 cm na face maciça.
        for (const x of [-0.85, 0.85]) {
          add(arch(1.34, 0.39, 1.48), C.cantaria, x, 0, 0.066);
          add(arch(1.12, 0.48, 1.48), C.cal, x, 0, 0.078);
          add(new THREE.CircleGeometry(0.2, 20), C.clothTeal, x, 1.45, 0.085);
          const tap = new THREE.CylinderGeometry(0.065, 0.065, 0.07, 12).rotateX(Math.PI / 2);
          add(tap, C.steel, x, 1.42, 0.073);
          rect(x, 1.23, 0.026, 0.3, C.clothTeal, 0.094);
          // Bacia semicircular de pedra, embutida na alvenaria.
          add(new THREE.CircleGeometry(0.4, 20, Math.PI, Math.PI), C.cantaria, x, 1.05, 0.081);
          rect(x, 1.04, 0.85, 0.075, C.cal, 0.1);
          rect(x, 0.74, 0.3, 0.07, C.stoneJoint, 0.09);
        }
      } else {
        const muralWidth = f.end ? 2.75 : 3.55;
        rect(0, 1.3, muralWidth + 0.22, 1.55, C.cantaria, 0.065);
        b.add(place(planeGeo(muralWidth, 1.33, ceramic).translate(0, 1.3, 0.08),
          f.x, 0, f.z, f.angle), art.material, { cast: false });
        // Óculo fechado e cantaria curvas fazem eco ao aqueduto, sem mudar a cobertura.
        for (const x of [-f.w / 2 + 0.58, f.w / 2 - 0.58]) {
          add(new THREE.CircleGeometry(0.19, 16), C.cantaria, x, 2.1, 0.07);
          add(new THREE.CircleGeometry(0.12, 16), C.clothTeal, x, 2.1, 0.08);
        }
      }
    }
  }
}
