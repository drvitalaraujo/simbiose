import * as THREE from 'three';
import { PALETTE as C, toonWith } from '../toon';
import { rgba } from './colonial-art';
import { Builder, place } from './builder';
import { rng } from './shapes';
import { Atlas, type G, planeGeo, type UVRect } from './textures';

// Desgaste pintado do cenário: sujeira na base das paredes, escorridos, rachaduras, manchas,
// remendos de asfalto, lixo miúdo e poças com reflexo falso de neon. Tudo num atlas
// transparente próprio (os de pichação e neon do bairro estão cheios) e em dois materiais:
// decalque toon (recebe luz e sombra) e poça (sem luz, um pouco acima do bloom nos reflexos).

export interface Grime {
  atlas: Atlas;
  /** Decalque toon transparente: não escreve profundidade (o nanquim não contorna o recorte). */
  mat: THREE.MeshToonMaterial;
  /** Poças: cor própria, sem luz; os riscos de neon passam do limiar do bloom. */
  puddleMat: THREE.MeshBasicMaterial;
  base: UVRect;
  drips: UVRect[];
  cracks: UVRect[];
  stains: UVRect[];
  patch: UVRect;
  litter: UVRect[];
  leaves: UVRect;
  puddles: UVRect[];
  /** Piso de cimento 4 × 4 m: juntas de dilatação, manchas e remendos (sobreposto ao chão). */
  slab: UVRect;
  finish(): void;
}

/** Contorno irregular fechado (mancha, poça, remendo): raio que oscila em volta do centro. */
function blob(g: G, cx: number, cy: number, rx: number, ry: number, r: () => number, wob = 0.28, n = 18) {
  const k = Array.from({ length: 4 }, () => r() * Math.PI * 2);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const f = 1 + wob * (0.55 * Math.sin(a * 2 + k[0]) + 0.3 * Math.sin(a * 3 + k[1]) + 0.15 * Math.sin(a * 5 + k[2]));
    const x = cx + Math.cos(a) * rx * f;
    const y = cy + Math.sin(a) * ry * f;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Rachadura: traço principal quebrado com galhos finos. */
function crack(g: G, x: number, y: number, len: number, angle: number, width: number, r: () => number, depth = 0) {
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(x, y);
  let a = angle;
  const steps = 6 + Math.floor(r() * 4);
  for (let i = 0; i < steps; i++) {
    a += (r() - 0.5) * 0.9;
    x += Math.cos(a) * (len / steps);
    y += Math.sin(a) * (len / steps);
    g.lineTo(x, y);
    if (depth < 2 && r() < 0.28) {
      g.stroke();
      crack(g, x, y, len * 0.4, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), width * 0.6, r, depth + 1);
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x, y);
    }
  }
  g.stroke();
}

let shared: Grime | null = null;
let quality = 0;

/** Atlas determinístico compartilhado: trocar de mapa não refaz texturas e materiais. */
export function createGrime(): Grime {
  return shared ??= buildGrime();
}

/** Bairro e Favela também retiram as camadas transparentes nos níveis econômicos. */
export function setStreetGrimeQuality(level: number): void {
  quality = level;
  if (shared) shared.mat.visible = shared.puddleMat.visible = level < 2;
}

function buildGrime(): Grime {
  const atlas = new Atlas(1536, true);
  const r = rng(5150);
  const slab = atlas.draw(256, 256, (g, w, h) => {
    // Manchas largas de umidade e de sol: o cimento nunca é de uma cor só
    for (let i = 0; i < 7; i++) {
      g.fillStyle = rgba(i % 3 ? C.inkSoft : C.cal, i % 3 ? 0.07 : 0.06);
      blob(g, r() * w, r() * h, 30 + r() * 50, 25 + r() * 45, r, 0.4);
      g.fill();
    }
    g.fillStyle = rgba(C.inkSoft, 0.12);
    for (let i = 0; i < 700; i++) g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    // Juntas a cada 2 m, com a borda de cima clara (luz) e a de baixo escura
    for (const p of [0, h / 2]) {
      g.fillStyle = rgba(C.ink, 0.32);
      g.fillRect(0, p, w, 3);
      g.fillRect(p, 0, 3, h);
      g.fillStyle = rgba(C.cal, 0.12);
      g.fillRect(0, p + 3, w, 2);
      g.fillRect(p + 3, 0, 2, h);
    }
    // Remendo de massa nova num dos quadros e uma rachadura fina
    g.fillStyle = rgba(C.cal, 0.1);
    blob(g, w * 0.72, h * 0.28, 26, 20, r, 0.2, 8);
    g.fill();
    g.strokeStyle = rgba(C.ink, 0.35);
    g.lineCap = 'round';
    crack(g, w * 0.08, h * 0.78, w * 0.36, -0.3, 1.4, r);
  });
  // Base das paredes: faixa que escurece até o chão, com respingo de chuva e borda irregular.
  const base = atlas.draw(512, 128, (g, w, h) => {
    for (const [top, a] of [[0.15, 0.1], [0.45, 0.14], [0.72, 0.2]] as const) {
      g.fillStyle = rgba(C.inkSoft, a);
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, h * top + Math.sin(x * 0.05 + top * 9) * 6 + r() * 7);
      g.lineTo(w, h);
      g.fill();
    }
    g.fillStyle = rgba(C.bark, 0.28);
    for (let i = 0; i < 260; i++) g.fillRect(r() * w, h * (0.55 + r() * 0.45), 1 + r() * 3, 1 + r() * 2);
    // Escorrido curto que sobe da base (umidade) em alguns pontos
    for (let i = 0; i < 9; i++) {
      const x = r() * w;
      g.fillStyle = rgba(C.inkSoft, 0.12);
      g.fillRect(x, h * (0.05 + r() * 0.3), 3 + r() * 6, h);
    }
  });
  // Escorridos: começam fortes sob peitoril/laje e somem para baixo.
  const drips = [0, 1].map(() => atlas.draw(128, 256, (g, w, h) => {
    for (let i = 0; i < 7; i++) {
      const x = 8 + r() * (w - 20);
      const len = h * (0.35 + r() * 0.65);
      const sw = 3 + r() * 10;
      const grad = g.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, rgba(i % 3 ? C.inkSoft : C.bark, 0.34));
      grad.addColorStop(0.6, rgba(C.inkSoft, 0.14));
      grad.addColorStop(1, rgba(C.inkSoft, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + sw, 0);
      g.lineTo(x + sw * 0.6, len);
      g.lineTo(x + sw * 0.3, len);
      g.fill();
    }
    g.fillStyle = rgba(C.inkSoft, 0.3);
    g.fillRect(0, 0, w, 5);
  }));
  const cracks = [0, 1].map(() => atlas.draw(256, 256, (g, w, h) => {
    g.strokeStyle = rgba(C.ink, 0.62);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    crack(g, w * 0.1, h * (0.3 + r() * 0.4), w * 0.85, (r() - 0.5) * 0.6, 2.6, r);
    crack(g, w * (0.3 + r() * 0.4), h * 0.08, h * 0.7, Math.PI / 2 + (r() - 0.5) * 0.5, 1.8, r);
  }));
  // Manchas de óleo/umidade em três patamares (luz "cel", sem borrão contínuo).
  const stains = [0, 1, 2].map((k) => atlas.draw(256, 256, (g, w, h) => {
    const color = k === 2 ? C.bark : C.ink;
    for (const [s, a] of [[1, 0.12], [0.72, 0.16], [0.42, 0.2]] as const) {
      g.fillStyle = rgba(color, a);
      blob(g, w / 2 + (r() - 0.5) * 20, h / 2 + (r() - 0.5) * 20, w * 0.42 * s, h * 0.34 * s, r, 0.35);
      g.fill();
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle = rgba(color, 0.18);
      blob(g, r() * w, r() * h, 8 + r() * 14, 6 + r() * 10, r);
      g.fill();
    }
  }));
  // Remendo de asfalto: tampa mais escura com borda selada.
  const patch = atlas.draw(256, 256, (g, w, h) => {
    g.fillStyle = rgba(C.ink, 0.3);
    blob(g, w / 2, h / 2, w * 0.44, h * 0.4, r, 0.12, 8);
    g.fill();
    g.strokeStyle = rgba(C.ink, 0.45);
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = rgba(C.concrete, 0.1);
    for (let i = 0; i < 160; i++) g.fillRect(w * 0.15 + r() * w * 0.7, h * 0.15 + r() * h * 0.7, 2, 2);
  });
  // Lixo miúdo: papel, latinha, tampinha, panfleto, bituca.
  const litter = [0, 1].map((k) => atlas.draw(256, 256, (g, w, h) => {
    const colors = k ? [C.paper, C.yellow, C.pink, C.cyan, C.orange] : [C.cal, C.ochre, C.colonialRed, C.leafLight, C.cal];
    for (let i = 0; i < 14; i++) {
      const x = 20 + r() * (w - 40);
      const y = 20 + r() * (h - 40);
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI);
      const roll = r();
      g.fillStyle = rgba(colors[i % colors.length], 1);
      if (roll < 0.4) {
        // Papel amassado: polígono claro com vinco
        blob(g, 0, 0, 10 + r() * 10, 7 + r() * 8, r, 0.4, 7);
        g.fill();
        g.strokeStyle = rgba(C.inkSoft, 0.45);
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(-6, -3); g.lineTo(5, 4); g.stroke();
      } else if (roll < 0.65) {
        // Latinha amassada
        g.fillRect(-9, -4, 18, 8);
        g.fillStyle = rgba(C.steelLight, 1);
        g.fillRect(-9, -4, 3, 8);
        g.fillStyle = rgba(C.paper, 0.6);
        g.fillRect(-4, -3, 9, 2);
      } else if (roll < 0.85) {
        // Panfleto
        g.fillRect(-12, -8, 24, 16);
        g.fillStyle = rgba(C.ink, 0.7);
        g.fillRect(-9, -5, 18, 3);
        g.fillRect(-9, 1, 12, 2);
      } else {
        // Tampinha e bituca
        g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill();
        g.fillStyle = rgba(C.cal, 1);
        g.fillRect(8, -1.5, 9, 3);
        g.fillStyle = rgba(C.orange, 1);
        g.fillRect(14, -1.5, 3, 3);
      }
      g.restore();
    }
  }));
  // Folhas secas e mato rasteiro nos cantos (Favela).
  const leaves = atlas.draw(256, 128, (g, w, h) => {
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const y = h * (0.3 + r() * 0.7);
      g.fillStyle = rgba([C.leaf, C.leafLight, C.ochre, C.bark, C.colonialMoss][i % 5], 0.95);
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI);
      g.beginPath();
      g.ellipse(0, 0, 6 + r() * 5, 2.5 + r() * 2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
  // Poças: fundo escuro espelhando o céu e riscos verticais de neon (reflexo esticado).
  const neon: [number, number][] = [[C.pink, C.cyan], [C.cyan, C.yellow], [C.yellow, C.pink]];
  const puddles = neon.map(([a, b2]) => atlas.draw(256, 192, (g, w, h) => {
    g.save();
    blob(g, w / 2, h / 2, w * 0.45, h * 0.4, r, 0.3, 22);
    g.clip();
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, rgba(C.skyDeep, 0.85));
    sky.addColorStop(1, rgba(C.dusk, 0.8));
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      const x = 20 + r() * (w - 40);
      const sw = 6 + r() * 16;
      const c = i % 3 === 2 ? C.paper : i % 2 ? b2 : a;
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, rgba(c, 0));
      grad.addColorStop(0.35, rgba(c, 0.85));
      grad.addColorStop(0.65, rgba(c, 0.85));
      grad.addColorStop(1, rgba(c, 0));
      g.fillStyle = grad;
      g.fillRect(x, 0, sw, h);
      // Ondulação: linhas horizontais cortando o reflexo
      g.fillStyle = rgba(C.skyDeep, 0.5);
      for (let y = 10; y < h; y += 9 + r() * 10) g.fillRect(x - 2, y, sw + 4, 2);
    }
    g.restore();
    g.strokeStyle = rgba(C.ink, 0.5);
    g.lineWidth = 3;
    blob(g, w / 2, h / 2, w * 0.45, h * 0.4, rng(1), 0, 22);
  }));
  const mat = toonWith({ color: C.paper, transparent: true, alphaTest: 0.02, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const puddleMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(C.paper).multiplyScalar(1.35), transparent: true, depthWrite: false, fog: true,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  mat.visible = puddleMat.visible = quality < 2;
  return {
    atlas, mat, puddleMat, base, drips, cracks, stains, patch, litter, leaves, puddles, slab,
    finish() {
      mat.map = atlas.texture;
      puddleMat.map = atlas.texture;
      mat.needsUpdate = puddleMat.needsUpdate = true;
      atlas.texture.needsUpdate = true;
      console.info(`desgaste: atlas ${atlas.used}`);
    },
  };
}

/** Decalque no chão: centro (x, z), altura do piso y, tamanho w × d, giro em Y. */
export function floorDecal(b: Builder, mat: THREE.Material, uv: UVRect, x: number, y: number, z: number, w: number, d: number, rot = 0) {
  const geo = planeGeo(w, d, uv);
  geo.rotateX(-Math.PI / 2);
  b.add(place(geo, x, y + 0.03, z, rot), mat, { cast: false });
}

/** Decalque vertical (parede): mesmo sistema de `place` (ângulo 0 = de frente para +z). */
export function wallDecal(b: Builder, mat: THREE.Material, uv: UVRect, x: number, y: number, z: number, w: number, h: number, angle = 0) {
  b.add(place(planeGeo(w, h, uv), x, y, z, angle), mat, { cast: false });
}

/**
 * Faixa de sujeira na base de uma parede, em módulos de ~3 m (sem esticar o respingo).
 * (x, z) é o centro da face, `angle` a direção para onde ela olha, `w` a largura.
 */
export function baseGrime(b: Builder, k: Grime, x: number, y: number, z: number, w: number, angle: number, h = 1.1, off = 0.035) {
  const n = Math.max(1, Math.round(w / 3));
  const tw = w / n;
  const nx = Math.sin(angle);
  const nz = Math.cos(angle);
  for (let i = 0; i < n; i++) {
    const t = -w / 2 + (i + 0.5) * tw;
    wallDecal(b, k.mat, k.base, x + Math.cos(angle) * t + nx * off, y + h / 2, z - Math.sin(angle) * t + nz * off, tw + 0.02, h, angle);
  }
}
