import * as THREE from 'three';
import { hex, PALETTE } from '../toon';
import { rng } from './shapes';

// Texturas desenhadas em canvas: fachadas com janelas, telões, letreiros e pichações.

export type G = CanvasRenderingContext2D;

export function canvas(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function texture(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------- fachadas

/** Uma repetição da textura cobre FACADE_W x FACADE_H metros (8 x 8 janelas). */
export const FACADE_W = 16;
export const FACADE_H = 24;
/** UV de um ponto de parede lisa (para tetos e pisos dos prédios). */
export const WALL_UV = 3 / 1024;

/** Fachada de concreto com janelas (cor) + janelas acesas (emissiva). Branca: o prédio tinge. */
export function facadeTextures(): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const S = 1024;
  const cell = S / 8;
  const [c, g] = canvas(S, S);
  const [e, ge] = canvas(S, S);
  const r = rng(7);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  // Poros e reparos no concreto ficam sob as janelas; o tint do prédio continua valendo.
  g.fillStyle = hex(PALETTE.concreteDark);
  g.globalAlpha = 0.075;
  for (let i = 0; i < 9000; i++) g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  g.globalAlpha = 1;
  ge.fillStyle = '#000000';
  ge.fillRect(0, 0, S, S);
  const lit = [PALETTE.yellow, PALETTE.orange, PALETTE.pink, PALETTE.cyan, PALETTE.yellow, PALETTE.sun];
  for (let row = 0; row < 8; row++) {
    // Faixa de laje entre andares (concreto aparente)
    g.fillStyle = hex(PALETTE.concrete);
    g.fillRect(0, row * cell + cell - 10, S, 10);
    for (let col = 0; col < 8; col++) {
      const x = col * cell + 22;
      const y = row * cell + 22;
      const w = cell - 44;
      const h = cell - 50;
      g.fillStyle = hex(PALETTE.ink);
      g.fillRect(x - 5, y - 5, w + 10, h + 10);
      g.fillStyle = hex(PALETTE.glass);
      g.fillRect(x, y, w, h);
      const runoff = g.createLinearGradient(0, y + h, 0, y + h + 32);
      runoff.addColorStop(0, hex(PALETTE.concreteDark));
      runoff.addColorStop(1, 'transparent');
      g.fillStyle = runoff;
      g.globalAlpha = 0.18;
      g.fillRect(x - 3, y + h + 4, w + 6, 30);
      g.globalAlpha = 1;
      // Reflexo diagonal de anime
      g.fillStyle = 'rgba(244,236,255,0.35)';
      g.beginPath();
      g.moveTo(x + w * 0.15, y + h);
      g.lineTo(x + w * 0.45, y);
      g.lineTo(x + w * 0.6, y);
      g.lineTo(x + w * 0.3, y + h);
      g.fill();
      // Caixilho no meio
      g.fillStyle = hex(PALETTE.ink);
      g.fillRect(x + w / 2 - 2, y, 4, h);
      const roll = r();
      if (roll < 0.28) {
        // Janela acesa
        ge.fillStyle = hex(lit[Math.floor(r() * lit.length)]);
        ge.fillRect(x, y, w, h);
        ge.fillStyle = '#000000';
        ge.fillRect(x + w / 2 - 2, y, 4, h);
      } else if (roll < 0.42) {
        // Ar-condicionado pendurado
        g.fillStyle = hex(PALETTE.paper);
        g.fillRect(x + w - 36, y + h - 8, 34, 22);
        g.strokeStyle = hex(PALETTE.ink);
        g.lineWidth = 3;
        g.strokeRect(x + w - 36, y + h - 8, 34, 22);
      } else if (roll < 0.52) {
        // Varal / cortina
        g.fillStyle = hex([PALETTE.pink, PALETTE.yellow, PALETTE.cyan][Math.floor(r() * 3)]);
        g.fillRect(x, y, w / 2 - 2, h);
      }
    }
  }
  return { map: texture(c, true), emissive: texture(e, true) };
}

// ---------------------------------------------------------------- atlas

export interface UVRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** Várias artes num canvas só: um material e um draw call para todos os letreiros. */
export class Atlas {
  readonly canvas: HTMLCanvasElement;
  private readonly g: G;
  private x = 0;
  private y = 0;
  private rowH = 0;
  private tex: THREE.CanvasTexture | null = null;

  /** Largura com folga para 2 artes de 1024 (+ margem de 2 px) lado a lado. */
  readonly width: number;

  constructor(readonly size: number, transparent: boolean) {
    this.width = size + 4;
    [this.canvas, this.g] = canvas(this.width, size);
    if (!transparent) {
      this.g.fillStyle = hex(PALETTE.ink);
      this.g.fillRect(0, 0, this.width, size);
    }
  }

  draw(w: number, h: number, paint: (g: G, w: number, h: number) => void): UVRect {
    if (this.x + w > this.width) {
      this.x = 0;
      this.y += this.rowH + 2;
      this.rowH = 0;
    }
    if (this.y + h > this.size) throw new Error('bairro: atlas cheio');
    const { g } = this;
    g.save();
    g.translate(this.x, this.y);
    g.beginPath();
    g.rect(0, 0, w, h);
    g.clip();
    paint(g, w, h);
    g.restore();
    const S = this.size;
    const W = this.width;
    // Meio texel para dentro: evita vazar a arte vizinha
    const rect = { u0: (this.x + 0.5) / W, u1: (this.x + w - 0.5) / W, v1: 1 - (this.y + 0.5) / S, v0: 1 - (this.y + h - 0.5) / S };
    this.x += w + 2;
    this.rowH = Math.max(this.rowH, h);
    return rect;
  }

  /** Ocupação do atlas ("64%"), para conferir antes de estourar. */
  get used(): string {
    return `${Math.round(((this.y + this.rowH) / this.size) * 100)}%`;
  }

  get texture(): THREE.CanvasTexture {
    this.tex ??= texture(this.canvas);
    return this.tex;
  }
}

/** Plano (de frente para +z) com a UV apontando para um pedaço do atlas. */
export function planeGeo(w: number, h: number, uv: UVRect): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) {
    a.setXY(i, a.getX(i) < 0.5 ? uv.u0 : uv.u1, a.getY(i) < 0.5 ? uv.v0 : uv.v1);
  }
  return g;
}

// ---------------------------------------------------------------- pintores

const FONT_BLACK = "900 Xpx 'Arial Black', Impact, sans-serif";
export const font = (px: number, f = FONT_BLACK) => f.replace('X', String(Math.round(px)));

/** Encolhe a fonte até o texto caber na largura. */
export function fit(g: G, text: string, px: number, maxW: number, f = FONT_BLACK) {
  let size = px;
  g.font = font(size, f);
  while (g.measureText(text).width > maxW && size > 8) {
    size -= 2;
    g.font = font(size, f);
  }
  return size;
}

export interface TelaoSpec {
  title: string;
  sub: string;
  bg: number;
  fg: number;
  accent?: number;
  /** Desenho extra (gráfico, carinha...). */
  extra?: 'graph' | 'smile' | 'bar';
}

/** Telão corporativo da OTIMIZA: moldura, linhas de varredura e logo. */
export function paintTelao(g: G, w: number, h: number, s: TelaoSpec) {
  g.fillStyle = hex(s.bg);
  g.fillRect(0, 0, w, h);
  const acc = hex(s.accent ?? PALETTE.paper);
  if (s.extra === 'graph') {
    g.strokeStyle = acc;
    g.lineWidth = 10;
    g.beginPath();
    const pts = [0.9, 0.82, 0.86, 0.7, 0.62, 0.55, 0.4, 0.3, 0.18];
    pts.forEach((p, i) => {
      const x = w * 0.62 + (i / (pts.length - 1)) * w * 0.33;
      const y = h * p * 0.7 + h * 0.05;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
  }
  if (s.extra === 'smile') {
    const cx = w * 0.82;
    const cy = h * 0.45;
    const R = h * 0.3;
    g.fillStyle = hex(PALETTE.yellow);
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = hex(PALETTE.ink);
    g.lineWidth = R * 0.12;
    g.lineCap = 'round';
    g.beginPath(); g.arc(cx - R * 0.35, cy - R * 0.15, R * 0.15, Math.PI, 0); g.stroke();
    g.beginPath(); g.arc(cx + R * 0.35, cy - R * 0.15, R * 0.15, Math.PI, 0); g.stroke();
    g.beginPath(); g.arc(cx, cy + R * 0.05, R * 0.55, 0.25, Math.PI - 0.25); g.stroke();
  }
  if (s.extra === 'bar') {
    g.fillStyle = hex(PALETTE.ink);
    g.fillRect(w * 0.08, h * 0.62, w * 0.84, h * 0.12);
    g.fillStyle = acc;
    g.fillRect(w * 0.09, h * 0.635, w * 0.82 * 0.97, h * 0.09);
  }
  const textW = s.extra === 'graph' || s.extra === 'smile' ? w * 0.58 : w * 0.9;
  const textX = s.extra === 'graph' || s.extra === 'smile' ? w * 0.33 : w / 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = fit(g, s.title, h * 0.36, textW);
  g.lineJoin = 'round';
  g.lineWidth = size * 0.14;
  g.strokeStyle = hex(PALETTE.ink);
  g.fillStyle = hex(s.fg);
  const ty = s.extra === 'bar' ? h * 0.36 : h * 0.44;
  g.strokeText(s.title, textX, ty);
  g.fillText(s.title, textX, ty);
  fit(g, s.sub, h * 0.11, textW, "700 Xpx Arial, sans-serif");
  g.fillStyle = hex(PALETTE.paper);
  g.fillText(s.sub, textX, s.extra === 'bar' ? h * 0.86 : h * 0.8);
  // Logo da OTIMIZA no canto
  g.font = font(h * 0.07);
  g.textAlign = 'left';
  g.fillStyle = hex(PALETTE.paper);
  g.fillText('◉ OTIMIZA', w * 0.03, h * 0.09);
  // Linhas de varredura (tela)
  g.fillStyle = 'rgba(26,16,38,0.16)';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2);
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = h * 0.05;
  g.strokeRect(0, 0, w, h);
}

/** Textura própria para cada telão (são o destaque: resolução alta). */
export function telaoTexture(spec: TelaoSpec, w = 1024, h = 384): THREE.CanvasTexture {
  const [c, g] = canvas(w, h);
  paintTelao(g, w, h, spec);
  return texture(c);
}

/** Letreiro de neon (horizontal ou vertical, letra por letra). */
export function paintNeon(g: G, w: number, h: number, text: string, color: number, vertical: boolean) {
  g.fillStyle = hex(PALETTE.ink);
  g.fillRect(0, 0, w, h);
  g.strokeStyle = hex(color);
  g.lineWidth = Math.min(w, h) * 0.05;
  g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = hex(color);
  g.shadowBlur = Math.min(w, h) * 0.12;
  g.fillStyle = hex(PALETTE.paper);
  if (vertical) {
    const n = text.length;
    const step = (h * 0.88) / n;
    g.font = font(Math.min(step * 0.85, w * 0.7));
    for (let i = 0; i < n; i++) g.fillText(text[i], w / 2, h * 0.06 + step * (i + 0.5));
  } else {
    fit(g, text, h * 0.62, w * 0.88);
    g.fillText(text, w / 2, h / 2);
  }
  g.shadowBlur = 0;
}

/** Letreiro pintado de loja (fundo colorido, letra de pintor). */
export function paintShopSign(g: G, w: number, h: number, text: string, bg: number, fg: number) {
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, w, h);
  g.fillStyle = hex(PALETTE.ink);
  g.fillRect(0, h - h * 0.1, w, h * 0.1);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fit(g, text, h * 0.6, w * 0.9);
  g.fillStyle = hex(fg);
  g.fillText(text, w / 2, h * 0.46);
}

/** Porta de aço de enrolar, com pichação por cima. */
export function paintShutter(g: G, w: number, h: number, seed: number) {
  const r = rng(seed);
  g.fillStyle = hex(PALETTE.concrete);
  g.fillRect(0, 0, w, h);
  g.fillStyle = hex(PALETTE.concreteDark);
  for (let y = 0; y < h; y += 10) g.fillRect(0, y, w, 4);
  g.fillStyle = hex(PALETTE.concreteDark);
  g.fillRect(0, h - 14, w, 14);
  for (let i = 0; i < 3; i++) {
    const tags = ['DESPLUGA', 'VILA', 'NÃO SORRIA', 'KAIA', 'OFFLINE', 'ZÉ', 'Ñ AO IFB'];
    const t = tags[Math.floor(r() * tags.length)];
    pixo(g, t, w * (0.15 + r() * 0.7), h * (0.25 + r() * 0.5), h * (0.18 + r() * 0.12), r() < 0.7 ? PALETTE.ink : PALETTE.wine);
  }
}

/** Pixo paulistano: letras altas, finas e retas. */
export function pixo(g: G, text: string, x: number, y: number, px: number, color: number) {
  g.save();
  g.translate(x, y);
  g.scale(0.55, 1.7);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${Math.round(px)}px Impact, 'Arial Narrow', sans-serif`;
  g.fillStyle = hex(color);
  g.fillText(text, 0, 0);
  g.restore();
}

export { paintGraffiti, type GraffitiStyle } from './graffiti';
