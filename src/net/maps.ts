import { PATACHO } from '../game/maps/patacho';
// Mapas do modo online como DADOS PUROS (sem Three.js): o servidor usa os sólidos para a
// colisão e o cliente desenha as mesmas caixas. Trocar de mapa = registrar outro em `MAPS`
// e passar o id na criação da sala (`client.create('arena', { mapa: 'id' })`).
// O mapa competitivo (Pelourinho, src/game/maps/arena1.ts) entra adaptado: sólidos e spawns
// FFA no servidor; no cliente, o visual vem de `maps/build.ts` (campo `data`).
import { ARENA1 } from '../game/maps/arena1';
import { LAPA } from '../game/maps/lapa';
import { FAVELA } from '../game/maps/favela';
import type { MapData } from '../game/maps/types';
import { mapShotBlockers, mapSolids } from '../game/maps/types';
import type { Box } from '../sim/physics';
import type { Vec3 } from '../sim/vec';

/** Nome de uma cor da PALETTE (src/game/toon.ts); o cliente resolve para a cor real. */
export type PaintName = 'concrete' | 'concreteDark' | 'asphalt' | 'lilac' | 'orange' | 'pink' | 'cyan' | 'yellow' | 'wine';

export interface NetBlock extends Box {
  paint: PaintName;
}

export interface NetMap {
  id: string;
  /** Caixas sólidas (colisão AABB) que também são desenhadas no cliente. */
  blocks: readonly NetBlock[];
  /** Só colisão: as mesmas caixas de `blocks`, no formato que `stepPlayer` usa. */
  solids: readonly Box[];
  /** Bloqueio de tiro e linha de visão (não inclui limites invisíveis). */
  shotBlockers: readonly Box[];
  /** Centro do corpo (y = pés + 0.86) dos pontos de nascimento (FFA). */
  spawns: readonly Vec3[];
  /** Mapa competitivo de origem (dados de src/game/maps/): o cliente desenha com `buildMap`. */
  data?: MapData;
  /** Área jogável (para a grade de navegação dos bots). */
  bounds: { x0: number; z0: number; x1: number; z1: number };
}

function block(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, paint: PaintName): NetBlock {
  return {
    min: { x: Math.min(x0, x1), y: Math.min(y0, y1), z: Math.min(z0, z1) },
    max: { x: Math.max(x0, x1), y: Math.max(y0, y1), z: Math.max(z0, z1) },
    paint,
  };
}

function defineMap(id: string, blocks: NetBlock[], spawns: Vec3[]): NetMap {
  const solids = blocks.map(({ min, max }) => ({ min, max }));
  return { id, blocks, solids, shotBlockers: solids, spawns, bounds: { x0: -HALF, z0: -HALF, x1: HALF, z1: HALF } };
}

const FEET = 0.86; // centro do corpo logo acima do chão (meia altura 0.85)
const HALF = 24; // meia largura da arena
const WALL = 5;

/** Arena de teste (greybox): chão, muros, caixas de cobertura e um palco com degraus. */
function arena(): NetMap {
  const b: NetBlock[] = [
    block(-HALF, -1, -HALF, HALF, 0, HALF, 'asphalt'),
    // muros
    block(-HALF - 1, 0, -HALF - 1, HALF + 1, WALL, -HALF, 'concreteDark'),
    block(-HALF - 1, 0, HALF, HALF + 1, WALL, HALF + 1, 'concreteDark'),
    block(-HALF - 1, 0, -HALF, -HALF, WALL, HALF, 'concreteDark'),
    block(HALF, 0, -HALF, HALF + 1, WALL, HALF, 'concreteDark'),
    // palco central com degraus de 0.4 (colisão é só AABB: nada de rampa)
    block(-4, 0, -4, 4, 1.2, 4, 'lilac'),
    block(-4, 0, 4, 4, 0.8, 5, 'concrete'),
    block(-4, 0, 5, 4, 0.4, 6, 'concrete'),
    block(-4, 0, -5, 4, 0.8, -4, 'concrete'),
    block(-4, 0, -6, 4, 0.4, -5, 'concrete'),
    // caixas de cobertura
    block(-14, 0, -12, -11, 1.6, -9, 'orange'),
    block(11, 0, 9, 14, 1.6, 12, 'orange'),
    block(10, 0, -14, 12, 2.6, -8, 'wine'),
    block(-12, 0, 8, -10, 2.6, 14, 'wine'),
    block(-18, 0, 1, -16, 1, 3, 'yellow'),
    block(16, 0, -3, 18, 1, -1, 'yellow'),
    // pilares
    block(-9, 0, -1, -7, 3.5, 1, 'concrete'),
    block(7, 0, -1, 9, 3.5, 1, 'concrete'),
  ];
  const spawns: Vec3[] = [
    { x: -19, y: FEET, z: -19 },
    { x: 19, y: FEET, z: 19 },
    { x: 19, y: FEET, z: -19 },
    { x: -19, y: FEET, z: 19 },
    { x: 0, y: FEET, z: -19 },
    { x: 0, y: FEET, z: 19 },
    { x: -19, y: FEET, z: 0 },
    { x: 19, y: FEET, z: 0 },
  ];
  return defineMap('arena', b, spawns);
}

/** Mapa competitivo (dados puros) como `NetMap`: todos os sólidos colidem; spawns FFA. */
function fromMapData(id: string, data: MapData): NetMap {
  return {
    id,
    blocks: [],
    solids: mapSolids(data),
    shotBlockers: mapShotBlockers(data),
    spawns: data.spawns.ffa.map((p) => ({ x: p.x, y: p.y + FEET, z: p.z })),
    data,
    bounds: data.bounds,
  };
}

export const MAPS: Readonly<Record<string, NetMap>> = {
  arena: arena(), pelourinho: fromMapData('pelourinho', ARENA1), lapa: fromMapData('lapa', LAPA),
  patacho: fromMapData('patacho', PATACHO),
  favela: fromMapData('favela', FAVELA),
};
/** O online abre no Pelourinho; `&mapa=arena` usa a arena simples de teste. */
export const DEFAULT_MAP = 'pelourinho';

/** Mapa registrado com esse id; qualquer outra coisa (inclusive '__proto__', 'toString') cai no padrão. */
export function getMap(id: unknown): NetMap {
  return typeof id === 'string' && Object.hasOwn(MAPS, id) ? MAPS[id] : MAPS[DEFAULT_MAP];
}
