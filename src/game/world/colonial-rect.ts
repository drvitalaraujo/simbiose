import { PALETTE, hex } from '../toon';
import type { G } from './textures';

// Vãos retos do casario do largo: guilhotina e veneziana, em contraste com os
// arcos da igreja. Artes originais no mesmo atlas, com cantaria e madeira.
export function rectWindow(g: G, w: number, h: number, shutter: boolean) {
  g.save();
  const fr = 11;
  g.fillStyle = hex(PALETTE.cal); g.fillRect(0, 0, w, h);
  g.strokeStyle = hex(PALETTE.bark); g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
  g.fillStyle = hex(shutter ? PALETTE.leaf : PALETTE.glass);
  g.fillRect(fr, fr, w - fr * 2, h - fr * 2);
  if (shutter) {
    for (let y = fr + 6; y < h - fr; y += 10) {
      g.fillStyle = hex(PALETTE.ink); g.globalAlpha = 0.3; g.fillRect(fr + 3, y, w - fr * 2 - 6, 3);
      g.fillStyle = hex(PALETTE.cal); g.globalAlpha = 0.2; g.fillRect(fr + 3, y + 3, w - fr * 2 - 6, 2);
    }
    g.globalAlpha = 1; g.fillStyle = hex(PALETTE.bark); g.fillRect(w / 2 - 3, fr, 6, h - fr * 2);
  } else {
    g.fillStyle = hex(PALETTE.colonialSky); g.globalAlpha = 0.5;
    g.fillRect(fr + 2, fr + 2, w - fr * 2 - 4, (h - fr * 2) * 0.45);
    g.globalAlpha = 1; g.strokeStyle = hex(PALETTE.cal); g.lineWidth = 4; g.beginPath();
    g.moveTo(w / 2, fr); g.lineTo(w / 2, h - fr);
    for (const t of [0.25, 0.5, 0.75]) {
      const y = fr + (h - fr * 2) * t;
      g.moveTo(fr, y); g.lineTo(w - fr, y);
    }
    g.stroke();
  }
  g.fillStyle = hex(PALETTE.bark); g.globalAlpha = 0.4; g.fillRect(fr, h - fr - 4, w - fr * 2, 4);
  g.restore();
}
