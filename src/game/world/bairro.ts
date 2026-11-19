import * as THREE from 'three';
import type { Box } from '../physics';
import { hex, PALETTE, toon } from '../toon';
import { Builder, place } from './builder';
import { buildCity, PLAZA, ROAD } from './city';
import {
  banca, barrier, car, crate, createCtx, type Ctx, type Face, faceBox, finishCtx, graf, neonBox, orelhao, poste, sign, wires,
} from './props';
import { slabWithHole, stairs } from './shapes';
import { buildSky } from './sky';
import { buildStreet } from './street';
import { bairroWear } from './bairro-wear';
import { paintGraffiti, paintTelao } from './textures';

// Bairro da Neo-São Paulo: um cruzamento virado praça, cercado de prédios, com passarela,
// lajes, bancas, carros largados e a entrada do metrô onde mora a Vila Analógica.

export interface World {
  /** Colisão AABB (jogador, drones e orbes). */
  solids: Box[];
  /** Bloqueio de tiro e linha de visão, derivado de `shoot`. */
  shotBlockers: Box[];
  impactSurfaces?: readonly Box[];
  /** Malhas que bloqueiam tiro (paredes, chão, cobertura). */
  shootables: THREE.Object3D[];
  /** Centro do jogador no nascimento (pés + 0.85), ao lado do metrô da Vila. */
  playerSpawn: { x: number; y: number; z: number };
  /** Pontos altos por onde os drones entram na praça. */
  droneSpawns: [number, number, number][];
  /** Animações do cenário (telões, poeira no ar). Chamar uma vez por quadro, antes do render. */
  update(dt: number, time: number): void;
}

const CURB = 0.25; // altura da calçada
const DECK = 4.5; // topo da passarela
const DECK_Z: [number, number] = [-18, -14];
const DECK_X = 26;
/** Fosso da escada do metrô (buraco no chão). */
const PIT = { x0: 12, z0: 20, x1: 16, z1: 30 };

export function buildBairro(scene: THREE.Scene): World {
  const b = new Builder(scene);
  const ctx = createCtx(scene, b);

  ctx.updaters.push(buildSky(scene, b));
  ground(ctx);
  buildCity(ctx);
  island(ctx);
  viaduct(ctx);
  lanchonete(ctx);
  laje(ctx);
  metro(ctx);
  street(ctx);
  fiacao(ctx);
  buildStreet(ctx);
  bairroWear(ctx);
  bounds(b);

  finishCtx(ctx);
  b.finish();

  return {
    solids: b.solids,
    shotBlockers: b.shotBlockers,
    impactSurfaces: b.impactSurfaces,
    shootables: b.shootables,
    playerSpawn: { x: 14, y: CURB + 0.85 + 0.01, z: 17.5 },
    droneSpawns: [
      [-34, 16, -34], [34, 16, -34], [-34, 16, 34], [34, 16, 34],
      [0, 18, -36], [0, 18, 36], [-36, 15, 0], [36, 15, 0],
      [-20, 20, -36], [20, 20, 36],
    ],
    update(dt, time) {
      for (const u of ctx.updaters) u(dt, time);
    },
  };
}

// ---------------------------------------------------------------- chão

function ground(ctx: Ctx) {
  const { b } = ctx;
  const floor = { cast: false, outline: 0 };
  for (const s of slabWithHole({ x0: -130, z0: -130, x1: 130, z1: 130 }, PIT, -4, 0)) {
    b.block(s.min.x, s.min.y, s.min.z, s.max.x, s.max.y, s.max.z, PALETTE.asphalt, floor);
  }
  // Calçadas elevadas nos quatro cantos da praça (o buraco do metrô fica na sudeste)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const r = { x0: Math.min(sx * ROAD, sx * PLAZA), x1: Math.max(sx * ROAD, sx * PLAZA), z0: Math.min(sz * ROAD, sz * PLAZA), z1: Math.max(sz * ROAD, sz * PLAZA) };
      const parts = sx > 0 && sz > 0 ? slabWithHole(r, PIT, 0, CURB) : [{ min: { x: r.x0, y: 0, z: r.z0 }, max: { x: r.x1, y: CURB, z: r.z1 } }];
      for (const p of parts) b.block(p.min.x, p.min.y, p.min.z, p.max.x, p.max.y, p.max.z, PALETTE.concrete, { cast: false, outline: 0.04 });
      // Calçadas das avenidas, fora da praça (cenário)
      const far = 106;
      b.block(sx * ROAD, 0, sz * PLAZA, sx * (ROAD + 3), CURB, sz * far, PALETTE.concrete, { solid: false, cast: false, outline: 0.04 });
      b.block(sx * PLAZA, 0, sz * ROAD, sx * far, CURB, sz * (ROAD + 3), PALETTE.concrete, { solid: false, cast: false, outline: 0.04 });
    }
  }
  const paint = { solid: false, cast: false, outline: 0 };
  // Faixas de pedestre em volta do cruzamento
  for (const s of [-1, 1]) {
    for (let x = -ROAD + 0.6; x < ROAD - 0.5; x += 1.2) {
      b.block(x, 0, s * 7.8, x + 0.6, 0.02, s * 10.6, PALETTE.paper, paint);
      b.block(s * 7.8, 0, x, s * 10.6, 0.02, x + 0.6, PALETTE.paper, paint);
    }
    // Faixa amarela tracejada no meio das avenidas
    for (let d = 12; d < 106; d += 4) {
      b.block(-0.12, 0, s * d, 0.12, 0.02, s * (d + 2), PALETTE.yellow, paint);
      b.block(s * d, 0, -0.12, s * (d + 2), 0.02, 0.12, PALETTE.yellow, paint);
    }
  }
}

// ---------------------------------------------------------------- praça

/** Ilhota no meio do cruzamento com o totem da OTIMIZA (anel do sorriso, rachado). */
function island(ctx: Ctx) {
  const { b } = ctx;
  b.block(-4.5, 0, -4.5, 4.5, 0.3, 4.5, PALETTE.concrete, { cast: false });
  // Floreiras em L nos cantos: cobertura baixa
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.block(sx * 4.4, 0.3, sz * 4.4, sx * 2, 1.1, sz * 3.8, PALETTE.concreteDark);
      b.block(sx * 4.4, 0.3, sz * 3.8, sx * 3.8, 1.1, sz * 2, PALETTE.concreteDark);
    }
  }
  b.block(-1.2, 0.3, -1.2, 1.2, 6.6, 1.2, PALETTE.paper);
  b.block(-1.35, 6.6, -1.35, 1.35, 6.9, 1.35, PALETTE.pink);
  const screen = ctx.signs.draw(512, 192, (g, w, h) => paintTelao(g, w, h, { title: 'SORRIA :)', sub: 'VOCÊ ESTÁ SENDO MEDIDO', bg: PALETTE.pink, fg: PALETTE.yellow }));
  const faces: Face[] = [
    { axis: 'z', at: 1.2, n: 1 }, { axis: 'z', at: -1.2, n: -1 },
    { axis: 'x', at: 1.2, n: 1 }, { axis: 'x', at: -1.2, n: -1 },
  ];
  for (const f of faces) sign(ctx, f, screen, 0, 5.4, 2.2, 0.82, 0.03);
  const tag = ctx.graffiti.draw(512, 256, (g, w, h) => paintGraffiti(g, w, h, 'A META É VOCÊ', 'pixo', PALETTE.ink));
  const tag2 = ctx.graffiti.draw(512, 256, (g, w, h) => paintGraffiti(g, w, h, 'DESPLUGA', 'bubble', PALETTE.yellow, PALETTE.pink));
  graf(ctx, faces[0], tag, 0, 2.6, 2.3, 1.15);
  graf(ctx, faces[1], tag2, 0, 2.4, 2.3, 1.15);
  graf(ctx, faces[2], tag2, 0, 3.4, 2.3, 1.15);
  const ring = new THREE.TorusGeometry(2.1, 0.32, 8, 28);
  place(ring, 0, 9.2, 0, 0.4, 0, 0.32);
  b.add(ring, toon(PALETTE.yellow), { outline: 0.05 });
}

/** Passarela atravessando a avenida, com escadas de degraus nas duas pontas. */
function viaduct(ctx: Ctx) {
  const { b } = ctx;
  const [z0, z1] = DECK_Z;
  b.block(-DECK_X, DECK - 1, z0, DECK_X, DECK, z1, PALETTE.concrete);
  // Guarda-corpo: o lado norte tem um vão para quem pula do telhado da lanchonete
  b.block(-DECK_X, DECK, z0, 19, DECK + 1, z0 + 0.15, PALETTE.concreteDark);
  b.block(25, DECK, z0, DECK_X, DECK + 1, z0 + 0.15, PALETTE.concreteDark);
  b.block(-DECK_X, DECK, z1 - 0.15, DECK_X, DECK + 1, z1, PALETTE.concreteDark);
  b.block(-DECK_X, DECK + 0.95, z1 - 0.2, DECK_X, DECK + 1.1, z1 + 0.05, PALETTE.pink, { solid: false, outline: 0.02 });
  for (const x of [-18, -8, 8, 18]) b.block(x - 0.6, 0, z0 + 1.1, x + 0.6, DECK - 1, z1 - 1.1, PALETTE.concreteDark);
  for (const dir of [1, -1] as const) {
    const n = Math.ceil((DECK - CURB) / 0.4 - 1e-9);
    const start = -dir * (DECK_X + n * 0.6);
    for (const s of stairs({ axis: 'x', start, dir, across: [z0, z1], base: CURB, top: DECK, floor: 0 })) {
      b.block(s.min.x, s.min.y, s.min.z, s.max.x, s.max.y, s.max.z, PALETTE.concrete, { outline: 0.03 });
    }
  }
  const south: Face = { axis: 'z', at: z1, n: 1 };
  const north: Face = { axis: 'z', at: z0, n: -1 };
  const desp = ctx.graffiti.draw(1024, 160, (g, w, h) => paintGraffiti(g, w, h, 'DESPLUGA', 'bubble', PALETTE.yellow, PALETTE.cyan));
  const ctrl = ctx.graffiti.draw(1024, 128, (g, w, h) => paintGraffiti(g, w, h, 'OTIMIZA = CONTROLE', 'stencil', PALETTE.ink));
  graf(ctx, south, desp, -17, DECK - 0.5, 12, 1.9);
  graf(ctx, north, ctrl, 0, DECK - 0.5, 12, 1.5);
  // Faixa da OTIMIZA pendurada sobre a avenida
  const banner = ctx.signs.draw(1536, 192, (g, w, h) => paintTelao(g, w, h, { title: 'SORRIA, VOCÊ ESTÁ SENDO AJUDADO :)', sub: 'OTIMIZA • PREFEITURA DA FELICIDADE', bg: PALETTE.pink, fg: PALETTE.paper }));
  sign(ctx, south, banner, 0, DECK - 1.6, 13, 1.6, 0.05);
  faceBox(ctx, south, 0, DECK - 0.75, 13.4, 0.12, 0.08, toon(PALETTE.ink));
}

/** Lanchonete térrea: crate → banca → telhado → passarela, tudo no pulo. */
function lanchonete(ctx: Ctx) {
  const { b } = ctx;
  b.block(18.5, 0, -27, 26, 3.6, -18.5, PALETTE.wine);
  b.block(18.5, 3.6, -27, 26, 3.75, -26.7, PALETTE.paper, { outline: 0.02 });
  b.block(23.6, 3.6, -26.4, 25.4, 4.9, -24.6, PALETTE.cyan); // caixa d'água
  const west: Face = { axis: 'x', at: 18.5, n: -1 };
  const label = ctx.signs.draw(512, 112, (g, w, h) => {
    g.fillStyle = hex(PALETTE.yellow);
    g.fillRect(0, 0, w, h);
    g.fillStyle = hex(PALETTE.wine);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = "900 54px 'Arial Black', sans-serif";
    g.fillText('LANCHONETE 24H', w / 2, h / 2);
  });
  sign(ctx, west, label, -22.7, 3.1, 7.2, 1.0, 0.04);
  faceBox(ctx, west, -21.5, 1.3, 3, 2.3, 0.04, toon(PALETTE.ink));
  crate(ctx, 13, CURB, -22, 1.1);
  crate(ctx, 11.8, CURB, -23.1, 0.9);
  banca(ctx, 14.5, -23.2, 17.7, -20.8, { axis: 'z', at: -20.8, n: 1 }, revistas(ctx));
}

let revistasUV: ReturnType<Ctx['signs']['draw']> | null = null;
function revistas(ctx: Ctx) {
  revistasUV ??= ctx.signs.draw(512, 96, (g, w, h) => {
    g.fillStyle = hex(PALETTE.ink);
    g.fillRect(0, 0, w, h);
    g.fillStyle = hex(PALETTE.yellow);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = "900 46px 'Arial Black', sans-serif";
    g.fillText('BANCA • REVISTAS', w / 2, h / 2);
  });
  return revistasUV;
}

/** Casa de laje com caixa d'água: telhado acessível por caixotes empilhados. */
function laje(ctx: Ctx) {
  const { b } = ctx;
  b.block(-34, 0, 22, -22, 3.2, 34, PALETTE.sky);
  b.block(-34, 3.2, 33.6, -22, 3.7, 34, PALETTE.concrete, { outline: 0.02 });
  b.block(-34, 3.2, 22, -33.6, 3.7, 34, PALETTE.concrete, { outline: 0.02 });
  b.block(-33, 3.2, 31, -31, 5, 33, PALETTE.cyan); // caixa d'água
  b.block(-25.5, 3.2, 32.8, -25.38, 7.5, 32.92, PALETTE.ink, { solid: false, outline: 0 }); // antena
  crate(ctx, -21.3, CURB, 27, 1.2, 2.05);
  crate(ctx, -19.6, CURB, 27, 1.1);
  const north: Face = { axis: 'z', at: 22, n: -1 };
  const meta = ctx.graffiti.draw(1024, 256, (g, w, h) => paintGraffiti(g, w, h, 'A META É VOCÊ', 'bubble', PALETTE.pink, PALETTE.cyan));
  graf(ctx, north, meta, -28, 1.9, 10, 2.5);
  banca(ctx, -14.5, 12.5, -11.3, 14.9, { axis: 'z', at: 12.5, n: -1 }, revistas(ctx));
}

/** Entrada do metrô destruída: escada descendo para a Vila Analógica. */
function metro(ctx: Ctx) {
  const { b } = ctx;
  for (const s of stairs({ axis: 'z', start: 28, dir: -1, across: [PIT.x0, PIT.x1], base: -3.5, top: CURB, floor: -4, depth: 0.8 })) {
    b.block(s.min.x, s.min.y, s.min.z, s.max.x, s.max.y, s.max.z, PALETTE.concreteDark, { outline: 0.03 });
  }
  b.block(PIT.x0, -4, 28, PIT.x1, -3.5, PIT.z1, PALETTE.concreteDark, { cast: false });
  // Mureta em volta do buraco (aberta para o norte)
  b.block(PIT.x0 - 0.4, CURB, PIT.z0, PIT.x0, 1.25, PIT.z1 + 0.4, PALETTE.paper);
  b.block(PIT.x1, CURB, PIT.z0, PIT.x1 + 0.4, 1.25, PIT.z1 + 0.4, PALETTE.paper);
  b.block(PIT.x0, CURB, PIT.z1, PIT.x1, 1.25, PIT.z1 + 0.4, PALETTE.paper);
  // Pórtico com a placa velha repintada
  b.block(PIT.x0 - 0.4, CURB, 19.6, PIT.x0, 3.6, 20, PALETTE.paper);
  b.block(PIT.x1, CURB, 19.6, PIT.x1 + 0.4, 3.6, 20, PALETTE.paper);
  b.block(PIT.x0 - 0.4, 3.6, 19.6, PIT.x1 + 0.4, 4.4, 20, PALETTE.paper);
  const front: Face = { axis: 'z', at: 19.6, n: -1 };
  const placa = ctx.signs.draw(1024, 176, (g, w, h) => {
    g.fillStyle = hex(PALETTE.glass);
    g.fillRect(0, 0, w, h);
    g.fillStyle = hex(PALETTE.paper);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = "900 64px 'Arial Black', sans-serif";
    g.fillText('METRÔ • ESTAÇÃO PRAÇA DA META', w / 2, h / 2, w * 0.92);
    paintGraffiti(g, w, h, 'VILA ANALÓGICA', 'bubble', PALETTE.yellow, PALETTE.ink);
  });
  sign(ctx, front, placa, 14, 4.0, 4.8, 0.82, 0.02);
  // Cobertura desabada (decorativa) e entulho
  const roof = new THREE.BoxGeometry(5.4, 0.3, 6.5);
  place(roof, 14.4, 3.2, 23.6, 0, 0.22, -0.14);
  b.add(roof, toon(PALETTE.concrete), { outline: 0.04 });
  b.block(16.8, CURB, 21, 18.4, 0.9, 24, PALETTE.concrete);
  b.block(17.2, 0.9, 21.6, 18, 1.3, 22.8, PALETTE.concreteDark);
  crate(ctx, 10.6, CURB, 23.5, 0.9, 0.9, PALETTE.yellow);
  // Totem do "M" do metrô, hoje da Vila
  b.block(17.8, CURB, 18.6, 18.2, 4.3, 19, PALETTE.ink, { outline: 0.02 });
  neonBox(ctx, 17.45, 4.3, 18.45, 18.55, 5.4, 19.15, PALETTE.yellow);
  // Porta lá embaixo, acesa em amarelo
  const door: Face = { axis: 'z', at: PIT.z1, n: -1 };
  faceBox(ctx, door, 14, -2.2, 2.6, 2.6, 0.05, toon(PALETTE.yellow), 0);
  faceBox(ctx, door, 14, -2.1, 2.0, 2.3, 0.08, toon(PALETTE.ink), 0);
  neonBox(ctx, 12.8, -0.6, PIT.z1 - 0.2, 15.2, -0.45, PIT.z1 - 0.05, PALETTE.yellow);
  const aqui = ctx.graffiti.draw(512, 128, (g, w, h) => paintGraffiti(g, w, h, 'AQUI NINGUÉM TE MEDE', 'stencil', PALETTE.yellow));
  graf(ctx, { axis: 'x', at: PIT.x0, n: 1 }, aqui, 25, -1.6, 4, 1);
  // "VILA ANALÓGICA ↓" gigante na parede sul da praça, em cima da entrada
  const vila = ctx.graffiti.draw(1024, 256, (g, w, h) => paintGraffiti(g, w, h, 'VILA ANALÓGICA ↓', 'bubble', PALETTE.yellow, PALETTE.ink));
  graf(ctx, { axis: 'z', at: PLAZA, n: -1 }, vila, 14, 8.2, 15, 3.75);
}

/** Cobertura espalhada: carros, barricadas, caixotes, orelhões. */
function street(ctx: Ctx) {
  car(ctx, -3.2, 18.5, false, PALETTE.pink);
  car(ctx, 3.5, -27, false, PALETTE.cyan);
  car(ctx, 21, 3, true, PALETTE.yellow);
  car(ctx, -17, -3.5, true, PALETTE.paper);
  car(ctx, -31, 2.5, false, PALETTE.orange);
  car(ctx, 4.5, 30, false, PALETTE.lilac);
  // Bloqueios da OTIMIZA nas saídas da praça
  const stop = ctx.signs.draw(512, 96, (g, w, h) => {
    g.fillStyle = hex(PALETTE.pink);
    g.fillRect(0, 0, w, h);
    g.fillStyle = hex(PALETTE.paper);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = "900 40px 'Arial Black', sans-serif";
    g.fillText('ZONA EM OTIMIZAÇÃO :)', w / 2, h / 2, w * 0.94);
  });
  for (const s of [-1, 1]) {
    for (const t of [-5, 0, 5]) {
      barrier(ctx, t, s * 36.5, true);
      barrier(ctx, s * 36.5, t, false);
    }
    sign(ctx, { axis: 'z', at: s * 36.5 - s * 0.35, n: (-s) as 1 | -1 }, stop, 0, 0.5, 2.6, 0.48, 0.02);
    sign(ctx, { axis: 'x', at: s * 36.5 - s * 0.35, n: (-s) as 1 | -1 }, stop, 0, 0.5, 2.6, 0.48, 0.02);
  }
  barrier(ctx, -12, 2.5, false);
  barrier(ctx, 12.5, -2.5, false);
  barrier(ctx, 2.5, 11.5, true);
  barrier(ctx, -2.5, -11.5, true);
  for (const [x, z, s] of [[-9.6, 10.5, 1], [-10.5, 9.6, 0.8], [25, 12, 1.2], [26.2, 12.3, 0.9], [-28, -10, 1.1], [30, 30, 1.2], [-30, -30, 1], [28.8, -31, 1.3], [-12, -30, 1]]) {
    crate(ctx, x, CURB, z, s);
  }
  orelhao(ctx, 9.2, 12, Math.PI / 2);
  orelhao(ctx, -9.2, -24, -Math.PI / 2);
  orelhao(ctx, 28, 9.2, 0);
  orelhao(ctx, -26, -9.2, Math.PI);
}

/** Postes e o emaranhado de fios: a assinatura visual de uma rua de São Paulo. */
function fiacao(ctx: Ctx) {
  const C = 8.3;
  const fac = (x: number, y: number, z: number) => [new THREE.Vector3(x, y - 0.35, z), new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + 0.35, z)];
  // Postes por lado: ns[sx][sz][k] na avenida norte-sul, ew[sx][sz][k] na leste-oeste
  const key = (sx: number, sz: number) => `${sx},${sz}`;
  const ns = new Map<string, THREE.Vector3[][]>();
  const ew = new Map<string, THREE.Vector3[][]>();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const corner = poste(ctx, sx * C, sz * C, -sx, 0);
      const n = [21, 33].map((d) => poste(ctx, sx * C, sz * d, -sx, 0));
      const e = [21, 33].map((d) => poste(ctx, sx * d, sz * C, 0, -sz));
      ns.set(key(sx, sz), n);
      ew.set(key(sx, sz), e);
      wires(ctx, corner, n[0], 0.6);
      wires(ctx, n[0], n[1], 0.55);
      wires(ctx, n[1], fac(sx * (ROAD + 3), 9.5, sz * 45), 0.5);
      wires(ctx, corner, e[0], 0.6);
      wires(ctx, e[0], e[1], 0.55);
      wires(ctx, e[1], fac(sx * 45, 9.5, sz * (ROAD + 3)), 0.5);
      // Da rua para as fachadas da praça (passam por cima de tudo)
      wires(ctx, n[1], fac(sx * 22, 11, sz * PLAZA), 0.9);
      wires(ctx, e[1], fac(sx * PLAZA, 11, sz * 22), 0.9);
      wires(ctx, fac(sx * PLAZA, 12, sz * 31), fac(sx * 31, 12, sz * PLAZA), 0.7);
    }
  }
  // Atravessando as avenidas
  for (const s of [-1, 1]) {
    for (const k of [0, 1]) {
      wires(ctx, ns.get(key(-1, s))![k], ns.get(key(1, s))![k], 1.0);
      wires(ctx, ew.get(key(s, -1))![k], ew.get(key(s, 1))![k], 1.0);
    }
  }
  // Par de tênis jogado no fio: marca de quem é do bairro
  for (const [z, k] of [[21, 0], [-33, 1]] as const) {
    const y = 8.55 - 1.0 * (0.75 + 0.22); // fio do meio (topo do poste), na barriga
    for (const dx of [-0.13, 0.13]) {
      ctx.b.block(dx - 0.006, y - 0.42, z - 0.006, dx + 0.006, y, z + 0.006, PALETTE.paper, { solid: false, cast: false, outline: 0 });
      ctx.b.block(dx - 0.07, y - 0.56, z - 0.15, dx + 0.07, y - 0.42, z + 0.14, k ? PALETTE.pink : PALETTE.cyan, { solid: false, cast: false, outline: 0.02 });
      ctx.b.block(dx - 0.075, y - 0.58, z - 0.16, dx + 0.075, y - 0.54, z + 0.15, PALETTE.paper, { solid: false, cast: false, outline: 0 });
    }
  }
  // Dois feixes cruzando o cruzamento na diagonal
  wires(ctx, fac(-C, 7.9, -C), fac(C, 7.9, C), 1.6);
  wires(ctx, fac(C, 7.9, -C), fac(-C, 7.9, C), 1.4);
}

/** Paredes invisíveis: o jogador não sai da praça e os drones não fogem por cima. */
function bounds(b: Builder) {
  const L = PLAZA;
  b.invisible(-L - 2, -5, -L - 2, -L, 60, L + 2);
  b.invisible(L, -5, -L - 2, L + 2, 60, L + 2);
  b.invisible(-L - 2, -5, -L - 2, L + 2, 60, -L);
  b.invisible(-L - 2, -5, L, L + 2, 60, L + 2);
  b.invisible(-L - 2, 40, -L - 2, L + 2, 42, L + 2); // teto
}
