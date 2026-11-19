// Moldura dos replays (DOM): faixas de cinema, selo KILLCAM / JOGADA DA PARTIDA, quem matou,
// onomatopeia no tiro final, contador de abates e o botão "SALVAR CLIPE". Durante o replay
// o corpo ganha a classe `replay-on`, que esconde o HUD do jogo (ver replay.css).
import './replay.css';
import { el } from '../hud/dom';
import type { PlayReason } from './highlight';
import { killcamTitle } from './replay-drone';

/** Onomatopeia por arma (o texto grande, a "legenda" em japonês e o selo de baixo). */
export function onomatopoeia(weapon: string, headshot: boolean): { big: string; jp: string; sub: string } {
  const sub = headshot ? 'NA CABEÇA!' : '';
  switch (weapon) {
    case 'sniper': return { big: 'DOOM!!', jp: 'ドーン', sub };
    case 'shotgun': return { big: 'BLAM!', jp: 'バーン', sub };
    case 'grenade': return { big: 'BUUM!', jp: 'ドーン', sub: 'GRANADA HE!' };
    case 'drone': return { big: 'ZAP!', jp: 'ビーッ', sub: 'DRONE HACKEADO!' };
    case 'smg': return { big: 'RA-TA-TÁ!', jp: 'ダダダ', sub };
    case 'chinelo': return { big: 'PLAFT!', jp: 'パシッ', sub: 'CHINELADA!' };
    case 'chinelo-arremesso': return { big: 'TOING-PLAFT!', jp: 'ビシッ', sub: 'CHINELO VOADOR!' };
    default: return { big: 'BANG!', jp: 'バン', sub };
  }
}

export interface KillcamInfo {
  killer: string;
  bot: boolean;
  /** Id da arma ('drone' = drone hackeado do matador) e o nome mostrado. */
  weapon: string;
  label: string;
}

export class ReplayOverlay {
  private readonly root = el('div', 'rp');
  private readonly stamp = el('div', 'rp-stamp');
  private readonly speed = el('div', 'rp-speed outline', 'CÂMERA LENTA ×0.4');
  private readonly band = el('div', 'rp-band');
  private readonly hint = el('div', 'rp-hint');
  private readonly pop = el('div', 'rp-pop');
  private readonly count = el('div', 'rp-count');
  private readonly introTitle = el('div', 'h', 'JOGADA DA PARTIDA');
  readonly save = el('button', 'rp-save', 'SALVAR CLIPE');
  private slow = false;

  constructor() {
    this.root.append(
      el('div', 'rp-vignette'),
      el('div', 'rp-bar top'),
      el('div', 'rp-bar bottom'),
      el('div', 'rp-corner tl'), el('div', 'rp-corner tr'), el('div', 'rp-corner bl'), el('div', 'rp-corner br'),
      this.stamp,
      this.speed,
      this.count,
      this.pop,
      this.band,
      this.hint,
      el('div', 'rp-intro', el('div', 'k', 'E O DESTAQUE VAI PARA…'), this.introTitle),
    );
    this.save.type = 'button';
    this.save.title = 'Baixa o replay da Jogada da Partida em vídeo (webm)';
    document.body.append(this.root, this.save);
  }

  showKillcam(k: KillcamInfo) {
    this.reset('killcam');
    this.stamp.replaceChildren(el('span', 'rec'), 'KILLCAM');
    const c = killcamTitle(k.killer, k.bot, k.weapon, k.label);
    this.band.replaceChildren(
      el('span', 't outline', c.lead, el('b', '', c.name), c.tail),
      el('span', 's', c.sub),
    );
    this.hint.replaceChildren(el('kbd', '', 'ESPAÇO'), ' pular');
    this.show();
  }

  /** Abertura enquanto o último lance termina de gravar. */
  intro() {
    this.reset('intro');
    this.show();
  }

  showHighlight(name: string, label: string, reasons: readonly PlayReason[]) {
    this.reset('highlight');
    this.stamp.replaceChildren(el('span', 'rec'), 'JOGADA DA PARTIDA');
    const chips = el('div', 'rp-reasons', ...reasons.map((r, i) => {
      const chip = el('span', '', `+${r.points} ${r.label}`);
      chip.style.animationDelay = `${0.25 + i * 0.12}s`;
      return chip;
    }));
    this.band.replaceChildren(el('span', 't outline', 'JOGADA DA PARTIDA — ', el('b', '', name), `: ${label}`), chips);
    this.hint.replaceChildren(el('kbd', '', 'ESPAÇO'), ' ver o placar');
    this.show();
  }

  setSlow(slow: boolean, speed: number) {
    if (slow !== this.slow) {
      this.slow = slow;
      this.root.classList.toggle('slow', slow);
    }
    if (slow) this.speed.textContent = `CÂMERA LENTA ×${speed.toFixed(1).replace('.', ',')}`;
  }

  /** Onomatopeia grande no tiro que matou. */
  burst(weapon: string, headshot: boolean) {
    const o = onomatopoeia(weapon, headshot);
    this.pop.replaceChildren(el('span', 'big', o.big), el('span', 'jp', o.jp), ...(o.sub ? [el('span', 'sub', o.sub)] : []));
    this.pop.classList.remove('show');
    void this.pop.offsetWidth; // reinicia a animação
    this.pop.classList.add('show');
  }

  /** Contador de abates da Jogada (1, 2, 3...). */
  killCount(n: number) {
    this.count.replaceChildren(String(n), el('small', '', n === 1 ? 'ABATE' : 'ABATES'));
    this.count.hidden = false;
    this.count.classList.remove('bump');
    void this.count.offsetWidth;
    this.count.classList.add('bump');
  }

  hide() {
    this.root.classList.remove('show', 'slow', 'intro', 'highlight', 'killcam');
    this.slow = false;
    document.body.classList.remove('replay-on');
  }

  showSave(visible: boolean) {
    this.save.classList.toggle('show', visible);
  }

  destroy() {
    this.hide();
    this.root.remove();
    this.save.remove();
  }

  private reset(mode: 'killcam' | 'intro' | 'highlight') {
    this.root.classList.remove('slow', 'intro', 'highlight', 'killcam');
    this.root.classList.add(mode);
    this.slow = false;
    this.pop.classList.remove('show');
    this.count.hidden = true;
  }

  private show() {
    this.root.classList.add('show');
    document.body.classList.add('replay-on');
  }
}
