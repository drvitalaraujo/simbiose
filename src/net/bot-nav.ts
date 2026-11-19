// Navegação dos bots (puro): grade de navegação do mapa (src/game/maps/nav.ts) + "campos de
// fluxo" até cada objetivo (distância a pé de todo nó até o objetivo). O bot só desce a
// distância. Tudo calculado uma vez por mapa (sob demanda) e compartilhado entre as salas.
import { buildNav, type NavGrid, neighbors, nodeAt, type NodeId, nodePos, walkDistances } from '../game/maps/nav';
import type { MapData } from '../game/maps/types';
import { PLAYER_HALF } from '../sim/player';
import type { Vec3 } from '../sim/vec';
import type { NetMap } from './maps';

export class BotNav {
  readonly grid: NavGrid;
  /** Objetivos (pés no chão): os pontos de nascimento, espalhados pelo mapa todo. */
  readonly goals: Vec3[];
  private readonly goalNodes: (NodeId | null)[];
  private readonly fields: (Float64Array | undefined)[] = [];

  constructor(map: NetMap) {
    this.grid = buildNav(asMapData(map));
    this.goals = map.spawns.map((s) => ({ x: s.x, y: s.y - PLAYER_HALF.y - 0.01, z: s.z }));
    this.goalNodes = this.goals.map((g) => nodeAt(this.grid, g));
  }

  /** Distância a pé de cada nó até o objetivo `i` (calculada na primeira vez). */
  field(i: number): Float64Array | null {
    const node = this.goalNodes[i];
    if (node === null || node === undefined) return null;
    return (this.fields[i] ??= walkDistances(this.grid, node));
  }

  /** Nó de piso sob os pés (ou null fora da grade). */
  nodeAt(feet: Vec3): NodeId | null {
    return nodeAt(this.grid, feet);
  }

  /**
   * Próximo ponto do caminho até o objetivo: desce o campo de fluxo até `look` nós à frente.
   * Devolve null se daqui não dá para chegar.
   */
  waypoint(field: Float64Array, from: NodeId, look = 5): Vec3 | null {
    if (!Number.isFinite(field[from])) return null;
    let n = from;
    for (let k = 0; k < look; k++) {
      let best = n;
      for (const [m] of neighbors(this.grid, n)) if (field[m] < field[best]) best = m;
      if (best === n) break;
      n = best;
    }
    return nodePos(this.grid, n);
  }
}

/** Arena simples (sem MapData): vira um mapa de dados só com caixas e limites. */
function asMapData(map: NetMap): MapData {
  if (map.data) return map.data;
  return {
    id: map.id,
    name: map.id,
    bounds: map.bounds,
    wallHeight: 5,
    solids: map.solids.map((box) => ({ box, kind: 'wall', tint: 'neutral' })),
    zones: [],
    spawns: { attack: [], defend: [], ffa: [] },
    playerSpawn: { x: 0, y: 0, z: 0 },
    droneSpawns: [],
    labels: [],
  };
}

const cache = new Map<string, BotNav>();

export function botNavFor(map: NetMap): BotNav {
  let nav = cache.get(map.id);
  if (!nav) {
    nav = new BotNav(map);
    cache.set(map.id, nav);
  }
  return nav;
}
