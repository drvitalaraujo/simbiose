// "Jogada da Partida" (puro): acompanha os abates da partida, junta sequências de um mesmo
// jogador e dá nota a cada lance com os motivos explicados. Como a partida dura mais que o
// buffer do gravador, cada lance candidato pede para congelar o trecho (`due`) logo depois do
// último abate dele; quem chama recorta o clipe e guarda só o melhor.

export interface HighlightKill {
  /** Tempo do abate na linha do tempo do replay (s). */
  t: number;
  killerId: string;
  killerName: string;
  victimId: string;
  weapon: string;
  headshot: boolean;
  /** Distância entre quem matou e a vítima (m). */
  distance: number;
  /** Time de quem matou (TDM/Hack); vazio no FFA. */
  killerTeam?: string;
}

export interface HighlightContext {
  /** Segundos que faltavam na partida. */
  timeLeft: number;
  /** Abates para vencer (0 = sem limite por abates, como no Hack). */
  killLimit: number;
}

export interface PlayReason {
  label: string;
  points: number;
}

export interface Play {
  killerId: string;
  killerName: string;
  kills: HighlightKill[];
  score: number;
  /** Nome curto do lance ("ABATE TRIPLO", "TIRO DE LONGE"...). */
  label: string;
  reasons: PlayReason[];
  /** Instante do auge (último abate). */
  peak: number;
}

/** Regras do recorte. */
export const HIGHLIGHT = {
  /** Abates do mesmo jogador com até este intervalo (s) formam uma sequência. */
  chainGap: 4.5,
  /** Respiro antes do primeiro abate e depois do último (s). */
  preRoll: 3,
  postRoll: 1.1,
  /** Trecho congelado no máximo (s). */
  maxLength: 8,
  /** Abaixo disto o lance não vale congelar (um abate comum = 100). */
  minScore: 100,
  /** Os últimos segundos da partida contam para "virada no fim". */
  clutchTime: 30,
} as const;

const MULTI = ['', 'ABATE', 'ABATE DUPLO', 'ABATE TRIPLO', 'ABATE QUÁDRUPLO', 'ABATE QUÍNTUPLO'];
const MULTI_BONUS = [0, 0, 150, 450, 800, 1200];
const LONG_SHOT = 25;

export function multiLabel(n: number): string {
  return n < MULTI.length ? MULTI[n] : 'MASSACRE';
}

/**
 * Nota de um lance. `extras` traz o que depende do placar (virada, abate da vitória),
 * calculado por quem acompanha a partida.
 */
export function scorePlay(kills: readonly HighlightKill[], extras: { clutch?: boolean; winner?: boolean } = {}): { score: number; label: string; reasons: PlayReason[] } {
  const reasons: PlayReason[] = [];
  const n = kills.length;
  const add = (label: string, points: number) => { if (points > 0) reasons.push({ label, points: Math.round(points) }); };
  add(n === 1 ? 'ABATE' : `${n} ABATES`, 100 * n);
  if (n >= 2) {
    add(multiLabel(n), n < MULTI_BONUS.length ? MULTI_BONUS[n] : 1200 + 400 * (n - 5));
    // Quanto mais rápida a sequência, melhor
    const span = kills[n - 1].t - kills[0].t;
    add('RAPIDEZ', Math.max(0, HIGHLIGHT.chainGap * (n - 1) - span) * 15);
  }
  const heads = kills.filter(k => k.headshot && !k.weapon.startsWith('chinelo')).length;
  if (heads) add(heads === 1 ? 'NA CABEÇA' : `${heads}× NA CABEÇA`, heads * 70);
  const melee = kills.filter(k => k.weapon === 'chinelo').length;
  const thrown = kills.filter(k => k.weapon === 'chinelo-arremesso').length;
  if (melee) add('CHINELADA FATAL', melee * 180);
  if (thrown) add('CHINELO VOADOR', thrown * 260);
  let longest = 0;
  for (const k of kills) if (k.weapon === 'sniper' && k.distance >= LONG_SHOT) longest = Math.max(longest, k.distance);
  if (longest) add(`TIRO DE LONGE · ${Math.round(longest)} m`, Math.min(320, 80 + (longest - LONG_SHOT) * 8));
  if (extras.clutch) add('VIRADA NO FIM', 250);
  if (extras.winner) add('ABATE DA VITÓRIA', 200);
  const score = reasons.reduce((sum, r) => sum + r.points, 0);
  const label = n >= 2 ? multiLabel(n)
    : extras.clutch ? 'VIRADA NO FIM'
      : thrown ? 'CHINELO VOADOR'
        : melee ? 'CHINELADA FATAL'
          : longest ? 'TIRO DE LONGE'
            : extras.winner ? 'ABATE DA VITÓRIA'
              : heads ? 'TIRO NA CABEÇA' : 'ABATE';
  return { score, label, reasons };
}

/** Pedido para congelar o trecho de um lance. */
export interface CaptureRequest {
  play: Play;
  from: number;
  to: number;
}

interface Chain {
  kills: HighlightKill[];
  clutch: boolean;
  winner: boolean;
  /** Já foi congelado com esta quantidade de abates. */
  captured: number;
}

export class HighlightTracker {
  private readonly chains = new Map<string, Chain>();
  private readonly tally = new Map<string, number>();
  /** Melhor lance já congelado (quem chama confirma com `commit`). */
  best: Play | null = null;

  reset() {
    this.chains.clear();
    this.tally.clear();
    this.best = null;
  }

  /** Um abate aconteceu (ignora morte sem matador e suicídio). */
  kill(k: HighlightKill, ctx: HighlightContext) {
    if (!k.killerId || k.killerId === k.victimId) return;
    // Placar por time (ou por jogador no FFA) para achar virada e abate da vitória
    const key = k.killerTeam || k.killerId;
    const before = this.tally.get(key) ?? 0;
    let rival = 0;
    for (const [other, v] of this.tally) if (other !== key) rival = Math.max(rival, v);
    const after = before + 1;
    this.tally.set(key, after);
    const tookLead = before <= rival && after > rival;
    const late = ctx.timeLeft <= HIGHLIGHT.clutchTime || (ctx.killLimit > 0 && after >= ctx.killLimit - 1);
    const clutch = tookLead && late && rival > 0;
    const winner = ctx.killLimit > 0 && after >= ctx.killLimit;

    let chain = this.chains.get(k.killerId);
    const last = chain?.kills[chain.kills.length - 1];
    if (!chain || !last || k.t - last.t > HIGHLIGHT.chainGap) {
      chain = { kills: [], clutch: false, winner: false, captured: 0 };
      this.chains.set(k.killerId, chain);
    }
    chain.kills.push(k);
    chain.clutch ||= clutch;
    chain.winner ||= winner;
  }

  /**
   * Lance pronto para congelar (o respiro depois do último abate já passou) e melhor que o
   * guardado. `flush` força os pendentes (fim da partida).
   */
  due(now: number, flush = false): CaptureRequest | null {
    let pick: CaptureRequest | null = null;
    for (const chain of this.chains.values()) {
      if (chain.captured === chain.kills.length) continue;
      const last = chain.kills[chain.kills.length - 1];
      if (!flush && now < last.t + HIGHLIGHT.postRoll) continue;
      const play = this.play(chain);
      // Se outro abate ainda pode estender a sequência, espera (exceto no fim)
      if (!flush && now < last.t + HIGHLIGHT.chainGap && chain.kills.length === 1 && play.score < 200) continue;
      chain.captured = chain.kills.length;
      if (play.score < HIGHLIGHT.minScore || (this.best && play.score <= this.best.score)) continue;
      const to = Math.min(now, last.t + HIGHLIGHT.postRoll);
      const from = Math.max(chain.kills[0].t - HIGHLIGHT.preRoll, to - HIGHLIGHT.maxLength);
      if (!pick || play.score > pick.play.score) pick = { play, from, to };
    }
    return pick;
  }

  /** O trecho do lance foi congelado: vira o melhor da partida. */
  commit(play: Play) {
    if (!this.best || play.score > this.best.score) this.best = play;
  }

  private play(chain: Chain): Play {
    const kills = chain.kills.slice();
    const last = kills[kills.length - 1];
    const { score, label, reasons } = scorePlay(kills, { clutch: chain.clutch, winner: chain.winner });
    return { killerId: last.killerId, killerName: last.killerName, kills, score, label, reasons, peak: last.t };
  }
}

/** Título da tela: "JOGADA DA PARTIDA — Lia: ABATE TRIPLO". */
export function playTitle(play: Play): string {
  return `JOGADA DA PARTIDA — ${play.killerName}: ${play.label}`;
}
