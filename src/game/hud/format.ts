// Regras puras do HUD competitivo (sem DOM, sem Three.js): cores por relação, ordem do
// placar, relógio, direção do dano e projeção do minimapa. Testadas em format.test.ts.
import type { MatchOutcome, MinimapSolid, PlayerRef, Relation, ScoreRow, TeamId } from './types';

/** Quem é o jogador local, para decidir as cores. */
export interface LocalView {
  id: string;
  team?: TeamId;
}

/** Você = amarelo; mesmo time = ciano; o resto (inclusive todos no FFA) = rosa. */
export function relation(p: Pick<PlayerRef, 'id' | 'team'>, local: LocalView): Relation {
  if (p.id === local.id) return 'self';
  if (p.team && local.team && p.team === local.team) return 'ally';
  return 'enemy';
}

/** "mm:ss" (ou "s.d" nos últimos 10 s, quando `tenths`). Negativo vira 0. */
export function formatClock(seconds: number, tenths = false): string {
  const s = Math.max(0, seconds);
  if (tenths && s < 10) return s.toFixed(1);
  const whole = Math.ceil(s);
  const m = Math.floor(whole / 60);
  return `${m}:${String(whole % 60).padStart(2, '0')}`;
}

/** Abates/mortes com 2 casas (sem morte, K/D = abates). */
export function kdRatio(kills: number, deaths: number): string {
  return (deaths === 0 ? kills : kills / deaths).toFixed(2).replace('.', ',');
}

/** Placar: mais pontos (ou abates), depois menos mortes, depois nome. Não muda a entrada. */
export function sortRows(rows: readonly ScoreRow[]): ScoreRow[] {
  return [...rows].sort(
    (a, b) =>
      (b.score ?? b.kills) - (a.score ?? a.kills) ||
      b.kills - a.kills ||
      a.deaths - b.deaths ||
      a.name.localeCompare(b.name),
  );
}

/** Separa por time (A primeiro); no FFA volta um grupo só. */
export function groupByTeam(rows: readonly ScoreRow[]): { team?: TeamId; rows: ScoreRow[] }[] {
  const hasTeams = rows.some((r) => r.team);
  if (!hasTeams) return [{ rows: sortRows(rows) }];
  return (['a', 'b'] as const).map((team) => ({ team, rows: sortRows(rows.filter((r) => r.team === team)) }));
}

/** Ping legível e a faixa de cor (bom < 60, médio < 120, ruim). Bots não têm ping. */
export function pingLabel(row: Pick<ScoreRow, 'ping' | 'bot'>): { text: string; level: 'good' | 'mid' | 'bad' | 'bot' } {
  if (row.bot) return { text: 'BOT', level: 'bot' };
  const ms = Math.max(0, Math.round(row.ping));
  return { text: `${ms}`, level: ms < 60 ? 'good' : ms < 120 ? 'mid' : 'bad' };
}

/**
 * Ângulo na tela de onde veio o dano: 0 = de frente (topo da tela), positivo = pela
 * direita (horário), ±π = pelas costas. Mesma convenção de yaw do Input/sim
 * (0 olha para -Z; frente = (-sen yaw, -cos yaw) no plano XZ).
 */
export function damageAngle(from: { x: number; z: number }, me: { x: number; z: number }, yaw: number): number {
  const dx = from.x - me.x;
  const dz = from.z - me.z;
  const ahead = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return Math.atan2(right, ahead);
}

/** Frase padrão da OTIMIZA no fim da partida (o tom de departamento de marketing). */
export function otimizaQuip(outcome: MatchOutcome): string {
  switch (outcome) {
    case 'win':
      return 'Vitória registrada. Seu Índice de Felicidade subiu 0,3% ✨';
    case 'loss':
      return 'Sua derrota foi otimizada ✨ Obrigada pela colaboração!';
    default:
      return 'Empate detectado. Distribuímos a felicidade igualmente ✨';
  }
}

export function outcomeTitle(outcome: MatchOutcome): string {
  return outcome === 'win' ? 'VITÓRIA' : outcome === 'loss' ? 'DERROTA' : 'EMPATE';
}

export interface MapRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Sólidos que aparecem no minimapa: paredes e coberturas, sem chão, teto nem limites. */
export function minimapSolids(solids: readonly MinimapSolid[]): MinimapSolid[] {
  return solids.filter((s) => {
    if (s.kind) return s.kind === 'wall' || s.kind === 'tall' || s.kind === 'low' || s.kind === 'edge' || s.kind === 'platform';
    const { min, max } = s.box;
    const h = max.y - min.y;
    // Sem tipo (bairro): ignora chão (fino e baixo) e caixas gigantes (limites/teto).
    const area = (max.x - min.x) * (max.z - min.z);
    return h > 0.6 && max.y > 0.8 && min.y < 6 && area < 4000;
  });
}

/** Retângulo que contém todos os sólidos (com uma margem). */
export function boundsOf(solids: readonly MinimapSolid[], margin = 2): MapRect {
  if (solids.length === 0) return { x0: -50, z0: -50, x1: 50, z1: 50 };
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const { box } of solids) {
    x0 = Math.min(x0, box.min.x);
    z0 = Math.min(z0, box.min.z);
    x1 = Math.max(x1, box.max.x);
    z1 = Math.max(z1, box.max.z);
  }
  return { x0: x0 - margin, z0: z0 - margin, x1: x1 + margin, z1: z1 + margin };
}

/** Escala e deslocamento para caber o retângulo do mapa num quadrado de `size` px. */
export function fitRect(r: MapRect, size: number): { scale: number; ox: number; oz: number } {
  const w = r.x1 - r.x0;
  const h = r.z1 - r.z0;
  const scale = size / Math.max(w, h);
  return { scale, ox: (size - w * scale) / 2 - r.x0 * scale, oz: (size - h * scale) / 2 - r.z0 * scale };
}
