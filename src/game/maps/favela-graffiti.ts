import { PALETTE as C, hex, toonWith } from '../toon';
import { rgba } from '../world/colonial-art';
import { Builder, place } from '../world/builder';
import { paintGraffiti } from '../world/graffiti';
import { rng } from '../world/shapes';
import { Atlas, type G, planeGeo, pixo, type UVRect } from '../world/textures';
import { exposedFaces } from './facades';
import { FAVELA_HOUSES } from './favela';
import type { MapData } from './types';

// Grafites autorais da Favela do Sol, em atlas próprio (os do bairro estão cheios): frases de
// orgulho e afeto, um sol sorridente, uma pipa e um bem-te-vi. Arte de comunidade, não de
// "perigo": quem pinta aqui assina o lugar. Ficam nas muretas das lajes e nos pés de parede.

function sun(g: G, w: number, h: number) {
  const cx = w / 2;
  const cy = h * 0.46;
  const R = Math.min(w, h) * 0.26;
  g.save();
  g.strokeStyle = hex(C.ink);
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r0 = R * 1.15;
    const r1 = R * (i % 2 ? 1.55 : 1.75);
    g.fillStyle = hex(i % 2 ? C.orange : C.colonialYellow);
    g.beginPath();
    g.moveTo(cx + Math.cos(a - 0.12) * r0, cy + Math.sin(a - 0.12) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.lineTo(cx + Math.cos(a + 0.12) * r0, cy + Math.sin(a + 0.12) * r0);
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.fillStyle = hex(C.colonialYellow);
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Rosto: olhos fechados de quem ri e bochecha rosada
  g.lineWidth = 5;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(cx + s * R * 0.36, cy - R * 0.1, R * 0.14, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    g.fillStyle = rgba(C.pink, 0.75);
    g.beginPath();
    g.ellipse(cx + s * R * 0.55, cy + R * 0.2, R * 0.15, R * 0.09, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(cx, cy + R * 0.12, R * 0.38, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  g.restore();
  paintGraffiti(g, w, h * 0.32, 'BOM DIA', 'bubble', C.cyan, C.ink);
}

function kite(g: G, w: number, h: number) {
  const cx = w * 0.42;
  const cy = h * 0.36;
  const pts = [[cx, cy - 70], [cx + 52, cy], [cx, cy + 75], [cx - 52, cy]];
  const cols = [C.pink, C.cyan, C.colonialYellow, C.colonialRed];
  for (let i = 0; i < 4; i++) {
    g.fillStyle = hex(cols[i]);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(pts[i][0], pts[i][1]);
    g.lineTo(pts[(i + 1) % 4][0], pts[(i + 1) % 4][1]);
    g.fill();
  }
  g.strokeStyle = hex(C.ink);
  g.lineWidth = 6;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.stroke();
  // Rabiola de laços e linha descendo em curva
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, cy + 75);
  g.bezierCurveTo(cx + 30, cy + 120, cx - 40, cy + 150, cx + 10, h * 0.95);
  g.stroke();
  for (let k = 0; k < 5; k++) {
    const t = (k + 1) / 6;
    const x = cx + Math.sin(t * 7) * 20;
    const y = cy + 75 + t * (h * 0.95 - cy - 75);
    g.fillStyle = hex(k % 2 ? C.colonialYellow : C.pink);
    g.beginPath();
    g.moveTo(x - 12, y - 7);
    g.lineTo(x + 12, y + 7);
    g.lineTo(x + 12, y - 7);
    g.lineTo(x - 12, y + 7);
    g.fill();
  }
  paintGraffiti(g, w * 1.7, h, 'SOLTA', 'pixo', C.ink);
}

function bird(g: G, w: number, h: number) {
  // Bem-te-vi: dorso marrom, peito amarelo, faixa branca na cabeça
  const cx = w / 2;
  const cy = h / 2;
  g.save();
  g.lineWidth = 6;
  g.strokeStyle = hex(C.ink);
  g.fillStyle = hex(C.bark);
  g.beginPath();
  g.ellipse(cx, cy, w * 0.3, h * 0.2, -0.2, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = hex(C.colonialYellow);
  g.beginPath();
  g.ellipse(cx + w * 0.04, cy + h * 0.06, w * 0.22, h * 0.13, -0.2, 0, Math.PI);
  g.fill();
  g.fillStyle = hex(C.ink);
  g.beginPath();
  g.arc(cx + w * 0.25, cy - h * 0.15, h * 0.13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hex(C.cal);
  g.fillRect(cx + w * 0.17, cy - h * 0.2, w * 0.15, h * 0.035);
  g.fillStyle = hex(C.cal);
  g.beginPath();
  g.arc(cx + w * 0.28, cy - h * 0.15, h * 0.03, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hex(C.ink);
  g.beginPath();
  g.moveTo(cx + w * 0.36, cy - h * 0.16);
  g.lineTo(cx + w * 0.46, cy - h * 0.12);
  g.lineTo(cx + w * 0.36, cy - h * 0.09);
  g.fill();
  g.fillStyle = hex(C.bark);
  g.beginPath();
  g.moveTo(cx - w * 0.26, cy);
  g.lineTo(cx - w * 0.46, cy - h * 0.12);
  g.lineTo(cx - w * 0.44, cy + h * 0.1);
  g.fill();
  g.stroke();
  g.restore();
  g.fillStyle = hex(C.ink);
  g.textAlign = 'center';
  g.font = "900 34px 'Arial Black', sans-serif";
  g.fillText('BEM-TE-VI', cx, h * 0.92);
}

function tags(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  const words = ['SOL', 'CRIA', 'VILA', 'MORRO', 'PAZ', 'LAJE', 'BAILE', 'NOIS', 'RAIZ', 'FÉ'];
  const inks = [C.ink, C.ink, C.inkSoft, C.colonialRed, C.skyDeep];
  for (let x = 30; x < w - 20; x += 70 + r() * 80) {
    pixo(g, words[Math.floor(r() * words.length)], x, h * (0.45 + r() * 0.2), h * (0.35 + r() * 0.15), inks[Math.floor(r() * inks.length)]);
  }
}

export function favelaGraffiti(b: Builder, map: MapData) {
  const atlas = new Atlas(1024, true);
  const mat = toonWith({ color: C.paper, transparent: true, alphaTest: 0.025, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const big = (text: string, style: 'bubble' | 'stencil' | 'pixo', c1: number, c2?: number) =>
    atlas.draw(512, 160, (g, w, h) => paintGraffiti(g, w, h, text, style, c1, c2));
  const art = {
    potencia: big('FAVELA É POTÊNCIA', 'bubble', C.colonialYellow, C.pink),
    sonhar: big('SONHAR É RESISTIR', 'bubble', C.cyan, C.lilac),
    voz: big('O MORRO TEM VOZ', 'stencil', C.inkSoft),
    vida: big('AQUI TEM VIDA', 'bubble', C.leafLight, C.clothTeal),
    sun: atlas.draw(256, 256, sun),
    kite: atlas.draw(256, 256, kite),
    bird: atlas.draw(256, 192, bird),
    tags: [1, 2].map((s) => atlas.draw(1024, 96, (g, w, h) => tags(g, w, h, 70 + s))),
  };
  const put = (uv: UVRect, x: number, y: number, z: number, w: number, h: number, angle: number) =>
    b.add(place(planeGeo(w, h, uv), x, y, z, angle), mat, { cast: false });
  const E = Math.PI / 2;
  // Muretas das lajes, longe das janelas: as peças grandes
  put(art.potencia, -22.035, 1.25, -0.6, 5.8, 1.8, -E);
  put(art.sonhar, -18, 1.25, 7.035, 7.2, 2.25, 0);
  put(art.voz, 11.965, 1.6, 9.5, 7.6, 2.3, -E);
  put(art.sun, 20.035, 1.65, 12.6, 2.9, 2.9, E);
  put(art.kite, 16, 1.6, 3.965, 2.9, 2.9, Math.PI);
  put(art.vida, -15.05, 1.55, -4.035, 1.8, 0.56, Math.PI);
  put(art.bird, -11.035, 1.15, 5.5, 2.8, 2.1, -E);
  // Pixações miúdas no pé das paredes (abaixo das janelas do térreo)
  const r = rng(1112);
  const homes = new Set(FAVELA_HOUSES.filter((h) => h.solid.box.min.y === 0).map((h) => h.solid));
  for (const f of exposedFaces(map, (s) => homes.has(s))) {
    if (f.base > 0 || f.t1 - f.t0 < 5 || r() < 0.45) continue;
    const w = Math.min(6, f.t1 - f.t0 - 1);
    const t = f.t0 + 0.5 + w / 2 + r() * (f.t1 - f.t0 - 1 - w);
    const out = f.n * 0.036;
    const angle = f.axis === 'z' ? (f.n > 0 ? 0 : Math.PI) : f.n > 0 ? E : -E;
    const uv = art.tags[Math.floor(r() * 2)];
    if (f.axis === 'z') put(uv, t, 0.72, f.at + out, w, 0.56, angle);
    else put(uv, f.at + out, 0.72, t, w, 0.56, angle);
  }
  mat.map = atlas.texture;
  atlas.texture.needsUpdate = true;
  console.info(`Favela: atlas de grafite ${atlas.used}`);
}
