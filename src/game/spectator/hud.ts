// HUD de quem assiste: killfeed, placar (Tab), cronômetro e anúncios do HUD competitivo, sem
// vida/munição/minimapa; embaixo, quem está em cena e a câmera; aviso de fila de espera.
import { el } from '../hud/dom';
import { CompetitiveHud, setCompetitiveMode } from '../hud/index';
import type { KillFeedEvent, ScoreRow } from '../../net/feed';
import { MAX_HP } from '../../sim/player';
import { hudTeam, killView, scoreView } from '../online/hud-data';
import type { CameraMode } from './cameras';
import { injectSpectatorStyle } from './style';

const MODE_LABEL: Record<CameraMode, string> = {
  free: 'CÂMERA LIVRE',
  chase: '3ª PESSOA',
  eyes: '1ª PESSOA',
  director: 'DIRETOR AUTOMÁTICO',
};

export interface SpectatorMatch {
  phase: string;
  timeLeft: number;
  killLimit: number;
  match: number;
  mode: string;
  scoreA: number;
  scoreB: number;
  winnerName: string;
  winnerTeam: string;
  drawn: boolean;
  rows: ScoreRow[];
}

export class SpectatorHud {
  readonly competitive = new CompetitiveHud();
  private readonly bar = el('div', 'sp-bar');
  private readonly who = el('div', 'sp-who');
  private readonly mode = el('div', 'sp-mode');
  private readonly help = el('div', 'sp-help');
  private readonly wait = el('div', 'sp-wait');
  private readonly status = el('div', 'sp-status');
  private whoKey = '-';
  private waitKey = '';
  private phase = '';
  private match = -1;

  /** `host`: a tela da live tem o pódio próprio (o placar não abre por cima dele). */
  constructor(private readonly host = false) {
    injectSpectatorStyle();
    setCompetitiveMode(true);
    document.body.classList.add('mode-spectator');
    this.competitive.root.classList.add('spectating');
    this.help.innerHTML = '<b>1</b> livre · <b>2</b> 3ª pessoa · <b>3</b> 1ª pessoa · <b>4</b> diretor<br><b>←/→</b> ou clique: trocar jogador · <b>Tab</b> placar<br>Livre: <b>WASD</b> + arrastar · <b>Q/E</b> desce/sobe · <b>Shift</b> rápido';
    this.wait.hidden = true;
    this.status.hidden = true;
    this.bar.append(this.mode, this.who);
    document.body.append(this.bar, this.help, this.wait, this.status);
  }

  setStatus(text: string) {
    this.status.textContent = text;
    this.status.hidden = !text;
  }

  /** Fila de espera (sala cheia). `null` esconde. */
  /** Fila: `place` = sua posição (1 = próximo); `benched` = saiu pelo rodízio "quem perde sai". */
  setWaiting(info: { place: number; benched: boolean } | null) {
    this.wait.hidden = !info;
    const key = info ? `${info.place}|${info.benched}` : '';
    if (!info || key === this.waitKey) return;
    this.waitKey = key;
    const title = info.benched ? 'Quem perde sai! Você volta na próxima' : 'Sala cheia — você entra na próxima partida';
    this.wait.replaceChildren(title, el('small', '', info.place > 1 ? `Você é o ${info.place}º da fila · assistindo enquanto isso` : 'Você é o próximo · assistindo enquanto isso'));
  }

  setCamera(mode: CameraMode, target: { name: string; bot: boolean; hp: number } | null) {
    this.mode.textContent = MODE_LABEL[mode];
    const key = target ? `${target.name}|${target.bot}|${Math.ceil(target.hp)}` : '';
    if (key === this.whoKey) return;
    this.whoKey = key;
    this.who.hidden = !target || mode === 'free';
    if (!target) return;
    const hp = el('span', target.hp <= MAX_HP * 0.3 ? 'hp low' : 'hp', target.hp > 0 ? `♥ ${Math.ceil(target.hp)}` : 'ABATIDO');
    this.who.replaceChildren(el('em', '', 'ASSISTINDO'), target.name, ...(target.bot ? [el('span', 'bot', 'BOT')] : []), hp);
  }

  kill(e: KillFeedEvent, followed: string) {
    this.competitive.pushKill(killView(e));
    if (e.killerId === followed && e.victimId !== followed) this.competitive.announce('ABATE!', `${e.killer} derrubou ${e.victim}`, 'ally', 1.4);
  }

  /** Placar e topo; em cena = `followed` (cores amarelas no killfeed/placar). */
  setMatch(m: SpectatorMatch, followed: string, dt: number) {
    const teams = m.mode === 'tdm' || m.mode === 'hack';
    const label = m.mode === 'hack' ? 'HACKEIA E SEGURA' : m.mode === 'tdm' ? 'TDM 3v3' : m.mode === 'duel' ? 'DUELO 1v1' : 'TODOS CONTRA TODOS';
    const mine = m.rows.find(r => r.id === followed);
    const hud = this.competitive;
    hud.setLocalPlayer({ id: followed, team: hudTeam(mine?.team) });
    if (m.match !== this.match) {
      this.match = m.match;
      hud.reset();
      this.phase = '';
    }
    if (m.phase !== this.phase) {
      this.phase = m.phase;
      if (m.phase === 'ended') {
        const who = m.drawn ? 'EMPATE' : teams ? (m.winnerTeam === 'a' ? 'EQUIPE A' : 'EQUIPE B') : m.winnerName;
        hud.announce('FIM DE PARTIDA', who ? `Vitória: ${who}` : '', 'otimiza', 4);
      } else if (m.phase === 'playing') {
        hud.announce('VALENDO!', `Primeiro a ${m.killLimit} ${m.mode === 'hack' ? 'pontos' : 'abates'}`, 'otimiza', 2);
      }
    }
    hud.showScoreboard(m.phase === 'ended' && !this.host);
    hud.setScoreboard(scoreView(m.rows));
    hud.setScoreboardTitle(`PLACAR · ${label}`);
    hud.setTimer(m.timeLeft, m.phase === 'playing');
    hud.setRound(m.phase === 'waiting' ? 'AGUARDANDO RIVAL' : m.phase === 'ended' ? 'REVANCHE EM BREVE' : `PARTIDA ${m.match}`);
    hud.setModeLabel(`${label} · ${m.killLimit} ${m.mode === 'hack' ? 'PONTOS' : 'ABATES'} · AO VIVO`);
    if (teams) hud.setTopScores({ value: m.scoreA, label: 'EQUIPE A' }, { value: m.scoreB, label: 'EQUIPE B' });
    else {
      const [first, second] = m.rows;
      hud.setTopScores(first ? { value: first.kills, label: first.name.toUpperCase() } : null, second ? { value: second.kills, label: second.name.toUpperCase() } : null);
    }
    hud.update(dt);
  }

  destroy() {
    this.competitive.destroy();
    this.bar.remove();
    this.help.remove();
    this.wait.remove();
    this.status.remove();
    document.body.classList.remove('mode-spectator');
    setCompetitiveMode(false);
  }
}
