import * as THREE from 'three';
import { PALETTE as C, hex, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { box } from '../world/shapes';
import { planeGeo } from '../world/textures';
import { clearOfBody } from './facades';
import { LAPA_COVERS } from './lapa';
import { LapaArt } from './lapa-art';
import type { MapData } from './types';

const deco = { solid: false, shoot: false, cast: false, outline: 0 };

export function lapaStreet(b: Builder, map: MapData, art: LapaArt) {
  // Medalhão é desenho na mesma superfície, para o nanquim não parecer um degrau.
  const mosaic = art.atlas.draw(256, 256, (g, w, h) => {
    g.fillStyle = hex(C.cobbleStone); g.fillRect(0, 0, w, h);
    g.fillStyle = hex(C.cal); g.globalAlpha = 0.65;
    for (let y = 0; y < h; y += 12) for (let x = 0; x < w; x += 12) g.fillRect(x + 1, y + 1, 10, 10);
    g.globalAlpha = 0.48; g.strokeStyle = hex(C.stoneJoint); g.lineWidth = 3;
    for (const r of [99, 108]) { g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.beginPath(); g.moveTo(128 + Math.sin(a) * 61, 128 + Math.cos(a) * 61);
      g.lineTo(128 + Math.sin(a) * 85, 128 + Math.cos(a) * 85); g.stroke();
    }
  });
  for (const [x, y, z] of [[-16.5, 0.008, 20], [31, 0.008, 28], [17, 1.615, 32]]) {
    b.add(place(planeGeo(5.6, 5.6, mosaic), x, y, z, 0, -Math.PI / 2), art.material, { cast: false });
  }
  for (const z of [-17.85, 26.9]) {
    b.block(-42, 0.024, z, 42, 0.03, z + 0.15, C.stoneJoint, deco);
    for (let x = -40; x < 42; x += 9) {
      b.block(x, 0.031, z - 0.15, x + 0.85, 0.034, z + 0.3, C.steel, deco);
      for (let j = 0; j < 7; j++) b.block(x + 0.06 + j * 0.11, 0.035, z - 0.1, x + 0.09 + j * 0.11, 0.037, z + 0.25, C.inkSoft, deco);
    }
  }
  // Reparos no asfalto e faixas apagadas não encobrem o calçamento da praça.
  for (const [x, z, w] of [[-31, -23, 3], [4, -20, 4.5], [34, -22, 2.4]]) {
    b.block(x, 0.021, z, x + w, 0.023, z + 0.8, C.steel, deco);
    for (let j = 0; j < 3; j++) b.block(x + j * 0.8, 0.024, z + 0.25, x + j * 0.8 + 0.5, 0.026, z + 0.28, C.inkSoft, deco);
  }

  for (const c of LAPA_COVERS) {
    const { min: p, max: q } = c.solid.box, cx = (p.x + q.x) / 2, width = q.x - p.x;
    if (c.type === 'kiosk') {
      const west = p.x < 0;
      const uv = art.sign(west ? 'CALDO & PASTEL' : 'BANCA LIVRE', west ? 'FEITO NA HORA • SEM CHIP' : 'JORNAIS • MAPAS • RECADOS', C.colonialRed);
      const cz = (p.z + q.z) / 2;
      const faces = [
        { x: cx, z: q.z, w: width, angle: 0 }, { x: cx, z: p.z, w: width, angle: Math.PI },
        { x: q.x, z: cz, w: q.z - p.z, angle: Math.PI / 2 },
        { x: p.x, z: cz, w: q.z - p.z, angle: -Math.PI / 2 },
      ];
      for (const f of faces) {
        // Tudo é raso (até 0,105 m): vidro fechado, caixilho e balcão coincidem
        // com a mesma caixa sólida, sem uma abertura falsa para corpo ou tiro.
        const add = (g: THREE.BufferGeometry, color: number, x: number, y: number, out = 0.065) => {
          g.translate(x, y, out);
          b.add(place(g, f.x, 0, f.z, f.angle), toon(color), { cast: false });
        };
        const rect = (x: number, y: number, w: number, h: number, color: number, out = 0.065) =>
          add(new THREE.PlaneGeometry(w, h), color, x, y, out);
        const signWidth = Math.min(4.8, f.w - 0.45);
        b.add(place(planeGeo(signWidth, 0.38, uv).translate(0, q.y - 0.31, 0.095), f.x, 0, f.z, f.angle), art.material, { cast: false });
        rect(0, 0.56, f.w - 0.25, 0.62, C.sand, 0.052);
        for (const x of [-f.w / 2 + 0.12, f.w / 2 - 0.12]) rect(x, q.y / 2, 0.17, q.y - 0.12, C.cal, 0.08);
        const panes = Math.max(2, Math.round((f.w - 0.8) / 1.7)), span = (f.w - 0.8) / panes;
        for (let i = 0; i < panes; i++) {
          const x = (i - (panes - 1) / 2) * span;
          rect(x, 1.65, span - 0.12, 1.18, C.cal, 0.07);
          rect(x, 1.65, span - 0.24, 1.04, C.steel, 0.078);
          rect(x, 1.8, span - 0.28, 0.61, C.glass, 0.082);
          rect(x, 1.51, span - 0.24, 0.045, C.cantaria, 0.09);
          rect(x - span * 0.22, 1.65, 0.04, 1.04, C.cantaria, 0.09);
          // Poucos objetos planos atrás do vidro sugerem serviço e dão escala humana.
          for (const dx of [-0.24, 0.18]) {
            rect(x + dx, 1.39, 0.18, 0.19, west ? C.cal : C.cobbleStone, 0.09);
            rect(x + dx, 1.5, 0.22, 0.035, C.cantaria, 0.095);
          }
        }
        add(new THREE.BoxGeometry(f.w - 0.22, 0.12, 0.12), C.cantaria, 0, 1.06, 0.045);
        rect(0, 0.94, f.w - 0.3, 0.055, C.bark, 0.085);
        // Sanefa curta e arredondada acompanha o alto da vitrine, sem toldo atravessável.
        rect(0, 2.31, f.w - 0.24, 0.11, C.colonialRed, 0.093);
        for (let x = -f.w / 2 + 0.3; x < f.w / 2 - 0.2; x += 0.37)
          add(new THREE.CircleGeometry(0.18, 12, Math.PI, Math.PI), C.colonialRed, x, 2.275, 0.094);
        rect(0, 0.18, f.w, 0.15, C.cantaria, 0.085);
      }
      // Friso/telha dentro da caixa existente; nenhum toldo atravessável.
      for (let x = p.x + 0.1; x < q.x; x += 0.3)
        b.block(x, q.y - 0.04, p.z + 0.03, x + 0.065, q.y + 0.01, q.z - 0.03, C.cantaria, deco);
      for (const x of [p.x + 0.1, q.x - 0.16]) b.block(x, 0.04, p.z - 0.055, x + 0.06, q.y - 0.05, p.z, C.cal, deco);
    } else if (c.type === 'barricade') {
      for (const n of [-1, 1]) {
        const z = n === 1 ? q.z + 0.036 : p.z - 0.036;
        art.panel(art.sign('OTIMIZA / CONTROLE URBANO', 'SEU TRAJETO FOI OTIMIZADO', C.steel), cx, 1.2, z, width - 0.6, 0.55, n);
        for (let x = p.x + 0.12; x < q.x; x += 0.6) {
          b.block(x, 0.15, Math.min(z, z + n * 0.018), x + 0.03, 1.88, Math.max(z, z + n * 0.018), C.steelLight, deco);
        }
      }
    } else if (c.type === 'planter') {
      for (const n of [-1, 1]) {
        const z = n === 1 ? q.z + 0.025 : p.z - 0.025;
        for (let x = p.x + 0.25; x < q.x - 0.2; x += 0.45)
          b.block(x, p.y + 0.12, Math.min(z, z + n * 0.015), x + 0.018, p.y + 0.78, Math.max(z, z + n * 0.015), C.cantaria, deco);
      }
    }
  }

  // Lambe-lambes políticos e programação em faces já sólidas, sem objetos na rota.
  const posters = [
    ['SORRIA. VOCÊ ESTÁ SEGURO.', 'OTIMIZA / IFB 99,7% / CULTURA AUTORIZADA', C.steel],
    ['A LAPA NÃO SE CALA', 'RESISTÊNCIA / NOSSA ALEGRIA NÃO É META', C.bark],
    ['SAMBA SEM SINAL', 'SEXTA • RODA LIVRE • TRAGA SUA VOZ', C.clothTeal],
  ] as const;
  for (let i = 0; i < 3; i++) {
    const [title, sub, bg] = posters[i];
    const uv = art.sign(title, sub, bg);
    art.panel(uv, -34 + i * 7.5, 2.5, -24.94, 6.5, 1.12);
  }
  art.panel(art.sign('CIRCO VOADOR', 'PALCO LIVRE • A CIDADE CANTA', C.colonialMoss), -25, 1.08, -24.92, 8.5, 0.85);
  const mural = art.mural((g, w, h) => {
    g.fillStyle = hex(C.ochre); g.fillRect(0, 0, w, h);
    g.fillStyle = hex(C.cal);
    // Aqueduto impresso, não um logotipo externo.
    for (let i = 0; i < 7; i++) {
      const x = 15 + i * 70;
      g.fillRect(x, 75, 62, 70); g.fillRect(x, 145, 10, 82);
      g.fillStyle = hex(C.ochre); g.beginPath(); g.arc(x + 36, 151, 25, Math.PI, 0); g.fill();
      g.fillStyle = hex(C.cal);
    }
    g.fillStyle = hex(C.inkSoft); g.font = 'bold 30px Arial'; g.textAlign = 'center';
    g.fillText('MEMÓRIA NÃO SE APAGA', w / 2, 42);
  });
  art.panel(mural, 41.5, 1.65, -24.94, 2.1, 1.1);

  // Bandeirolas/luminárias acompanham o perímetro alto, nunca cruzam os vãos.
  for (const [start, end, z, y] of [[-38, -12, -24.4, 6.5], [-49, -26, 27.4, 7], [16, 49, 27.4, 8]]) {
    const bounds = box(start, y - 0.8, z - 0.1, end, y + 0.1, z + 0.1);
    if (!clearOfBody(map, bounds)) throw new Error('Lapa: festão invade o pulo');
    const points = [];
    for (let i = 0; i <= 24; i++) points.push(new THREE.Vector3(start + (end - start) * i / 24, y - Math.sin(i / 24 * Math.PI) * 0.35, z));
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.018, 3, false), toon(C.steel), { cast: false });
    for (let i = 1; i < 18; i++) {
      const x = start + (end - start) * i / 18, yy = y - Math.sin(i / 18 * Math.PI) * 0.35;
      const pennant = new THREE.BufferGeometry();
      pennant.setAttribute('position', new THREE.Float32BufferAttribute([
        x - 0.17, yy, z, x + 0.17, yy, z, x, yy - 0.32, z,
        x - 0.17, yy, z, x + 0.17, yy, z, x, yy - 0.32, z,
      ], 3));
      pennant.setIndex([0, 2, 1, 3, 4, 5]); pennant.computeVertexNormals();
      b.add(pennant, toon([C.ochre, C.cal, C.colonialMoss][i % 3]), { cast: false });
    }
  }
}

export function lapaBackdrop(b: Builder) {
  // Segunda linha de quarteirão além da arena: volumes escalonados, casas e oficinas.
  // Altura moderada deixa a Catedral e o aqueduto dominarem o panorama.
  for (let i = 0; i < 11; i++) {
    const x = -53 + i * 10, h = 8 + (i * 7 % 9), z = 48 + (i % 3) * 3;
    b.block(x, 0, z, x + 8, h, z + 10, [C.sand, C.colonialRose, C.stoneJoint][i % 3], deco);
    b.block(x - 0.15, h, z - 0.1, x + 8.15, h + 0.25, z + 10.1, C.cantaria, deco);
    for (let y = 3; y < h - 1; y += 2.6) for (let dx = 1; dx < 8; dx += 2) {
      b.block(x + dx, y, z - 0.025, x + dx + 0.9, y + 1.45, z, C.glass, deco);
      b.block(x + dx, y + 0.65, z - 0.04, x + dx + 0.9, y + 0.73, z, C.cal, deco);
    }
    if (i % 2 === 0) {
      b.block(x + 3.8, h + 0.2, z + 5, x + 3.85, h + 3, z + 5.05, C.steel, deco);
      b.block(x + 2.8, h + 2.7, z + 5, x + 4.9, h + 2.74, z + 5.05, C.steel, deco);
    }
  }
  // Laterais além das muretas: a rua segue visualmente para dentro da cidade.
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = side * 61, z = -24 + i * 17, h = 7 + (i % 3) * 3;
    b.block(x - 4, 0, z, x + 4, h, z + 11, i % 2 ? C.sand : C.colonialSky, deco);
    for (let y = 2; y < h; y += 2.8) for (let dz = 1.5; dz < 10; dz += 2.7)
      b.block(x - side * 4 - 0.02, y, z + dz, x - side * 4 + 0.02, y + 1.5, z + dz + 1.2, C.glass, deco);
    b.block(x - 4.1, h, z - 0.1, x + 4.1, h + 0.24, z + 11.1, C.telha, deco);
  }
}
