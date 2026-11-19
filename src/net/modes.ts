export type MatchMode = 'ffa' | 'duel' | 'tdm' | 'hack';
export type Team = 'a' | 'b' | '';

export const MODE_CONFIG: Readonly<Record<MatchMode, { title: string; capacity: number; fill: number; target: number }>> = {
  ffa: { title: 'Arena FFA', capacity: 8, fill: 6, target: 25 },
  duel: { title: 'Duelo', capacity: 2, fill: 0, target: 10 },
  tdm: { title: 'TDM 3v3', capacity: 6, fill: 6, target: 40 },
  hack: { title: 'Hackeia e Segura', capacity: 6, fill: 6, target: 150 },
};

export function modeFrom(value: unknown): MatchMode {
  return typeof value === 'string' && Object.hasOwn(MODE_CONFIG, value) ? value as MatchMode : 'ffa';
}
export const teamMode = (mode: MatchMode) => mode === 'tdm' || mode === 'hack';
export const allies = (mode: MatchMode, a: { team?: Team }, b: { team?: Team }) => teamMode(mode) && !!a.team && a.team === b.team;

/** Time menor: entrar nunca permite ao cliente escolher uma equipe superlotada. */
export function chooseTeam(mode: MatchMode, players: Iterable<{ team?: Team }>): Team {
  if (!teamMode(mode)) return '';
  let a = 0, b = 0;
  for (const p of players) { if (p.team === 'a') a++; else if (p.team === 'b') b++; }
  return a <= b ? 'a' : 'b';
}

export function teamWinner(a: number, b: number): { winnerId: string; winnerName: string; winnerTeam: Team; drawn: boolean } {
  if (a === b) return { winnerId: '', winnerName: 'Empate', winnerTeam: '', drawn: true };
  const team = a > b ? 'a' : 'b';
  return { winnerId: `team-${team}`, winnerName: team === 'a' ? 'Equipe A' : 'Equipe B', winnerTeam: team, drawn: false };
}

export function balanceBotTeams(players: Iterable<{ team?: Team; bot: boolean }>) {
  const all = [...players];
  for (let n = 0; n < all.length; n++) {
    const a = all.filter(p => p.team === 'a').length, b = all.filter(p => p.team === 'b').length;
    if (Math.abs(a - b) <= 1) break;
    const bot = all.find(p => p.bot && p.team === (a > b ? 'a' : 'b'));
    if (!bot) break;
    bot.team = a > b ? 'b' : 'a';
  }
}

export function individualWinner(players: Iterable<[string, { name: string; kills: number; deaths: number }]>) {
  const ranked = [...players].sort((a, b) => b[1].kills - a[1].kills || a[1].deaths - b[1].deaths);
  const best = ranked[0];
  const tied = best && ranked[1] && best[1].kills === ranked[1][1].kills && best[1].deaths === ranked[1][1].deaths;
  return { winnerId: tied ? '' : best?.[0] ?? '', winnerName: tied ? 'Empate' : best?.[1].name ?? '', drawn: !!tied, winnerTeam: '' };
}
