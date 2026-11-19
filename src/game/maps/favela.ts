// Favela do Sol: bairro autoral, com largos interligados e quarteirões em cotovelo.
import { box, stairs } from '../world/shapes';
import type { Vec3 } from '../physics';
import type { MapData, MapSolid, SolidKind, Tint } from './types';

const solids: MapSolid[] = [];
function put(kind: SolidKind, tint: Tint, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const s: MapSolid = { kind, tint, box: box(x0, y0, z0, x1, y1, z1) }; solids.push(s); return s;
}
export const FAVELA_HOUSES: { solid: MapSolid; paint: number; brick: boolean }[] = [];
function house(x: number, z: number, w: number, d: number, h: number, paint: number, brick = false, y = 0) {
  const solid = put('wall', 'neutral', x, y, z, x + w, y + h, z + d);
  FAVELA_HOUSES.push({ solid, paint, brick });
}
put('ground', 'neutral', -36, -1, -32, 36, 0, 32);

// O limite jogável é o casario: recuos eliminam a pista retangular periférica.
const perimeter: [number, number, number, number, number, number][] = [
  [-36, -32, 16, 8, 9.2, 4], [-20, -32, 15, 4, 7.6, 0], [-5, -32, 14, 7, 10.4, 1],
  [9, -32, 14, 5, 8.2, 2], [23, -32, 13, 13, 9.8, 3],
  [-36, -24, 5, 14, 8.4, 3], [-36, -10, 9, 13, 10.8, 4], [-36, 3, 4, 11, 7.8, 1],
  [-36, 14, 10, 18, 9.6, 0], [-26, 27, 13, 5, 7.4, 2], [-13, 25, 14, 7, 8.2, 1],
  [1, 28, 16, 4, 7.6, 4], [17, 24, 12, 8, 10.2, 3], [29, 12, 7, 20, 8.8, 0],
  [30, -19, 6, 11, 8.6, 4], [27, -8, 9, 10, 10.6, 2], [31, 2, 5, 10, 8.2, 1],
];
for (const [i, [x, z, w, d, h, paint]] of perimeter.entries()) {
  house(x, z, w, d, h, paint);
  // Pavimentos recuados interrompem o skyline e deixam telhados de alturas variadas.
  if (i % 3 !== 1) house(x + 0.7, z + 0.6, Math.min(w - 1.4, 7), Math.min(d - 1.2, 6.2), 2.6 + (i % 3) * 0.4, (paint + 2) % 6, true, h);
}

// Quarteirões em L revelam o próximo largo somente depois de vencer cada esquina.
house(-24, -22, 13, 9, 7.6, 0); // mercearia
house(-14, -13, 3, 5, 6.8, 0);
house(-22.6, -21, 7, 6, 3.2, 3, true, 7.6);
house(-5, -23, 10, 8, 8, 2); // oficina divide a entrada norte em dois braços
house(-5, -26, 4, 3, 8, 2); // ligação ao casario força a rotação pela frente da oficina
house(-4.2, -22.3, 6, 5, 3, 4, true, 8);
house(12, -23, 10, 9, 7.2, 3); // samba
house(16, -14, 6, 7, 8.4, 3);
house(13, -22, 6.8, 6, 3.6, 1, true, 7.2);
house(-23, 13, 12, 8, 7.4, 2); // ateliê e passagem transversal para a associação
house(-18, 9, 7, 4, 7.4, 2);
house(-22, 14, 7, 6, 3.1, 5, true, 7.4);
house(1, 15, 8, 7, 7, 4); // barbearia protege a praça do nascimento sul
house(9, 17, 4, 3, 7, 4); // anexo em L corta a diagonal da feira ao nascimento sul
house(5, 22, 4, 2, 7, 4); // fundos criam um segundo cotovelo na travessa sul
house(2, 16, 5.6, 5, 3.4, 2, true, 7);
house(21, -4, 6, 9, 6.8, 1); // bica: cotovelo do circuito leste

export const FAVELA_TERRACES: MapSolid[] = [
  put('platform', 'routeA', -22, 0, -4, -14, 2.4, 7),
  put('platform', 'routeB', 12, 0, 4, 20, 3.2, 15),
];
export const FAVELA_STAIRWAYS: { name: string; steps: MapSolid[]; bottom: Vec3; top: Vec3 }[] = [];
function stairway(name: string, axis: 'x' | 'z', start: number, dir: 1 | -1, across: [number, number], top: number) {
  const boxes = stairs({ axis, start, dir, across, base: 0, top, depth: 1 });
  const steps = boxes.map(b => ({ box: b, kind: 'stairs' as const, tint: 'neutral' as const }));
  solids.push(...steps);
  const cross = (across[0] + across[1]) / 2;
  const at = (v: number, y: number) => axis === 'x' ? { x: v, y, z: cross } : { x: cross, y, z: v };
  FAVELA_STAIRWAYS.push({ name, steps, bottom: at(start - dir, 0), top: at(start + dir * (boxes.length + 1), top) });
}
stairway('ESCADINHA DA FEIRA', 'z', -10, 1, [-20, -16], 2.4);
stairway('ESCADINHA DA BICA', 'x', -28, 1, [3, 7], 2.4);
stairway('ESCADINHA DO VARAL', 'z', 23, -1, [14, 18], 3.2);
stairway('ESCADINHA DO SAMBA', 'x', 28, -1, [6, 10], 3.2);

// Peitoris interrompidos expõem tronco e cabeça de quem disputa as lajes.
put('low', 'routeA', -14.35, 2.4, -3.5, -14, 3.35, 0.5);
put('low', 'routeA', -14.35, 2.4, 3, -14, 3.35, 6.5);
put('low', 'routeB', 12, 3.2, 4.5, 12.35, 4.15, 8);
put('low', 'routeB', 12, 3.2, 10.5, 12.35, 4.15, 14.5);
export const FAVELA_COVERS: { solid: MapSolid; type: 'planter' | 'stall' | 'tank' }[] = [];
function cover(type: 'planter' | 'stall' | 'tank', x: number, z: number, w: number, d: number, y = 0) {
  const h = type === 'tank' ? 2.4 : type === 'stall' ? 2.15 : 1.05;
  const solid = put(type === 'planter' ? 'low' : 'tall', 'mid', x, y, z, x + w, y + h, z + d);
  FAVELA_COVERS.push({ type, solid });
}
cover('tank', -21, -1.5, 2.4, 2.4, 2.4);
cover('tank', 16.5, 11, 2.4, 2.4, 3.2);
cover('stall', -10, -11, 4, 2.6); // feira rompe a mira direta do nascimento norte
cover('stall', 3, -11, 5.6, 3.6);
cover('planter', -9, 10, 2, 3.5);
cover('planter', 8.5, -3, 2, 3.8);
cover('planter', -5.5, 18, 3.4, 1.8);
// Mural maciço junto da quadra corta a diagonal inteira entre os dois becos.
put('tall', 'mid', -11, 0, 3, -10.65, 2.4, 8);

// Traves reais, sem rede invisível. A quadra é uma clareira de combate dentro do bairro.
export const FAVELA_GOALS: MapSolid[] = [];
for (const z of [-6.5, 12.5]) {
  for (const x of [-2.25, 2.15]) FAVELA_GOALS.push(put('tall', 'mid', x, 0, z, x + 0.1, 2.2, z + 0.1));
  FAVELA_GOALS.push(put('tall', 'mid', -2.25, 2.1, z, 2.25, 2.2, z + 0.1));
}
for (const b of [box(-37, 0, -33, -36, 36, 33), box(36, 0, -33, 37, 36, 33),
  box(-36, 0, -33, 36, 36, -32), box(-36, 0, 32, 36, 36, 33), box(-36, 36, -32, 36, 37, 32)]) solids.push({ kind: 'bound', tint: 'neutral', box: b });

const feet = (x: number, z: number, y = 0) => ({ x, y, z });
export const FAVELA: MapData = {
  id: 'favela', name: 'Favela do Sol · Brasil', bounds: { x0: -36, z0: -32, x1: 36, z1: 32 }, wallHeight: 14,
  solids,
  zones: [
    { id: 'mid', name: 'QUADRA', tint: 'mid', rect: { x0: -10, z0: -7, x1: 10, z1: 14 } },
    { id: 'lajeA', name: 'CAIXA', tint: 'routeA', rect: { x0: -22, z0: -4, x1: -14, z1: 7 } },
    { id: 'lajeB', name: 'VARAL', tint: 'routeB', rect: { x0: 12, z0: 4, x1: 20, z1: 15 } },
    { id: 'feira', name: 'FEIRA', tint: 'A', rect: { x0: -11, z0: -15, x1: 12, z1: -7 } },
    { id: 'praca', name: 'ASSOCIAÇÃO', tint: 'B', rect: { x0: -11, z0: 14, x1: 1, z1: 25 } },
    { id: 'becoA', name: 'BICA', tint: 'atk', rect: { x0: -32, z0: -4, x1: -23, z1: 13 } },
    { id: 'becoB', name: 'SAMBA', tint: 'def', rect: { x0: 22, z0: -19, x1: 30, z1: -2 } },
    { id: 'atk', name: 'OFICINA', tint: 'atk', rect: { x0: -20, z0: -28, x1: -5, z1: -23 } },
    { id: 'def', name: 'BARBEARIA', tint: 'def', rect: { x0: 1, z0: 22, x1: 17, z1: 28 } },
  ],
  spawns: {
    attack: [-17, -14, -11, -8, -6.5].map(x => feet(x, -25.5)),
    defend: [2.5, 5, 7.5, 10, 12.5].map(x => feet(x, 25.5)),
    ffa: [feet(-28, -20), feet(26, -15), feet(-29.5, 10), feet(25.5, 20), feet(-8, -23),
      feet(10, -25), feet(-8, 22), feet(13, 25.5), feet(-20, 2, 2.4), feet(18, 9.5, 3.2)],
  },
  playerSpawn: feet(-6, 22),
  droneSpawns: [[-26, 23, -18], [26, 23, 18], [-18, 24, 18], [18, 24, -18], [0, 25, 3]],
  labels: [],
};
