// Consultas puras sobre a planta de um mapa (sem Three.js) para vestir o cenário:
// que trechos de parede ficam à vista, a altura do piso num ponto, onde dividir a fileira
// de casarões em lotes e o que está do outro lado da rua (para estender fios).
import type { Box } from '../physics';
import type { MapData, MapSolid } from './types';

/** Trecho de face vertical de um sólido que alguém vê de dentro do mapa. */
export interface FaceSpan {
  /** Eixo da normal da face e coordenada do plano. */
  axis: 'x' | 'z';
  at: number;
  /** Sentido da normal (para fora do sólido). */
  n: 1 | -1;
  /** Intervalo ao longo da face (z se axis = x; x se axis = z). */
  t0: number;
  t1: number;
  /** A face aparece de `base` até `top` (abaixo de `base` há outra parede encostada). */
  base: number;
  top: number;
  solid: MapSolid;
}

const STEP = 0.5;
const OUT = 0.3;

/** Paredes que tapam uma face: o que sai do chão e ninguém atravessa. */
const blocks = (s: MapSolid) => (s.kind === 'wall' || s.kind === 'edge') && s.box.min.y <= 0.1;
const walkable = (s: MapSolid) => s.kind === 'ground' || s.kind === 'terrace' || s.kind === 'platform' || s.kind === 'stairs';
const inXZ = (b: Box, x: number, z: number) => x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z;

/** Altura das paredes que tapam o ponto (0 = livre; Infinity = fora da área jogável). */
export function coverAt(map: MapData, x: number, z: number): number {
  let h = 0;
  for (const s of map.solids) if (blocks(s) && inXZ(s.box, x, z)) h = Math.max(h, s.box.max.y);
  if (h > 0) return h; // o muro externo fica fora dos limites, mas conta como parede
  const { x0, z0, x1, z1 } = map.bounds;
  return x < x0 || x > x1 || z < z0 || z > z1 ? Infinity : 0;
}

/** Altura do piso onde se pisa no ponto (chão, terraço, plataforma ou degrau). */
export function floorAt(map: MapData, x: number, z: number): number {
  let h = 0;
  for (const s of map.solids) if (walkable(s) && inXZ(s.box, x, z)) h = Math.max(h, s.box.max.y);
  return h;
}

/** Ponto a `off` metros da face, na posição `t` ao longo dela. */
export function facePoint(f: Pick<FaceSpan, 'axis' | 'at' | 'n'>, t: number, off: number): { x: number; z: number } {
  return f.axis === 'x' ? { x: f.at + f.n * off, z: t } : { x: t, z: f.at + f.n * off };
}

/**
 * Trechos à vista das faces dos sólidos escolhidos. Amostra a cada 0.5 m logo à frente da
 * face; trechos seguidos com a mesma parede encostada viram um `FaceSpan`.
 */
export function exposedFaces(map: MapData, pick: (s: MapSolid) => boolean): FaceSpan[] {
  const out: FaceSpan[] = [];
  for (const s of map.solids) {
    if (!pick(s)) continue;
    const b = s.box;
    const faces: [FaceSpan['axis'], number, 1 | -1, number, number][] = [
      ['x', b.max.x, 1, b.min.z, b.max.z],
      ['x', b.min.x, -1, b.min.z, b.max.z],
      ['z', b.max.z, 1, b.min.x, b.max.x],
      ['z', b.min.z, -1, b.min.x, b.max.x],
    ];
    for (const [axis, at, n, a, c] of faces) {
      let start = a;
      let cur: number | null = null;
      const flush = (end: number) => {
        if (cur !== null && cur < b.max.y - 0.2 && end - start > 0.4) {
          out.push({ axis, at, n, t0: start, t1: end, base: cur, top: b.max.y, solid: s });
        }
      };
      for (let t = a; t < c - 1e-6; t += STEP) {
        const mid = Math.min(t + STEP / 2, (t + c) / 2);
        const p = facePoint({ axis, at, n }, mid, OUT);
        const h = coverAt(map, p.x, p.z);
        if (h !== cur) {
          flush(t);
          start = t;
          cur = h;
        }
      }
      flush(c);
    }
  }
  return out;
}

/** Divide um trecho em lotes de casarão de ~5 a 8 m (sorteio determinístico). */
export function splitLots(t0: number, t1: number, r: () => number, target = 6.5): [number, number][] {
  const len = t1 - t0;
  const n = Math.max(1, Math.round(len / target));
  const cuts = [t0];
  for (let i = 1; i < n; i++) {
    const ideal = t0 + (len * i) / n;
    cuts.push(Math.round((ideal + (r() - 0.5) * (len / n) * 0.4) * 2) / 2);
  }
  cuts.push(t1);
  const lots: [number, number][] = [];
  for (let i = 0; i < cuts.length - 1; i++) if (cuts[i + 1] - cuts[i] > 0.4) lots.push([cuts[i], cuts[i + 1]]);
  return lots;
}

/**
 * Do ponto `t` da face, anda para fora até bater em outra parede: distância e altura dela
 * (para estender fio de um lado da rua ao outro). Null se não achar até `maxD`.
 */
export function acrossStreet(map: MapData, f: Pick<FaceSpan, 'axis' | 'at' | 'n'>, t: number, maxD: number): { d: number; top: number } | null {
  for (let d = OUT; d <= maxD; d += 0.25) {
    const p = facePoint(f, t, d);
    const h = coverAt(map, p.x, p.z);
    if (h === Infinity) return null;
    if (h > 0) return { d: d - 0.125, top: h };
  }
  return null;
}

// ---------------------------------------------------------------- envelope do corpo

/**
 * Envelope conservador do jogador usado para saber até onde o corpo alcança.
 * Mantém a corrida antiga de 11 m/s após a redução autorizada para 9,5 m/s:
 * decoração existente continua segura. `facades.test.ts` confere contra `stepPlayer`.
 */
export const BODY = {
  /** Meia largura da caixa do corpo. */
  half: 0.35,
  /** Altura da caixa do corpo (pés ao topo da cabeça). */
  height: 1.7,
  /** Subida máxima do pulo: JUMP² / (2·GRAVITY) = 81 / 52. */
  rise: 81 / 52,
  gravity: 26,
  /** Velocidade horizontal máxima (correndo). */
  speed: 11,
  /** Distância horizontal até o ápice (JUMP/GRAVITY · speed) + o que anda no tempo de coyote (0.1 s). */
  apexDist: (9 / 26) * 11 + 1.1,
  /** Folga de segurança acima do topo da cabeça. */
  margin: 0.1,
};

/** Retângulo no plano XZ. */
export interface XZ {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

const rectOf = (b: Box): XZ => ({ x0: b.min.x, z0: b.min.z, x1: b.max.x, z1: b.max.z });
const rectDist = (a: XZ, b: XZ) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));

/** Quanto acima do ponto de partida o pé consegue estar a `d` m (horizontal) dele, pulando. */
export function jumpRise(d: number): number {
  if (d <= BODY.apexDist) return BODY.rise;
  const t = (d - BODY.apexDist) / BODY.speed;
  return BODY.rise - (BODY.gravity / 2) * t * t;
}

/** Altura do pé no arco do pulo a `x` m (horizontal) do ponto onde saiu do chão, correndo. */
function arc(x: number): number {
  const t = x / BODY.speed;
  return 9 * t - (BODY.gravity / 2) * t * t;
}

/**
 * Subida possível para pousar em algo a `d` m da borda do apoio, tendo `run` m de apoio
 * para trás (onde dá para tirar o pé antes). O tempo de coyote adianta a saída em 1.1 m.
 */
function landRise(d: number, run: number): number {
  const apex = (9 / BODY.gravity) * BODY.speed;
  const near = Math.max(0, d - 1.1);
  const far = near + run;
  if (near <= apex && far >= apex) return BODY.rise;
  return far < apex ? arc(far) : arc(near);
}

const supportCache = new WeakMap<MapData, Box[]>();

/**
 * Onde dá para ficar de pé: piso, terraço, degrau e plataforma, mais as coberturas que se
 * alcançam pulando de outra superfície alcançável (repete até não mudar mais).
 */
export function reachableSupports(map: MapData): Box[] {
  const cached = supportCache.get(map);
  if (cached) return cached;
  const reach = map.solids.filter(walkable).map((s) => s.box);
  const rest = map.solids.filter((s) => s.kind === 'low' || s.kind === 'tall').map((s) => s.box);
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = rest.length - 1; i >= 0; i--) {
      const t = rest[i];
      const ok = reach.some((s) => {
        // Corrida disponível: comprimento do apoio no eixo em que os dois se separam
        const gx = Math.max(0, s.min.x - t.max.x, t.min.x - s.max.x);
        const gz = Math.max(0, s.min.z - t.max.z, t.min.z - s.max.z);
        const run = gx >= gz ? s.max.x - s.min.x : s.max.z - s.min.z;
        return t.max.y <= s.max.y + landRise(Math.max(0, Math.hypot(gx, gz) - 2 * BODY.half), run);
      });
      if (ok) {
        reach.push(t);
        rest.splice(i, 1);
        changed = true;
      }
    }
  }
  supportCache.set(map, reach);
  return reach;
}

/**
 * Maior altura que o topo da cabeça alcança (com folga) com o corpo sobre o retângulo,
 * de pé ou pulando de qualquer superfície alcançável, inclusive correndo de longe.
 */
export function bodyCeiling(map: MapData, r: XZ): number {
  let h = 0;
  for (const s of reachableSupports(map)) {
    // Quem pula sai com o centro até meia largura fora da borda de apoio, e o corpo encosta
    // no retângulo com o centro a meia largura dele
    const d = Math.max(0, rectDist(rectOf(s), r) - 2 * BODY.half);
    h = Math.max(h, s.max.y + BODY.height + jumpRise(d) + BODY.margin);
  }
  return h;
}

/** A peça decorativa (sem colisão) fica inteira acima do alcance do corpo, mesmo pulando? */
export function clearOfBody(map: MapData, b: Box): boolean {
  return b.min.y >= bodyCeiling(map, rectOf(b));
}
