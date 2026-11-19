import * as THREE from 'three';
import { PALETTE as C, hex, toon, toonWith } from '../toon';
import { Builder, place } from '../world/builder';
import { canvas, texture } from '../world/textures';
import { box, rng } from '../world/shapes';
import { clearOfBody } from './facades';
import { LAPA_ARCADE, LAPA_ARCH_SOLIDS, LAPA_BUILDINGS, LAPA_COVERS, LAPA_PALMS, LAPA_SPANDRELS } from './lapa';
import { solidColor } from './colors';
import type { MapData } from './types';
import { LapaArt } from './lapa-art';
import { broadleaf, palm as floraPalm } from '../world/flora';
import { lapaGrime } from './lapa-grime';
import { lapaTram } from './lapa-tram';
import { detailQuality } from '../render/detail-quality';
import { setGrimeQuality } from '../world/grime';
import { lapaFacades, lapaHeritage } from './lapa-facades';
import { lapaBackdrop, lapaStreet } from './lapa-street';
import { lapaUrbanDetails } from './lapa-urban';
import { lapaLandmarks } from './lapa-landmarks';

// Arte autoral procedural: nenhum pixel do Google Maps é embarcado no jogo.
const decoration = { solid: false, shoot: false, cast: false, outline: 0 };
const archSet = new Set(LAPA_ARCH_SOLIDS);
const spandrelSet = new Set(LAPA_SPANDRELS);
const proxy = toon(C.cal).clone(); proxy.visible = false;

export function lapaLight(scene: THREE.Scene) {
  for (const child of scene.children) {
    if (child instanceof THREE.HemisphereLight) {
      child.color.set(C.cal).lerp(new THREE.Color(C.colonialSky), 0.28);
      child.groundColor.set(C.steelLight); child.intensity = 1.05;
    } else if (child instanceof THREE.DirectionalLight) {
      child.color.set(child.castShadow ? C.sun : C.colonialSky);
      child.intensity = child.castShadow ? 2.25 : 0.38;
    }
  }
}

export function dressLapa(b: Builder, map: MapData, dressed: boolean) {
  setGrimeQuality(detailQuality()); // nível em vigor do pipeline (no online o mapa chega depois)
  for (const s of map.solids) {
    const { min: p, max: q } = s.box;
    if (s.kind === 'bound') { b.invisible(p.x, p.y, p.z, q.x, q.y, q.z); continue; }
    const building = LAPA_BUILDINGS.find(item => item.solid === s);
    const cover = LAPA_COVERS.find(item => item.solid === s);
    const color = archSet.has(s) ? C.cal : building ? C[building.color] :
      cover?.type === 'kiosk' ? C.ochre : cover?.type === 'barricade' ? C.steel : cover?.type === 'memory' ? C.cal :
      s.kind === 'terrace' || s.kind === 'stairs' ? C.cantaria :
      s.kind === 'ground' ? C.cobbleStone : s.kind === 'wall' ? C.bark : C.stoneJoint;
    b.block(p.x, p.y, p.z, q.x, q.y, q.z, dressed && spandrelSet.has(s) ? proxy : dressed ? color : solidColor(s), {
      solid: s.solid ?? true, shoot: s.shoot ?? true, cast: s.kind !== 'ground', outline: 0,
    });
  }
  if (!dressed) return;
  // Solo de fundo além dos limites, para o recorte continuar inserido na cidade.
  b.block(-200, -0.12, -180, 200, -0.08, 180, C.asphalt, decoration);
  paving(b, map);
  arcadeDetails(b);
  const art = new LapaArt(b);
  for (const building of LAPA_BUILDINGS) {
    if (building.name === 'circo') circus(b);
    else if (building.name === 'fundicao') {
      art.panel(art.plaster(C.ochre, 47), 24, 5, -24.99, 38, 10);
      facade(b, building.solid.box, C[building.color], true);
      art.panel(art.sign('FUNDIÇÃO PROGRESSO', 'CULTURA VIVA • MÚSICA • MEMÓRIA', C.colonialMoss), 24, 9.2, -24.9, 13, 0.9);
    }
  }
  lapaFacades(b, map, art);
  for (const c of LAPA_COVERS) {
    const { min: p, max: q } = c.solid.box;
    if (c.type === 'planter') {
      // Tampa dentro da caixa de cobertura; vegetação alta passa pelo envelope de pulo.
      b.block(p.x, q.y - 0.15, p.z, q.x, q.y, q.z, C.cal, decoration);
      b.block(p.x + 0.2, q.y, p.z + 0.2, q.x - 0.2, q.y + 0.03, q.z - 0.2, C.bark, decoration);
    } else if (c.type === 'kiosk') {
      const z = p.z - 0.025;
      b.block(p.x + 0.3, 0.8, z, q.x - 0.3, q.y - 0.7, p.z, C.inkSoft, decoration);
      for (let x = p.x + 0.35; x + 0.35 < q.x; x += 0.66) b.block(x, 0.9, z - 0.01, x + 0.35, 1.1, z, C.colonialRed, decoration);
      b.block(p.x, q.y - 0.2, p.z, q.x, q.y, q.z, C.colonialRed, decoration);
    } else if (c.type === 'barricade') {
      for (let x = p.x + 0.3; x < q.x; x += 0.65) {
        b.block(x, 0.25, p.z - 0.025, x + 0.3, 0.42, p.z, C.yellow, decoration);
        b.block(x, 1.65, q.z, x + 0.3, 1.82, q.z + 0.025, C.yellow, decoration);
      }
    }
  }
  for (const [x, z] of LAPA_PALMS) palm(b, map, x, z);
  lapaTram(b, art);
  skyline(b);
  lapaLandmarks(b);
  lapaStreet(b, map, art);
  lapaHeritage(b, map, art);
  lapaUrbanDetails(b, map, art);
  lapaBackdrop(b);
  lapaGrime(b, map);
  art.finish();
}

function paving(b: Builder, map: MapData) {
  const S = 1024;
  const [c, g] = canvas(S, S);
  const r = rng(1810);
  // Pedra clara com variação curta de valor: o piso não disputa contraste com o alvo.
  // 16 × 16 placas por repetição (8 m): placa trocada, trincada, manchada e quina lascada.
  g.fillStyle = hex(C.stoneJoint); g.fillRect(0, 0, S, S);
  const stone = new THREE.Color(C.cobbleStone).lerp(new THREE.Color(C.sand), 0.12);
  for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) {
    const roll = r();
    const shade = roll < 0.06 ? stone.clone().lerp(new THREE.Color(C.stoneJoint), 0.45) :
      roll < 0.14 ? stone.clone().lerp(new THREE.Color(C.sand), 0.35) : stone.clone().lerp(new THREE.Color(C.cal), 0.12 + r() * 0.3);
    g.fillStyle = `#${shade.getHexString()}`;
    g.fillRect(x + 1, y + 1, 62, 62);
    // Quina de corte e junta fina em vez de quadrados alternados muito escuros.
    g.globalAlpha = 0.22; g.fillStyle = hex(C.cal);
    g.fillRect(x + 2, y + 2, 60, 1);
    g.globalAlpha = 0.18; g.fillStyle = hex(C.stoneJoint);
    g.fillRect(x + 2, y + 60, 60, 2);
    g.fillRect(x + 60, y + 2, 2, 58);
    if (r() < 0.2) {
      g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(x + 4 + r() * 20, y + 1); g.lineTo(x + 20 + r() * 20, y + 20 + r() * 20);
      g.lineTo(x + 30 + r() * 30, y + 63); g.strokeStyle = hex(C.stoneJoint); g.lineWidth = 1; g.stroke();
    }
    if (r() < 0.12) {
      g.globalAlpha = 0.12; g.fillStyle = hex(C.bark);
      g.beginPath(); g.ellipse(x + 32, y + 32, 10 + r() * 18, 8 + r() * 12, r() * 3, 0, Math.PI * 2); g.fill();
    }
    if (r() < 0.15) {
      g.globalAlpha = 0.9; g.fillStyle = hex(C.stoneJoint);
      const cx = r() < 0.5 ? x + 1 : x + 55, cy = r() < 0.5 ? y + 1 : y + 55;
      g.fillRect(cx, cy, 8, 8);
    }
    g.globalAlpha = 1;
  }
  g.globalAlpha = 0.055; g.fillStyle = hex(C.steel);
  for (let i = 0; i < 22000; i++) g.fillRect(r() * S, r() * S, 1, 1);
  g.globalAlpha = 1;
  const mat = toonWith({ map: texture(c, true), color: C.paper });
  const { x0, x1, z0, z1 } = map.bounds;
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12.5, uv.getY(i) * 10.25);
  b.add(place(geo, (x0 + x1) / 2, 0.006, (z0 + z1) / 2, 0, -Math.PI / 2), mat, { cast: false });
  // Mem de Sá cruza o fim dos arcos; a rua dos Arcos separa as casas de shows.
  b.block(-50, 0.009, -38, -43, 0.014, 12, C.asphalt, decoration);
  b.block(-43, 0.009, -25, 43, 0.014, -18, C.asphalt, decoration);
  b.block(43, 0.009, -38, 50, 0.014, 9, C.asphalt, decoration);
  for (let x = -40; x < 41; x += 6) b.block(x, 0.015, -21.6, x + 2.8, 0.02, -21.4, C.cal, decoration);
  for (const x of [-49, -48, -47, -46, -45, -44]) b.block(x, 0.016, 0, x + 0.5, 0.02, 6, C.cal, decoration);
  // Faixas de pedra escura da praça, sem o desenho de ondas de Copacabana.
  for (const [x0, z, x1] of [[-42, 3, 9], [-21, 22, 23], [-42, 28, -15], [0, 41, 27]])
    b.block(x0, 0.007, z, x1, 0.012, z + 0.18, C.stoneJoint, decoration);
}

function arcadeDetails(b: Builder) {
  const a = LAPA_ARCADE;
  for (let tier = 0; tier < 2; tier++) for (let i = 0; i < a.bays; i++) {
    const shape = new THREE.Shape();
    shape.moveTo(-a.radius, a.tier); shape.lineTo(-a.radius, a.spring);
    shape.absarc(0, a.spring, a.radius, Math.PI, 0, true);
    shape.lineTo(a.radius, a.tier); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: a.depth, bevelEnabled: false, curveSegments: 32 });
    b.add(place(g, a.start + (i + 0.5) * a.pitch, tier * a.tier, -a.depth / 2), toon(C.cal));
  }
  for (const y of [a.tier, a.top]) {
    // Cimalhas seguem o sólido, com saliência abaixo de 0,12 m.
    b.block(-42.65, y - 0.16, -1.16, 42.65, y, 1.16, C.paper, decoration);
  }
  for (let i = 0; i <= a.bays; i++) {
    const x = a.start + i * a.pitch;
    for (const n of [-1, 1]) {
      const z = n * 1.105;
      // Cantaria e marcas de reboco: peças rasas coladas nos pilares.
      for (let y = 0.4; y < 3.1; y += 0.7) b.block(x - 0.55, y, Math.min(z, z + n * 0.015), x + 0.55, y + 0.022, Math.max(z, z + n * 0.015), C.cobbleStone, decoration);
      b.block(x - 0.55, 0.05, Math.min(z, z + n * 0.012), x + 0.55, 0.32 + (i % 3) * 0.12, Math.max(z, z + n * 0.012), C.cantaria, decoration);
    }
  }
  // Trilhos e proteção da via do bondinho, fora do alcance do corpo.
  for (const z of [-0.42, 0.42]) b.block(-42.6, 13.61, z - 0.045, 42.6, 13.68, z + 0.045, C.steel, decoration);
  for (const z of [-1.05, 1.05]) {
    b.block(-42.6, 14.3, z - 0.025, 42.6, 14.35, z + 0.025, C.steel, decoration);
    for (let x = -42; x <= 42; x += 3) b.block(x, 13.6, z - 0.025, x + 0.035, 14.35, z + 0.025, C.steel, decoration);
  }
}

function facade(b: Builder, bounds: ReturnType<typeof box>, color: number, foundry: boolean) {
  const { min: p, max: q } = bounds;
  const n = p.z < 0 ? 1 : -1;
  const z = n === 1 ? q.z : p.z;
  const width = q.x - p.x;
  const flat = (x0: number, y0: number, x1: number, y1: number, c: number, offset = 0.025) =>
    b.block(x0, y0, Math.min(z, z + n * offset), x1, y1, Math.max(z, z + n * offset), c, decoration);
  const bays = Math.round(width / (foundry ? 4.7 : 6));
  for (let i = 0; i < bays; i++) {
    const x0 = p.x + i * width / bays;
    const x1 = p.x + (i + 1) * width / bays;
    flat(x0, 0, x0 + 0.25, q.y, C.cal, 0.06);
    flat(x0 + 0.65, 0.15, x1 - 0.65, 2.6, C.inkSoft);
    flat(x0 + 0.85, 0.25, x1 - 0.85, 2.5, foundry ? C.colonialMoss : C.bark, 0.04);
    for (const y of [3.7, 6.5]) {
      if (y + 1.8 > q.y - 0.4) continue;
      const cx = (x0 + x1) / 2;
      flat(cx - 1.05, y, cx + 1.05, y + 1.9, C.cal, 0.05);
      flat(cx - 0.83, y + 0.12, cx + 0.83, y + 1.75, C.glass, 0.06);
      flat(cx - 0.07, y + 0.12, cx + 0.07, y + 1.75, foundry ? C.colonialMoss : color, 0.08);
      flat(cx - 0.83, y + 0.85, cx + 0.83, y + 0.95, C.cal, 0.08);
      if (foundry) {
        const arch = new THREE.CircleGeometry(0.85, 16, 0, Math.PI);
        b.add(place(arch, cx, y + 1.76, z + n * 0.065, n === 1 ? 0 : Math.PI), toon(C.glass), { cast: false });
      }
    }
  }
  for (const y of [0.5, 3.15, q.y - 0.3]) flat(p.x, y, q.x, y + 0.16, C.cal, 0.08);
  // Telhado só acima de um prédio inacessível; duas águas e frontão industrial.
  const roof = new THREE.CylinderGeometry(1, 1, width, 3);
  roof.rotateZ(Math.PI / 2); roof.scale(1, 1.6, (q.z - p.z) * 0.64);
  b.add(place(roof, (p.x + q.x) / 2, q.y + 0.6, (p.z + q.z) / 2), toon(C.telha));
  if (foundry) {
    const pediment = new THREE.Shape([new THREE.Vector2(-6, 0), new THREE.Vector2(6, 0), new THREE.Vector2(0, 2.5)]);
    b.add(place(new THREE.ShapeGeometry(pediment), (p.x + q.x) / 2, q.y - 0.1, z + 0.07), toon(C.ochre));
  }
}

function circus(b: Builder) {
  // A lona branca e abaulada do Circo Voador, com os arcos da estrutura por cima.
  const g = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(11.5, 5.8, 6.2);
  b.add(place(g, -25, 3.4, -31.5), toon(C.cal));
  for (let k = 0; k < 6; k++) {
    const rib = new THREE.TorusGeometry(1, 0.012, 4, 40, Math.PI);
    rib.rotateY(k * Math.PI / 6);
    rib.scale(11.56, 5.86, 6.26);
    b.add(place(rib, -25, 3.4, -31.5), toon(C.steelLight), { cast: false });
  }
  // Faixa vermelha na barra da lona: o picadeiro lido de longe.
  const hem = new THREE.CylinderGeometry(1, 1, 0.5, 32, 1, true);
  hem.scale(11.53, 1, 6.23);
  b.add(place(hem, -25, 3.65, -31.5), toon(C.colonialRed), { cast: false });
  for (let x = -36; x <= -14; x += 2) {
    b.block(x, 0.3, -25.025, x + 0.7, 1.7, -25, C.inkSoft, decoration);
    b.block(x, 1.7, -25.04, x + 0.7, 1.78, -25, C.cal, decoration);
  }
}

function palm(b: Builder, map: MapData, x: number, z: number) {
  // Tronco reto sobre a coluna de colisão (0,44 m); folhas só fora do alcance do pulo.
  floraPalm(b, x, 1, z, 7.2, rng(Math.round(x * 37 + z * 11)), {
    lean: 0, radius: 0.21, fronds: 11, frond: 3.3, fits: (bb) => clearOfBody(map, bb),
  });
}

function skyline(b: Builder) {
  // Catedral Metropolitana no lado do Centro, atrás da Fundição. Fora da área jogável.
  const cx = 74, cz = -56;
  const cathedral = new THREE.CylinderGeometry(8, 23, 38, 48, 1, true);
  b.add(place(cathedral, cx, 19, cz), toon(C.stoneJoint), { cast: false });
  for (let y = 2; y < 38; y += 1.8) {
    const radius = 23 - y / 38 * 15;
    const ring = new THREE.TorusGeometry(radius, 0.13, 3, 48); ring.rotateX(Math.PI / 2);
    b.add(place(ring, cx, y, cz), toon(C.steel), { cast: false });
  }
  const r = rng(2026);
  for (let i = 0; i < 14; i++) {
    const x = -62 + i * 10;
    if (x > 50) continue; // preserva a silhueta da Catedral
    if (x < -34) continue; // janela para o Corcovado (lapa-landmarks.ts)
    const h = 14 + r() * 22;
    b.block(x, 0, -87, x + 7, h, -75, i % 2 ? C.concreteDark : C.steel, decoration);
    for (let y = 3; y < h - 1; y += 2) b.block(x + 0.4, y, -74.98, x + 6.6, y + 0.18, -74.95, C.concrete, decoration);
  }
  // Santa Teresa sobe além da ponta sul do recorte: encosta verde, casario e convento.
  for (let i = 0; i < 5; i++) {
    const hill = new THREE.SphereGeometry(1, 16, 8);
    hill.scale(25, 16 + i * 2, 24);
    b.add(place(hill, -95 - i * 12, -6, -25 + i * 15), toon(i % 2 ? C.leaf : C.colonialMoss), { cast: false });
    b.block(-83 - i * 10, 4 + i * 2, -28 + i * 12, -76 - i * 10, 10 + i * 2, -22 + i * 12, C.cal, decoration);
  }
  // Mata de Santa Teresa: copas em tufos na encosta (silhueta de fundo, sem colisão)
  for (let i = 0; i < 16; i++) {
    const x = -66 - r() * 50, z = -30 + r() * 70;
    broadleaf(b, x, 2 + (-66 - x) * 0.18, z, 7 + r() * 5, r);
  }
}
