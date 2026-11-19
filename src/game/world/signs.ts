import * as THREE from 'three';
import { hex, PALETTE } from '../toon';
import { rng } from './shapes';
import { canvas, fit, font, type G, texture } from './textures';

// Pintores dos letreiros do salto visual: neon vertical, lambe-lambe e letreiro corrido.

/** Letreiro vertical de neon: tubo colorido na borda, letras empilhadas brancas com halo. */
export function paintNeonBlade(g: G, w: number, h: number, text: string, color: number) {
  g.fillStyle = hex(PALETTE.ink);
  g.fillRect(0, 0, w, h);
  const lw = w * 0.07;
  g.shadowColor = hex(color);
  g.shadowBlur = w * 0.18;
  g.strokeStyle = hex(color);
  g.lineWidth = lw;
  g.strokeRect(lw * 1.5, lw * 1.5, w - lw * 3, h - lw * 3);
  const letters = [...text.replace(/ /g, '')];
  const n = letters.length;
  const step = (h * 0.86) / n;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font(Math.min(step * 0.82, w * 0.62));
  g.fillStyle = hex(PALETTE.paper);
  for (let i = 0; i < n; i++) g.fillText(letters[i], w / 2, h * 0.07 + step * (i + 0.5));
  g.shadowBlur = 0;
}

/** Cartazes lambe-lambe colados lado a lado (show, forró, "compro ouro", a Vila). */
export function lambeLambe(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  const posters: [string, string, number, number][] = [
    ['FORRÓ', 'SÁBADO NA LAJE', PALETTE.yellow, PALETTE.ink],
    ['COMPRO OURO', 'PAGO NA HORA', PALETTE.paper, PALETTE.wine],
    ['SHOW HOJE', 'BAILE DA VILA', PALETTE.pink, PALETTE.paper],
    ['DESPLUGA', 'ENCONTRO 22H', PALETTE.cyan, PALETTE.ink],
    ['TRAGO A PESSOA', 'AMADA EM 3 DIAS', PALETTE.orange, PALETTE.ink],
    ['SAMBA', 'DOMINGO NA PRAÇA', PALETTE.lilac, PALETTE.paper],
    ['Ñ SORRIA', 'A META É VOCÊ', PALETTE.paper, PALETTE.ink],
  ];
  let x = 4;
  while (x < w - 60) {
    const [title, sub, bg, fg] = posters[Math.floor(r() * posters.length)];
    const pw = 120 + r() * 70;
    const ph = h * (0.7 + r() * 0.26);
    const y = (h - ph) * r();
    g.save();
    g.translate(x + pw / 2, y + ph / 2);
    g.rotate((r() - 0.5) * 0.08);
    g.fillStyle = hex(bg);
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.fillStyle = hex(fg);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fit(g, title, ph * 0.3, pw * 0.88);
    g.fillText(title, 0, -ph * 0.12);
    fit(g, sub, ph * 0.12, pw * 0.86, "700 Xpx Arial, sans-serif");
    g.fillText(sub, 0, ph * 0.22);
    // Papel rasgado: um canto arrancado
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(pw / 2, ph / 2);
    g.lineTo(pw / 2 - pw * r() * 0.4, ph / 2);
    g.lineTo(pw / 2, ph / 2 - ph * r() * 0.4);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.restore();
    x += pw - 6 + r() * 10;
  }
}

/** Faixa de letreiro corrido (repete na horizontal: a UV rola para animar). */
export function paintTicker(text: string): THREE.CanvasTexture {
  const [c, g] = canvas(2048, 64);
  g.fillStyle = hex(PALETTE.ink);
  g.fillRect(0, 0, 2048, 64);
  g.textBaseline = 'middle';
  g.font = font(40);
  g.fillStyle = hex(PALETTE.yellow);
  // Repete o texto até preencher a faixa inteira (emenda sem corte no fim)
  const tw = g.measureText(text).width;
  const n = Math.max(1, Math.round(2048 / tw));
  g.save();
  g.scale(2048 / (tw * n), 1);
  for (let i = 0; i < n; i++) g.fillText(text, i * tw, 34);
  g.restore();
  const t = texture(c, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
