// Arena 1 / Pelourinho: recorte jogável de Salvador, com o largo em declive e o
// Rosário como referência de escala e silhueta. Três rotas, dois sites, defesa ao norte
// (z negativo) e ataque ao sul (z positivo). Dados puros, sem Three.js.
//
// Tema no greybox: paredes = fileiras de casarões de 2–3 andares (alturas variadas) formando
// ruas estreitas; os longs são ladeiras (terraços de 0.4) com uma sacada cada; o meio é o
// "largo" triangular em declive; o site B é o adro de uma igreja com escadaria larga.
//
// Planta (x para a direita, z para baixo; cada caractere ~ 8 m):
//
//   z=-44  ##ct-A###[DEF]###ct-B##
//          [ A  ]####|##|####[  B ]      A/B: sites (z -36..-12)
//          [site]=short=|=short=[site]   short: conectores meio -> site
//          |long|###[ MEIO ]###|long|    MEIO: praça com quiosque no centro
//          |  A |####|  |####|  B |
//          |lobby A=[ATK]=lobby B |
//   z=+44
//
// Oeste e centro preservam o circuito original; leste tem o largo assimétrico até a igreja.
import type { Box, Vec3 } from '../physics';
import { box, type Rect, stairs } from '../world/shapes';
import type { MapData, MapLabel, MapSolid, SolidKind, Tint, Zone } from './types';

const H2 = 9; // sobrado colonial: térreo alto + pavimento superior
const H3 = 13; // três pavimentos, como o casario do largo
const CHURCH = 14; // cornija da igreja; campanários são montados acima
const EDGE = 11; // casario contínuo delimita o bairro
const LOW = 1; // cobertura baixa
const TALL = 2; // cobertura alta
const STEP_DEPTH = 0.6;

const BOUNDS: Rect = { x0: -60, z0: -44, x1: 60, z1: 44 };

const solids: MapSolid[] = [];

function put(kind: SolidKind, tint: Tint, b: Box) {
  solids.push({ box: b, kind, tint });
}

const swapTint = (t: Tint): Tint => ({ A: 'B', B: 'A', routeA: 'routeB', routeB: 'routeA' } as Record<string, Tint>)[t] ?? t;
const mirrorBox = (b: Box): Box => box(-b.max.x, b.min.y, b.min.z, -b.min.x, b.max.y, b.max.z);

/** Peça do lado oeste (A) e a cópia espelhada no lado leste (B). */
function both(kind: SolidKind, tint: Tint, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const b = box(x0, y0, z0, x1, y1, z1);
  put(kind, tint, b);
  put(kind, swapTint(tint), mirrorBox(b));
}

/** Escada que sobe até a borda `edge` de uma plataforma, avançando no sentido `dir`. */
function stairsTo(tint: Tint, axis: 'x' | 'z', edge: number, dir: 1 | -1, across: [number, number], top: number, base = 0) {
  const n = Math.ceil((top - base) / 0.4 - 1e-9);
  for (const s of stairs({ axis, start: edge - dir * n * STEP_DEPTH, dir, across, base, top, depth: STEP_DEPTH })) {
    put('stairs', tint, s);
  }
}

// ---------------------------------------------------------------- chão e limites

put('ground', 'neutral', box(BOUNDS.x0, -1, BOUNDS.z0, BOUNDS.x1, 0, BOUNDS.z1));
{
  const { x0, z0, x1, z1 } = BOUNDS;
  // Muro visível em volta
  put('edge', 'neutral', box(x0 - 1, 0, z0 - 1, x0, EDGE, z1 + 1));
  put('edge', 'neutral', box(x1, 0, z0 - 1, x1 + 1, EDGE, z1 + 1));
  put('edge', 'neutral', box(x0, 0, z0 - 1, x1, EDGE, z0));
  put('edge', 'neutral', box(x0, 0, z1, x1, EDGE, z1 + 1));
  // Invisível do muro até o teto (drones não fogem por cima) e o teto
  put('bound', 'neutral', box(x0 - 2, EDGE, z0 - 2, x0, 42, z1 + 2));
  put('bound', 'neutral', box(x1, EDGE, z0 - 2, x1 + 2, 42, z1 + 2));
  put('bound', 'neutral', box(x0, EDGE, z0 - 2, x1, 42, z0));
  put('bound', 'neutral', box(x0, EDGE, z1, x1, 42, z1 + 2));
  put('bound', 'neutral', box(x0 - 2, 40, z0 - 2, x1 + 2, 42, z1 + 2));
}

// ---------------------------------------------------------------- casarões (lado A, espelhados)

// Fileiras de casarões: 2 andares (H2) ou 3 andares (H3), ruas estreitas entre elas
put('wall', 'neutral', box(-46, 0, 8, -6, H3, 24));
put('wall', 'neutral', box(-46, 0, -12, -14, H2 + 1.5, 8));
// Leste: largo de verdade, largo no alto e estreito junto à igreja. Os lotes em
// degraus substituem o long espelhado; cada telhado acompanha a descida da rua.
put('wall', 'neutral', box(6, 0, 8, 32, 14, 24));
put('wall', 'neutral', box(14, 0, 0, 36, 12.5, 8));
put('wall', 'neutral', box(14, 0, -6, 40, 11, 0));
put('wall', 'neutral', box(14, 0, -12, 44, 9.5, -6));
both('wall', 'neutral', -32, 0, -26, -6, H2 + 1.5, -18); // entre site A e o short
both('wall', 'neutral', -32, 0, -36, -10, H2, -26); // entre CT e o short
both('wall', 'neutral', -10, 0, -30, -6, H2, -26); // canto do spawn da defesa
put('wall', 'neutral', box(-60, 0, -44, -42, H2, -36)); // fundo do CT A (no B fica a igreja)
both('wall', 'neutral', -60, 0, 36, -10, H3, 44); // fundo do lobby
both('wall', 'neutral', -10, 0, 24, -6, H2, 30); // canto do spawn do ataque
// Quebras de linha de visão
both('wall', 'neutral', -30, 0, 29, -24, H2 + 1.5, 36); // lobby: bloco do sul
both('wall', 'neutral', -40, 0, 24, -36, H2, 29.5); // lobby: bloco do norte
both('wall', 'neutral', -24, 0, -40, -20, H2, -36); // corredor CT
// Portas da ladeira em zigue-zague (choke)
put('wall', 'neutral', box(-60, 0, 6, -51, H2, 8));
put('wall', 'neutral', box(-55, 0, -2, -46, H2, 0));

// Ladeiras (os longs): sobem do lobby em terraços de 0.4 e descem 0.4 antes do site
put('terrace', 'routeA', box(-60, 0, 16, -46, 0.4, 24));
put('terrace', 'routeA', box(-60, 0, -6, -46, 0.8, 16));
put('terrace', 'routeA', box(-60, 0, -10, -46, 0.4, -6));
// 3,2 m de desnível em 32 m. Microdegraus de 0,1 m: a mesma inclinação aparece
// na rua, no perfil dos telhados e na vista da igreja, sem introduzir rampas.
for (let i = 0; i < 32; i++) {
  const z0 = -8 + i;
  const left = z0 < -4 ? 44 : z0 < 0 ? 40 : z0 < 8 ? 36 : 32;
  put('terrace', 'routeB', box(left, 0, z0, 60, (i + 1) / 10, z0 + 1));
}
// Escadarias do topo e dos becos laterais mantêm todo o circuito acessível.
stairsTo('routeB', 'z', 24, -1, [32, 60], 3.2);
stairsTo('routeB', 'x', 32, 1, [24, 29], 3.2);
stairsTo('routeB', 'z', 8, 1, [32, 36], 1.6);
stairsTo('routeB', 'z', -6, -1, [40, 44], 0.4);
// Sacada de casarão na ladeira (posição alta), com escada pelo lado do lobby
put('platform', 'routeA', box(-48, 0, 10, -46, 2.8, 20));
put('low', 'routeA', box(-48.3, 2.8, 10, -48, 2.8 + LOW, 18));
stairsTo('routeA', 'z', 20, -1, [-48, -46], 2.8, 0.4);

// Meio = largo triangular em declive: alto ao norte (1.2), baixo ao sul (0)
put('terrace', 'mid', box(-14, 0, -8, 14, 1.2, -5));
put('terrace', 'mid', box(-14, 0, -5, 14, 0.8, -1));
put('terrace', 'mid', box(-14, 0, -1, 14, 0.4, 3));
stairsTo('mid', 'z', -8, 1, [-6, 6], 1.2); // do meio-norte sobe para o alto do largo
both('wall', 'neutral', -14, 0, 4, -10, H2, 8); // casarões fecham o triângulo no sul
both('wall', 'neutral', -14, 0, 0, -12, H2, 4);
// Pilar que separa os dois shorts e o chafariz/pelourinho no meio do largo
put('wall', 'neutral', box(-2, 0, -21, 2, H2, -11));
put('tall', 'mid', box(-6.5, 0, -3, 6.5, 4, 3));
// Sacadas do largo (top mid): 0.4 acima do alto do largo, de frente para os shorts
both('platform', 'mid', -14, 0, -12, -6, 1.6, -8);
both('low', 'mid', -9, 1.6, -8.3, -6, 1.6 + LOW, -8);

// Spawns: um bloco atrás de cada time (também corta a linha de visão do CT)
put('tall', 'def', box(-4, 0, -44, 4, 3, -39));
put('tall', 'atk', box(-4, 0, 40, 4, 3, 44));
put('tall', 'atk', box(-1.5, 0, 30, 1.5, 3, 35.5)); // corta a visão de lobby a lobby

// ---------------------------------------------------------------- site A: palco + "céu"

put('platform', 'A', box(-50, 0, -28, -42, 1.2, -20)); // palco (onde planta)
stairsTo('A', 'z', -20, -1, [-48, -44], 1.2);
stairsTo('A', 'x', -42, -1, [-26, -22], 1.2);
put('low', 'A', box(-49.6, 1.2, -27.6, -48.4, 1.2 + LOW, -26.4));
put('platform', 'A', box(-60, 0, -36, -56, 2.8, -22)); // céu: varanda corrida no casarão oeste
stairsTo('A', 'z', -22, -1, [-60, -57], 2.8);
put('low', 'A', box(-56.3, 2.8, -36, -56, 2.8 + LOW, -24)); // parapeito do céu
put('tall', 'A', box(-40, 0, -33, -38, TALL, -31));
put('low', 'A', box(-38, 0, -33, -36, LOW, -31));
put('low', 'A', box(-37, 0, -25, -35, LOW, -23));
put('tall', 'A', box(-40, 0, -20, -38, 2.4, -12)); // quina na saída do short
put('tall', 'A', box(-53, 0, -16, -51, TALL, -14));

// ---------------------------------------------------------------- site B: adro da igreja

put('wall', 'B', box(42, 0, -44, 60, CHURCH, -36)); // igreja (fachada para o adro)
put('wall', 'B', box(42, CHURCH, -40, 46, CHURCH + 4, -36)); // torres na fachada
put('wall', 'B', box(56, CHURCH, -40, 60, CHURCH + 4, -36));
put('platform', 'B', box(44, 0, -36, 60, 2, -28)); // adro
stairsTo('B', 'z', -28, -1, [48, 60], 2); // escadaria larga
stairsTo('B', 'x', 44, 1, [-36, -33], 2); // escada lateral (lado do CT)
put('low', 'B', box(44, 2, -28.3, 48, 2 + LOW, -28)); // mureta do adro
put('tall', 'B', box(42, 0, -28, 46, 3.2, -22)); // cobertura lateral: vista da igreja livre
put('low', 'B', box(36, 0, -31, 38, LOW, -29));
put('tall', 'B', box(50, 0, -22, 52, TALL, -20));
put('low', 'B', box(52, 0, -18, 54, LOW, -16));
put('low', 'B', box(34, 0, -24, 36, LOW, -22));
put('tall', 'B', box(38, 0, -20, 40, 2.4, -12)); // quina na saída do short

// ---------------------------------------------------------------- coberturas nas rotas

put('low', 'mid', box(-5, 0, 18, -3, LOW, 20));
put('tall', 'mid', box(3, 0, 12, 5, TALL, 14));
put('low', 'mid', box(3, 0, -25, 5, LOW, -23));
put('low', 'mid', box(-9, 0, 5, -7, LOW, 7));
put('low', 'mid', box(9, 0.4, -1, 11, 0.4 + LOW, 1));
put('low', 'routeA', box(-20, 0, 32, -18, LOW, 34));
put('low', 'routeA', box(-58, 0.8, 14, -56, 0.8 + LOW, 16));
put('tall', 'routeA', box(-50, 0.4, 20, -48, 0.4 + TALL, 22));
put('low', 'routeB', box(16, 0, 25, 18, LOW, 27));
put('tall', 'routeB', box(56, 2.5, 16, 58, 2.5 + TALL, 18));
put('low', 'routeB', box(36, 2.1, 12, 38, 2.1 + LOW, 14));
put('low', 'routeB', box(43, 0.9, 0, 45, 0.9 + LOW, 2));

// ---------------------------------------------------------------- zonas

function mirrorZone(z: Zone, id: string, name: string): Zone {
  return { ...z, id, name, tint: swapTint(z.tint), rect: { x0: -z.rect.x1, z0: z.rect.z0, x1: -z.rect.x0, z1: z.rect.z1 } };
}

const westZones: Zone[] = [
  { id: 'siteA', name: 'SITE A', rect: { x0: -60, z0: -36, x1: -32, z1: -12 }, tint: 'A', site: true },
  { id: 'longA', name: 'LADEIRA A', rect: { x0: -60, z0: -12, x1: -46, z1: 36 }, tint: 'routeA' },
  { id: 'lobbyA', name: 'LOBBY A', rect: { x0: -46, z0: 24, x1: -10, z1: 36 }, tint: 'routeA' },
  { id: 'shortA', name: 'SHORT A', rect: { x0: -32, z0: -18, x1: -6, z1: -12 }, tint: 'routeA' },
  { id: 'ctA', name: 'CT A', rect: { x0: -42, z0: -44, x1: -10, z1: -36 }, tint: 'def' },
];

const zones: Zone[] = [
  ...westZones,
  mirrorZone(westZones[0], 'siteB', 'SITE B (ADRO)'),
  { id: 'longB', name: 'LARGO DO PELOURINHO', rect: { x0: 32, z0: -12, x1: 60, z1: 24 }, tint: 'routeB' },
  { id: 'lobbyB', name: 'ALTO DO PELÔ', rect: { x0: 10, z0: 24, x1: 60, z1: 36 }, tint: 'routeB' },
  mirrorZone(westZones[3], 'shortB', 'SHORT B'),
  mirrorZone(westZones[4], 'ctB', 'CT B'),
  { id: 'mid', name: 'LARGO (MEIO)', rect: { x0: -14, z0: -8, x1: 14, z1: 8 }, tint: 'mid' },
  { id: 'midN', name: 'MEIO NORTE', rect: { x0: -6, z0: -30, x1: 6, z1: -8 }, tint: 'mid' },
  { id: 'midS', name: 'MEIO SUL', rect: { x0: -6, z0: 8, x1: 6, z1: 30 }, tint: 'mid' },
  { id: 'def', name: 'DEFESA', rect: { x0: -10, z0: -44, x1: 10, z1: -30 }, tint: 'def' },
  { id: 'atk', name: 'ATAQUE', rect: { x0: -10, z0: 30, x1: 10, z1: 44 }, tint: 'atk' },
];

// ---------------------------------------------------------------- letreiros

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const labels: MapLabel[] = [
  // A: nas três entradas (long, short e CT), voltados para quem chega
  { text: 'A', tint: 'A', at: v(-55.5, 3.2, 8), axis: 'z', n: 1, width: 2.4 },
  { text: 'A', tint: 'A', at: v(-6, 3.2, -21), axis: 'x', n: 1, width: 2.4 },
  { text: 'A', tint: 'A', at: v(-28, 3.2, -36), axis: 'z', n: -1, width: 2.4 },
  { text: 'A', tint: 'A', at: v(-46, 1.21, -24), axis: 'floor', n: 1, width: 5 },
  { text: 'B', tint: 'B', at: v(36, 3.2, 4), axis: 'x', n: 1, width: 2.4 },
  { text: 'B', tint: 'B', at: v(6, 3.2, -21), axis: 'x', n: -1, width: 2.4 },
  { text: 'B', tint: 'B', at: v(28, 3.2, -36), axis: 'z', n: -1, width: 2.4 },
  { text: 'B', tint: 'B', at: v(44, 0.03, -16), axis: 'floor', n: 1, width: 4 },
  { text: 'MEIO', tint: 'mid', at: v(0, 2.8, 3), axis: 'z', n: 1, width: 4.4 },
  { text: 'MEIO', tint: 'mid', at: v(0, 2.8, -3), axis: 'z', n: -1, width: 4.4 },
  { text: 'MEIO', tint: 'mid', at: v(6.5, 2.8, 0), axis: 'x', n: 1, width: 4.4 },
  { text: 'MEIO', tint: 'mid', at: v(-6.5, 2.8, 0), axis: 'x', n: -1, width: 4.4 },
  { text: 'ATAQUE', tint: 'atk', at: v(0, 2, 40), axis: 'z', n: -1, width: 6 },
  { text: 'DEFESA', tint: 'def', at: v(0, 2, -39), axis: 'z', n: 1, width: 6 },
];

// ---------------------------------------------------------------- spawns

const row = (z: number) => [-6, -3, 0, 3, 6].map((x) => v(x, 0, z));

export const ARENA1: MapData = {
  id: 'arena1',
  name: 'Pelourinho · Salvador',
  bounds: BOUNDS,
  wallHeight: CHURCH,
  solids,
  zones,
  spawns: {
    attack: row(37),
    defend: row(-37),
    ffa: [
      v(-40, 0, -35), // site A, fundo
      v(50, 0, -17), // site B, frente
      v(-53, 0.4, 18), // ladeira A
      v(49, 3.2, 23), // alto do largo
      v(-33, 0, 26), // lobby A
      v(36, 0, 33), // lobby B
      v(-11, 0.4, 1), // largo, oeste
      v(8.5, 0, 6), // largo, leste
      v(-30, 0, -42), // CT A
      v(30, 0, -38), // CT B
      v(0, 0, 22), // meio sul
      v(-3, 0, -26), // meio norte
    ],
  },
  playerSpawn: v(49, 3.2, 23), // primeira vista: largo em declive, igreja azul ao fundo
  droneSpawns: [
    [-50, 22, 0], [50, 22, 0], [0, 22, -20], [0, 22, 20],
    [-40, 22, -40], [40, 22, -40], [-40, 22, 36], [40, 22, 36],
    [-25, 22, 0], [25, 22, 0],
  ],
  labels,
};
