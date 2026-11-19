// Placar da SESSÃO do Modo Live (puro): soma abates, mortes e vitórias por apelido ao longo
// das revanches da mesma sala. Fica só no cliente do anfitrião (o servidor zera o placar a
// cada partida). Partida em andamento entra "ao vivo" sem ser gravada duas vezes.

export interface MatchRow {
  name: string;
  kills: number;
  deaths: number;
  bot: boolean;
  team?: string;
}

export interface MatchResult {
  /** Número da partida na sala (`state.match`). */
  match: number;
  rows: readonly MatchRow[];
  /** Apelido do vencedor (FFA/Duelo); vazio em empate. */
  winnerName?: string;
  /** Time vencedor (TDM/Hack); vazio fora de times ou em empate. */
  winnerTeam?: string;
  drawn?: boolean;
}

export interface SessionRow {
  name: string;
  kills: number;
  deaths: number;
  wins: number;
  /** Partidas que jogou nesta sessão. */
  matches: number;
  bot: boolean;
}

export interface SessionData {
  rows: SessionRow[];
  /** Partidas já somadas (não somar a mesma duas vezes). */
  counted: number[];
}

/** Mais vitórias, depois mais abates, menos mortes e o nome. */
function rank(a: SessionRow, b: SessionRow): number {
  return b.wins - a.wins || b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name);
}

export class SessionScore {
  private readonly rows = new Map<string, SessionRow>();
  private readonly counted = new Set<number>();

  constructor(data?: SessionData | null) {
    if (!data || !Array.isArray(data.rows)) return;
    for (const r of data.rows) {
      if (typeof r?.name !== 'string') continue;
      this.rows.set(r.name, { name: r.name, kills: num(r.kills), deaths: num(r.deaths), wins: num(r.wins), matches: num(r.matches), bot: !!r.bot });
    }
    for (const m of Array.isArray(data.counted) ? data.counted : []) if (Number.isFinite(m)) this.counted.add(m);
  }

  /** Já somou esta partida? */
  has(match: number): boolean {
    return this.counted.has(match);
  }

  /** Soma uma partida encerrada (uma vez só por número de partida). Devolve se somou. */
  commit(result: MatchResult): boolean {
    if (this.counted.has(result.match)) return false;
    this.counted.add(result.match);
    for (const [name, row] of merge(this.rows, result, true)) this.rows.set(name, row);
    return true;
  }

  /** Sessão somada à partida em andamento (ainda não gravada), ordenada. */
  view(live?: MatchResult | null): SessionRow[] {
    const rows = live && !this.counted.has(live.match) ? merge(this.rows, { ...live, winnerName: '', winnerTeam: '' }, false) : this.rows;
    return [...rows.values()].map(r => ({ ...r })).sort(rank);
  }

  /** Os três primeiros da sessão (pódio entre partidas). */
  podium(): SessionRow[] {
    return this.view().slice(0, 3);
  }

  toJSON(): SessionData {
    return { rows: this.view(), counted: [...this.counted] };
  }
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Cópia de `base` com a partida somada. `finished`: conta partida jogada e vitória. */
function merge(base: ReadonlyMap<string, SessionRow>, result: MatchResult, finished: boolean): Map<string, SessionRow> {
  const out = new Map<string, SessionRow>();
  for (const [k, r] of base) out.set(k, { ...r });
  const seen = new Set<string>();
  for (const r of result.rows) {
    const row = out.get(r.name) ?? { name: r.name, kills: 0, deaths: 0, wins: 0, matches: 0, bot: r.bot };
    row.kills += num(r.kills);
    row.deaths += num(r.deaths);
    row.bot = row.bot && r.bot; // mesmo apelido usado por gente vale como gente
    if (finished && !seen.has(r.name)) {
      row.matches += 1;
      const won = !result.drawn && (result.winnerTeam ? r.team === result.winnerTeam : !!result.winnerName && r.name === result.winnerName);
      if (won) row.wins += 1;
    }
    seen.add(r.name);
    out.set(r.name, row);
  }
  return out;
}
