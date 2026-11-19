import { hex, PALETTE as P, toonWith } from '../toon';
import { Builder, place } from '../world/builder';
import { rng } from '../world/shapes';
import { Atlas, fit, planeGeo, type G, type UVRect } from '../world/textures';

/** Atlas opaco único da vila: reboco caiçara com azulejo, esteiras, placas, murais e passarelas. */
export class PatachoArt {
  readonly atlas = new Atlas(2048, false);
  readonly material = toonWith({ map: this.atlas.texture, color: 0xffffff });
  private readonly plasters = new Map<number, UVRect>();
  private readonly signs = new Map<string, UVRect>();
  private readonly crates = new Map<string, UVRect>();
  private readonly walks: UVRect[] = [];
  readonly bamboo: UVRect;
  readonly muralViva: UVRect;
  readonly muralResort: UVRect;

  constructor(readonly b: Builder) {
    // Reserva primeiro as artes mais altas (384 px -> 256 px -> 160 px -> 128 px).
    [P.cal, P.colonialSky, P.colonialRose, P.colonialMoss, P.ochre].forEach((col, i) =>
      this.plaster(col, 401 + i * 17),
    );
    this.bamboo = this.drawBamboo();
    this.muralViva = this.drawMuralViva();
    this.muralResort = this.drawMuralResort();
    for (let i = 0; i < 3; i++) this.walks.push(this.drawBoardwalk(610 + i * 29));
  }

  panel(uv: UVRect, x: number, y: number, z: number, w: number, h: number, rotY = 0, rotX = 0) {
    this.b.add(place(planeGeo(w, h, uv), x, y, z, rotY, rotX), this.material, { cast: false });
  }

  boardwalk(index: number): UVRect {
    return this.walks[Math.abs(index) % this.walks.length];
  }

  plaster(color: number, seed: number): UVRect {
    const cached = this.plasters.get(color);
    if (cached) return cached;
    const uv = this.atlas.draw(256, 384, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = hex(color);
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        g.globalAlpha = 0.05 + r() * 0.08;
        g.fillStyle = hex(i % 2 ? P.cal : P.sand);
        g.fillRect(r() * w - 20, r() * (h - 56), 28 + r() * 64, 8 + r() * 24);
      }
      for (let i = 0; i < 1400; i++) {
        g.globalAlpha = 0.06 + r() * 0.12;
        g.fillStyle = hex(i % 3 ? P.cal : P.cantaria);
        g.fillRect(r() * w, r() * (h - 54), 1 + r() * 2, 1 + r() * 2);
      }
      const topShade = g.createLinearGradient(0, 0, 0, 44);
      topShade.addColorStop(0, 'rgba(90,61,85,0.22)');
      topShade.addColorStop(1, 'rgba(90,61,85,0)');
      g.globalAlpha = 1;
      g.fillStyle = topShade;
      g.fillRect(0, 0, w, 44);

      const damp = g.createLinearGradient(0, h - 110, 0, h - 46);
      damp.addColorStop(0, 'rgba(201,162,116,0)');
      damp.addColorStop(1, 'rgba(201,162,116,0.26)');
      g.fillStyle = damp;
      g.fillRect(0, h - 110, w, 64);

      // Barrado de azulejo artesanal alagoano (renda/losango costeiro)
      const tileTop = h - 48;
      g.fillStyle = hex(P.cal);
      g.fillRect(0, tileTop, w, 48);
      g.fillStyle = hex(P.clothTeal);
      g.fillRect(0, tileTop, w, 4);
      const tileAccent = seed % 2 ? P.clothTeal : P.colonialBlue;
      for (let y = tileTop + 6; y < h - 4; y += 20) {
        for (let x = 0; x < w; x += 20) {
          g.strokeStyle = hex(P.stoneJoint);
          g.lineWidth = 1;
          g.strokeRect(x + 0.5, y + 0.5, 19, 19);
          g.fillStyle = hex(tileAccent);
          g.beginPath();
          g.moveTo(x + 10, y + 3);
          g.lineTo(x + 17, y + 10);
          g.lineTo(x + 10, y + 17);
          g.lineTo(x + 3, y + 10);
          g.closePath();
          g.fill();
          g.fillStyle = hex(P.ochre);
          g.beginPath();
          g.arc(x + 10, y + 10, 2.6, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
    this.plasters.set(color, uv);
    return uv;
  }

  private drawBamboo(): UVRect {
    return this.atlas.draw(256, 384, (g, w, h) => {
      const r = rng(499);
      g.fillStyle = hex(P.cantaria);
      g.fillRect(0, 0, w, h);
      const colW = 16;
      for (let x = 0; x < w; x += colW) {
        g.fillStyle = hex((x / colW) % 2 ? P.sand : P.ochre);
        g.fillRect(x + 1, 0, colW - 2, h);
        g.fillStyle = hex(P.bark);
        g.globalAlpha = 0.45;
        g.fillRect(x, 0, 1.5, h);
        const nodeY = ((x * 37) % 96) + 24;
        for (let y = nodeY; y < h; y += 96) {
          g.globalAlpha = 0.6;
          g.fillRect(x + 1, y, colW - 2, 3);
          g.globalAlpha = 0.35;
          g.fillStyle = hex(P.cal);
          g.fillRect(x + 1, y + 3, colW - 2, 1.5);
          g.fillStyle = hex(P.bark);
        }
      }
      g.globalAlpha = 0.14;
      for (let i = 0; i < 900; i++) {
        g.fillStyle = hex(i % 2 ? P.bark : P.cal);
        g.fillRect(r() * w, r() * h, 1.5, 6 + r() * 14);
      }
      g.globalAlpha = 1;
    });
  }

  private drawMuralViva(): UVRect {
    return this.atlas.draw(512, 256, (g, w, h) => {
      g.fillStyle = hex(P.cal);
      g.fillRect(0, 0, w, h);
      g.fillStyle = hex(P.sun);
      g.beginPath();
      g.arc(w * 0.78, h * 0.42, 54, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hex(P.ochre);
      g.beginPath();
      g.arc(w * 0.78, h * 0.42, 40, 0, Math.PI * 2);
      g.fill();
      for (const [k, col, yBase] of [
        [0, P.seaShallow, 0.62],
        [1, P.seaTurquoise, 0.74],
        [2, P.seaDeep, 0.85],
      ] as const) {
        g.fillStyle = hex(col);
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w; x += 16) {
          g.lineTo(x, h * yBase + Math.sin((x / w) * Math.PI * 4 + k * 1.4) * 11);
        }
        g.lineTo(w, h);
        g.closePath();
        g.fill();
      }
      g.fillStyle = hex(P.cal);
      g.beginPath();
      g.moveTo(w * 0.72, h * 0.66);
      g.lineTo(w * 0.79, h * 0.24);
      g.lineTo(w * 0.88, h * 0.64);
      g.closePath();
      g.fill();
      g.strokeStyle = hex(P.ink);
      g.lineWidth = 4;
      g.stroke();
      g.fillStyle = hex(P.wood);
      g.fillRect(w * 0.69, h * 0.65, 110, 9);

      g.strokeStyle = hex(P.ink);
      g.lineWidth = 8;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      fit(g, 'PRAIA VIVA', 54, w * 0.6);
      g.fillStyle = hex(P.ink);
      g.fillText('PRAIA VIVA', 28, h * 0.3);
      fit(g, 'O MAR NÃO TEM ASSINATURA', 24, w * 0.62);
      g.fillStyle = hex(P.colonialRed);
      g.fillText('O MAR NÃO TEM ASSINATURA', 28, h * 0.52);
    });
  }

  private drawMuralResort(): UVRect {
    return this.atlas.draw(512, 256, (g, w, h) => {
      g.fillStyle = hex(P.inkSoft);
      g.fillRect(0, 0, w, h);
      g.fillStyle = hex(P.seaTurquoise);
      g.fillRect(14, 14, w - 28, 42);
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      fit(g, '◉ OTIMIZA BEACH RESORT', 24, w - 60);
      g.fillStyle = hex(P.ink);
      g.fillText('◉ OTIMIZA BEACH RESORT', 26, 36);

      fit(g, 'PARAÍSO POR ASSINATURA', 38, w * 0.72);
      g.fillStyle = hex(P.paper);
      g.fillText('PARAÍSO POR ASSINATURA', 26, h * 0.44);
      fit(g, 'BRISA PREMIUM • SOL COM HORA MARCADA • IFB +99%', 17, w * 0.74, '700 Xpx Arial');
      g.fillStyle = hex(P.sun);
      g.fillText('BRISA PREMIUM • SOL COM HORA MARCADA • IFB +99%', 26, h * 0.66);

      g.fillStyle = hex(P.ink);
      g.fillRect(26, h * 0.78, w * 0.66, 22);
      g.fillStyle = hex(P.cyan);
      g.fillRect(30, h * 0.78 + 4, w * 0.64, 14);
      const cx = w * 0.87,
        cy = h * 0.62;
      g.fillStyle = hex(P.yellow);
      g.beginPath();
      g.arc(cx, cy, 38, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = hex(P.ink);
      g.lineWidth = 5;
      g.stroke();
      g.beginPath();
      g.arc(cx, cy + 3, 20, 0.2, Math.PI - 0.2);
      g.stroke();
      g.fillStyle = hex(P.ink);
      g.fillRect(cx - 14, cy - 12, 6, 8);
      g.fillRect(cx + 8, cy - 12, 6, 8);
      g.strokeStyle = hex(P.cyan);
      g.lineWidth = 5;
      g.strokeRect(8, 8, w - 16, h - 16);
    });
  }

  private drawBoardwalk(seed: number): UVRect {
    return this.atlas.draw(256, 256, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = hex(P.beachSand);
      g.fillRect(0, 0, w, h);
      g.fillStyle = hex(P.bark);
      g.fillRect(42, 0, 14, h);
      g.fillRect(w - 56, 0, 14, h);
      for (let y = 6; y < h; y += 32) {
        const insetL = 10 + r() * 14;
        const insetR = 10 + r() * 14;
        const pw = w - insetL - insetR;
        g.fillStyle = hex(P.bark);
        g.fillRect(insetL + 2, y + 2, pw, 23);
        g.fillStyle = hex(y % 64 === 6 ? P.wood : P.cantaria);
        g.fillRect(insetL, y, pw, 22);
        g.globalAlpha = 0.28;
        g.fillStyle = hex(P.sand);
        g.fillRect(insetL + 2, y + 2, pw - 4, 4);
        g.globalAlpha = 0.55;
        g.fillStyle = hex(P.bark);
        for (const nx of [49, w - 49]) {
          g.beginPath();
          g.arc(nx, y + 7, 2, 0, Math.PI * 2);
          g.arc(nx, y + 15, 2, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
        if (r() < 0.45) {
          g.globalAlpha = 0.65;
          g.fillStyle = hex(P.beachSand);
          g.beginPath();
          const sx = r() < 0.5 ? insetL : w - insetR;
          g.ellipse(sx, y + 11, 22 + r() * 24, 9, 0, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
        }
      }
    });
  }

  sign(title: string, sub: string, bg: number, fg: number = P.cal, accent: number = P.ochre): UVRect {
    const key = `${title}|${sub}|${bg}|${fg}|${accent}`;
    const cached = this.signs.get(key);
    if (cached) return cached;
    const uv = this.atlas.draw(384, 128, (g, w, h) => {
      const r = rng(title.length * 197 + bg);
      g.fillStyle = hex(bg);
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.14;
      for (let i = 0; i < 180; i++) {
        g.fillStyle = hex(i % 2 ? P.sand : P.bark);
        g.fillRect(r() * w, r() * h, 8 + r() * 28, 1.5);
      }
      g.globalAlpha = 1;
      g.strokeStyle = hex(P.ink);
      g.lineWidth = 6;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.strokeStyle = hex(accent);
      g.lineWidth = 3;
      g.strokeRect(12, 12, w - 24, h - 24);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fit(g, title, 38, w - 44);
      g.fillStyle = hex(P.ink);
      g.fillText(title, w / 2 + 2, h * 0.41 + 2);
      g.fillStyle = hex(fg);
      g.fillText(title, w / 2, h * 0.41);
      fit(g, sub, 16, w - 44, '700 Xpx Arial');
      g.fillStyle = hex(accent === P.cal ? P.ochre : accent);
      g.fillText(sub, w / 2, h * 0.76);
    });
    this.signs.set(key, uv);
    return uv;
  }

  crate(label: string, baseColor: number, stripeColor: number): UVRect {
    const key = `${label}|${baseColor}|${stripeColor}`;
    const cached = this.crates.get(key);
    if (cached) return cached;
    const uv = this.atlas.draw(256, 160, (g: G, w, h) => {
      g.fillStyle = hex(baseColor);
      g.fillRect(0, 0, w, h);
      g.fillStyle = hex(P.bark);
      for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3);
      g.fillStyle = hex(stripeColor);
      g.fillRect(0, h * 0.62, w, 24);
      g.strokeStyle = hex(P.sand);
      g.lineWidth = 8;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fit(g, label, 22, w - 36);
      g.fillStyle = hex(P.ink);
      g.fillText(label, w / 2, h * 0.36);
    });
    this.crates.set(key, uv);
    return uv;
  }

  finish() {
    this.atlas.texture.needsUpdate = true;
    console.info(`Patacho: atlas autoral ${this.atlas.used}`);
  }
}
