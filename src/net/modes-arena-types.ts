import type { GrenadeProjectile } from '../sim/grenade';
import type { GrenadeStore } from './grenade-combat';
import type { FlatPlayer } from './protocol';
import type { Pose } from './combat';
import { poseOf } from './combat';
import type { MatchRules } from './match';
import type { Team } from './modes';
import type { DroneStore, HackDrone } from './hack-objectives';
import type { Rng } from '../sim/rng';
import type { BotDifficulty } from './bot-persona';
import type { NetMap } from './maps';
import type { DroneEventMsg, KillFeedEvent, ShotMsg } from './feed';
import type { SlipperStore, SlipperProjectile } from './slipper-combat';

/** Jogador na sala: mesmos campos do `NetPlayer` do schema (o servidor passa o próprio). */
export interface SimPlayer extends FlatPlayer {
  selectedWeapon?: number;
  team?: Team;
  name: string;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  spawnYaw: number;
  bot: boolean;
  kills: number;
  deaths: number;
  ping: number;
  life: number;
  respawnIn: number;
  invuln: boolean;
}

/** Campos da partida no estado da sala (`ArenaState`). */
export interface MatchFields {
  mode?: string;
  scoreA?: number;
  scoreB?: number;
  winnerTeam?: string;
  drawn?: boolean;
  phase: string;
  timeLeft: number;
  killLimit: number;
  winnerId: string;
  winnerName: string;
  match: number;
}

/** Onde guardar os jogadores (o `MapSchema` do estado, ou um `Map` nos testes). */
export interface PlayerStore<P> {
  get(id: string): P | undefined;
  set(id: string, p: P): unknown;
  delete(id: string): unknown;
  [Symbol.iterator](): IterableIterator<[string, P]>;
  readonly size: number;
}

/**
 * Pose de um alvo no instante que o atirador via (rewind). null = não acertável (ex.: nasceu
 * depois daquele instante). Bots atiram no presente: a pose atual.
 */
export type PoseLookup = (targetId: string, target: SimPlayer) => Pose | null;

/** Decide o instante do rewind UMA vez por disparo e devolve como ler as poses nele. */
export type ViewLookup = () => PoseLookup;

/** Sem rewind: poses atuais (bots e testes). */
export const liveView: ViewLookup = () => (_id, p) => poseOf(p);

/** Saiu ferido há menos que isto (s): conta como abatido por quem feriu por último. */
export const ABANDON_WINDOW = 5;

export type ArenaEvent =
  | { type: 'shot'; msg: ShotMsg }
  | { type: 'kill'; msg: KillFeedEvent }
  | { type: 'end'; winnerId: string; winnerName: string }
  | { type: 'start'; match: number }
  /** Logo antes do reinício: o placar ainda é o da partida que acabou (rodízio da fila). */
  | { type: 'restarting'; match: number }
  | { type: 'drone'; msg: DroneEventMsg };

export interface ArenaSimOptions {
  map: NetMap;
  rules: MatchRules;
  rng: Rng;
  state: MatchFields;
  players: PlayerStore<SimPlayer>;
  /** Cria o objeto do jogador (no servidor: `new NetPlayer(init)`). */
  create: (init: SimPlayer) => SimPlayer;
  /** Relógio do servidor em ms (o mesmo do rewind). */
  now: () => number;
  /** Bots usam a grade de navegação do mapa (desligue em testes que não precisam). */
  botNav?: boolean;
  grenades?: GrenadeStore;
  createGrenade?: (p: GrenadeProjectile) => GrenadeProjectile;
  slippers?: SlipperStore;
  createSlipper?: (p: SlipperProjectile) => SlipperProjectile;
  drones?: DroneStore;
  createDrone?: (d: HackDrone) => HackDrone;
  /** Nível dos bots da sala (`dificuldade` na criação). Padrão: normal. */
  difficulty?: BotDifficulty;
  /** Drone da OTIMIZA no FFA (padrão: ligado). */
  arenaDrone?: boolean;
}

