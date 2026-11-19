import { PALETTE, hex } from '../toon';
import { mix, rgba } from './colonial-art';
import { rng } from './shapes';

// Pé-de-moleque: células de Voronoi periódicas, com pedra irregular e rejunte fino.
// A imagem é original, desenhada uma vez no canvas; nenhum asset fotográfico.
type Point = { x: number; y: number };

function clip(poly: Point[], p: Point, q: Point): Point[] {
  const nx = q.x - p.x, ny = q.y - p.y;
  const limit = (q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y) / 2;
  const dist = (v: Point) => v.x * nx + v.y * ny - limit;
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = dist(a), db = dist(b);
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function paintFieldstone(g: CanvasRenderingContext2D, size: number, seed: number) {
  const r = rng(seed), n = Math.round(size / 73), cell = size / n;
  const points: Point[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    points.push({ x: (x + 0.5 + (r() - 0.5) * 0.65) * cell,
      y: (y + 0.5 + (r() - 0.5) * 0.65) * cell });
  }
  const neighbors = points.flatMap(p => [-size, 0, size].flatMap(dx =>
    [-size, 0, size].map(dy => ({ x: p.x + dx, y: p.y + dy }))));
  g.fillStyle = hex(PALETTE.stoneJoint);
  g.fillRect(0, 0, size, size);
  // Terra no rejunte: manchas escuras soltas, não uma grade uniforme
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rgba(PALETTE.bark, 0.08 + r() * 0.12);
    g.fillRect(r() * size, r() * size, 3 + r() * 9, 3 + r() * 9);
  }
  // Pedras de outra jazida (puxadas para areia, arenito ou rosa) e algumas mais escuras
  const tints = [PALETTE.sand, PALETTE.cantaria, PALETTE.colonialRose, PALETTE.stoneJoint];
  for (const p of points) {
    let poly = [{ x: p.x - cell * 2, y: p.y - cell * 2 },
      { x: p.x + cell * 2, y: p.y - cell * 2 },
      { x: p.x + cell * 2, y: p.y + cell * 2 },
      { x: p.x - cell * 2, y: p.y + cell * 2 }];
    for (const q of neighbors) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > 0.001 && d < cell * 3) poly = clip(poly, p, q);
    }
    // Recuo para a junta e cantos gastos; a cópia periódica usa a mesma cor.
    const shrink = 0.86 + r() * 0.06;
    const inset = poly.map(v => ({ x: p.x + (v.x - p.x) * shrink, y: p.y + (v.y - p.y) * shrink }));
    const roll = r();
    const tone = roll < 0.08 ? 0.45 + r() * 0.2 : 0.1 + r() * 0.24;
    const tint = roll > 0.72 ? tints[Math.floor(r() * tints.length)] : -1;
    const tk = 0.12 + r() * 0.22;
    const base = mix(PALETTE.cal, PALETTE.stoneJoint, tone);
    const crackA = r(), crackB = r();
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      const shape = (ox: number, oy: number) => {
        g.beginPath();
        inset.forEach((v, i) => i ? g.lineTo(v.x + dx + ox, v.y + dy + oy) : g.moveTo(v.x + dx + ox, v.y + dy + oy));
        g.closePath();
      };
      // Sombra da pedra para baixo/direita (relevo cel, luz vinda de cima)
      shape(2.5, 3);
      g.fillStyle = rgba(PALETTE.ink, 0.28);
      g.fill();
      shape(0, 0);
      g.fillStyle = base;
      g.fill();
      if (tint >= 0) { g.fillStyle = rgba(tint, tk); g.fill(); }
      g.save(); g.clip();
      // Topo gasto: polido claro no alto, faixa escura embaixo
      g.fillStyle = rgba(PALETTE.paper, 0.22);
      g.beginPath(); g.ellipse(p.x + dx - cell * 0.08, p.y + dy - cell * 0.12, cell * 0.26, cell * 0.16, -0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = rgba(PALETTE.ink, 0.12);
      g.fillRect(p.x + dx - cell, p.y + dy + cell * 0.22, cell * 2, cell);
      g.strokeStyle = rgba(PALETTE.ink, 0.16);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(p.x - cell * 0.25 + dx, p.y - cell * 0.1 * crackA + dy);
      g.lineTo(p.x + cell * 0.05 + dx, p.y + cell * 0.12 + dy);
      g.lineTo(p.x + cell * (0.1 + crackB * 0.15) + dx, p.y + cell * 0.3 + dy);
      g.stroke(); g.restore();
      shape(0, 0);
      g.lineWidth = 2;
      g.strokeStyle = rgba(PALETTE.cal, 0.4);
      g.stroke();
    }
  }
}
