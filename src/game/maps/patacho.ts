// Patacho: homenagem autoral; mar ao leste, coqueiral ao oeste e três rotas abertas.
import { box } from '../world/shapes';
import type { MapData, MapSolid, SolidKind } from './types';

const solids: MapSolid[] = [];
function put(kind: SolidKind, x: number, z: number, w: number, d: number, h: number, y = 0) {
  const s: MapSolid = { kind, tint: 'neutral', box: box(x, y, z, x + w, y + h, z + d) };
  solids.push(s);
  return s;
}
put('ground', -30, -36, 60, 72, 1, -1);
export const PATACHO_HUTS = [
  put('wall', -27, -27, 9, 10, 4.6),
  put('wall', -25, 15, 9, 11, 4.6),
  put('wall', -9, -20, 8, 8, 4),
  put('wall', -6, 10, 8, 8, 4),
  put('wall', -22, -4, 9, 9, 4.8),
];
export const PATACHO_COVERS = [
  // Pilhas de pesca quebram a reta da beira-mar e protegem os bolsões de nascimento.
  put('tall', 24, -11, 6, 3, 2.5),
  put('tall', 24, 9, 6, 3, 2.5),
  put('tall', 8, -30, 3, 6, 2.5),
  put('tall', 9, 24, 3, 7, 2.5),
  put('tall', -24, 7, 5, 2, 2.5),
  put('tall', 3, -17, 4, 3, 2.3),

  put('tall', 9, -24, 5, 3, 2.3),
  put('tall', 12, 19, 5, 3, 2.3),
  put('tall', 4, -4, 6, 3, 2.2),
  put('tall', 18, 3, 7, 3, 2.2),
  put('low', 13, -13, 6, 2, 1.05),
  put('low', 7, 10, 5, 2, 1.05),
  put('tall', -12, 28, 5, 2, 2.2),
  put('tall', -15, -31, 5, 2, 2.2),
];
// Troncos retos têm caixas exatas; copas ficam acima da faixa alcançável do jogador.
export const PATACHO_PALMS = [
  [-28, -32],
  [-16, -24],
  [-28, -10],
  [-10, -6],
  [-27, 10],
  [-14, 22],
  [-25, 32],
  [-5, 30],
  [3, -28],
  [21, -29],
  [25, -18],
  [26, 14],
  [22, 29],
  [-3, 3],
];
for (const [x, z] of PATACHO_PALMS) put('wall', x - 0.23, z - 0.23, 0.46, 0.46, 8);
// Cercas e boias sinalizam as quatro bordas; os limites não bloqueiam tiros.
for (const b of [
  box(-31, 0, -37, -30, 30, 37),
  box(30, 0, -37, 31, 30, 37),
  box(-30, 0, -37, 30, 30, -36),
  box(-30, 0, 36, 30, 30, 37),
  box(-30, 30, -36, 30, 31, 36),
])
  solids.push({ kind: 'bound', tint: 'neutral', box: b });
const feet = (x: number, z: number) => ({ x, y: 0, z });
export const PATACHO: MapData = {
  id: 'patacho',
  name: 'Praia do Patacho · Alagoas',
  bounds: { x0: -30, z0: -36, x1: 30, z1: 36 },
  wallHeight: 9,
  solids,
  playerSpawn: feet(3, 28),
  spawns: {
    attack: [-8, -5, -2, 1, 4].map((x) => feet(x, -33)),
    defend: [-8, -5, -2, 1, 4].map((x) => feet(x, 33)),
    ffa: [
      feet(-27, -30),
      feet(-20, 30),
      feet(0, -28),
      feet(3, 28),
      feet(22, -23),
      feet(24, 23),
      feet(-26, 5),
      feet(-10, 13),
    ],
  },
  droneSpawns: [
    [-20, 18, -20],
    [20, 18, 20],
    [-20, 19, 20],
    [20, 19, -20],
    [0, 20, 0],
  ],
  zones: [
    { id: 'A', name: 'COQUEIRAL', tint: 'A', site: true, rect: { x0: -29, z0: -7, x1: -23, z1: 7 } },
    { id: 'mid', name: 'VILA DOS PESCADORES', tint: 'mid', rect: { x0: -10, z0: -25, x1: 10, z1: 25 } },
    { id: 'B', name: 'JANGADAS', tint: 'B', site: true, rect: { x0: 11, z0: -28, x1: 29, z1: 28 } },
  ],
  labels: [
    { text: 'PATACHO • ALAGOAS', tint: 'A', at: { x: -5, y: 2.8, z: -12 }, axis: 'z', n: 1, width: 6 },
    { text: 'OTIMIZA: PARAÍSO POR ASSINATURA', tint: 'def', at: { x: -2, y: 2.7, z: 18 }, axis: 'z', n: 1, width: 7 },
  ],
};
