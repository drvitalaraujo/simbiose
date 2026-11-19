// Nomes, lugares e miniaturas dos mapas e rótulos de modo/dificuldade, usados no menu e na
// tela "ENTRAR NA PARTIDA". Miniaturas: capturas do próprio jogo em public/assets/maps/
// (origem em docs/assets.md); se faltarem, o menu desenha uma arte no lugar.
import type { MatchMode } from '../../net/modes';
import type { ArenaMapId, Difficulty, MapId } from './settings';

export interface MapInfo {
  name: string;
  where: string;
  tag: string;
}

export const MAP_INFO: Readonly<Record<MapId, MapInfo>> = {
  bairro: { name: 'BAIRRO', where: 'Neo-São Paulo', tag: 'Drones da OTIMIZA em ondas' },
  pelourinho: { name: 'PELOURINHO', where: 'Salvador · BA', tag: 'Ladeiras, largo e igreja azul' },
  lapa: { name: 'ARCOS DA LAPA', where: 'Rio de Janeiro · RJ', tag: 'Arcos, becos e terraços' },
  patacho: { name: 'PATACHO', where: 'Porto de Pedras · AL', tag: 'Coqueiral, jangadas e mar turquesa' },
  favela: { name: 'FAVELA', where: 'Favela do Sol', tag: 'Becos, lajes e quadra' },
};

/** Ordem dos cards da Arena (o padrão competitivo; o Bairro é só do Treino). */
export const ARENA_CHOICES: readonly ArenaMapId[] = ['pelourinho', 'lapa', 'favela', 'patacho', 'aleatorio'];

export const RANDOM_INFO: MapInfo = { name: 'ALEATÓRIO', where: 'Sorteio na entrada', tag: 'Um dos quatro, sem aviso prévio... quase' };

export function arenaInfo(id: ArenaMapId): MapInfo {
  return id === 'aleatorio' ? RANDOM_INFO : MAP_INFO[id];
}

/** Miniatura do mapa (captura do jogo). */
export function thumbUrl(id: MapId): string {
  return `${import.meta.env.BASE_URL}assets/maps/${id}.webp`;
}

export const DIFFICULTIES: readonly { id: Difficulty; label: string; hint: string }[] = [
  { id: 'facil', label: 'FÁCIL', hint: 'Bots distraídos: bom para aquecer' },
  { id: 'normal', label: 'NORMAL', hint: 'Bots que revidam' },
  { id: 'dificil', label: 'DIFÍCIL', hint: 'Bots que miram como gente com raiva' },
];

export function difficultyLabel(id: string | null | undefined): string {
  return DIFFICULTIES.find((d) => d.id === id)?.label ?? 'NORMAL';
}

const MODE_LABEL: Record<MatchMode, string> = { ffa: 'TODOS CONTRA TODOS', duel: 'DUELO', tdm: 'EQUIPES 3V3', hack: 'HACKEIA E SEGURA' };

export function modeLabel(mode: string | null | undefined): string {
  return MODE_LABEL[(mode ?? 'ffa') as MatchMode] ?? MODE_LABEL.ffa;
}

/** Nome do mapa a partir do id do servidor (`pelourinho`, `lapa`, `favela`, `arena`...). */
export function mapLabel(id: string | null | undefined): MapInfo {
  if (id === 'pelourinho' || id === 'lapa' || id === 'favela' || id === 'patacho') return MAP_INFO[id];
  if (id === 'arena') return { name: 'ARENA DE TESTE', where: 'Caixas cinzas', tag: '' };
  return MAP_INFO.pelourinho; // o servidor abre no Pelourinho sem `&mapa=`
}
