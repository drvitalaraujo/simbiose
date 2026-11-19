import * as THREE from 'three';
import { PALETTE as C, toon } from '../toon';
import { Builder, place } from '../world/builder';
import { box, rng } from '../world/shapes';
import { clearOfBody } from './facades';
import { FAVELA_HOUSES } from './favela';
import type { MapData } from './types';

// Lajes e janelas da Favela do Sol: a casa que cresce por etapas. Ferros de espera nas quinas,
// caixas d'água de fibra, antenas, tijolos para o próximo andar, vasos no peitoril, grades e
// ar-condicionado. Tudo decorativo: só entra o que fica fora do alcance do corpo (`clearOfBody`)
// ou rente à parede (até 0,12 m).

const deco = { solid: false, shoot: false, cast: false, outline: 0 };
const castDeco = { ...deco, cast: true };

/** Janela registrada pela fachada: centro da base, normal e se está numa face lateral (eixo x). */
export interface FavelaWindow {
  x: number;
  y: number;
  z: number;
  n: number;
  side: boolean;
  seed: number;
}

/** Ponto da laje livre: nenhuma outra casa ocupa o ponto acima de `top`. */
function freeAt(x: number, z: number, top: number, self: number) {
  return !FAVELA_HOUSES.some((h, i) => {
    if (i === self) return false;
    const b = h.solid.box;
    return x > b.min.x - 0.3 && x < b.max.x + 0.3 && z > b.min.z - 0.3 && z < b.max.z + 0.3 && b.max.y > top + 0.01;
  });
}

export function favelaRoofs(b: Builder, map: MapData) {
  const r = rng(9090);
  const safeBlock = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, opts = deco) => {
    if (clearOfBody(map, box(x0, y0, z0, x1, y1, z1))) b.block(x0, y0, z0, x1, y1, z1, color, opts);
  };
  const safeAdd = (geo: THREE.BufferGeometry, color: number, cast = false) => {
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    if (clearOfBody(map, box(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z))) b.add(geo, toon(color), { cast });
    else geo.dispose();
  };
  FAVELA_HOUSES.forEach((home, index) => {
    const { min: p, max: q } = home.solid.box;
    const top = q.y;
    // Ferro de espera nas quinas livres: a laje ainda vai ganhar outro andar
    for (const [x, z] of [[p.x + 0.2, p.z + 0.2], [q.x - 0.2, p.z + 0.2], [p.x + 0.2, q.z - 0.2], [q.x - 0.2, q.z - 0.2]]) {
      if (!freeAt(x, z, top, index) || r() < 0.35) continue;
      safeBlock(x - 0.13, top, z - 0.13, x + 0.13, top + 0.32, z + 0.13, C.stoneJoint, castDeco);
      for (const [dx, dz] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) {
        const h = 0.7 + r() * 0.7;
        const bar = new THREE.BoxGeometry(0.025, h, 0.025);
        bar.translate(0, h / 2, 0);
        safeAdd(place(bar, x + dx, top + 0.3, z + dz, 0, (r() - 0.5) * 0.25, (r() - 0.5) * 0.25), C.bark);
      }
    }
    const w = q.x - p.x;
    const d = q.z - p.z;
    // Pilha de tijolos e saco de cimento esperando a obra
    if (index % 3 === 0) {
      const x = p.x + 0.8 + r() * (w - 2.4);
      const z = p.z + 0.8 + r() * (d - 2);
      if (freeAt(x, z, top, index) && freeAt(x + 1, z + 0.6, top, index)) {
        for (let k = 0; k < 3; k++) safeBlock(x, top + k * 0.2, z, x + 0.9 - k * 0.1, top + k * 0.2 + 0.19, z + 0.55, k % 2 ? C.telha : C.terracotta, castDeco);
        safeBlock(x + 1, top, z, x + 1.5, top + 0.22, z + 0.35, C.cal, castDeco);
      }
    }
    // Caixa d'água de fibra azul (redonda, com tampa) nas lajes sem pavimento em cima
    if (p.y === 0 && index % 2 === 1) {
      const x = q.x - 1.1;
      const z = q.z - 1.1;
      if (freeAt(x, z, top, index) && freeAt(x - 0.8, z - 0.8, top, index)) {
        safeAdd(place(new THREE.CylinderGeometry(0.72, 0.6, 0.85, 14), x, top + 0.48, z), C.tank, true);
        safeAdd(place(new THREE.CylinderGeometry(0.78, 0.74, 0.12, 14), x, top + 0.95, z), C.colonialSky, true);
        safeAdd(place(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), x, top + 1.03, z), C.tank);
        safeBlock(x - 0.75, top, z - 0.75, x + 0.75, top + 0.06, z + 0.75, C.stoneJoint);
      }
    }
    // Antena de TV ou parabólica
    if (index % 4 === 2 || index % 5 === 0) {
      const x = p.x + 0.6 + r() * (w - 1.2);
      const z = p.z + 0.6 + r() * (d - 1.2);
      if (!freeAt(x, z, top, index)) return;
      if (r() < 0.55) {
        const h = 2.2 + r() * 1.8;
        safeBlock(x - 0.03, top, z - 0.03, x + 0.03, top + h, z + 0.03, C.steel);
        for (let k = 0; k < 3; k++) {
          const half = 0.7 - k * 0.18;
          safeBlock(x - half, top + h - 0.2 - k * 0.38, z - 0.02, x + half, top + h - 0.16 - k * 0.38, z + 0.02, C.steel);
        }
      } else {
        const dish = new THREE.SphereGeometry(0.5, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.3);
        dish.rotateX(-Math.PI / 2 + 0.7);
        safeAdd(place(dish, x, top + 0.75, z, r() * Math.PI * 2), C.cal);
        safeBlock(x - 0.03, top, z - 0.03, x + 0.03, top + 0.7, z + 0.03, C.steel);
      }
    }
  });
}

/** Peitoril com vaso, grade de ferro no térreo e ar-condicionado pendurado. */
export function favelaWindowLife(b: Builder, map: MapData, windows: FavelaWindow[]) {
  const r = rng(4242);
  const item = (w: FavelaWindow, u0: number, v0: number, out0: number, u1: number, v1: number, out1: number, color: number) => {
    // Coordenadas locais da janela: u ao longo da parede, v para cima, out para fora
    const o0 = w.n * out0;
    const o1 = w.n * out1;
    const bx = w.side
      ? box(w.x + Math.min(o0, o1), w.y + v0, w.z + u0, w.x + Math.max(o0, o1), w.y + v1, w.z + u1)
      : box(w.x + u0, w.y + v0, w.z + Math.min(o0, o1), w.x + u1, w.y + v1, w.z + Math.max(o0, o1));
    if (Math.max(out0, out1) <= 0.12 || clearOfBody(map, bx)) b.block(bx.min.x, bx.min.y, bx.min.z, bx.max.x, bx.max.y, bx.max.z, color, deco);
    return bx;
  };
  for (const w of windows) {
    const roll = r();
    if (w.y < 2 && w.seed % 3 === 1) {
      // Grade de ferro rente à parede (não sai mais que 8 cm)
      for (let u = -0.55; u <= 0.56; u += 0.137) item(w, u, -0.02, 0.05, u + 0.03, 1.2, 0.08, C.inkSoft);
      for (const v of [0.02, 0.6, 1.15]) item(w, -0.6, v, 0.05, 0.6, v + 0.035, 0.08, C.inkSoft);
    } else if (w.y >= 2 && roll < 0.42) {
      // Floreira no peitoril: caixote, folhas e flores
      const bx = item(w, -0.5, -0.12, 0.04, 0.5, 0.12, 0.28, C.terracotta);
      if (!clearOfBody(map, bx)) continue;
      const g = (u: number, v: number, s: number, color: number) => {
        const sphere = new THREE.SphereGeometry(s, 7, 5);
        const out = 0.16 * w.n;
        const x = w.side ? w.x + out : w.x + u;
        const z = w.side ? w.z + u : w.z + out;
        if (clearOfBody(map, box(x - s, w.y + v - s, z - s, x + s, w.y + v + s, z + s))) {
          b.add(place(sphere, x, w.y + v, z), toon(color), { cast: false });
        } else sphere.dispose();
      };
      for (const u of [-0.32, -0.08, 0.16, 0.36]) g(u, 0.2 + r() * 0.06, 0.13 + r() * 0.05, r() < 0.5 ? C.leaf : C.leafLight);
      for (let k = 0; k < 3; k++) g(-0.35 + r() * 0.7, 0.32, 0.055, [C.ipe, C.colonialYellow, C.cal][k]);
    } else if (w.y >= 2 && roll < 0.58) {
      // Ar-condicionado pendurado ao lado da janela, com suporte e pingadeira
      const u = w.seed % 2 ? 0.75 : -1.45;
      const bx = item(w, u, 0.25, 0.03, u + 0.7, 0.7, 0.42, C.cal);
      if (!clearOfBody(map, bx)) continue;
      item(w, u + 0.08, 0.3, 0.41, u + 0.62, 0.62, 0.43, C.stoneJoint);
      item(w, u + 0.1, 0.18, 0.03, u + 0.14, 0.26, 0.38, C.steel);
      item(w, u + 0.56, 0.18, 0.03, u + 0.6, 0.26, 0.38, C.steel);
    }
  }
}
