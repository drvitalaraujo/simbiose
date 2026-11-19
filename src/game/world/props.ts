import * as THREE from 'three';
import { GLOW, PALETTE, toon, toonWith } from '../toon';
import { Builder, paint, place } from './builder';
import { paintTicker } from './signs';
import { Atlas, planeGeo, telaoTexture, type TelaoSpec, type UVRect } from './textures';

// Objetos de rua do bairro: carros, bancas, orelhões, postes com fiação, barricadas, letreiros.

export interface Ctx {
  b: Builder;
  scene: THREE.Scene;
  /** Neon e lâmpadas: cor por vértice, sem luz (brilha no pôr do sol). */
  neon: THREE.MeshBasicMaterial;
  signs: Atlas;
  signMat: THREE.MeshBasicMaterial;
  /** Letreiros de neon: mesmo esquema do `signs`, mas acima do limiar do bloom. */
  glowSigns: Atlas;
  glowMat: THREE.MeshBasicMaterial;
  graffiti: Atlas;
  graffitiMat: THREE.MeshToonMaterial;
  wireMat: THREE.MeshBasicMaterial;
  /** Animações por quadro (telões, partículas...), chamadas por `World.update`. */
  updaters: ((dt: number, time: number) => void)[];
}

export function createCtx(scene: THREE.Scene, b: Builder): Ctx {
  const signs = new Atlas(2048, false);
  const graffiti = new Atlas(2048, true);
  return {
    b,
    scene,
    neon: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(GLOW, GLOW, GLOW) }),
    signs,
    // O mapa é ligado no fim (`finishCtx`), depois de tudo desenhado no atlas
    signMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    glowSigns: new Atlas(1024, false),
    glowMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(GLOW * 0.75, GLOW * 0.75, GLOW * 0.75) }),
    graffiti,
    graffitiMat: toonWith({ color: 0xffffff, transparent: true, alphaTest: 0.025, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    wireMat: new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
    updaters: [],
  };
}

export function finishCtx(ctx: Ctx) {
  ctx.signMat.map = ctx.signs.texture;
  ctx.signMat.needsUpdate = true;
  ctx.graffitiMat.map = ctx.graffiti.texture;
  ctx.graffitiMat.needsUpdate = true;
  ctx.glowMat.map = ctx.glowSigns.texture;
  ctx.glowMat.needsUpdate = true;
  console.info(`bairro: atlas letreiros ${ctx.signs.used}, pichações ${ctx.graffiti.used}, neon ${ctx.glowSigns.used}`);
}

// ---------------------------------------------------------------- faces de parede

/** Plano de parede: normal no eixo `axis`, na coordenada `at`, apontando para `n`. */
export interface Face {
  axis: 'x' | 'z';
  at: number;
  n: 1 | -1;
}

export function facePos(f: Face, t: number, y: number, off: number): THREE.Vector3 {
  return f.axis === 'z' ? new THREE.Vector3(t, y, f.at + f.n * off) : new THREE.Vector3(f.at + f.n * off, y, t);
}

export function faceRot(f: Face): number {
  if (f.axis === 'z') return f.n === 1 ? 0 : Math.PI;
  return f.n === 1 ? Math.PI / 2 : -Math.PI / 2;
}

/** Letreiro do atlas colado na parede (decorativo, não bloqueia tiro). */
export function sign(ctx: Ctx, f: Face, uv: UVRect, t: number, y: number, w: number, h: number, off = 0.06) {
  const p = facePos(f, t, y, off);
  ctx.b.add(place(planeGeo(w, h, uv), p.x, p.y, p.z, faceRot(f)), ctx.signMat, { cast: false, receive: false });
}

/** Pichação colada na parede (recebe sombra, como tinta de verdade). */
export function graf(ctx: Ctx, f: Face, uv: UVRect, t: number, y: number, w: number, h: number, off = 0.03) {
  const p = facePos(f, t, y, off);
  ctx.b.add(place(planeGeo(w, h, uv), p.x, p.y, p.z, faceRot(f)), ctx.graffitiMat, { cast: false });
}

/** Caixa decorativa encostada na parede (`off` = distância da parede até a face de trás). */
export function faceBox(ctx: Ctx, f: Face, t: number, y: number, w: number, h: number, depth: number, mat: THREE.Material, off = 0, outline = 0) {
  const p = facePos(f, t, y, off + depth / 2);
  ctx.b.add(place(new THREE.BoxGeometry(w, h, depth), p.x, p.y, p.z, faceRot(f)), mat, { outline });
}

export function neonBox(ctx: Ctx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  ctx.b.add(paint(g, color), ctx.neon, { cast: false, receive: false });
}

/** Telão da OTIMIZA: textura própria, moldura escura e filete de neon. */
export function telao(ctx: Ctx, f: Face, t: number, y: number, w: number, h: number, spec: TelaoSpec, fog = true) {
  const mat = new THREE.MeshBasicMaterial({ map: telaoTexture(spec), fog });
  faceBox(ctx, f, t, y, w + 0.8, h + 0.8, 0.3, toon(PALETTE.ink));
  const p = facePos(f, t, y, 0.33);
  ctx.b.add(place(new THREE.PlaneGeometry(w, h), p.x, p.y, p.z, faceRot(f)), mat, { cast: false, receive: false });
  // Brilho de tela (passa do limiar do bloom), respiração lenta e uma falha de vez em quando
  const seed = Math.abs(Math.sin(t * 12.9898 + y * 78.233)) * 10;
  const base = 1.25;
  ctx.updaters.push((_dt, time) => {
    const glitch = (time * 0.31 + seed) % 7 < 0.12 ? 0.45 + 0.4 * Math.sin(time * 90) : 1;
    mat.color.setScalar(base * (1 + 0.06 * Math.sin(time * 2.1 + seed)) * glitch);
  });
  mat.color.setScalar(base);
  // Letreiro corrido da OTIMIZA na base da tela
  const th = Math.max(0.5, h * 0.13);
  const tp = facePos(f, t, y - h / 2 + th / 2 + 0.05, 0.36);
  const strip = new THREE.PlaneGeometry(w, th);
  const uv = strip.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w / (th * 32)));
  ctx.b.add(place(strip, tp.x, tp.y, tp.z, faceRot(f)), tickerMaterial(ctx), { cast: false, receive: false });
  const e = facePos(f, t, y - h / 2 - 0.55, 0.2);
  const tan = f.axis === 'z' ? 'x' : 'z';
  const half = w / 2 + 0.4;
  if (tan === 'x') neonBox(ctx, e.x - half, e.y - 0.06, e.z - 0.06, e.x + half, e.y + 0.06, e.z + 0.06, spec.accent ?? PALETTE.cyan);
  else neonBox(ctx, e.x - 0.06, e.y - 0.06, e.z - half, e.x + 0.06, e.y + 0.06, e.z + half, spec.accent ?? PALETTE.cyan);
}

const tickers = new WeakMap<Ctx, THREE.MeshBasicMaterial>();

/** Material único de todos os letreiros corridos (um draw call; a textura rola por quadro). */
function tickerMaterial(ctx: Ctx): THREE.MeshBasicMaterial {
  let m = tickers.get(ctx);
  if (!m) {
    const tex = paintTicker('OTIMIZA INFORMA  •  IFB 98,7% ▲  •  FELICIDADE É OBRIGATÓRIA  •  SORRIA, VOCÊ ESTÁ SENDO MEDIDO  •  DESPLUGAR É CRIME  •  ');
    m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5) });
    tickers.set(ctx, m);
    ctx.updaters.push((_dt, time) => {
      tex.offset.x = (time * 0.09) % 1;
    });
  }
  return m;
}

/** Toldo listrado inclinado (decorativo). */
export function awning(ctx: Ctx, f: Face, t: number, y: number, w: number, colors: [number, number]) {
  const n = Math.max(2, Math.round(w / 0.6));
  const sw = w / n;
  const rot = faceRot(f);
  const depth = 1.5;
  const tilt = 0.38;
  for (let i = 0; i < n; i++) {
    const tt = t - w / 2 + sw * (i + 0.5);
    const p = facePos(f, tt, y - Math.sin(tilt) * depth * 0.5, Math.cos(tilt) * depth * 0.5);
    ctx.b.add(place(new THREE.BoxGeometry(sw, 0.06, depth), p.x, p.y, p.z, rot, tilt), toon(colors[i % 2]));
  }
}

// ---------------------------------------------------------------- objetos de rua

export function crate(ctx: Ctx, x: number, y: number, z: number, s: number, h = s, color: number = PALETTE.orange) {
  ctx.b.block(x - s / 2, y, z - s / 2, x + s / 2, y + h, z + s / 2, color);
  const o = { solid: false, cast: false, outline: 0 };
  const e = 0.02;
  const x0 = x - s / 2 - e, x1 = x + s / 2 + e, z0 = z - s / 2 - e, z1 = z + s / 2 + e;
  // Caixote reforçado: cantoneiras nas quinas, aro em cima e embaixo e ripas no meio
  for (const [cx, cz] of [[x0, z0], [x1 - 0.09, z0], [x0, z1 - 0.09], [x1 - 0.09, z1 - 0.09]]) ctx.b.block(cx, y, cz, cx + 0.09, y + h, cz + 0.09, PALETTE.wine, o);
  for (const yy of [y + 0.02, y + h - 0.1]) {
    ctx.b.block(x0, yy, z0, x1, yy + 0.08, z0 + e, PALETTE.wine, o);
    ctx.b.block(x0, yy, z1 - e, x1, yy + 0.08, z1, PALETTE.wine, o);
    ctx.b.block(x0, yy, z0, x0 + e, yy + 0.08, z1, PALETTE.wine, o);
    ctx.b.block(x1 - e, yy, z0, x1, yy + 0.08, z1, PALETTE.wine, o);
  }
  ctx.b.block(x0, y + h * 0.45, z0, x1, y + h * 0.55, z1, PALETTE.wine, o);
  // Etiqueta clara e lasca de tinta em uma face
  ctx.b.block(x - s * 0.18, y + h * 0.62, z1 - 0.005, x + s * 0.14, y + h * 0.8, z1 + 0.004, PALETTE.paper, o);
  ctx.b.block(x0 - 0.004, y + h * 0.2, z - s * 0.1, x0 + 0.004, y + h * 0.3, z + s * 0.12, PALETTE.sand, o);
}

export { car } from './cars';

/** Banca de jornal: caixa sólida, teto com beiral (dá para subir pulando) e letreiro. */
export function banca(ctx: Ctx, x0: number, z0: number, x1: number, z1: number, front: Face, label: UVRect) {
  const b = ctx.b;
  b.block(x0, 0, z0, x1, 2.4, z1, PALETTE.cyan);
  b.block(x0 - 0.25, 2.4, z0 - 0.25, x1 + 0.25, 2.6, z1 + 0.25, PALETTE.paper);
  const mid = front.axis === 'z' ? (x0 + x1) / 2 : (z0 + z1) / 2;
  const len = front.axis === 'z' ? x1 - x0 : z1 - z0;
  sign(ctx, front, label, mid, 2.0, len * 0.9, 0.55, 0.04);
  // Revistas penduradas (faixas coloridas)
  const cols = [PALETTE.pink, PALETTE.yellow, PALETTE.paper, PALETTE.orange, PALETTE.lilac];
  const n = Math.floor(len / 0.5);
  for (let i = 0; i < n; i++) {
    const t = mid - len / 2 + 0.25 + i * 0.5;
    faceBox(ctx, front, t, 1.2, 0.38, 0.5, 0.03, toon(cols[i % cols.length]), 0);
  }
}

/** Orelhão: o telefone público laranja de São Paulo (decorativo, só o poste colide). */
export function orelhao(ctx: Ctx, x: number, z: number, rotY: number) {
  const b = ctx.b;
  b.block(x - 0.08, 0.25, z - 0.08, x + 0.08, 2.2, z + 0.08, PALETTE.concreteDark, { outline: 0.02 });
  const hood = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
  hood.scale(0.62, 0.95, 0.62);
  const off = new THREE.Vector3(0, 0, 0.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  hood.rotateX(-Math.PI / 2 + 0.25);
  place(hood, x + off.x, 1.75, z + off.z, rotY);
  b.add(hood, toonWith({ color: PALETTE.orange, side: THREE.DoubleSide }), { outline: 0.03 });
  const phone = new THREE.BoxGeometry(0.3, 0.45, 0.15);
  place(phone, x + off.x * 0.4, 1.55, z + off.z * 0.4, rotY);
  b.add(phone, toon(PALETTE.paper), { outline: 0.02 });
}

let poolMat: THREE.MeshBasicMaterial | null = null;
function poolMaterial(): THREE.MeshBasicMaterial {
  if (!poolMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    // Degradê em 3 anéis (luz "cel", não um borrão)
    for (const [r, a] of [[64, 0.25], [44, 0.5], [26, 0.8]] as const) {
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath();
      g.arc(64, 64, r, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    poolMat = new THREE.MeshBasicMaterial({
      map: tex, color: new THREE.Color(PALETTE.horizon).multiplyScalar(0.28), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    });
  }
  return poolMat;
}

/** Poste de concreto com luminária e cruzeta. Devolve os pontos onde a fiação se prende. */
export function poste(ctx: Ctx, x: number, z: number, armX: number, armZ: number): THREE.Vector3[] {
  const b = ctx.b;
  const H = 8.6;
  b.block(x - 0.16, 0, z - 0.16, x + 0.16, H, z + 0.16, PALETTE.concrete, { outline: 0.03 });
  // Cruzeta perpendicular ao braço da luz
  const px = -armZ;
  const pz = armX;
  const cw = 0.9;
  b.block(x - Math.abs(px) * cw - 0.06, H - 0.6, z - Math.abs(pz) * cw - 0.06, x + Math.abs(px) * cw + 0.06, H - 0.48, z + Math.abs(pz) * cw + 0.06, PALETTE.concreteDark, { solid: false, outline: 0.02 });
  // Braço e luminária
  const ax = x + armX * 1.8;
  const az = z + armZ * 1.8;
  b.block(Math.min(x, ax) - 0.05, H - 1.25, Math.min(z, az) - 0.05, Math.max(x, ax) + 0.05, H - 1.15, Math.max(z, az) + 0.05, PALETTE.ink, { solid: false, outline: 0 });
  neonBox(ctx, ax - 0.3, H - 1.4, az - 0.3, ax + 0.3, H - 1.22, az + 0.3, PALETTE.horizon);
  // Poça de luz quente no asfalto (aditiva, não escreve profundidade: sem contorno)
  const pool = new THREE.CircleGeometry(3.4, 20);
  pool.rotateX(-Math.PI / 2);
  pool.translate(ax, 0.03, az);
  ctx.b.add(pool, poolMaterial(), { cast: false, receive: false });
  // Faixa zebrada na base, plaquinha de número e caixa de ligação com sobra de cabo enrolada
  for (let k = 0; k < 4; k++) b.block(x - 0.175, 0.2 + k * 0.3, z - 0.175, x + 0.175, 0.35 + k * 0.3, z + 0.175, k % 2 ? PALETTE.ink : PALETTE.yellow, { solid: false, cast: false, outline: 0 });
  b.block(x - 0.12, 2.4, z - 0.18, x + 0.12, 2.62, z - 0.165, PALETTE.paper, { solid: false, cast: false, outline: 0 });
  b.block(x - 0.22, 4.2, z - 0.24, x + 0.22, 4.75, z - 0.16, PALETTE.concreteDark, { solid: false, cast: false, outline: 0.02 });
  const coil = new THREE.TorusGeometry(0.32, 0.035, 5, 14);
  coil.translate(x, 5.6, z - 0.2);
  b.add(coil, ctx.wireMat, { cast: false, receive: false });
  // Transformador em alguns postes
  if ((Math.round(x * 7 + z * 3) & 3) === 0) {
    const g = new THREE.CylinderGeometry(0.32, 0.32, 0.9, 10);
    g.translate(x + px * 0.45, H - 1.9, z + pz * 0.45);
    b.add(g, toon(PALETTE.concreteDark), { outline: 0.03 });
  }
  const y = H - 0.5;
  return [
    new THREE.Vector3(x - px * cw * 0.9, y, z - pz * cw * 0.9),
    new THREE.Vector3(x, y + 0.45, z),
    new THREE.Vector3(x + px * cw * 0.9, y, z + pz * cw * 0.9),
  ];
}

/** Fio elétrico com barriga (catenária aproximada por parábola). Sem colisão. */
export function wire(ctx: Ctx, a: THREE.Vector3, c: THREE.Vector3, sag: number) {
  const pts: THREE.Vector3[] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = a.clone().lerp(c, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.028, 4, false);
  ctx.b.add(g, ctx.wireMat, { cast: false, receive: false });
}

/** Feixe de fios entre dois pontos, cada um com barriga diferente (o "emaranhado"). */
export function wires(ctx: Ctx, as: THREE.Vector3[], cs: THREE.Vector3[], sag: number) {
  const n = Math.min(as.length, cs.length);
  for (let i = 0; i < n; i++) wire(ctx, as[i], cs[i], sag * (0.75 + i * 0.22));
}

/** Filete de neon horizontal rente a uma parede, centrado em `t`. */
export function faceNeon(ctx: Ctx, f: Face, t: number, y: number, w: number, color: number, off = 0.08) {
  const p = facePos(f, t, y, off);
  if (f.axis === 'z') neonBox(ctx, p.x - w / 2, p.y - 0.04, p.z - 0.04, p.x + w / 2, p.y + 0.04, p.z + 0.04, color);
  else neonBox(ctx, p.x - 0.04, p.y - 0.04, p.z - w / 2, p.x + 0.04, p.y + 0.04, p.z + w / 2, color);
}

/** Barreira de concreto (tipo New Jersey) com faixa rosa da OTIMIZA. */
export function barrier(ctx: Ctx, cx: number, cz: number, alongX: boolean, len = 3) {
  const hx = alongX ? len / 2 : 0.35;
  const hz = alongX ? 0.35 : len / 2;
  // A caixa de colisão e de tiro continua a mesma; o que se vê é o perfil New Jersey
  ctx.b.block(cx - hx, 0, cz - hz, cx + hx, 1.05, cz + hz, hiddenProxy, { cast: false });
  const profile = new THREE.Shape([[-0.35, 0], [0.35, 0], [0.35, 0.12], [0.27, 0.36], [0.24, 1.05], [-0.24, 1.05], [-0.27, 0.36], [-0.35, 0.12]].map(([x, y]) => new THREE.Vector2(x, y)));
  const body = new THREE.ExtrudeGeometry(profile, { depth: len, bevelEnabled: false });
  body.translate(0, 0, -len / 2);
  const yaw = alongX ? Math.PI / 2 : 0;
  ctx.b.add(place(body, cx, 0, cz, yaw), toon(PALETTE.concrete), { outline: 0.03 });
  const band = (y0: number, y1: number, half: number, color: number, l = len + 0.01, t = 0) => {
    const g = new THREE.BoxGeometry(half * 2, y1 - y0, l);
    g.translate(0, (y0 + y1) / 2, t);
    ctx.b.add(place(g, cx, 0, cz, yaw), toon(color), { cast: false });
  };
  band(0.62, 0.82, 0.262, PALETTE.pink);
  band(0, 0.1, 0.355, PALETTE.concreteDark);
  // Lascas de concreto nas pontas e marcas de batida
  for (const t of [-len / 2 + 0.25, len / 2 - 0.4]) band(0.9, 1.0, 0.245, PALETTE.paper, 0.14, t);
  band(0.25, 0.4, 0.3, PALETTE.concreteDark, 0.5, len * 0.12);
}

const hiddenProxy = (() => {
  const m = toon(PALETTE.ink).clone();
  m.visible = false;
  return m;
})();
