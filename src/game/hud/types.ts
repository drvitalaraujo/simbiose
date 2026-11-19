// Dados que o HUD competitivo recebe. Formato neutro: a rede (ou o mock da página `?hud`)
// monta estes objetos; o HUD só desenha.

/** Time de um jogador. `undefined` = FFA (todo mundo contra todo mundo). */
export type TeamId = 'a' | 'b';

/** Relação com o jogador local: decide a cor (rosa = inimigo, ciano = aliado, amarelo = você). */
export type Relation = 'self' | 'ally' | 'enemy';

export interface PlayerRef {
  id: string;
  name: string;
  team?: TeamId;
  /** Bot assumido: sempre aparece com a etiqueta BOT. */
  bot?: boolean;
}

export interface KillEvent {
  /** `null` = morte sem matador (queda, sair do mapa, drone do treino). */
  killer: PlayerRef | null;
  victim: PlayerRef;
  /** Nome da arma como aparece no killfeed (ex.: "Pistola", "Rifle"). */
  weapon: string;
  headshot?: boolean;
}

export interface ScoreRow extends PlayerRef {
  kills: number;
  deaths: number;
  /** Assistências (opcional; some da tabela se ninguém tiver). */
  assists?: number;
  /** Ping em ms; bots mostram "BOT" no lugar. */
  ping: number;
  /** Pontos do modo (ex.: drones hackeados no "Hackeia e Segura"). */
  score?: number;
}

export type MatchOutcome = 'win' | 'loss' | 'draw';

export interface MatchStat {
  label: string;
  value: string;
}

export interface MatchEndData {
  outcome: MatchOutcome;
  /** Título grande opcional (ex.: "1º LUGAR" no FFA). Sem ele: VITÓRIA/DERROTA/EMPATE. */
  title?: string;
  /** Placar dos times (TDM) ou do duelo. */
  teamScore?: { a: number; b: number };
  mvp: PlayerRef & { line: string };
  /** Estatísticas do jogador local (abates, precisão...). */
  stats: MatchStat[];
  rows: ScoreRow[];
  /** Fala da OTIMIZA; sem ela, uma frase padrão conforme o resultado. */
  quip?: string;
}

export interface DeathData {
  killer: PlayerRef | null;
  weapon: string;
  headshot?: boolean;
  /** Segundos até renascer (a contagem anda sozinha no `update`). */
  respawnIn: number;
  /** Vida que restou ao matador (mostrada como "ele ficou com X"). */
  killerHp?: number;
}

/** Ponto no minimapa (coordenadas do mundo, plano XZ). */
export interface MinimapDot {
  x: number;
  z: number;
  rel: Relation;
  /** Drone da OTIMIZA: losango ('self' = neutro, amarelo). */
  kind?: 'drone';
}

export interface MinimapSelf {
  x: number;
  z: number;
  /** Mesmo yaw do Input (radianos; 0 = olhando para -Z). */
  yaw: number;
}

/** Caixa de colisão (igual à `Box` do sim) com o tipo opcional do sólido do mapa. */
export interface MinimapSolid {
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
  kind?: string;
}

export type HitKind = 'body' | 'head' | 'kill';
