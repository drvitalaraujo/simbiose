import { PALETTE as C, hex } from '../toon';
import { rgba } from '../world/colonial-art';
import { rng } from '../world/shapes';
import type { G } from '../world/textures';

// Pintores das paredes da Favela do Sol (canvas): tijolo baiano aparente com argamassa
// escorrida e reboco pintado que descasca. Cada módulo cobre 3 × 3 m de parede (reboco) ou
// 2,4 × 2,4 m (tijolo), para o detalhe não esticar em fachadas grandes.

const BRICKS = [C.terracotta, C.telha, C.colonialRed, C.terracotta, C.cantaria];

/** Trecho de tijolo: fiadas desencontradas, argamassa irregular e furos do tijolo quebrado. */
function brickCourse(g: G, x0: number, y0: number, w: number, h: number, bw: number, bh: number, r: () => number) {
  g.fillStyle = hex(C.stoneJoint);
  g.fillRect(x0, y0, w, h);
  const rows = Math.ceil(h / bh);
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * bw * 0.5 - bw;
    for (let x = x0 + off; x < x0 + w; x += bw) {
      const y = y0 + row * bh;
      const c = BRICKS[Math.floor(r() * BRICKS.length)];
      const gap = Math.max(1.5, bh * 0.12);
      g.fillStyle = hex(c);
      g.fillRect(x + gap * 0.5, y + gap * 0.5, bw - gap, bh - gap);
      // Luz na aresta de cima, sombra em baixo: volume de anime sem textura ruidosa
      g.fillStyle = rgba(C.cal, 0.18);
      g.fillRect(x + gap * 0.5, y + gap * 0.5, bw - gap, Math.max(1, bh * 0.14));
      g.fillStyle = rgba(C.bark, 0.22);
      g.fillRect(x + gap * 0.5, y + bh - gap * 0.5 - Math.max(1, bh * 0.12), bw - gap, Math.max(1, bh * 0.12));
      // Tijolo quebrado mostra os furos do bloco cerâmico
      if (r() < 0.05) {
        g.fillStyle = rgba(C.ink, 0.75);
        for (let k = 0; k < 3; k++) g.fillRect(x + bw * (0.18 + k * 0.24), y + bh * 0.3, bw * 0.14, bh * 0.38);
      } else if (r() < 0.12) {
        // Quina lascada
        g.fillStyle = hex(C.stoneJoint);
        g.beginPath();
        g.moveTo(x + bw - gap, y + gap);
        g.lineTo(x + bw - gap - bw * 0.25, y + gap);
        g.lineTo(x + bw - gap, y + bh * 0.6);
        g.fill();
      }
    }
  }
  // Argamassa espremida entre as fiadas, em gotas claras irregulares
  g.fillStyle = rgba(C.cobbleStone, 0.55);
  for (let row = 1; row < rows; row++) {
    for (let k = 0; k < w / 14; k++) {
      if (r() < 0.55) continue;
      const x = x0 + r() * w;
      g.beginPath();
      g.ellipse(x, y0 + row * bh, 3 + r() * 7, 1.5 + r() * 2.5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** Contorno irregular fechado. */
function blob(g: G, cx: number, cy: number, rx: number, ry: number, r: () => number, n = 14) {
  const k = [r() * 6.28, r() * 6.28, r() * 6.28];
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const f = 1 + 0.3 * Math.sin(a * 2 + k[0]) + 0.18 * Math.sin(a * 3 + k[1]) + 0.1 * Math.sin(a * 5 + k[2]);
    const x = cx + Math.cos(a) * rx * f;
    const y = cy + Math.sin(a) * ry * f;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Tijolo aparente 2,4 × 2,4 m, com faixas de chapisco e manchas de cimento. */
export function paintBrickWall(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  brickCourse(g, 0, 0, w, h, 32, 16, r);
  // Chapisco cinza começando a cobrir o tijolo: reforma pela metade
  for (let i = 0; i < 2; i++) {
    g.save();
    blob(g, r() * w, r() * h, 30 + r() * 40, 20 + r() * 28, r);
    g.clip();
    g.fillStyle = rgba(C.stoneJoint, 0.85);
    g.fillRect(0, 0, w, h);
    g.fillStyle = rgba(C.inkSoft, 0.25);
    for (let k = 0; k < 400; k++) g.fillRect(r() * w, r() * h, 2, 2);
    g.restore();
  }
  // Escorrido escuro descendo da laje
  for (let i = 0; i < 6; i++) {
    const x = r() * w;
    const len = h * (0.25 + r() * 0.5);
    const grad = g.createLinearGradient(0, 0, 0, len);
    grad.addColorStop(0, rgba(C.inkSoft, 0.3));
    grad.addColorStop(1, rgba(C.inkSoft, 0));
    g.fillStyle = grad;
    g.fillRect(x, 0, 4 + r() * 10, len);
  }
}

/**
 * Reboco pintado 3 × 3 m: mancha de pintura, rachaduras finas, reboco caído mostrando o
 * tijolo e escorridos. `base` = módulo do térreo (umidade e sujeira subindo do chão).
 */
export function paintPlaster(g: G, w: number, h: number, color: number, seed: number, base: boolean) {
  const r = rng(seed);
  g.fillStyle = hex(color);
  g.fillRect(0, 0, w, h);
  // Demãos diferentes de tinta: manchas grandes um tom acima/abaixo
  for (let i = 0; i < 9; i++) {
    g.fillStyle = rgba(i % 2 ? C.cal : C.inkSoft, i % 2 ? 0.07 : 0.05);
    blob(g, r() * w, r() * h, 30 + r() * 60, 20 + r() * 50, r);
    g.fill();
  }
  g.fillStyle = rgba(C.cal, 0.1);
  for (let i = 0; i < 900; i++) g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
  g.fillStyle = rgba(C.inkSoft, 0.08);
  for (let i = 0; i < 500; i++) g.fillRect(r() * w, r() * h, 1, 1);
  // Reboco caído: tijolo aparente com borda clara de reboco quebrado
  const holes = base ? (r() < 0.5 ? 1 : 0) : r() < 0.25 ? 1 : 0;
  for (let i = 0; i < holes; i++) {
    const cx = 25 + r() * (w - 50);
    const cy = base ? h * (0.55 + r() * 0.3) : 25 + r() * (h - 50);
    const rx = 12 + r() * 18;
    const ry = 8 + r() * 12;
    g.save();
    blob(g, cx, cy, rx, ry, rng(seed * 7 + i));
    g.clip();
    brickCourse(g, cx - rx * 2, cy - ry * 2, rx * 4, ry * 4, 22, 11, r);
    g.restore();
    // Tijolo recuado: sombra da borda do reboco por cima, sem contorno claro de adesivo
    g.fillStyle = rgba(C.inkSoft, 0.3);
    blob(g, cx, cy, rx, ry, rng(seed * 7 + i));
    g.fill();
    g.strokeStyle = rgba(color, 0.9);
    g.lineWidth = 2.5;
    blob(g, cx, cy, rx, ry, rng(seed * 7 + i));
    g.stroke();
    g.strokeStyle = rgba(C.inkSoft, 0.35);
    g.lineWidth = 1.5;
    g.save();
    g.translate(1.5, 2);
    blob(g, cx, cy, rx, ry, rng(seed * 7 + i));
    g.stroke();
    g.restore();
  }
  // Rachadura fina em diagonal (canto de janela)
  g.strokeStyle = rgba(C.inkSoft, 0.4);
  g.lineWidth = 1.2;
  g.beginPath();
  let x = r() * w;
  let y = r() * h * 0.5;
  g.moveTo(x, y);
  for (let i = 0; i < 7; i++) {
    x += (r() - 0.3) * 14;
    y += 6 + r() * 10;
    g.lineTo(x, y);
  }
  g.stroke();
  // Escorridos da laje e dos peitoris
  for (let i = 0; i < 5; i++) {
    const sx = r() * w;
    const len = h * (0.2 + r() * 0.45);
    const top = base ? 0 : r() < 0.5 ? 0 : h * 0.42;
    const grad = g.createLinearGradient(0, top, 0, top + len);
    grad.addColorStop(0, rgba(C.inkSoft, 0.2));
    grad.addColorStop(1, rgba(C.inkSoft, 0));
    g.fillStyle = grad;
    g.fillRect(sx, top, 3 + r() * 9, len);
  }
  if (base) {
    // Barra de umidade: sujeira, limo e respingo de chuva no pé da parede
    const grad = g.createLinearGradient(0, h * 0.62, 0, h);
    grad.addColorStop(0, rgba(C.inkSoft, 0));
    grad.addColorStop(0.55, rgba(C.inkSoft, 0.16));
    grad.addColorStop(1, rgba(C.inkSoft, 0.38));
    g.fillStyle = grad;
    g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = rgba(C.colonialMoss, 0.22);
    g.beginPath();
    g.moveTo(0, h);
    for (let sx = 0; sx <= w; sx += 12) g.lineTo(sx, h * (0.9 + 0.05 * Math.sin(sx * 0.11 + seed)) - r() * 6);
    g.lineTo(w, h);
    g.fill();
    g.fillStyle = rgba(C.bark, 0.3);
    for (let i = 0; i < 160; i++) g.fillRect(r() * w, h * (0.8 + r() * 0.2), 1 + r() * 2, 1 + r() * 2);
  }
}

/** Quadra de cimento pintada e gasta, vista de cima: 1 px = 4 cm (20 × 21 m → 500 × 525). */
export function paintCourt(g: G, w: number, h: number) {
  const r = rng(7711);
  const px = w / 20; // px por metro
  // Moldura de cimento (fora da quadra) e campo pintado
  g.fillStyle = hex(C.clothTeal);
  g.fillRect(0, 0, w, h);
  const field = (x0: number, z0: number, x1: number, z1: number) => [(x0 + 10) * px, (z0 + 7) * px, (x1 - x0) * px, (z1 - z0) * px] as const;
  g.fillStyle = hex(C.colonialMoss);
  g.fillRect(...field(-7, -5, 7, 11));
  // Desgaste: tinta gasta na área do gol e no círculo central (onde mais se pisa)
  for (const [cx, cz, s] of [[0, -3.5, 1.4], [0, 9.5, 1.4], [0, 3, 1.8], [-4, 3, 0.9], [4.5, 0, 0.8], [-3, 7, 0.8]]) {
    for (const [k, a] of [[1, 0.16], [0.6, 0.2]] as const) {
      g.fillStyle = rgba(C.stoneJoint, a);
      blob(g, (cx + 10) * px, (cz + 7) * px, s * k * px * 1.6, s * k * px, r);
      g.fill();
    }
  }
  // Marcas de bola e de tênis
  g.fillStyle = rgba(C.inkSoft, 0.12);
  for (let i = 0; i < 260; i++) g.fillRect(r() * w, r() * h, 2 + r() * 5, 1 + r() * 2);
  // Linhas brancas, falhadas
  g.strokeStyle = hex(C.cal);
  g.lineWidth = 0.1 * px;
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    g.beginPath();
    g.moveTo((x0 + 10) * px, (z0 + 7) * px);
    g.lineTo((x1 + 10) * px, (z1 + 7) * px);
    g.stroke();
  };
  g.strokeRect(...field(-6.95, -4.95, 6.95, 10.95));
  line(-7, 3, 7, 3);
  for (const z of [-5, 11]) {
    const d = z < 0 ? 1 : -1;
    line(-3, z, -3, z + 3 * d);
    line(3, z, 3, z + 3 * d);
    line(-3, z + 3 * d, 3, z + 3 * d);
  }
  g.beginPath();
  g.arc(10 * px, 10 * px, 1.7 * px, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = hex(C.cal);
  g.beginPath();
  g.arc(10 * px, 10 * px, 0.15 * px, 0, Math.PI * 2);
  g.fill();
  // Falhas nas linhas: a tinta branca descascou
  g.fillStyle = hex(C.colonialMoss);
  for (let i = 0; i < 70; i++) {
    const x = (3 + r() * 14) * px;
    const y = (2 + r() * 16) * px;
    g.fillRect(x, y, 2 + r() * 6, 2 + r() * 6);
  }
  // Rachaduras do cimento atravessando a pintura
  g.strokeStyle = rgba(C.ink, 0.4);
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    g.lineWidth = 1.2 + r();
    g.beginPath();
    let x = r() * w;
    let y = r() * h;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (r() - 0.5) * 40;
      y += (r() - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}
