// Minimapa 2D (canvas) a partir dos sólidos do mapa. A planta é desenhada uma vez num canvas
// fora da tela; a cada ~1/15 s só copia a planta e pinta os pontos (você, aliados, inimigos
// vistos). Norte para cima; a seta mostra para onde você olha.
import { el } from './dom';
import { boundsOf, fitRect, type MapRect, minimapSolids } from './format';
import type { MinimapDot, MinimapSelf, MinimapSolid } from './types';

const SIZE = 168; // px CSS
const REDRAW = 1 / 15;
const COLORS = {
  // Mesmos tons da PALETTE (toon.ts) em CSS
  ink: '#1a1026',
  wall: 'rgba(184, 169, 217, 0.85)',
  low: 'rgba(125, 110, 168, 0.75)',
  self: '#ffd23f',
  ally: '#2de2e6',
  enemy: '#ff3d7f',
};

export class Minimap {
  readonly root = el('div', 'ch-minimap');
  private readonly canvas = el('canvas');
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly plan = document.createElement('canvas');
  private fit = { scale: 1, ox: 0, oz: 0 };
  private self: MinimapSelf | null = null;
  private dots: MinimapDot[] = [];
  private dirty = false;
  private since = 0;
  private ready = false;
  private readonly dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);

  constructor() {
    this.root.append(this.canvas);
    const px = Math.round(SIZE * this.dpr);
    this.canvas.width = this.plan.width = px;
    this.canvas.height = this.plan.height = px;
    this.ctx = this.canvas.getContext('2d');
    this.root.hidden = true;
  }

  /** Desenha a planta (uma vez por mapa). Aceita os `solids` do MapData ou as caixas do mundo. */
  setMap(solids: readonly MinimapSolid[], bounds?: MapRect) {
    const shown = minimapSolids(solids);
    const r = bounds ?? boundsOf(shown);
    const px = this.plan.width;
    this.fit = fitRect(r, px);
    const g = this.plan.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, px, px);
    // Paredes altas por último, por cima das coberturas baixas
    const order = [...shown].sort((a, b) => a.box.max.y - b.box.max.y);
    for (const s of order) {
      const low = s.kind ? s.kind === 'low' || s.kind === 'platform' : s.box.max.y - s.box.min.y < 1.6;
      g.fillStyle = low ? COLORS.low : COLORS.wall;
      const x = s.box.min.x * this.fit.scale + this.fit.ox;
      const z = s.box.min.z * this.fit.scale + this.fit.oz;
      g.fillRect(x, z, Math.max(1, (s.box.max.x - s.box.min.x) * this.fit.scale), Math.max(1, (s.box.max.z - s.box.min.z) * this.fit.scale));
    }
    this.ready = true;
    this.root.hidden = false;
    this.dirty = true;
  }

  /** Posições do quadro. Barato: só guarda; o desenho acontece no `update` (15 Hz). */
  setPlayers(self: MinimapSelf | null, others: MinimapDot[] = []) {
    this.self = self;
    this.dots = others;
    this.dirty = true;
  }

  setVisible(on: boolean) {
    this.root.hidden = !on || !this.ready;
  }

  update(dt: number) {
    this.since += dt;
    if (!this.dirty || this.since < REDRAW || !this.ready || !this.ctx) return;
    this.since = 0;
    this.dirty = false;
    const g = this.ctx;
    const px = this.canvas.width;
    g.clearRect(0, 0, px, px);
    g.drawImage(this.plan, 0, 0);
    const r = 3.2 * this.dpr;
    for (const d of this.dots) {
      g.fillStyle = COLORS[d.rel === 'self' ? 'self' : d.rel];
      g.strokeStyle = COLORS.ink;
      g.lineWidth = 1.5 * this.dpr;
      g.beginPath();
      if (d.kind === 'drone') {
        const x = this.mx(d.x), z = this.mz(d.z), k = r * 1.8;
        g.moveTo(x, z - k); g.lineTo(x + k, z); g.lineTo(x, z + k); g.lineTo(x - k, z); g.closePath();
      } else g.arc(this.mx(d.x), this.mz(d.z), r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    if (this.self) {
      // Seta: frente = (-sen yaw, -cos yaw) no XZ => girar -yaw a partir de "para cima"
      g.save();
      g.translate(this.mx(this.self.x), this.mz(this.self.z));
      g.rotate(-this.self.yaw);
      const s = 6 * this.dpr;
      g.beginPath();
      g.moveTo(0, -s * 1.3);
      g.lineTo(s * 0.85, s);
      g.lineTo(0, s * 0.45);
      g.lineTo(-s * 0.85, s);
      g.closePath();
      g.fillStyle = COLORS.self;
      g.strokeStyle = COLORS.ink;
      g.lineWidth = 2 * this.dpr;
      g.stroke();
      g.fill();
      g.restore();
    }
  }

  private mx(x: number) {
    return x * this.fit.scale + this.fit.ox;
  }

  private mz(z: number) {
    return z * this.fit.scale + this.fit.oz;
  }
}
