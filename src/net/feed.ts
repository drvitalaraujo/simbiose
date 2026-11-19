// Mensagens de combate do modo online (servidor → clientes) e os formatos prontos para o HUD
// (killfeed e placar). Puro, sem Three.js: o servidor monta, o cliente só lê.
import type { HitPart } from '../game/characters/hitbox';
import type { Team } from './modes';
import type { WeaponId } from '../sim/weapons';

/** Nomes das mensagens avulsas da sala (o estado vai pelo schema). */
export const MSG = {
  /** Servidor → todos: um disparo (rastro dos outros, acerto confirmado para quem atirou). */
  shot: 'shot',
  /** Servidor → todos: alguém abateu alguém (killfeed). */
  kill: 'kill',
  /** Cliente → servidor: o ping que o cliente mediu (ms), para o placar. */
  ping: 'ping',
  /** Servidor → cliente: número de medida do relógio; o cliente devolve na hora em `syncAck`. */
  sync: 'sync',
  syncAck: 'sync-ok',
  loadout: 'loadout',
  /** Servidor → todos: ciclo do drone da OTIMIZA na Arena (apareceu, hackeado, abatido, foi embora). */
  drone: 'drone',
} as const;

/** Fuzil padrão; as demais armas usam os ids de src/sim/weapons.ts. */
export const WEAPON_RIFLE = 'mk2';
/** Tiro do drone da OTIMIZA hackeado (crédito do abate vai para o dono). */
export const WEAPON_DRONE = 'drone';

export type V3 = [number, number, number];

/** Um disparo resolvido pelo servidor. */
export interface ShotMsg {
  /** Quem atirou (sessionId ou id do bot). */
  by: string;
  /** Número do comando do disparo (o cliente casa com o rastro que já desenhou). */
  seq: number;
  /** Origem (olho de quem atirou, no servidor) e onde o tiro parou. */
  o: V3;
  e: V3;
  /** Parou numa parede (faísca no ponto). */
  w?: boolean;
  /** Efeito correto no cliente para golpes/arremessos. */
  /** Só para HE: lançamento ou explosão (um efeito, mesmo com vários alvos). */
  grenadePhase?: 'throw' | 'explode';
  grenadeVelocity?: [number, number, number];
  weapon?: WeaponId | 'chinelo' | 'chinelo-arremesso' | 'drone' | 'grenade';
  pellets?: V3[];
  /** Pontos de parede de toda a salva, separados dos acertos em personagens. */
  impacts?: V3[];
  /** Confirmação adicional de outro alvo da mesma salva: não repetir os efeitos. */
  continuation?: boolean;
  /** Acertou alguém: id, parte do corpo, dano aplicado (0 = protegido) e se matou. */
  t?: string;
  part?: HitPart;
  dmg?: number;
  k?: boolean;
}

/** Evento de abate no formato do killfeed (o HUD competitivo liga direto nisto). */
export interface KillFeedEvent {
  /** Apelidos (o HUD mostra "BOT" à parte, pelos campos *IsBot). */
  killer: string;
  victim: string;
  killerId: string;
  victimId: string;
  weapon: string;
  headshot: boolean;
  killerIsBot: boolean;
  victimIsBot: boolean;
  killerTeam?: Team;
  victimTeam?: Team;
}

/** Uma linha do placar. */
export interface ScoreRow {
  team?: Team;
  id: string;
  name: string;
  kills: number;
  deaths: number;
  ping: number;
  bot: boolean;
}

interface ScoreSource {
  team?: Team | string;
  name: string;
  kills: number;
  deaths: number;
  ping: number;
  bot: boolean;
}

/** Placar ordenado: mais abates primeiro; empate, menos mortes; depois o nome. */
export function scoreboard(players: Iterable<[string, ScoreSource]>): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const [id, p] of players) rows.push({ id, name: p.name, kills: p.kills, deaths: p.deaths, ping: p.ping, bot: p.bot, ...(p.team ? { team: p.team as Team } : {}) });
  return rows.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name));
}

/** Um passo do ciclo do drone da OTIMIZA na Arena (anúncio, som e efeito no cliente). */
export interface DroneEventMsg {
  kind: 'spawn' | 'hacked' | 'down' | 'leave';
  /** Nome da zona onde apareceu. */
  zone: string;
  x: number;
  y: number;
  z: number;
  /** Dono (quem hackeou), se houver. */
  owner?: string;
  ownerName?: string;
  /** Quem derrubou (só em 'down'). */
  by?: string;
  byName?: string;
}
