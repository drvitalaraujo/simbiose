import type { CutPlane } from './regions';

// Corta uma malha (com esqueleto) em planos, para a borda entre duas cores seguir o plano
// em vez do serrilhado dos triângulos grandes do manequim. Lógica pura, sem Three.js.
// Vértices novos nascem no meio das arestas cortadas e são compartilhados pelos dois
// triângulos vizinhos (a malha continua fechada, então a casca do contorno não abre).

export interface SplitMesh {
  /** Posição na geometria (espaço do bind), 3 por vértice. */
  position: number[];
  normal: number[];
  /** 4 ossos + 4 pesos por vértice. */
  skinIndex: number[];
  skinWeight: number[];
  /** Posição de descanso em metros (onde os planos são medidos), 3 por vértice. */
  rest: number[];
  /** Osso de maior peso de cada vértice. */
  bone: string[];
  /** 3 índices por triângulo. */
  index: number[];
}

const AXIS = { x: 0, y: 1, z: 2 } as const;
const EPS = 1e-5;

export function splitByPlanes(mesh: SplitMesh, planes: CutPlane[]): SplitMesh {
  let index = mesh.index;
  for (const plane of planes) index = splitOne(mesh, index, plane);
  mesh.index = index;
  return mesh;
}

function splitOne(m: SplitMesh, index: number[], plane: CutPlane): number[] {
  const a = AXIS[plane.axis];
  const d = (v: number) => m.rest[v * 3 + a] - plane.value;
  const edges = new Map<string, number>();
  const out: number[] = [];
  const mid = (u: number, v: number): number => {
    const key = u < v ? `${u},${v}` : `${v},${u}`;
    let w = edges.get(key);
    if (w === undefined) {
      const t = d(u) / (d(u) - d(v));
      w = lerpVertex(m, u, v, t);
      edges.set(key, w);
    }
    return w;
  };
  for (let i = 0; i < index.length; i += 3) {
    const tri = [index[i], index[i + 1], index[i + 2]];
    const ds = tri.map(d);
    const pos = ds.map((x) => x > EPS);
    const neg = ds.map((x) => x < -EPS);
    const np = pos.filter(Boolean).length;
    const nn = neg.filter(Boolean).length;
    if (np === 0 || nn === 0 || !inBox(m, tri, plane)) {
      out.push(...tri);
      continue;
    }
    // Gira o triângulo (mantendo a ordem/winding) até o vértice "sozinho" ficar em tri[0]
    const lone = np === 1 ? pos.indexOf(true) : neg.indexOf(true);
    const [A, B, C] = [tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]];
    const sideB = Math.abs(d(B)) <= EPS;
    const sideC = Math.abs(d(C)) <= EPS;
    if (sideB || sideC) {
      // Um vértice já está no plano: corta em 2
      const P = sideB ? mid(A, C) : mid(A, B);
      if (sideB) out.push(A, B, P, B, C, P);
      else out.push(A, P, C, P, B, C);
      continue;
    }
    const P = mid(A, B);
    const Q = mid(A, C);
    out.push(A, P, Q, P, B, C, P, C, Q);
  }
  return out;
}

function inBox(m: SplitMesh, tri: number[], plane: CutPlane): boolean {
  if (!plane.box) return true;
  for (const [axis, range] of Object.entries(plane.box) as [keyof typeof AXIS, [number, number]][]) {
    const k = AXIS[axis];
    const c = (m.rest[tri[0] * 3 + k] + m.rest[tri[1] * 3 + k] + m.rest[tri[2] * 3 + k]) / 3;
    if (c < range[0] || c > range[1]) return false;
  }
  return true;
}

function lerpVertex(m: SplitMesh, u: number, v: number, t: number): number {
  const w = m.bone.length;
  for (const arr of [m.position, m.normal, m.rest]) {
    for (let k = 0; k < 3; k++) arr.push(arr[u * 3 + k] + (arr[v * 3 + k] - arr[u * 3 + k]) * t);
  }
  // Pesos: soma os dois vértices por osso, fica com os 4 maiores e normaliza
  const acc = new Map<number, number>();
  for (const [vert, f] of [[u, 1 - t], [v, t]] as const) {
    for (let k = 0; k < 4; k++) {
      const wt = m.skinWeight[vert * 4 + k] * f;
      if (wt > 0) acc.set(m.skinIndex[vert * 4 + k], (acc.get(m.skinIndex[vert * 4 + k]) ?? 0) + wt);
    }
  }
  const top = [...acc.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4);
  const sum = top.reduce((s, [, wt]) => s + wt, 0) || 1;
  for (let k = 0; k < 4; k++) {
    m.skinIndex.push(top[k]?.[0] ?? 0);
    m.skinWeight.push((top[k]?.[1] ?? 0) / sum);
  }
  m.bone.push(t < 0.5 ? m.bone[u] : m.bone[v]);
  return w;
}
