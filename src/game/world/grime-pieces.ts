import { hex, PALETTE } from '../toon';
import { mix, rgba } from './colonial-art';
import { rng } from './shapes';
import type { G } from './textures';

// Peças opacas com recorte do desgaste (grime.ts): tijolo, mosaico, fitas, poça, bueiro, ralo, folhas.

// ---------------------------------------------------------------- peças opacas (recorte)

/** Reboco caído mostrando o tijolo: borda de cal quebrada, fiadas de tijolo e sombra. */
export function brickPatch(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  const cx = w / 2;
  const cy = h / 2;
  const outline: [number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const k = 0.55 + r() * 0.45;
    outline.push([cx + Math.cos(a) * (w / 2 - 6) * k, cy + Math.sin(a) * (h / 2 - 6) * k]);
  }
  const path = (s: number, dx = 0, dy = 0) => {
    g.beginPath();
    outline.forEach(([x, y], i) => {
      const px = cx + (x - cx) * s + dx;
      const py = cy + (y - cy) * s + dy;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.closePath();
  };
  // Borda do reboco quebrado (cal clara) em volta do buraco
  path(1.06);
  g.fillStyle = hex(PALETTE.cal);
  g.fill();
  path(0.94);
  g.fillStyle = hex(PALETTE.stoneJoint);
  g.fill();
  g.save();
  path(0.9);
  g.clip();
  const bh = 14;
  for (let y = 0; y < h; y += bh) {
    const shift = (Math.floor(y / bh) % 2) * 15;
    for (let x = -30 + shift; x < w; x += 30) {
      g.fillStyle = r() < 0.25 ? hex(PALETTE.colonialRed) : r() < 0.5 ? mix(PALETTE.terracotta, PALETTE.bark, 0.2) : hex(PALETTE.terracotta);
      g.fillRect(x + 1.5, y + 1.5, 27, bh - 3);
      g.fillStyle = rgba(PALETTE.cal, 0.25);
      g.fillRect(x + 1.5, y + 1.5, 27, 2);
    }
  }
  // Sombra da borda do reboco sobre o tijolo (luz de cima)
  path(0.9, 0, 6);
  g.lineWidth = 8;
  g.strokeStyle = rgba(PALETTE.ink, 0.3);
  g.stroke();
  g.restore();
  path(0.94);
  g.lineWidth = 2;
  g.strokeStyle = hex(PALETTE.bark);
  g.stroke();
}

/** Mosaico de cacos (estilo da escadaria Selarón, desenho próprio): vermelho, amarelo, verde e azul. */
export function selaronTiles(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  const colors = [PALETTE.colonialRed, PALETTE.colonialRed, PALETTE.colonialYellow, PALETTE.colonialGreen, PALETTE.colonialBlue, PALETTE.cal, PALETTE.ochre];
  g.fillStyle = hex(PALETTE.cal);
  g.fillRect(0, 0, w, h);
  const n = 8;
  const c = w / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const x0 = x * c + 1.5 + r() * 2;
      const y0 = y * c + 1.5 + r() * 2;
      const s = c - 4 - r() * 3;
      const col = colors[Math.floor(r() * colors.length)];
      g.fillStyle = hex(col);
      g.fillRect(x0, y0, s, s);
      // Desenho no azulejo: losango, cruz ou faixa
      const k = r();
      g.fillStyle = col === PALETTE.cal ? hex(PALETTE.colonialBlue) : rgba(PALETTE.cal, 0.75);
      if (k < 0.3) {
        g.beginPath();
        g.moveTo(x0 + s / 2, y0 + 4); g.lineTo(x0 + s - 4, y0 + s / 2);
        g.lineTo(x0 + s / 2, y0 + s - 4); g.lineTo(x0 + 4, y0 + s / 2);
        g.fill();
      } else if (k < 0.5) {
        g.fillRect(x0 + s / 2 - 2, y0 + 3, 4, s - 6);
        g.fillRect(x0 + 3, y0 + s / 2 - 2, s - 6, 4);
      } else if (k < 0.62) g.fillRect(x0, y0 + s * 0.42, s, s * 0.16);
      // Brilho de vidrado no canto
      g.fillStyle = rgba(PALETTE.paper, 0.5);
      g.fillRect(x0 + 2, y0 + 2, s * 0.3, 2);
    }
  }
}

/** Fitas do Bonfim penduradas (amarradas em cima, pontas soltas embaixo). */
export function ribbonArt(g: G, w: number, h: number) {
  const r = rng(73);
  const colors = [PALETTE.colonialYellow, PALETTE.colonialBlue, PALETTE.colonialRed, PALETTE.colonialGreen, PALETTE.paper, PALETTE.colonialPink, PALETTE.orange, PALETTE.colonialSky];
  g.fillStyle = hex(PALETTE.bark);
  g.fillRect(0, 4, w, 6);
  for (let i = 0; i < 16; i++) {
    const x = 4 + i * ((w - 8) / 16) + r() * 2;
    const len = h * (0.55 + r() * 0.42);
    const sway = (r() - 0.5) * 14;
    g.strokeStyle = hex(colors[i % colors.length]);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, 8);
    g.quadraticCurveTo(x + sway, len * 0.6, x + sway * 0.5, len);
    g.stroke();
    // Letrinhas da lembrança: risquinhos claros ao longo da fita
    g.strokeStyle = rgba(PALETTE.paper, 0.6);
    g.lineWidth = 1;
    for (let y = 20; y < len - 6; y += 9) {
      g.beginPath(); g.moveTo(x - 1.5 + sway * (y / len) * 0.8, y); g.lineTo(x + 1.5 + sway * (y / len) * 0.8, y + 2); g.stroke();
    }
  }
}

/** Poça rasa: céu refletido em faixas toon e borda molhada mais escura. */
export function puddle(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const k = 0.62 + r() * 0.38;
    pts.push([w / 2 + Math.cos(a) * (w / 2 - 6) * k, h / 2 + Math.sin(a) * (h / 2 - 6) * k]);
  }
  const path = (s: number) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(w / 2 + (x - w / 2) * s, h / 2 + (y - h / 2) * s) : g.moveTo(w / 2 + (x - w / 2) * s, h / 2 + (y - h / 2) * s)));
    g.closePath();
  };
  path(1);
  g.fillStyle = mix(PALETTE.stoneJoint, PALETTE.ink, 0.25);
  g.fill();
  path(0.88);
  g.fillStyle = mix(PALETTE.stoneJoint, PALETTE.colonialSky, 0.45);
  g.fill();
  g.save();
  path(0.88);
  g.clip();
  g.fillStyle = mix(PALETTE.stoneJoint, PALETTE.colonialSky, 0.75);
  g.fillRect(0, h * 0.5, w, h);
  // Reflexos: riscos claros diagonais (anime)
  g.fillStyle = rgba(PALETTE.paper, 0.6);
  for (let i = 0; i < 3; i++) {
    const x = w * (0.25 + i * 0.2 + r() * 0.05);
    g.beginPath();
    g.moveTo(x, h * 0.2); g.lineTo(x + 10, h * 0.2); g.lineTo(x - 8, h * 0.8); g.lineTo(x - 16, h * 0.8);
    g.fill();
  }
  g.restore();
}

/** Tampa de bueiro de ferro fundido: anéis, grade em losango e "PMS" apagado. */
export function manholeArt(g: G, w: number, h: number) {
  const c = w / 2;
  g.fillStyle = hex(PALETTE.inkSoft);
  g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = hex(PALETTE.steel);
  g.beginPath(); g.arc(c, c, c - 9, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(c, c, c - 14, 0, Math.PI * 2); g.clip();
  g.strokeStyle = hex(PALETTE.inkSoft);
  g.lineWidth = 3;
  for (let k = -w; k < w * 2; k += 12) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke();
    g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke();
  }
  g.restore();
  g.strokeStyle = hex(PALETTE.steelLight);
  g.lineWidth = 2;
  g.beginPath(); g.arc(c, c, c - 9, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
  g.fillStyle = hex(PALETTE.steel);
  g.fillRect(c - 22, c - 9, 44, 18);
  g.fillStyle = hex(PALETTE.steelLight);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 14px Arial';
  g.fillText('ÁGUAS', c, c + 1);
}

/** Grelha de ralo junto ao meio-fio. */
export function grateArt(g: G, w: number, h: number) {
  g.fillStyle = hex(PALETTE.ink);
  g.fillRect(0, 0, w, h);
  g.fillStyle = hex(PALETTE.steel);
  g.fillRect(3, 3, w - 6, 5);
  g.fillRect(3, h - 8, w - 6, 5);
  for (let x = 6; x < w - 6; x += 10) {
    g.fillRect(x, 8, 5, h - 16);
    g.fillStyle = hex(PALETTE.steelLight);
    g.fillRect(x, 8, 2, h - 16);
    g.fillStyle = hex(PALETTE.steel);
  }
}

/** Folhas secas e papel no canto da rua. */
export function leavesArt(g: G, w: number, h: number) {
  const r = rng(99);
  const colors = [PALETTE.ochre, PALETTE.terracotta, PALETTE.leaf, PALETTE.ipeYellow, PALETTE.bark];
  for (let i = 0; i < 22; i++) {
    const x = 12 + r() * (w - 24);
    const y = 12 + r() * (h - 24);
    g.save();
    g.translate(x, y);
    g.rotate(r() * Math.PI * 2);
    g.fillStyle = hex(colors[Math.floor(r() * colors.length)]);
    g.beginPath();
    g.ellipse(0, 0, 7 + r() * 4, 3 + r() * 2, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba(PALETTE.ink, 0.4);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.stroke();
    g.restore();
  }
  // Um papel amassado
  g.fillStyle = hex(PALETTE.paper);
  g.beginPath(); g.moveTo(w * 0.6, h * 0.6); g.lineTo(w * 0.78, h * 0.58); g.lineTo(w * 0.8, h * 0.76); g.lineTo(w * 0.62, h * 0.8); g.fill();
}
