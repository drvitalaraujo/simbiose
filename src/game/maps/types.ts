// Formato de um mapa competitivo como dados puros (sem Three.js): colisão, zonas e spawns.
// `build.ts` transforma isso em malhas; `nav.ts` valida (alcance, entradas, linhas de visão).
import type { Box, Vec3 } from '../physics';
import type { Rect } from '../world/shapes';

/** Cor de leitura de cada parte do mapa (traduzida para a PALETTE em build.ts/svg.ts). */
export type Tint = 'A' | 'routeA' | 'B' | 'routeB' | 'mid' | 'def' | 'atk' | 'neutral';

export type SolidKind =
  | 'ground' // chão
  | 'wall' // paredes altas (prédios do greybox), ninguém sobe
  | 'low' // cobertura baixa (~1 m): esconde agachado, em pé vê por cima
  | 'tall' // cobertura alta (~2 m): esconde em pé
  | 'platform' // plataforma onde se anda (sobe por escada)
  | 'terrace' // terraço de ladeira ou largo (piso no tom da zona, degrau de 0.4)
  | 'stairs' // degraus de no máximo 0.4
  | 'edge' // muro externo visível
  | 'bound'; // limite invisível (paredes até o teto e o teto)

export interface MapSolid {
  box: Box;
  kind: SolidKind;
  tint: Tint;
  /** Colisão de movimento; padrão true. */
  solid?: boolean;
  /** Bloqueia tiro; padrão igual a solid, exceto limite invisível. */
  shoot?: boolean;
}

/** Mesma política no treino, predição e servidor, sem depender das malhas visuais. */
export function mapSolids(map: Pick<MapData, 'solids'>): Box[] {
  return map.solids.filter((s) => s.solid ?? true).map((s) => s.box);
}

export function mapShotBlockers(map: Pick<MapData, 'solids'>): Box[] {
  return map.solids.filter((s) => s.shoot ?? (s.kind !== 'bound' && (s.solid ?? true))).map((s) => s.box);
}

export interface Zone {
  id: string;
  /** Nome mostrado na planta. */
  name: string;
  rect: Rect;
  tint: Tint;
  /** Local de plantar a bomba no futuro modo bomba. */
  site?: boolean;
}

/** Letreiro simples (texto do atlas do mapa) colado numa parede ou pintado no chão. */
export interface MapLabel {
  text: string;
  tint: Tint;
  /** Centro do letreiro. */
  at: Vec3;
  /** Parede: normal no eixo `axis` apontando para `n`; `floor`: deitado no chão. */
  axis: 'x' | 'z' | 'floor';
  n: 1 | -1;
  /** Largura em metros (a altura sai da proporção da arte). */
  width: number;
}

export interface MapData {
  id: string;
  name: string;
  /** Área jogável (os limites invisíveis ficam nas bordas). */
  bounds: Rect;
  /** Altura das paredes altas (para drones e para a planta). */
  wallHeight: number;
  solids: MapSolid[];
  zones: Zone[];
  /** Pontos de nascimento: pés no chão (y = altura do piso). */
  spawns: { attack: Vec3[]; defend: Vec3[]; ffa: Vec3[] };
  /** Spawn do modo atual (treino), pés no chão. */
  playerSpawn: Vec3;
  /** Pontos altos por onde os drones entram (centro do drone). */
  droneSpawns: [number, number, number][];
  labels: MapLabel[];
}
