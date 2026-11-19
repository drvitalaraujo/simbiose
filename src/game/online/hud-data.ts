// Conversões puras entre mensagens da rede e a apresentação do HUD.
import type { KillFeedEvent, ScoreRow } from '../../net/feed';
import type { KillEvent, MatchEndData, TeamId } from '../hud/types';
import { ARSENAL } from '../../sim/weapons';

export interface MatchPresentation {
  rows: (Omit<ScoreRow, 'team'> & { team?: string })[];
  me: string;
  winnerId: string;
  winnerName: string;
  mode?: string;
  scoreA?: number;
  scoreB?: number;
  winnerTeam?: string;
  drawn?: boolean;
}
export function hudTeam(value?: string): TeamId | undefined { return value === 'a' || value === 'b' ? value : undefined; }
export function scoreView(rows: MatchPresentation['rows']) { return rows.map(({ team, ...r }) => ({ ...r, team: hudTeam(team) })); }

export function weaponLabel(id: string): string {
  const gun = ARSENAL.find(w => w.id === id);
  if (gun) return gun.name;
  if (id === 'chinelo') return 'Chinelada';
  if (id === 'chinelo-arremesso') return 'Chinelo voador';
  if (id === 'grenade') return 'Granada HE';
  if (id === 'drone') return 'Drone hackeado';
  return id;
}

export function killView(e: KillFeedEvent): KillEvent {
  return {
    killer: e.killerId ? { id: e.killerId, name: e.killer, bot: e.killerIsBot, ...(hudTeam(e.killerTeam) ? { team: hudTeam(e.killerTeam) } : {}) } : null,
    victim: { id: e.victimId, name: e.victim, bot: e.victimIsBot, ...(hudTeam(e.victimTeam) ? { team: hudTeam(e.victimTeam) } : {}) },
    weapon: weaponLabel(e.weapon),
    headshot: e.headshot,
  };
}

export function matchEndView(m: MatchPresentation): MatchEndData {
  const mine = m.rows.find((r) => r.id === m.me);
  const teams = m.mode === 'tdm' || m.mode === 'hack';
  const winner = teams ? m.rows.find(r => r.team === m.winnerTeam) : m.rows.find((r) => r.id === m.winnerId);
  const rank = m.rows.findIndex((r) => r.id === m.me) + 1;
  const draw = !!m.drawn || !m.winnerId;
  const won = teams ? !!mine?.team && mine.team === m.winnerTeam : m.winnerId === m.me;
  return {
    outcome: draw ? 'draw' : won ? 'win' : 'loss',
    title: draw ? 'EMPATE' : teams ? won ? 'VITÓRIA' : 'DERROTA' : rank ? `${rank}º LUGAR` : 'FIM DE PARTIDA',
    ...(teams ? { teamScore: { a: m.scoreA ?? 0, b: m.scoreB ?? 0 } } : {}),
    mvp: { id: winner?.id ?? m.winnerId, name: winner?.name ?? m.winnerName, bot: winner?.bot, team: hudTeam(winner?.team), line: winner ? `${winner.kills} abates · ${winner.deaths} mortes` : 'Partida encerrada' },
    stats: [{ label: 'ABATES', value: String(mine?.kills ?? 0) }, { label: 'MORTES', value: String(mine?.deaths ?? 0) }],
    rows: scoreView(m.rows),
  };
}
