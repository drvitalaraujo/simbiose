import * as THREE from 'three';
import { GLOW, hex, PALETTE, toonWith } from '../toon';
import { Atlas, fit, type G, type UVRect } from './textures';
import { rng } from './shapes';
import { rectWindow } from './colonial-rect';

// Janelas, portas e gradis de casarão colonial desenhados em canvas, num atlas próprio com
// fundo transparente (o arco da janela é recortado pelo alfa). 128 px por metro.

const PX = 128;

/** Cor da paleta com transparência, como string CSS (para desenhar em canvas). */
export function rgba(color: number, a: number): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${a})`;
}

/** Mistura duas cores da paleta (k = 0 → a, 1 → b), como string CSS opaca. */
export function mix(a: number, b: number, k: number): string {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export interface Art {
  uv: UVRect;
  /** Tamanho em metros. */
  w: number;
  h: number;
}

export interface ColonialKit {
  /** Material toon das artes (recorte por alfa). */
  mat: THREE.Material;
  /** Mesmo atlas acima do limiar do bloom: vidro de janela acesa. */
  glow: THREE.Material;
  glass: Art;
  shutters: Art[];
  rectWindows: Art[];
  /** Janela com as venezianas abertas para os lados (2 m de largura). */
  open: Art[];
  doors: Art[];
  boarded: Art;
  poster: Art;
  grille: Art;
  /** Vidro aceso (vai por cima do vidro de `glass`/`open`, mesmo recorte de arco). */
  lit: Art[];
  /** Guarda-corpo de ferro trabalhado (sacada), 2 m x 0.95 m. */
  railing: Art;
  /** Vão do campanário: arco escuro com o sino. */
  belfry: Art;
  atlas: Atlas;
}

const FR = 10; // moldura de cantaria, em px

/** Contorno de arco pleno: retângulo com meio círculo em cima. */
function archPath(g: G, x: number, y: number, w: number, h: number) {
  const r = w / 2;
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y + r);
  g.arc(x + r, y + r, r, Math.PI, 0);
  g.lineTo(x + w, y + h);
  g.closePath();
}

/** Moldura branca em arco e o miolo (recortado) pintado por `inner`. */
function framed(g: G, w: number, h: number, inner: (iw: number, ih: number) => void, fr = FR) {
  archPath(g, 0, 0, w, h);
  g.fillStyle = hex(PALETTE.paper);
  g.fill();
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = 3;
  g.stroke();
  g.save();
  archPath(g, fr, fr, w - fr * 2, h - fr * 2);
  g.clip();
  g.translate(fr, fr);
  inner(w - fr * 2, h - fr * 2);
  g.restore();
  archPath(g, fr, fr, w - fr * 2, h - fr * 2);
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = 3;
  g.stroke();
}

/** Bandeira em leque no arco (vidro com raios brancos). */
function fan(g: G, w: number) {
  const r = w / 2;
  g.fillStyle = hex(PALETTE.glass);
  g.fillRect(0, 0, w, r);
  g.strokeStyle = hex(PALETTE.paper);
  g.lineWidth = 3;
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    g.beginPath();
    g.moveTo(r, r);
    g.lineTo(r + Math.cos(a) * r, r + Math.sin(a) * r);
    g.stroke();
  }
  g.fillStyle = hex(PALETTE.paper);
  g.fillRect(0, r - 3, w, 5);
}

function glassInner(g: G, w: number, h: number) {
  g.fillStyle = hex(PALETTE.glass);
  g.fillRect(0, 0, w, h);
  // Céu refletido na metade de cima e um risco diagonal de anime
  g.fillStyle = rgba(PALETTE.lilac, 0.45);
  g.fillRect(0, 0, w, h * 0.42);
  g.fillStyle = rgba(PALETTE.paper, 0.32);
  g.beginPath();
  g.moveTo(w * 0.1, h);
  g.lineTo(w * 0.62, h * 0.18);
  g.lineTo(w * 0.82, h * 0.18);
  g.lineTo(w * 0.3, h);
  g.fill();
  g.strokeStyle = hex(PALETTE.paper);
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(w / 2, w / 2);
  g.lineTo(w / 2, h);
  for (const k of [0.45, 0.72]) {
    g.moveTo(0, h * k);
    g.lineTo(w, h * k);
  }
  g.stroke();
  fan(g, w);
}

function shutterInner(color: number) {
  return (g: G, w: number, h: number) => {
    g.fillStyle = hex(color);
    g.fillRect(0, 0, w, h);
    g.fillStyle = rgba(PALETTE.ink, 0.28);
    for (let y = w / 2 + 6; y < h; y += 9) g.fillRect(0, y, w, 3);
    g.fillStyle = rgba(PALETTE.paper, 0.22);
    for (let y = w / 2 + 9; y < h; y += 9) g.fillRect(0, y, w, 2);
    g.fillStyle = hex(PALETTE.ink);
    g.fillRect(w / 2 - 2, w / 2, 4, h);
    timberWear(g, w, h, color);
    fan(g, w);
  };
}

function paintShutterLeaf(g: G, x: number, y: number, w: number, h: number, color: number) {
  g.fillStyle = hex(color);
  g.fillRect(x, y, w, h);
  g.fillStyle = rgba(PALETTE.ink, 0.28);
  for (let yy = y + 8; yy < y + h - 4; yy += 9) g.fillRect(x + 5, yy, w - 10, 3);
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = 4;
  g.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

function doorInner(color: number) {
  return (g: G, w: number, h: number) => {
    g.fillStyle = hex(color);
    g.fillRect(0, 0, w, h);
    fan(g, w);
    const top = w / 2 + 6;
    g.strokeStyle = hex(PALETTE.ink);
    g.lineWidth = 3;
    g.fillStyle = rgba(PALETTE.paper, 0.18);
    for (const x0 of [6, w / 2 + 4]) {
      const pw = w / 2 - 10;
      for (const [y0, ph] of [[top + 8, (h - top) * 0.42], [top + 16 + (h - top) * 0.42, (h - top) * 0.42]] as const) {
        g.fillRect(x0, y0, pw, ph);
        g.strokeRect(x0, y0, pw, ph);
      }
    }
    g.fillStyle = hex(PALETTE.ink);
    g.fillRect(w / 2 - 2, top, 4, h);
    timberWear(g, w, h, color);
    g.fillStyle = hex(PALETTE.yellow);
    g.beginPath();
    g.arc(w / 2 - 9, top + (h - top) * 0.5, 4, 0, Math.PI * 2);
    g.arc(w / 2 + 9, top + (h - top) * 0.5, 4, 0, Math.PI * 2);
    g.fill();
  };
}

/** Veios e quinas raspadas na madeira pintada, em vez de superfície plástica uniforme. */
function timberWear(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  g.strokeStyle = rgba(PALETTE.bark, 0.22);
  g.lineWidth = 0.8;
  for (let i = 0; i < 28; i++) {
    const x = r() * w;
    const y = w / 2 + r() * Math.max(1, h - w / 2);
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 3, Math.min(h, y + 10 + r() * 35)); g.stroke();
  }
  g.fillStyle = rgba(PALETTE.sand, 0.42);
  for (let i = 0; i < 18; i++) {
    const x = i % 2 ? 3 + r() * 4 : w - 7 + r() * 4;
    g.fillRect(x, w / 2 + r() * Math.max(1, h - w / 2), 1.5, 2 + r() * 8);
  }
}

function boardedInner(g: G, w: number, h: number) {
  g.fillStyle = hex(PALETTE.ink);
  g.fillRect(0, 0, w, h);
  const planks: [number, number, number][] = [[h * 0.3, -0.25, 0], [h * 0.55, 0.3, 1], [h * 0.8, -0.12, 0]];
  for (const [y, a, k] of planks) {
    g.save();
    g.translate(w / 2, y);
    g.rotate(a);
    g.fillStyle = hex(k ? PALETTE.wine : PALETTE.orange);
    g.fillRect(-w * 0.7, -11, w * 1.4, 22);
    g.strokeStyle = hex(PALETTE.ink);
    g.lineWidth = 3;
    g.strokeRect(-w * 0.7, -11, w * 1.4, 22);
    g.fillStyle = hex(PALETTE.paper);
    g.fillRect(-w * 0.35, -3, 5, 5);
    g.fillRect(w * 0.3, -3, 5, 5);
    g.restore();
  }
  // Marca da Resistência em spray
  g.strokeStyle = hex(PALETTE.pink);
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(w * 0.2, h * 0.4);
  g.lineTo(w * 0.8, h * 0.68);
  g.moveTo(w * 0.8, h * 0.4);
  g.lineTo(w * 0.2, h * 0.68);
  g.stroke();
}

function posterInner(g: G, w: number, h: number) {
  glassInner(g, w, h);
  const px = w * 0.12;
  const py = h * 0.4;
  const pw = w * 0.76;
  const ph = h * 0.42;
  g.fillStyle = hex(PALETTE.pink);
  g.fillRect(px, py, pw, ph);
  g.fillStyle = hex(PALETTE.yellow);
  g.beginPath();
  g.arc(px + pw / 2, py + ph * 0.36, pw * 0.26, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(px + pw / 2, py + ph * 0.38, pw * 0.15, 0.3, Math.PI - 0.3);
  g.stroke();
  g.fillStyle = hex(PALETTE.ink);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fit(g, 'SORRIA', ph * 0.2, pw * 0.9);
  g.fillText('SORRIA', px + pw / 2, py + ph * 0.8);
}

function grille(g: G, w: number, h: number) {
  g.fillStyle = hex(PALETTE.paper);
  g.fillRect(0, 0, w, h);
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, w - 3, h - 3);
  g.fillStyle = hex(PALETTE.glass);
  g.fillRect(FR, FR, w - FR * 2, h - FR * 2);
  g.fillStyle = rgba(PALETTE.paper, 0.25);
  g.fillRect(FR, FR, w - FR * 2, (h - FR * 2) * 0.35);
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = 5;
  for (let i = 1; i < 6; i++) {
    const x = FR + ((w - FR * 2) * i) / 6;
    g.beginPath();
    g.moveTo(x, FR);
    g.lineTo(x, h - FR);
    g.stroke();
    g.beginPath();
    g.arc(x, FR + 14, 7, Math.PI * 0.2, Math.PI * 1.8);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(FR, h * 0.62);
  g.lineTo(w - FR, h * 0.62);
  g.stroke();
}

function litInner(curtain: number) {
  return (g: G, w: number, h: number) => {
    archPath(g, 0, 0, w, h);
    g.save();
    g.clip();
    g.fillStyle = hex(PALETTE.sun);
    g.fillRect(0, 0, w, h);
    g.fillStyle = hex(PALETTE.ipeYellow);
    g.fillRect(0, h * 0.62, w, h * 0.38);
    // Cortinas presas dos lados
    g.fillStyle = hex(curtain);
    for (const s of [0, 1]) {
      g.beginPath();
      const x = s ? w : 0;
      const dx = s ? -1 : 1;
      g.moveTo(x, 0);
      g.lineTo(x + dx * w * 0.42, 0);
      g.quadraticCurveTo(x + dx * w * 0.1, h * 0.45, x + dx * w * 0.3, h);
      g.lineTo(x, h);
      g.fill();
    }
    g.restore();
  };
}

function belfryInner(g: G, w: number, h: number) {
  g.fillStyle = hex(PALETTE.ink);
  g.fillRect(0, 0, w, h);
  const cx = w / 2;
  const top = h * 0.3;
  g.fillStyle = hex(PALETTE.ipeYellow);
  g.beginPath();
  g.moveTo(cx - w * 0.12, top);
  g.quadraticCurveTo(cx - w * 0.16, top + h * 0.22, cx - w * 0.32, top + h * 0.36);
  g.lineTo(cx + w * 0.32, top + h * 0.36);
  g.quadraticCurveTo(cx + w * 0.16, top + h * 0.22, cx + w * 0.12, top);
  g.closePath();
  g.fill();
  g.fillStyle = hex(PALETTE.orange);
  g.fillRect(cx - w * 0.32, top + h * 0.33, w * 0.64, h * 0.04);
  g.fillStyle = hex(PALETTE.paper);
  g.fillRect(cx - 3, top - h * 0.12, 6, h * 0.12);
  g.fillRect(0, top - h * 0.14, w, 5);
}

function railingArt(g: G, w: number, h: number) {
  g.strokeStyle = hex(PALETTE.ink);
  g.lineCap = 'round';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, 5);
  g.lineTo(w, 5);
  g.moveTo(0, h - 5);
  g.lineTo(w, h - 5);
  g.stroke();
  g.lineWidth = 4;
  const step = 32;
  for (let x = step / 2; x < w; x += step) {
    g.beginPath();
    g.moveTo(x, 5);
    g.lineTo(x, h - 5);
    g.stroke();
    // Voluta em "S" entre os balaústres
    g.beginPath();
    g.arc(x + step / 2, h * 0.36, step * 0.26, Math.PI * 0.5, Math.PI * 2.1);
    g.stroke();
    g.beginPath();
    g.arc(x + step / 2, h * 0.68, step * 0.26, Math.PI * 1.5, Math.PI * 3.1);
    g.stroke();
  }
}

/** Desenha todas as artes num atlas novo (1024, transparente) e devolve UVs e materiais. */
export function colonialKit(): ColonialKit {
  const atlas = new Atlas(1024, true);
  const art = (w: number, h: number, paint: (g: G, w: number, h: number) => void): Art => ({
    uv: atlas.draw(w, h, paint),
    w: w / PX,
    h: h / PX,
  });
  const arch = (inner: (g: G, w: number, h: number) => void) => (g: G, w: number, h: number) => framed(g, w, h, (iw, ih) => inner(g, iw, ih));
  const glass = art(128, 256, arch(glassInner));
  const shutters = [PALETTE.leaf, PALETTE.tank, PALETTE.wine].map((c) => art(128, 256, arch(shutterInner(c))));
  const boarded = art(128, 256, arch(boardedInner));
  const poster = art(128, 256, arch(posterInner));
  const grilleArt = art(128, 192, grille);
  // Cortinas em tons de casa (vinho e terracota): rosa neon e ciano são cores de time
  const lit = [art(112, 240, litInner(PALETTE.wine))];
  const open = [PALETTE.leaf, PALETTE.tank].map((c) =>
    art(256, 256, (g, w, h) => {
      paintShutterLeaf(g, 0, 64, 60, h - 64, c);
      paintShutterLeaf(g, w - 60, 64, 60, h - 64, c);
      g.save();
      g.translate(64, 0);
      framed(g, 128, h, (iw, ih) => glassInner(g, iw, ih));
      g.restore();
    }),
  );
  const doors = [PALETTE.wine, PALETTE.leaf].map((c) => art(160, 320, (g, w, h) => framed(g, w, h, (iw, ih) => doorInner(c)(g, iw, ih), 14)));
  const rectWindows = [false, true].map(shutter => art(128, 256, (g, w, h) => rectWindow(g, w, h, shutter)));
  lit.push(art(112, 240, litInner(PALETTE.terracotta)));
  const railing = art(256, 120, railingArt);
  const belfry = art(128, 224, arch(belfryInner));
  const tex = atlas.texture;
  console.info(`mapa: atlas janelas ${atlas.used}`);
  return {
    mat: toonWith({ map: tex, alphaTest: 0.5 }),
    glow: new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: new THREE.Color(GLOW * 0.55, GLOW * 0.55, GLOW * 0.55) }),
    glass, shutters, rectWindows, open, doors, boarded, poster, grille: grilleArt, lit, railing, belfry, atlas,
  };
}
