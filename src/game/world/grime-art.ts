import { PALETTE } from '../toon';
import { rgba } from './colonial-art';
import { rng } from './shapes';
import type { G } from './textures';

// Artes do desgaste (grime.ts), desenhadas em canvas: originais, sem foto nem asset externo.

// ---------------------------------------------------------------- artes de multiplicar
// Cor de multiplicar: a sombra fria do cel (lilás do nanquim), nunca preto chapado.

const dirt = (a: number) => rgba(PALETTE.bark, a);
const moss = (a: number) => rgba(PALETTE.leaf, a);

export function blot(g: G, x: number, y: number, rx: number, ry: number, r: () => number) {
  g.beginPath();
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const k = 0.7 + r() * 0.3;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
}

/** Pé da parede: sujeira de respingo, linha de maré da umidade e tufos de musgo. */
export function baseBand(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  // Linha da umidade: borda ondulada, mais forte embaixo
  const tide = (x: number) => h * (0.3 + 0.12 * Math.sin(x * 0.021 + seed) + 0.06 * Math.sin(x * 0.07 + seed * 3));
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) g.lineTo(x, tide(x));
  g.lineTo(w, h);
  g.closePath();
  const grad = g.createLinearGradient(0, h * 0.2, 0, h);
  grad.addColorStop(0, dirt(0.1));
  grad.addColorStop(0.55, dirt(0.22));
  grad.addColorStop(1, dirt(0.5));
  g.fillStyle = grad;
  g.fill();
  // Contorno da maré: mancha mais escura logo abaixo da borda (sal e limo secando)
  g.strokeStyle = dirt(0.07);
  g.lineWidth = 4;
  g.beginPath();
  for (let x = 0; x <= w; x += 8) (x ? g.lineTo(x, tide(x) + 3) : g.moveTo(x, tide(x) + 3));
  g.stroke();
  // Respingo de chuva: pintas no terço de baixo
  for (let i = 0; i < 160; i++) {
    g.fillStyle = dirt(0.12 + r() * 0.2);
    const y = h - Math.pow(r(), 1.6) * h * 0.45;
    g.fillRect(r() * w, y, 1 + r() * 3, 1 + r() * 3);
  }
  // Musgo em tufos no rodapé (sem encostar nas bordas: a faixa repete)
  for (let i = 0; i < 9; i++) {
    const x = 20 + r() * (w - 40);
    const rx = 10 + r() * 26;
    const ry = 6 + r() * 14;
    g.fillStyle = moss(0.3 + r() * 0.2);
    blot(g, x, h - ry * 0.5, rx, ry, r);
    g.fillStyle = moss(0.25);
    for (let k = 0; k < 6; k++) blot(g, x + (r() - 0.5) * rx * 1.6, h - ry - r() * ry, 3 + r() * 5, 3 + r() * 5, r);
  }
}

/** Sob a cornija: sombra pintada e sujeira que escorre em fios até meia parede. */
export function eaveBand(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  const grad = g.createLinearGradient(0, 0, 0, h * 0.35);
  grad.addColorStop(0, dirt(0.38));
  grad.addColorStop(1, dirt(0));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h * 0.35);
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    const len = h * (0.3 + r() * 0.7);
    const sw = 2 + r() * 9;
    const s = g.createLinearGradient(0, 0, 0, len);
    s.addColorStop(0, dirt(0.22 + r() * 0.2));
    s.addColorStop(1, dirt(0));
    g.fillStyle = s;
    g.beginPath();
    g.moveTo(x - sw, 0);
    g.lineTo(x + sw, 0);
    g.lineTo(x + sw * 0.3, len);
    g.lineTo(x - sw * 0.3, len);
    g.closePath();
    g.fill();
  }
}

/** Escorrido sob o peitoril: mancha na saída da água e fios afinando para baixo. */
export function drip(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  const top = g.createLinearGradient(0, 0, 0, h * 0.18);
  top.addColorStop(0, dirt(0.42));
  top.addColorStop(1, dirt(0.1));
  g.fillStyle = top;
  g.fillRect(4, 0, w - 8, h * 0.12);
  for (let i = 0; i < 5; i++) {
    const x = 8 + r() * (w - 16);
    const len = h * (0.35 + r() * 0.65);
    const sw = 2 + r() * 5;
    const s = g.createLinearGradient(0, 0, 0, len);
    s.addColorStop(0, dirt(0.4));
    s.addColorStop(0.6, dirt(0.18));
    s.addColorStop(1, dirt(0));
    g.fillStyle = s;
    g.beginPath();
    g.moveTo(x - sw, 0);
    g.quadraticCurveTo(x + sw * 1.4, len * 0.5, x, len);
    g.quadraticCurveTo(x - sw * 0.2, len * 0.5, x - sw, 0);
    g.fill();
  }
}

/** Fissura no reboco: risco de nanquim que se ramifica, com sombra suja em volta. */
export function crack(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  const branch = (x: number, y: number, a: number, len: number, lw: number, depth: number) => {
    g.strokeStyle = rgba(PALETTE.ink, 0.55);
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < len; i++) {
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * 6;
      y += Math.sin(a) * 6;
      g.lineTo(x, y);
      if (depth < 2 && r() < 0.15) {
        g.stroke();
        branch(x, y, a + (r() < 0.5 ? 0.8 : -0.8), len * 0.4, lw * 0.6, depth + 1);
        g.strokeStyle = rgba(PALETTE.ink, 0.55);
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(x, y);
      }
    }
    g.stroke();
  };
  g.fillStyle = dirt(0.06);
  blot(g, w / 2, h / 2, w * 0.36, h * 0.36, r);
  branch(w * 0.2, h * 0.15, Math.PI * 0.35, 16, 2.2, 0);
}

/** Mancha no piso (óleo, água parada secando). */
export function stain(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  for (let k = 0; k < 5; k++) {
    g.fillStyle = rgba(PALETTE.ink, 0.06 + k * 0.025);
    blot(g, w / 2 + (r() - 0.5) * 20, h / 2 + (r() - 0.5) * 20, w * (0.42 - k * 0.07), h * (0.36 - k * 0.06), r);
  }
}

/** Quina gasta: lascas escuras e marcas de batida na aresta. */
export function cornerWear(g: G, w: number, h: number) {
  const r = rng(91);
  // Lascas só na aresta (lado esquerdo da arte) e a sujeira de batida no rodapé
  for (let i = 0; i < 16; i++) {
    g.fillStyle = dirt(0.14 + r() * 0.16);
    blot(g, 2 + r() * w * 0.25, r() * h, 1.5 + r() * 3, 3 + r() * 7, r);
  }
  const grad = g.createLinearGradient(0, h * 0.75, 0, h);
  grad.addColorStop(0, dirt(0));
  grad.addColorStop(1, dirt(0.32));
  g.fillStyle = grad;
  g.fillRect(0, h * 0.75, w, h * 0.25);
}

/** Piso junto à parede: o canto onde a sujeira e a sombra se juntam (topo da arte = parede). */
export function curbArt(g: G, w: number, h: number) {
  const r = rng(95);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rgba(PALETTE.ink, 0.42));
  grad.addColorStop(0.35, dirt(0.2));
  grad.addColorStop(1, dirt(0));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = dirt(0.1 + r() * 0.2);
    g.fillRect(r() * w, Math.pow(r(), 1.8) * h, 1 + r() * 4, 1 + r() * 3);
  }
}

/** Cantaria: blocos em fiadas, tom variando por bloco, junta fina e aresta inferior suja. */
export function ashlarArt(g: G, w: number, h: number) {
  const r = rng(97);
  const rows = 6;
  const rh = h / rows;
  for (let row = 0; row < rows; row++) {
    let x = row % 2 ? -rh * 0.9 : 0;
    while (x < w) {
      const bw = rh * (1.4 + r() * 0.9);
      g.fillStyle = dirt(0.02 + r() * 0.1);
      g.fillRect(x, row * rh, bw, rh);
      g.fillStyle = dirt(0.32);
      g.fillRect(x, row * rh + rh - 2, bw, 2);
      g.fillRect(x + bw - 2, row * rh, 2, rh);
      if (r() < 0.3) {
        g.fillStyle = dirt(0.12);
        blot(g, x + bw * r(), row * rh + rh * r(), 6 + r() * 10, 4 + r() * 6, r);
      }
      x += bw;
    }
  }
}

