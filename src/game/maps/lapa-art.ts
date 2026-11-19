import { PALETTE as C, hex, toonWith } from '../toon';
import { Builder, place } from '../world/builder';
import { Atlas, fit, planeGeo, type G, type UVRect } from '../world/textures';
import { rng } from '../world/shapes';

// Um atlas exclusivo, opaco: reboco, azulejos, comércio e cartazes compartilham
// material, sem transparência nem passe emissivo. Tudo é desenhado aqui.
export class LapaArt {
  readonly atlas = new Atlas(2048, false);
  readonly material = toonWith({ map: this.atlas.texture, color: C.paper });
  private readonly signs = new Map<string, UVRect>();
  private readonly plasters = new Map<number, UVRect>();
  private readonly shutters = new Map<number, UVRect>();

  constructor(readonly b: Builder) {
    // Reserva primeiro as artes altas: alternar reboco e letreiro desperdiça
    // a altura de cada prateleira do atlas (chegava a 91% com os mesmos pixels).
    [C.ochre, C.colonialMoss, C.colonialRose, C.sand, C.colonialSky, C.terracotta]
      .forEach((color, i) => this.plaster(color, 21 + i));
    for (let i = 0; i < 3; i++) this.shutter(i);
  }

  panel(uv: UVRect, x: number, y: number, z: number, w: number, h: number, n = 1) {
    this.b.add(place(planeGeo(w, h, uv), x, y, z, n === 1 ? 0 : Math.PI), this.material, { cast: false });
  }

  sign(title: string, sub: string, bg: number, fg: number = C.cal) {
    const key = `${title}/${sub}/${bg}/${fg}`;
    let uv = this.signs.get(key);
    if (uv) return uv;
    uv = this.atlas.draw(384, 96, (g, w, h) => {
      g.fillStyle = hex(bg); g.fillRect(0, 0, w, h);
      g.strokeStyle = hex(fg); g.lineWidth = 2; g.strokeRect(7, 7, w - 14, h - 14);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = hex(fg);
      fit(g, title, 35, w - 30); g.fillText(title, w / 2, h * 0.39);
      fit(g, sub, 15, w - 25, '700 Xpx Arial'); g.fillText(sub, w / 2, h * 0.77);
      const r = rng(title.length * 311);
      g.globalAlpha = 0.16; g.fillStyle = hex(C.sand);
      for (let i = 0; i < 170; i++) g.fillRect(r() * w, r() * h, 1 + r() * 4, 1);
    });
    this.signs.set(key, uv);
    return uv;
  }

  plaster(color: number, seed: number) {
    const cached = this.plasters.get(color);
    if (cached) return cached;
    const uv = this.atlas.draw(256, 384, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = hex(color); g.fillRect(0, 0, w, h);
      // Poros, escorridos sob a cornija e reparos concentrados no rodapé.
      g.fillStyle = hex(C.cantaria); g.globalAlpha = 0.24;
      for (let i = 0; i < 1600; i++) g.fillRect(r() * w, r() * h, 0.5 + r() * 2, 1 + r() * 2);
      g.globalAlpha = 0.15; g.fillStyle = hex(C.steel);
      for (let i = 0; i < 32; i++) g.fillRect(r() * w, 0, 1 + r() * 3, 12 + r() * 70);
      g.globalAlpha = 0.6;
      for (let i = 0; i < 18; i++) {
        const x = r() * w, y = h - r() * 68;
        g.fillStyle = hex(i % 3 ? C.cantaria : C.cal);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y - 9); g.lineTo(x + 18, y - 5);
        g.lineTo(x + 22, y + 13); g.lineTo(x + 4, y + 18); g.fill();
      }
      g.globalAlpha = 1;
      // Barrado de azulejos com losangos, sempre abaixo das aberturas altas.
      for (let y = h - 42; y < h; y += 14) for (let x = 0; x < w; x += 14) {
        g.fillStyle = hex(C.cal); g.fillRect(x, y, 13, 13);
        g.fillStyle = hex(seed % 2 ? C.clothTeal : C.glass);
        g.beginPath(); g.moveTo(x + 7, y + 2); g.lineTo(x + 12, y + 7);
        g.lineTo(x + 7, y + 12); g.lineTo(x + 2, y + 7); g.fill();
      }
    });
    this.plasters.set(color, uv);
    return uv;
  }

  shutter(seed: number) {
    seed %= 3;
    const cached = this.shutters.get(seed);
    if (cached) return cached;
    const uv = this.atlas.draw(128, 192, (g, w, h) => {
      g.fillStyle = hex(seed % 2 ? C.steel : C.bark); g.fillRect(0, 0, w, h);
      g.fillStyle = hex(C.inkSoft);
      for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 2);
      g.fillStyle = hex(C.steelLight); g.fillRect(w / 2 - 7, h - 18, 14, 3);
      if (seed % 3 === 0) {
        g.save(); g.translate(w / 2, h * 0.55); g.rotate(-0.12);
        g.textAlign = 'center'; g.fillStyle = hex(C.cal);
        fit(g, 'A RUA É NOSSA', 18, w - 12); g.fillText('A RUA É NOSSA', 0, 0); g.restore();
      }
    });
    this.shutters.set(seed, uv);
    return uv;
  }

  mural(paint: (g: G, w: number, h: number) => void) { return this.atlas.draw(512, 256, paint); }

  finish() {
    this.atlas.texture.needsUpdate = true;
    console.info(`Lapa: atlas autoral ${this.atlas.used}`);
  }
}
