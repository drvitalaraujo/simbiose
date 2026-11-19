// Hitboxes por parte do corpo como DADOS PUROS (sem Three.js): o servidor autoritativo vai
// usar exatamente este arquivo para decidir acertos (com rewind). Por isso o acerto NÃO
// depende dos ossos animados: as cápsulas saem só do estado do jogador (posição, yaw,
// agachado, pitch). O boneco animado é desenhado para "caber" nelas.
//
// Convenções (iguais às da câmera do jogo):
//  - y para cima; `pos` é o ponto dos pés (chão sob o jogador).
//  - yaw = 0 olha para -Z; frente = (-sin yaw, 0, -cos yaw). Direita = (cos yaw, 0, -sin yaw).
//  - pitch > 0 olha para cima.

export type Vec3 = { x: number; y: number; z: number };

export type HitPart = 'head' | 'torso' | 'legs';

/** Multiplicador de dano por parte (cabeça vale muito mais: teto de habilidade). */
export const DAMAGE_MULTIPLIER: Record<HitPart, number> = { head: 4, torso: 1, legs: 0.75 };

export interface HitboxState {
  pos: Vec3;
  yaw: number;
  /** 0 = em pé, 1 = agachado (aceita valores intermediários durante a transição). */
  crouch: number;
  /** Pitch da mira (radianos). Inclina o tronco/cabeça um pouco, como o boneco. */
  pitch?: number;
  /** Velocidade horizontal (m/s): correndo, o boneco inclina o tronco para frente. */
  speed?: number;
}

/** Cápsula: segmento a→b com raio. Esfera = cápsula com a == b. */
export interface Capsule {
  part: HitPart;
  a: Vec3;
  b: Vec3;
  radius: number;
}

export interface Hit {
  part: HitPart;
  /** Distância ao longo do raio (dir normalizada). */
  t: number;
  point: Vec3;
}

// Medidas do boneco (Quaternius UAL, ~1.83 m), tiradas dos ossos em cada pose: [em pé, agachado].
// "forward" é o avanço na direção da mira (o agachado inclina o tronco para frente).
export const BODY = {
  height: 1.83,
  head: { y: [1.64, 1.0], forward: [0.02, 0.2], radius: 0.14 },
  torso: { bottom: [0.92, 0.52], top: [1.42, 0.95], forward: [-0.03, -0.12], topForward: [0, 0.05], radius: 0.22 },
  legs: { bottom: [0.1, 0.1], top: [0.88, 0.5], forward: [0, 0.08], radius: 0.21 },
  /** Altura da coluna onde o tronco "dobra" com o pitch e com a corrida. */
  pivot: [0.98, 0.6],
  /** Fração do pitch que vira inclinação do tronco (o resto é só a cabeça/braços). */
  pitchBend: 0.35,
  /** Inclinação para frente na corrida (rad) na velocidade de `leanSpeed` (m/s) ou mais. */
  lean: 0.5,
  leanSpeed: 7,
} as const;

const lerp = (r: readonly [number, number], k: number) => r[0] + (r[1] - r[0]) * k;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Monta as 3 cápsulas (cabeça, tronco, pernas) no mundo para um estado do jogador. */
export function buildHitboxes(s: HitboxState): Capsule[] {
  const k = clamp01(s.crouch);
  const fx = -Math.sin(s.yaw);
  const fz = -Math.cos(s.yaw);
  const lean = Math.min(1, (s.speed ?? 0) / BODY.leanSpeed) * BODY.lean * (1 - 0.7 * k);
  const bend = (s.pitch ?? 0) * BODY.pitchBend - lean;
  const pivotY = lerp(BODY.pivot, k);
  const cb = Math.cos(bend);
  const sb = Math.sin(bend);

  // Ponto local (altura y, avanço f) → mundo, com o tronco girado pelo pitch em torno do pivô.
  // Olhar para cima (bend > 0) joga a parte de cima para trás; para baixo, para frente.
  const upper = (y: number, f: number): Vec3 => {
    const dy = y - pivotY;
    const ry = pivotY + dy * cb + f * sb;
    const rf = f * cb - dy * sb;
    return { x: s.pos.x + fx * rf, y: s.pos.y + ry, z: s.pos.z + fz * rf };
  };
  const lower = (y: number, f: number): Vec3 => ({ x: s.pos.x + fx * f, y: s.pos.y + y, z: s.pos.z + fz * f });

  const headF = lerp(BODY.head.forward, k);
  const head = upper(lerp(BODY.head.y, k), headF);
  return [
    { part: 'head', a: head, b: head, radius: BODY.head.radius },
    {
      part: 'torso',
      a: upper(lerp(BODY.torso.bottom, k) + BODY.torso.radius, lerp(BODY.torso.forward, k)),
      b: upper(lerp(BODY.torso.top, k) - BODY.torso.radius * 0.5, lerp(BODY.torso.topForward, k)),
      radius: BODY.torso.radius,
    },
    {
      part: 'legs',
      a: lower(lerp(BODY.legs.bottom, k) + BODY.legs.radius * 0.5, 0),
      b: lower(lerp(BODY.legs.top, k) - BODY.legs.radius, lerp(BODY.legs.forward, k)),
      radius: BODY.legs.radius,
    },
  ];
}

/**
 * Raio × cápsula. `dir` precisa estar normalizada. Devolve a distância t ≥ 0 do primeiro
 * contato (ou null). Começar dentro da cápsula conta como t = 0.
 */
export function rayCapsule(o: Vec3, dir: Vec3, c: Capsule): number | null {
  const ab = sub(c.b, c.a);
  const ao = sub(o, c.a);
  const abab = dot(ab, ab);
  const r2 = c.radius * c.radius;
  if (abab < 1e-9) return raySphere(o, dir, c.a, c.radius);

  const abd = dot(ab, dir);
  const abao = dot(ab, ao);
  const aod = dot(ao, dir);
  const aoao = dot(ao, ao);
  const a = abab - abd * abd;
  const b = abab * aod - abao * abd;
  const cc = abab * aoao - abao * abao - r2 * abab;

  // Dentro do corpo cilíndrico ou das tampas: t = 0
  const along = abao / abab;
  if (along >= 0 && along <= 1 && cc <= 0) return 0;

  if (a > 1e-9) {
    const h = b * b - a * cc;
    if (h < 0) return null;
    const t = (-b - Math.sqrt(h)) / a;
    const y = abao + t * abd;
    if (t >= 0 && y > 0 && y < abab) return t;
  }
  // Tampas esféricas
  const ta = raySphere(o, dir, c.a, c.radius);
  const tb = raySphere(o, dir, c.b, c.radius);
  if (ta === null) return tb;
  if (tb === null) return ta;
  return Math.min(ta, tb);
}

function raySphere(o: Vec3, d: Vec3, center: Vec3, r: number): number | null {
  const oc = sub(o, center);
  const b = dot(oc, d);
  const c = dot(oc, oc) - r * r;
  if (c <= 0) return 0;
  const h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : null;
}

/**
 * Raio contra o corpo inteiro: devolve a parte atingida mais próxima (ou null).
 * `maxDist` limita o alcance (ex.: parede mais próxima já achada pelo raio × AABB).
 * Em empate de distância (bordas sobrepostas), a cabeça ganha.
 */
export function raycastBody(origin: Vec3, dir: Vec3, state: HitboxState, maxDist = Infinity): Hit | null {
  const d = normalize(dir);
  let best: Hit | null = null;
  for (const cap of buildHitboxes(state)) {
    const t = rayCapsule(origin, d, cap);
    if (t === null || t > maxDist) continue;
    if (!best || t < best.t - 1e-6) {
      best = { part: cap.part, t, point: { x: origin.x + d.x * t, y: origin.y + d.y * t, z: origin.z + d.z * t } };
    }
  }
  return best;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
