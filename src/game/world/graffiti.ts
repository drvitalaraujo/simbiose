import { hex, PALETTE } from '../toon';
import { rgba } from './colonial-art';
import { rng } from './shapes';
import { fit, type G } from './textures';

export type GraffitiStyle = 'pixo' | 'bubble' | 'stencil';

/** Spray original: variação entre letras, overspray, escorridos e tinta falhada. */
export function paintGraffiti(g: G, w: number, h: number, text: string, style: GraffitiStyle, color: number, color2: number = PALETTE.ink) {
  const seed = Array.from(text).reduce((s, c) => s * 31 + c.charCodeAt(0) | 0, 17);
  const r = rng(seed);
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.translate(w / 2, h * 0.47);
  g.rotate(style === 'stencil' ? -0.012 : -0.045);
  if (style === 'pixo') g.scale(0.7, 1.45);
  const px = fit(g, text, h * (style === 'pixo' ? 0.4 : 0.52), w * (style === 'pixo' ? 1.22 : 0.78),
    style === 'pixo' ? "500 Xpx 'Arial Narrow', sans-serif" : "900 Xpx 'Arial Black', Impact, sans-serif");
  const total = g.measureText(text).width;
  let x = -total / 2;
  g.lineJoin = 'round';
  for (const ch of text) {
    const cw = g.measureText(ch).width;
    g.save();
    g.translate(x + cw / 2, (r() - 0.5) * px * (style === 'stencil' ? 0.025 : 0.09));
    g.rotate((r() - 0.5) * (style === 'stencil' ? 0.01 : 0.1));
    // Névoa de pigmento ao redor do traço, sem emissão de luz.
    g.shadowColor = rgba(color, 0.5);
    g.shadowBlur = 3;
    if (style === 'bubble') {
      g.strokeStyle = hex(color2); g.lineWidth = px * 0.18;
      g.strokeText(ch, px * 0.025, px * 0.04);
      g.strokeStyle = hex(PALETTE.ink); g.lineWidth = px * 0.105;
      g.strokeText(ch, 0, 0);
      const grad = g.createLinearGradient(0, -px * 0.3, 0, px * 0.4);
      grad.addColorStop(0, hex(color)); grad.addColorStop(1, hex(color2));
      g.fillStyle = grad;
    } else g.fillStyle = hex(color);
    g.globalAlpha = 0.8 + r() * 0.18;
    g.fillText(ch, 0, 0);
    g.shadowBlur = 0;
    // Gotas partem da borda inferior das letras, com ponta arredondada.
    if (ch.trim() && r() < 0.5) {
      const dx = (r() - 0.5) * cw * 0.55;
      const y = px * 0.32;
      const len = px * (0.08 + r() * 0.24);
      g.strokeStyle = hex(style === 'bubble' ? color2 : color);
      g.lineWidth = 1 + r() * 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(dx, y); g.lineTo(dx + 0.8, y + len); g.stroke();
    }
    g.restore();
    x += cw;
  }
  if (style === 'pixo') {
    g.strokeStyle = hex(color); g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-total * 0.48, px * 0.42);
    g.lineTo(total * 0.45, px * 0.37); g.stroke();
  }
  if (style === 'stencil') {
    g.globalCompositeOperation = 'destination-out';
    for (let tx = -total / 2; tx < total / 2; tx += px * 0.6) g.fillRect(tx, -px * 0.34, px * 0.035, px * 0.7);
  }
  g.restore();
  // Porosidade e pequenas falhas removem só tinta dentro da arte, sem retângulo de fundo.
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    g.globalAlpha = 0.12 + r() * 0.55;
    g.fillRect(r() * w, r() * h, 0.5 + r() * 2, 0.5 + r() * 2);
  }
  g.restore();
}
