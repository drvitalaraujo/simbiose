// Tela da live do anfitrião: convite grande (QR + link + código da sala, "ENTRE AGORA",
// H esconde), contadores, placar da SESSÃO (somado entre revanches, guardado só neste
// navegador) e o pódio entre partidas.
import { el } from '../hud/dom';
import { sourceLink } from '../menu/source-link';
import { hex, PALETTE } from '../toon';
import type { AudienceMsg } from '../../net/spectate';
import { qrSvg } from './qr';
import { type MatchResult, SessionScore, type SessionRow } from './session-score';
import { injectSpectatorStyle } from './style';

const STORE_PREFIX = 'simbiose-live:';
const BOARD_ROWS = 8;
const BOARD_EVERY = 0.5;

function load(roomId: string): SessionScore {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + roomId);
    return new SessionScore(raw ? JSON.parse(raw) : null);
  } catch {
    return new SessionScore();
  }
}

function save(roomId: string, score: SessionScore) {
  try {
    localStorage.setItem(STORE_PREFIX + roomId, JSON.stringify(score));
  } catch {
    // aba anônima ou armazenamento cheio: o placar segue só na memória
  }
}

export class LiveOverlay {
  readonly session: SessionScore;
  private readonly invite = el('div', 'lv-invite');
  private readonly board = el('div', 'lv-session');
  private readonly count = el('div', 'lv-count');
  private readonly list = el('ol');
  private readonly podium = el('div', 'lv-podium off');
  private readonly podiumWinner = el('div', 'winner');
  private readonly podiumSteps = el('div', 'lv-steps');
  private readonly podiumNext = el('div', 'next');
  private boardTimer = 0;
  private countKey = '';
  private boardKey = '-';
  private podiumMatch = -1;

  constructor(private readonly roomId: string, link: string) {
    injectSpectatorStyle();
    this.session = load(roomId);
    const qr = el('div', 'lv-qr');
    qr.innerHTML = qrSvg(link, hex(PALETTE.ink), hex(PALETTE.paper));
    this.invite.append(
      el('h2', '', 'ENTRE AGORA'),
      qr,
      el('div', 'lv-code', roomId),
      el('div', 'lv-link', link),
      el('div', 'lv-hint', 'Jogue no computador: abra o link · no celular, aponte a câmera para guardar o link · H esconde'),
      sourceLink('lv-source'),
    );
    this.board.append(this.count, el('h3', '', 'PLACAR DA SESSÃO'), this.list);
    this.podium.append(el('h1', '', 'PÓDIO DA SESSÃO'), this.podiumWinner, this.podiumSteps, this.podiumNext);
    document.body.append(this.invite, this.board, this.podium);
  }

  get inviteShown(): boolean {
    return !this.invite.classList.contains('off');
  }

  toggleInvite(on = !this.inviteShown) {
    this.invite.classList.toggle('off', !on);
  }

  setAudience(a: AudienceMsg | null, playersInMatch: number) {
    const humans = a?.players ?? 0;
    const key = `${humans}|${a?.capacity}|${a?.spectators}|${a?.waiting}|${playersInMatch}`;
    if (key === this.countKey) return;
    this.countKey = key;
    const parts = [el('span', '', `JOGADORES ${humans}/${a?.capacity ?? '?'}`)];
    if (playersInMatch > humans) parts.push(el('span', '', `+${playersInMatch - humans} BOTS`));
    // O anfitrião também assiste: plateia sem ele
    parts.push(el('span', '', `PLATEIA ${Math.max(0, (a?.spectators ?? 1) - 1 - (a?.waiting ?? 0))}`));
    if (a?.waiting) parts.push(el('span', '', `NA FILA ${a.waiting}`));
    this.count.replaceChildren(...parts);
  }

  /**
   * Por quadro: grava a partida que acabou (uma vez), atualiza o placar da sessão e abre o
   * pódio durante a tela de fim.
   */
  update(dt: number, result: MatchResult, phase: string, timeLeft: number, winnerLabel: string) {
    if (phase === 'ended' && !this.session.has(result.match)) {
      this.session.commit(result);
      save(this.roomId, this.session);
      this.boardTimer = 0;
    }
    this.boardTimer -= dt;
    if (this.boardTimer <= 0) {
      this.boardTimer = BOARD_EVERY;
      this.renderBoard(this.session.view(phase === 'ended' ? null : result));
    }
    const ended = phase === 'ended';
    this.podium.classList.toggle('off', !ended);
    if (!ended) return;
    if (this.podiumMatch !== result.match) {
      this.podiumMatch = result.match;
      this.podiumWinner.textContent = winnerLabel ? `Partida ${result.match}: vitória de ${winnerLabel}` : `Partida ${result.match} encerrada`;
      this.renderPodium(this.session.podium());
    }
    this.podiumNext.textContent = `Revanche em ${Math.max(0, Math.ceil(timeLeft))} s · escaneie o QR e entre na próxima`;
  }

  private renderBoard(rows: SessionRow[]) {
    const key = rows.slice(0, BOARD_ROWS).map(r => `${r.name}:${r.kills}:${r.deaths}:${r.wins}`).join('|');
    if (key === this.boardKey) return;
    this.boardKey = key;
    if (rows.length === 0) {
      this.list.replaceChildren(el('li', 'empty', 'Ninguém jogou ainda'));
      return;
    }
    this.list.replaceChildren(...rows.slice(0, BOARD_ROWS).map((r, i) =>
      el('li', '', el('i', '', `${i + 1}`), `${r.name}${r.bot ? ' (BOT)' : ''}`, el('b', '', `${r.wins}V · ${r.kills}/${r.deaths}`))));
  }

  private renderPodium(top: SessionRow[]) {
    // Ordem visual clássica: 2º, 1º, 3º
    const order = [1, 0, 2].filter(i => top[i]);
    this.podiumSteps.replaceChildren(...order.map(i => {
      const r = top[i];
      return el('div', `lv-step p${i + 1}`,
        el('div', 'name', r.name),
        el('div', 'line', `${r.wins} vitória${r.wins === 1 ? '' : 's'} · ${r.kills} abates · ${r.deaths} mortes`),
        el('div', 'block', `${i + 1}º`));
    }));
  }

  destroy() {
    this.invite.remove();
    this.board.remove();
    this.podium.remove();
  }
}
