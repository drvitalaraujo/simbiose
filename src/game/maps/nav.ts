// Grade de navegação para validar mapas (lógica pura): onde o jogador fica em pé, para onde
// anda (degrau <= STEP, cair pode), distâncias a pé, entradas de cada zona e linhas de visão.
import type { Box, Vec3 } from '../physics';
import type { Rect } from '../world/shapes';
import type { MapData } from './types';

const RADIUS = 0.35; // meia largura do jogador (player.ts)
const HEIGHT = 1.7;
const STEP = 0.45; // degrau que o jogador sobe andando (player.ts)
const EYE = 1.5; // olho acima dos pés
const MAX_FLOORS = 4;

export interface NavGrid {
  map: MapData;
  cell: number;
  nx: number;
  nz: number;
  /** Alturas de piso por célula (NaN = vazio), MAX_FLOORS por célula. */
  floors: Float32Array;
}

const overlaps = (a: Box, b: Box) =>
  a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y && a.min.z < b.max.z && a.max.z > b.min.z;

export function buildNav(map: MapData, cell = 0.5): NavGrid {
  const { x0, z0, x1, z1 } = map.bounds;
  const nx = Math.round((x1 - x0) / cell);
  const nz = Math.round((z1 - z0) / cell);
  const floors = new Float32Array(nx * nz * MAX_FLOORS).fill(NaN);
  const boxes = map.solids.map((s) => s.box);
  for (let j = 0; j < nz; j++) {
    const cz = z0 + (j + 0.5) * cell;
    // Só as caixas que tocam esta fileira (com a folga do raio)
    const rowBoxes = boxes.filter((b) => b.min.z < cz + RADIUS && b.max.z > cz - RADIUS);
    for (let i = 0; i < nx; i++) {
      const cx = x0 + (i + 0.5) * cell;
      const near = rowBoxes.filter((b) => b.min.x < cx + RADIUS && b.max.x > cx - RADIUS);
      const under = near.filter((b) => b.min.x < cx && b.max.x > cx && b.min.z < cz && b.max.z > cz);
      const tops = under.map((b) => b.max.y);
      tops.sort((a, b) => a - b);
      let k = 0;
      for (const h of tops) {
        if (k >= MAX_FLOORS) break;
        if (k > 0 && Math.abs(floors[(j * nx + i) * MAX_FLOORS + k - 1] - h) < 1e-3) continue;
        // Piso coberto por outro sólido bem nesse ponto (ex.: chão debaixo de um terraço)
        if (under.some((b) => b.min.y < h + 0.01 && b.max.y > h + 0.01)) continue;
        // Cabe em pé? (o que está abaixo de um degrau não conta: o jogador sobe nele)
        const body: Box = { min: { x: cx - RADIUS, y: h + STEP + 0.01, z: cz - RADIUS }, max: { x: cx + RADIUS, y: h + HEIGHT, z: cz + RADIUS } };
        if (near.some((b) => overlaps(body, b))) continue;
        floors[(j * nx + i) * MAX_FLOORS + k++] = h;
      }
    }
  }
  return { map, cell, nx, nz, floors };
}

/** Nó = célula * MAX_FLOORS + índice do piso. */
export type NodeId = number;

export function cellOf(nav: NavGrid, x: number, z: number): [number, number] {
  return [Math.floor((x - nav.map.bounds.x0) / nav.cell), Math.floor((z - nav.map.bounds.z0) / nav.cell)];
}

export function nodePos(nav: NavGrid, id: NodeId): Vec3 {
  const c = Math.floor(id / MAX_FLOORS);
  const i = c % nav.nx;
  const j = Math.floor(c / nav.nx);
  return { x: nav.map.bounds.x0 + (i + 0.5) * nav.cell, y: nav.floors[id], z: nav.map.bounds.z0 + (j + 0.5) * nav.cell };
}

/** Nó de piso mais próximo de um ponto (pés), procurando em volta se a célula exata for parede. */
export function nodeAt(nav: NavGrid, p: Vec3, tolY = 0.5): NodeId | null {
  const [ci, cj] = cellOf(nav, p.x, p.z);
  for (let r = 0; r <= 2; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) continue;
        for (let k = 0; k < MAX_FLOORS; k++) {
          const id = (j * nav.nx + i) * MAX_FLOORS + k;
          const h = nav.floors[id];
          if (!Number.isNaN(h) && Math.abs(h - p.y) <= tolY) return id;
        }
      }
    }
  }
  return null;
}

/** Piso para onde se vai andando da altura `h` até a célula (i,j): o mais alto até h + STEP. */
function stepInto(nav: NavGrid, i: number, j: number, h: number): NodeId | -1 {
  if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) return -1;
  let best = -1;
  let bestH = -Infinity;
  for (let k = 0; k < MAX_FLOORS; k++) {
    const id = (j * nav.nx + i) * MAX_FLOORS + k;
    const f = nav.floors[id];
    if (!Number.isNaN(f) && f <= h + STEP && f > bestH) {
      best = id;
      bestH = f;
    }
  }
  return best;
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Vizinhos andando (8 direções, sem cortar quina) com o custo em metros. */
export function neighbors(nav: NavGrid, id: NodeId): [NodeId, number][] {
  const c = Math.floor(id / MAX_FLOORS);
  const i = c % nav.nx;
  const j = Math.floor(c / nav.nx);
  const h = nav.floors[id];
  const out: [NodeId, number][] = [];
  for (const [di, dj] of DIRS) {
    const n = stepInto(nav, i + di, j + dj, h);
    if (n < 0) continue;
    if (di !== 0 && dj !== 0 && (stepInto(nav, i + di, j, h) < 0 || stepInto(nav, i, j + dj, h) < 0)) continue;
    out.push([n, (di !== 0 && dj !== 0 ? Math.SQRT2 : 1) * nav.cell]);
  }
  return out;
}

/** Distância a pé (metros) de `from` até todos os nós (Infinity = inalcançável). */
export function walkDistances(nav: NavGrid, from: NodeId): Float64Array {
  const dist = new Float64Array(nav.floors.length).fill(Infinity);
  dist[from] = 0;
  // Heap binário simples de [distância, nó]
  const heap: [number, number][] = [[0, from]];
  const push = (e: [number, number]) => {
    heap.push(e);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  while (heap.length > 0) {
    const [d, id] = pop();
    if (d > dist[id]) continue;
    for (const [n, cost] of neighbors(nav, id)) {
      const nd = d + cost;
      if (nd < dist[n]) {
        dist[n] = nd;
        push([nd, n]);
      }
    }
  }
  return dist;
}

const inRect = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

/** Menor distância até qualquer nó dentro do retângulo (chegada na zona). */
export function distanceToRect(nav: NavGrid, dist: Float64Array, r: Rect): number {
  let best = Infinity;
  for (let id = 0; id < dist.length; id++) {
    if (dist[id] >= best || Number.isNaN(nav.floors[id])) continue;
    const p = nodePos(nav, id);
    if (inRect(r, p.x, p.z)) best = dist[id];
  }
  return best;
}

/**
 * Entradas de uma zona: passagens andáveis que cruzam a borda do retângulo, agrupadas por
 * vizinhança (uma porta larga conta como uma entrada). Só conta o que se alcança de `dist`.
 */
export function entrances(nav: NavGrid, dist: Float64Array, r: Rect): number {
  const outside = new Set<number>();
  for (let id = 0; id < dist.length; id++) {
    if (!Number.isFinite(dist[id])) continue;
    const p = nodePos(nav, id);
    if (!inRect(r, p.x, p.z)) continue;
    for (const [n] of neighbors(nav, id)) {
      const q = nodePos(nav, n);
      if (inRect(r, q.x, q.z)) continue;
      // A volta também precisa ser andável (cair de uma borda não é entrada)
      if (neighbors(nav, n).some(([m]) => m === id)) outside.add(Math.floor(n / MAX_FLOORS));
    }
  }
  // Agrupa as células de fora que se tocam (8 vizinhos, folga de 2 células)
  const cells = [...outside];
  const seen = new Set<number>();
  let groups = 0;
  for (const c of cells) {
    if (seen.has(c)) continue;
    groups++;
    const stack = [c];
    seen.add(c);
    while (stack.length > 0) {
      const a = stack.pop()!;
      const ai = a % nav.nx;
      const aj = Math.floor(a / nav.nx);
      for (const b of cells) {
        if (seen.has(b)) continue;
        if (Math.abs((b % nav.nx) - ai) <= 2 && Math.abs(Math.floor(b / nav.nx) - aj) <= 2) {
          seen.add(b);
          stack.push(b);
        }
      }
    }
  }
  return groups;
}

/**
 * Maior linha de visão de quem está em pé no chão (olho a 1.5 m), em metros: raios a partir
 * de pontos de piso térreo alcançáveis, parando no primeiro sólido na altura do olho.
 */
export function longestSightline(nav: NavGrid, dist: Float64Array, sample = 2, dirs = 48): { length: number; from: Vec3; to: Vec3 } {
  const { map, cell, nx, nz } = nav;
  const { x0, z0 } = map.bounds;
  // Grade de bloqueio na altura do olho (sem contar o chão)
  const blocked = new Uint8Array(nx * nz);
  for (const s of map.solids) {
    if (s.kind === 'ground' || s.box.min.y > EYE || s.box.max.y < EYE) continue;
    const i0 = Math.max(0, Math.floor((s.box.min.x - x0) / cell));
    const i1 = Math.min(nx - 1, Math.ceil((s.box.max.x - x0) / cell) - 1);
    const j0 = Math.max(0, Math.floor((s.box.min.z - z0) / cell));
    const j1 = Math.min(nz - 1, Math.ceil((s.box.max.z - z0) / cell) - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * nx + i] = 1;
  }
  let best = { length: 0, from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 } };
  const stride = Math.max(1, Math.round(sample / cell));
  for (let j = 0; j < nz; j += stride) {
    for (let i = 0; i < nx; i += stride) {
      const id = (j * nx + i) * MAX_FLOORS;
      if (Math.abs(nav.floors[id]) > 1e-3 || !Number.isFinite(dist[id])) continue; // só térreo alcançável
      const px = x0 + (i + 0.5) * cell;
      const pz = z0 + (j + 0.5) * cell;
      for (let d = 0; d < dirs; d++) {
        const a = (d / dirs) * Math.PI * 2;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        let t = 0;
        for (;;) {
          const nt = t + cell * 0.5;
          const qi = Math.floor((px + dx * nt - x0) / cell);
          const qj = Math.floor((pz + dz * nt - z0) / cell);
          if (qi < 0 || qj < 0 || qi >= nx || qj >= nz || blocked[qj * nx + qi]) break;
          t = nt;
        }
        if (t > best.length) best = { length: t, from: { x: px, y: 0, z: pz }, to: { x: px + dx * t, y: 0, z: pz + dz * t } };
      }
    }
  }
  return best;
}
