// Rodízio "quem perde sai" (como na pelada), puro: no reinício da partida, com fila de espera
// e a sala cheia de gente, os piores colocados da partida que acabou saem para assistir e os
// primeiros da fila entram no lugar. O servidor (server/arena-room.ts) aplica a troca.

/** Como cada pessoa terminou a partida (bots e plateia ficam de fora). */
export interface Standing {
  id: string;
  kills: number;
  deaths: number;
  /** Partidas seguidas jogadas até esta (inclusive). */
  streak: number;
}

/**
 * Quem sai, do pior para o menos pior: menos abates; empate, mais mortes; depois quem jogou
 * mais partidas seguidas. Saem até `waiting` pessoas (o tamanho da fila), mas o melhor
 * colocado sempre fica: quem ganha não sai.
 */
export function pickBenched(standings: readonly Standing[], waiting: number): string[] {
  const count = Math.max(0, Math.min(waiting, standings.length - 1));
  if (count === 0) return [];
  return [...standings]
    .sort((a, b) => a.kills - b.kills || b.deaths - a.deaths || b.streak - a.streak || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, count)
    .map(s => s.id);
}
