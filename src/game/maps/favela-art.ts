import { PALETTE as C, hex, toonWith } from '../toon';
import { Builder, place } from '../world/builder';
import { Atlas, fit, planeGeo, type UVRect } from '../world/textures';
import { paintBirosca } from './favela-life';
import { paintBrickWall, paintCourt, paintPlaster } from './favela-walls';
import { rgba } from '../world/colonial-art';

export const FAVELA_COLORS = [C.ochre, C.colonialSky, C.colonialMoss, C.colonialRose, C.sand, C.terracotta];
/** Arte autoral: tijolos cerâmicos, reboco e placas compartilham atlas próprio. */
export class FavelaArt {
  readonly atlas = new Atlas(2048, false);
  readonly material = toonWith({ color: C.paper, map: this.atlas.texture });
  /** Módulo de reboco 3 × 3 m (andares de cima), um por cor de `FAVELA_COLORS`. */
  readonly walls: UVRect[] = [];
  /** Módulo de reboco do térreo (umidade e sujeira subindo do chão), um por cor. */
  readonly wallsBase: UVRect[] = [];
  /** Segunda versão do módulo de cima: alterna com a primeira (e espelhada) para não repetir. */
  readonly wallsAlt: UVRect[] = [];
  readonly brick: UVRect;
  readonly court: UVRect;
  readonly birosca: UVRect;
  private readonly muralUV: UVRect;
  private signs = new Map<string, UVRect>();

  constructor(private b: Builder) {
    // Artes altas primeiro (armadilha do atlas: prateleiras desperdiçadas).
    // Prateleira 1 (525 px): quadra, mural, tijolo e birosca cabem lado a lado em 2052 px.
    this.court = this.atlas.draw(500, 525, paintCourt);
    this.muralUV = this.atlas.draw(768, 384, paintMural);
    this.brick = this.atlas.draw(384, 384, (g, w, h) => paintBrickWall(g, w, h, 832));
    this.birosca = this.atlas.draw(384, 256, paintBirosca);
    FAVELA_COLORS.forEach((color, index) => {
      this.walls.push(this.atlas.draw(256, 256, (g, w, h) => paintPlaster(g, w, h, color, 222 + index, false)));
      this.wallsBase.push(this.atlas.draw(256, 256, (g, w, h) => paintPlaster(g, w, h, color, 444 + index, true)));
      this.wallsAlt.push(this.atlas.draw(256, 256, (g, w, h) => paintPlaster(g, w, h, color, 666 + index, false)));
    });
  }

  panel(uv: UVRect, x: number, y: number, z: number, w: number, h: number, angle = 0) {
    this.b.add(place(planeGeo(w, h, uv), x, y, z, angle), this.material, { cast: false });
  }

  /**
   * Reboco em módulos de 3 × 3 m a partir de `y0` (pé da parede): o térreo usa o módulo com
   * sujeira se `ground`; a última fiada é recortada na UV (nada estica na vertical).
   */
  plaster(paint: number, x: number, y0: number, z: number, w: number, h: number, angle: number, ground: boolean) {
    const cols = Math.max(1, Math.round(w / 3));
    const tw = w / cols;
    for (let row = 0; row * 3 < h - 0.01; row++) {
      const th = Math.min(3, h - row * 3);
      for (let col = 0; col < cols; col++) {
        // Sorteio fixo pela posição: módulo, versão alternativa e espelhamento variam lado a lado
        const hash = Math.abs(Math.round(x * 7 + z * 13 + col * 31 + row * 17 + y0 * 5));
        const tile = row === 0 && ground ? this.wallsBase[paint] : hash % 3 === 1 ? this.wallsAlt[paint] : this.walls[paint];
        const flip = (hash >> 2) % 2 === 1;
        const uv = { u0: flip ? tile.u1 : tile.u0, u1: flip ? tile.u0 : tile.u1, v0: tile.v0, v1: tile.v0 + (tile.v1 - tile.v0) * (th / 3) };
        const dx = -w / 2 + (col + 0.5) * tw;
        this.panel(uv, x + Math.cos(angle) * dx, y0 + row * 3 + th / 2, z - Math.sin(angle) * dx, tw, th, angle);
      }
    }
  }

  /** Repete o tijolo em módulos de 2,4 m: escala arquitetônica constante, sem esticar. */
  brickPanel(x: number, y: number, z: number, w: number, h: number, angle = 0) {
    const cols = Math.ceil(w / 2.4), rows = Math.ceil(h / 2.4);
    const tw = w / cols, th = h / rows;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const dx = -w / 2 + (col + 0.5) * tw;
      this.panel(this.brick, x + Math.cos(angle) * dx, y - h / 2 + (row + 0.5) * th, z - Math.sin(angle) * dx, tw, th, angle);
    }
  }

  sign(title: string, sub: string, bg: number, fg: number = C.cal) {
    const key = `${title}/${sub}`;
    if (this.signs.has(key)) return this.signs.get(key)!;
    const uv = this.atlas.draw(512, 128, (g, w, h) => {
      g.fillStyle = hex(bg); g.fillRect(0, 0, w, h);
      g.strokeStyle = hex(fg); g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = hex(fg); g.textAlign = 'center'; g.textBaseline = 'middle';
      fit(g, title, 48, w - 30); g.fillText(title, w / 2, h * 0.4);
      fit(g, sub, 22, w - 32); g.fillText(sub, w / 2, h * 0.78);
      // Placa pintada à mão ao sol: cantos descascados e ferrugem do parafuso
      g.fillStyle = rgba(C.ink, 0.16);
      for (let i = 0; i < 4; i++) g.fillRect(i % 2 ? w - 26 : 14, i < 2 ? 14 : h - 22, 8, 8);
      g.fillStyle = rgba(C.paper, 0.12);
      g.fillRect(0, 0, w, h * 0.18);
    });
    this.signs.set(key, uv); return uv;
  }

  mural() {
    return this.muralUV;
  }

  finish() { this.atlas.texture.needsUpdate = true; console.info(`Favela: atlas autoral ${this.atlas.used}`); }
}

function paintMural(g: CanvasRenderingContext2D, w: number, h: number) {
    {
      g.fillStyle = hex(C.colonialSky); g.fillRect(0, 0, w, h);
      g.fillStyle = hex(C.colonialYellow); g.beginPath(); g.arc(w * 0.74, h * 0.37, 110, 0, Math.PI * 2); g.fill();
      const colors = [C.terracotta, C.ochre, C.colonialMoss, C.colonialRose];
      for (let i = 0; i < 12; i++) {
        const y = 145 + Math.sin(i * 0.8) * 70;
        g.fillStyle = hex(colors[i % 4]); g.fillRect(i * 69 - 8, y, 65, h - y);
        g.fillStyle = hex(C.cal); g.fillRect(i * 69 + 8, y + 15, 12, 19);
      }
      g.fillStyle = hex(C.inkSoft); g.globalAlpha = 0.86; g.fillRect(0, h - 110, w, 110); g.globalAlpha = 1;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = hex(C.cal);
      fit(g, 'QUEM FAZ O MORRO É A GENTE', 44, w - 30); g.fillText('QUEM FAZ O MORRO É A GENTE', w / 2, h - 68);
      fit(g, 'FAVELA DO SOL • CULTURA VIVA', 23, w - 30); g.fillText('FAVELA DO SOL • CULTURA VIVA', w / 2, h - 27);
    }
}
