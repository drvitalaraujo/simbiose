import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE, toon, toonWith } from '../toon';
import { paint } from './builder';
import { blade, bladeUVs, building, type Lot } from './buildings';
import { awning, type Ctx, type Face, faceBox, faceNeon, graf, neonBox, sign, telao } from './props';
import { box, rng } from './shapes';
import { FACADE_H, FACADE_W, facadeTextures, paintGraffiti, paintShopSign, paintShutter, pixo, WALL_UV } from './textures';

// Os prédios em volta da praça: quarteirões em grade, fachadas com janelas, lojas no térreo,
// telões da OTIMIZA e a resposta da resistência pichada por cima.

/** Meia largura da praça jogável (o jogador fica em |x|, |z| < PLAZA). */
export const PLAZA = 40;
/** Meia largura das ruas (asfalto). */
export const ROAD = 7;
const CELL = 11;
const CELLS = 9;

const FACADE_COLORS = [PALETTE.concrete, PALETTE.concreteDark, PALETTE.lilac, PALETTE.paper, PALETTE.sky, PALETTE.concrete, PALETTE.horizon];

let facadeMat: THREE.MeshToonMaterial | null = null;

function facadeMaterial() {
  if (!facadeMat) {
    const { map, emissive } = facadeTextures();
    facadeMat = toonWith({ color: 0xffffff, map, emissive: 0xffffff, emissiveMap: emissive, vertexColors: true });
  }
  return facadeMat;
}

/** Caixa de prédio com UV em metros (as janelas não esticam) e cor por vértice. */
function buildingGeo(b: Box, color: number, offU: number, offV: number): THREE.BufferGeometry {
  const w = b.max.x - b.min.x;
  const h = b.max.y - b.min.y;
  const d = b.max.z - b.min.z;
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (f === 2 || f === 3) {
        uv.setXY(i, WALL_UV, WALL_UV); // teto e piso: parede lisa
        continue;
      }
      const horiz = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * (horiz / FACADE_W) + offU, uv.getY(i) * (h / FACADE_H) + offV);
    }
  }
  return paint(g, color);
}

export function buildCity(ctx: Ctx) {
  const r = rng(2026);
  const mat = facadeMaterial();
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      for (let i = 0; i < CELLS; i++) {
        for (let j = 0; j < CELLS; j++) {
          if (i < 3 && j < 3) continue; // a praça
          if (i >= 5 && j >= 5) continue; // miolo do quarteirão: ninguém vê
          let u0 = ROAD + i * CELL + 0.5;
          let v0 = ROAD + j * CELL + 0.5;
          const u1 = ROAD + (i + 1) * CELL - 0.5;
          const v1 = ROAD + (j + 1) * CELL - 0.5;
          if (i === 0) u0 = ROAD + 3; // calçada da avenida
          if (j === 0) v0 = ROAD + 3;
          if (i === 3 && j < 3) u0 = PLAZA; // fachada colada no limite da praça
          if (j === 3 && i < 3) v0 = PLAZA;
          if (i === 3 && j === 3) { u0 = PLAZA; v0 = PLAZA; }
          const front = (i === 3 && j <= 3) || (j === 3 && i <= 3);
          const street = i === 0 || j === 0;
          const h = front ? 21 + r() * 15 : street ? 14 + r() * 26 : 26 + r() * 34;
          const x0 = sx * u0;
          const x1 = sx * u1;
          const z0 = sz * v0;
          const z1 = sz * v1;
          const faces: Lot['faces'] = [];
          if (i === 0) faces.push({ face: { axis: 'x', at: x0, n: (-sx) as 1 | -1 }, kind: 'street' });
          if (j === 0) faces.push({ face: { axis: 'z', at: z0, n: (-sz) as 1 | -1 }, kind: 'street' });
          if (i === 3 && j <= 3) faces.push({ face: { axis: 'x', at: x0, n: (-sx) as 1 | -1 }, kind: 'plaza' });
          if (j === 3 && i <= 3) faces.push({ face: { axis: 'z', at: z0, n: (-sz) as 1 | -1 }, kind: 'plaza' });
          const color = FACADE_COLORS[Math.floor(r() * FACADE_COLORS.length)];
          const offU = Math.floor(r() * 8) / 8;
          const offV = Math.floor(r() * 8) / 8;
          // Só os prédios ao alcance precisam de colisão; os do fundo são cenário
          building(ctx, {
            x0, z0, x1, z1, h, near: front, color, faces,
            facade: (bx) => buildingGeo(bx, color, offU, offV),
            facadeMat: mat,
          }, r);
        }
      }
    }
  }
  skyline(ctx, r);
  otimizaTower(ctx);
  streetSigns(ctx, r);
  plazaFacades(ctx, r);
}

/** Silhueta distante da megacidade (sem colisão), com vãos para o sol e para a torre. */
function skyline(ctx: Ctx, r: () => number) {
  const mat = facadeMaterial();
  for (let k = 0; k < 46; k++) {
    const a = r() * Math.PI * 2;
    const deg = ((a * 180) / Math.PI + 360) % 360;
    if (Math.abs(deg - 180) < 14 || Math.abs(deg - 270) < 9) continue; // oeste: sol; norte: torre
    const dist = 125 + r() * 70;
    const w = 14 + r() * 18;
    const h = 40 + r() * 70;
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    const geo = buildingGeo(box(cx - w / 2, 0, cz - w / 2, cx + w / 2, h, cz + w / 2), r() < 0.5 ? PALETTE.lilac : PALETTE.concreteDark, r(), r());
    ctx.b.add(geo, mat, { cast: false, receive: false });
  }
}

/** A sede da OTIMIZA no fim da avenida norte, com o sorriso gigante. */
function otimizaTower(ctx: Ctx) {
  const mat = facadeMaterial();
  const b = box(-14, 0, -150, 14, 150, -122);
  ctx.b.add(buildingGeo(b, PALETTE.paper, 0, 0), mat, { cast: false, receive: false });
  ctx.b.add(buildingGeo(box(-9, 150, -145, 9, 175, -127), PALETTE.paper, 0, 0), mat, { cast: false, receive: false });
  const face: Face = { axis: 'z', at: -122, n: 1 };
  telao(ctx, face, 0, 92, 24, 24 * 0.375, { title: 'SORRIA :)', sub: 'OTIMIZA — FELICIDADE COMO SERVIÇO', bg: PALETTE.pink, fg: PALETTE.yellow, extra: 'smile' }, false);
  neonBox(ctx, -14.3, 0, -121.9, -13.9, 150, -121.6, PALETTE.pink);
  neonBox(ctx, 13.9, 0, -121.9, 14.3, 150, -121.6, PALETTE.pink);
  neonBox(ctx, -14.3, 149.6, -121.9, 14.3, 150, -121.6, PALETTE.pink);
}

/** Letreiros verticais de neon saindo das fachadas das avenidas (aparecem no fundo da rua). */
function streetSigns(ctx: Ctx, r: () => number) {
  const uvs = bladeUVs(ctx);
  let k = 0;
  for (const s of [-1, 1]) {
    for (const side of [-1, 1]) {
      const n = (-side) as 1 | -1;
      for (let d = PLAZA + 6; d < 100; d += 9 + r() * 8) {
        const y = 6 + r() * 7;
        // Avenida norte-sul (paredes em x = ±10) e leste-oeste (z = ±10)
        const wall = side * (ROAD + 3);
        blade(ctx, { axis: 'x', at: wall, n }, s * d, y, uvs[k++ % uvs.length]);
        blade(ctx, { axis: 'z', at: wall, n }, s * d + 3, y + 1.5, uvs[k++ % uvs.length]);
      }
    }
  }
}

const SHOPS: [string, number, number][] = [
  ['LANCHONETE', PALETTE.yellow, PALETTE.wine],
  ['FARMÁCIA', PALETTE.paper, PALETTE.pink],
  ['BAR DO TONHÃO', PALETTE.wine, PALETTE.yellow],
  ['CHAVEIRO 24H', PALETTE.yellow, PALETTE.ink],
  ['MERCADINHO', PALETTE.cyan, PALETTE.ink],
  ['ASSISTÊNCIA TÉCNICA', PALETTE.orange, PALETTE.paper],
  ['CABELEIREIRO', PALETTE.pink, PALETTE.paper],
  ['LAN HOUSE', PALETTE.ink, PALETTE.cyan],
];

/** Térreo e paredes que dão para a praça: lojas, portas de aço, pichações e telões. */
function plazaFacades(ctx: Ctx, r: () => number) {
  const shopUV = SHOPS.map(([t, bg, fg]) => ctx.signs.draw(512, 112, (g, w, h) => paintShopSign(g, w, h, t, bg, fg)));
  const shutterUV = [1, 2, 3, 4].map((s) => ctx.signs.draw(256, 192, (g, w, h) => paintShutter(g, w, h, s)));
  const tagUV = [11, 12, 13].map((s) => ctx.graffiti.draw(1024, 128, (g, w, h) => {
    const rr = rng(s);
    const tags = ['VILA', 'DESPLUGA', 'Ñ SORRIA', 'OFF', 'KAIA', 'BIT', 'ZN', 'LIVRES'];
    for (let x = 60; x < w; x += 110 + rr() * 60) pixo(g, tags[Math.floor(rr() * tags.length)], x, h * 0.5, h * 0.42, PALETTE.ink);
  }));
  const dark = toon(PALETTE.ink);
  const faces: Face[] = [
    { axis: 'z', at: -PLAZA, n: 1 },
    { axis: 'z', at: PLAZA, n: -1 },
    { axis: 'x', at: -PLAZA, n: 1 },
    { axis: 'x', at: PLAZA, n: -1 },
  ];
  let shop = 0;
  for (const f of faces) {
    for (const s of [-1, 1]) {
      for (let t = ROAD + 4; t < PLAZA - 2; t += 5.5) {
        const tt = s * t;
        const roll = r();
        if (roll < 0.45) {
          sign(ctx, f, shutterUV[Math.floor(r() * shutterUV.length)], tt, 1.75, 4.2, 3.0, 0.08);
          faceBox(ctx, f, tt, 3.4, 4.5, 0.35, 0.3, toon(PALETTE.concreteDark), 0);
        } else if (roll < 0.85) {
          faceBox(ctx, f, tt, 1.5, 3.6, 2.6, 0.04, dark, 0);
          sign(ctx, f, shopUV[shop++ % shopUV.length], tt, 3.55, 4.4, 0.95, 0.12);
          // Moldura de neon do letreiro: a vitrine acesa no fim de tarde
          const neon = [PALETTE.pink, PALETTE.cyan, PALETTE.yellow, PALETTE.magenta][shop % 4];
          faceNeon(ctx, f, tt, 4.06, 4.5, neon, 0.08);
          faceNeon(ctx, f, tt, 3.04, 4.5, neon, 0.08);
          awning(ctx, f, tt, 3.0, 4.6, r() < 0.5 ? [PALETTE.pink, PALETTE.paper] : [PALETTE.yellow, PALETTE.orange]);
        }
      }
      // Pixo no alto: a marca de quem escalou o prédio
      if (r() < 0.8) graf(ctx, f, tagUV[Math.floor(r() * tagUV.length)], s * (ROAD + 17), 18.7, 18, 2.2);
      // Filete de neon vertical na quina de algum prédio
      if (r() < 0.6) {
        const tt = s * (ROAD + CELL * (1 + Math.floor(r() * 2)));
        const c = r() < 0.5 ? PALETTE.pink : PALETTE.cyan;
        const p0 = f.axis === 'z' ? [tt, f.at + f.n * 0.1] : [f.at + f.n * 0.1, tt];
        neonBox(ctx, p0[0] - 0.08, 4, p0[1] - 0.08, p0[0] + 0.08, 19, p0[1] + 0.08, c);
      }
    }
  }

  // Telões da OTIMIZA, um em cada lado da praça
  telao(ctx, faces[0], -24, 13, 16, 6, { title: 'SORRIA :)', sub: 'SUA FELICIDADE ESTÁ SENDO OTIMIZADA', bg: PALETTE.pink, fg: PALETTE.yellow, extra: 'smile' });
  telao(ctx, faces[0], 22, 14, 14, 5.25, { title: 'VOCÊ ESTÁ FELIZ?', sub: '☑ SIM    ☑ SIM    ☑ SIM', bg: PALETTE.orange, fg: PALETTE.paper, accent: PALETTE.yellow });
  telao(ctx, faces[2], 22, 13, 16, 6, { title: 'IFB 98,7%', sub: 'ÍNDICE DE FELICIDADE BRUTA: NOVO RECORDE!', bg: PALETTE.glass, fg: PALETTE.cyan, accent: PALETTE.cyan, extra: 'graph' });
  telao(ctx, faces[3], -22, 13, 16, 6, { title: 'META DO TRIMESTRE: 100%', sub: 'FALTAM SÓ VOCÊS :)', bg: PALETTE.wine, fg: PALETTE.yellow, accent: PALETTE.yellow, extra: 'bar' });
  telao(ctx, faces[1], -22, 12, 16, 6, { title: 'Felicidade é obrigatória e gratuita*', sub: '*sujeito aos termos de uso da OTIMIZA', bg: PALETTE.lilac, fg: PALETTE.paper, accent: PALETTE.pink });

  // Resposta da resistência, grande, nas paredes da praça
  const big = (text: string, style: 'bubble' | 'stencil' | 'pixo', c1: number, c2?: number) =>
    ctx.graffiti.draw(1024, 256, (g, w, h) => paintGraffiti(g, w, h, text, style, c1, c2));
  graf(ctx, faces[3], big('DESPLUGA', 'bubble', PALETTE.cyan, PALETTE.pink), 16, 7.5, 13, 3.25);
  graf(ctx, faces[1], big('OTIMIZA = CONTROLE', 'stencil', PALETTE.ink), 26, 6.5, 13, 3.25);
  graf(ctx, faces[2], big('A META É VOCÊ', 'pixo', PALETTE.ink), -20, 7, 14, 3.5);
  graf(ctx, faces[0], big('NÃO SORRIA', 'pixo', PALETTE.wine), -24, 6.5, 12, 3);
}
