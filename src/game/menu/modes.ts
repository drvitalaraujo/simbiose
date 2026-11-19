// Modos do menu e o registro de "quem sabe jogar cada um". O menu não sabe começar partida:
// quem implementa um modo (Treino no main.ts, rede para FFA/Duelo...) registra um handler.
// Modo sem handler mostra "em breve".
import type { MapId } from './settings';

export type PlayMode = 'ffa' | 'duel' | 'training' | 'tdm' | 'hack' | 'live';

export interface ModeInfo {
  id: PlayMode;
  title: string;
  sub: string;
  /** Texto do aviso quando ainda não há handler. */
  soon: string;
}

export const MODES: readonly ModeInfo[] = [
  { id: 'ffa', title: 'ARENA', sub: 'Todos contra todos · até 8 jogadores · bots completam', soon: 'Arena indisponível nesta sessão.' },
  { id: 'duel', title: 'DUELO', sub: '1 contra 1 · convide um amigo pelo link · sem bots', soon: 'Duelo indisponível nesta sessão.' },
  { id: 'training', title: 'TREINO', sub: 'Solo contra drones · pratique o combate', soon: 'Treino indisponível.' },
  { id: 'live', title: 'MODO LIVE', sub: 'Assista e transmita · a audiência entra pelo QR code', soon: 'Modo Live indisponível nesta sessão.' },
];

export interface PlayRequest {
  mode: PlayMode;
  map: MapId;
  nickname: string;
}

/** Retorne `false` para recusar (o menu mostra o aviso de "em breve"). */
export type PlayHandler = (req: PlayRequest) => boolean | void;

const handlers = new Map<PlayMode, PlayHandler>();
const changeListeners = new Set<() => void>();

/**
 * Liga um modo do menu. Ex. (agente de rede):
 *   onPlay('ffa', ({ map, nickname }) => { void joinArena(map, nickname); });
 * Retorna a função que desliga.
 */
export function onPlay(mode: PlayMode, handler: PlayHandler): () => void {
  handlers.set(mode, handler);
  for (const fn of changeListeners) fn();
  return () => {
    if (handlers.get(mode) === handler) handlers.delete(mode);
    for (const fn of changeListeners) fn();
  };
}

export function hasHandler(mode: PlayMode): boolean {
  return handlers.has(mode);
}

/** Tenta começar o modo; `false` se não houver handler ou ele recusar. */
export function requestPlay(req: PlayRequest): boolean {
  const h = handlers.get(req.mode);
  if (!h) return false;
  return h(req) !== false;
}

/** Avisa quando um modo é ligado/desligado (o menu tira o selo "em breve"). */
export function onHandlersChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}
