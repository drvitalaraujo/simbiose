// Telas cheias do competitivo: morte (quem te matou + contagem do respawn) e fim de partida
// (resultado, MVP, estatísticas, placar e o botão "Jogar de novo" bem grande).
import { el, nameTag, Text, Toggle } from './dom';
import { type LocalView, otimizaQuip, outcomeTitle, relation } from './format';
import { Scoreboard } from './scoreboard';
import type { DeathData, MatchEndData } from './types';

const DEATH_LINES = [
  'Sua eliminação foi registrada para fins de melhoria contínua ✨',
  'Detectamos frustração. Já agendamos um sorriso para você ✨',
  'Morrer é só um atrito. A OTIMIZA remove atritos ✨',
  'Obrigada por testar nosso novo plano de felicidade ✨',
];

export class DeathScreen {
  readonly root = el('div', 'ch-death');
  private readonly shown: Toggle;
  private readonly killer = el('div', 'd-killer');
  private readonly detail = el('div', 'd-detail');
  private readonly count: Text;
  private readonly countLabel: Text;
  private readonly line: Text;
  private left = 0;
  private active = false;
  private lineIndex = 0;

  constructor(private readonly local: () => LocalView) {
    const count = el('b', 'd-count');
    const countLabel = el('span', 'd-count-label');
    const line = el('p', 'd-line');
    this.root.append(
      el('div', 'd-band', el('div', 'd-title', 'VOCÊ FOI OTIMIZADO'), this.killer, this.detail),
      el('div', 'd-respawn', countLabel, count),
      line,
    );
    this.shown = new Toggle(this.root, 'show');
    this.count = new Text(count);
    this.countLabel = new Text(countLabel);
    this.line = new Text(line);
  }

  show(d: DeathData) {
    const me = this.local();
    if (d.killer && d.killer.id !== me.id) {
      this.killer.replaceChildren(el('span', 'by', 'POR '), nameTag(d.killer, relation(d.killer, me)));
    } else {
      this.killer.replaceChildren(el('span', 'by', d.killer ? 'POR VOCÊ MESMO' : 'PELO AMBIENTE'));
    }
    const bits = [d.weapon.toUpperCase()];
    if (d.headshot) bits.push('NA CABEÇA');
    if (d.killerHp !== undefined && d.killer) bits.push(`ficou com ${Math.max(0, Math.ceil(d.killerHp))} de vida`);
    this.detail.textContent = bits.join(' · ');
    this.line.set(DEATH_LINES[this.lineIndex++ % DEATH_LINES.length]);
    this.left = d.respawnIn;
    this.active = true;
    this.renderCount();
    this.shown.set(true);
  }

  hide() {
    this.active = false;
    this.shown.set(false);
  }

  update(dt: number) {
    if (!this.active) return;
    this.left = Math.max(0, this.left - dt);
    this.renderCount();
  }

  private renderCount() {
    if (this.left > 0) {
      this.countLabel.set('RENASCE EM');
      this.count.set(String(Math.ceil(this.left)));
    } else {
      this.countLabel.set('RENASCENDO…');
      this.count.set('');
    }
  }
}

export interface MatchEndActions {
  onPlayAgain: () => void;
  onMenu?: () => void;
}

export class MatchEndScreen {
  readonly root = el('div', 'ch-end');
  private readonly shown: Toggle;
  private readonly title = el('div', 'e-title');
  private readonly score = el('div', 'e-score');
  private readonly quip = el('div', 'e-quip');
  private readonly mvp = el('div', 'e-mvp');
  private readonly stats = el('div', 'e-stats');
  private readonly again = el('button', 'e-again');
  private readonly menu = el('button', 'e-menu', 'MENU');
  private readonly table: Scoreboard;
  private actions: MatchEndActions | null = null;
  private visible = false;
  private againFired = false;
  private menuFired = false;
  private focusFrame = 0;

  constructor(private readonly local: () => LocalView) {
    this.table = new Scoreboard(local);
    this.table.root.classList.add('embedded');
    this.again.append(el('span', 'big', 'JOGAR DE NOVO'), el('span', 'key', 'ESPAÇO'));
    this.again.type = 'button';
    this.menu.type = 'button';
    this.root.append(
      el(
        'div',
        'e-wrap',
        el('div', 'e-head', this.title, this.score),
        this.quip,
        el('div', 'e-grid', this.mvp, this.stats),
        this.table.root,
        el('div', 'e-actions', this.again, this.menu),
      ),
    );
    this.shown = new Toggle(this.root, 'show');
    this.again.addEventListener('click', () => this.fire('again'));
    this.menu.addEventListener('click', () => this.fire('menu'));
    window.addEventListener('keydown', this.onKey);
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (!this.visible || e.repeat) return;
    // No botão MENU, Enter/Espaço devem manter a ativação nativa do botão.
    if (e.target === this.menu) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.fire('again');
    }
  };

  destroy() {
    this.hide();
    window.removeEventListener('keydown', this.onKey);
  }

  /** Deduplica cada ação sem impedir sair enquanto a revanche está pendente. */
  private fire(which: 'again' | 'menu') {
    if (!this.visible || this.menuFired) return;
    if (which === 'again') {
      if (this.againFired) return;
      this.againFired = true;
      this.actions?.onPlayAgain();
    } else {
      if (!this.actions?.onMenu) return;
      this.menuFired = true;
      this.actions.onMenu();
    }
  }

  setTeamNames(a: string, b: string) {
    this.table.setTeamNames(a, b);
  }

  show(d: MatchEndData, actions: MatchEndActions) {
    this.actions = actions;
    const me = this.local();
    this.root.dataset.outcome = d.outcome;
    this.title.textContent = d.title ?? outcomeTitle(d.outcome);
    this.score.textContent = d.teamScore ? `${d.teamScore.a} — ${d.teamScore.b}` : '';
    this.quip.replaceChildren(el('b', '', 'OTIMIZA: '), d.quip ?? otimizaQuip(d.outcome));

    const mvpRel = relation(d.mvp, me);
    this.mvp.replaceChildren(
      el('div', 'm-tag', 'MVP'),
      el('div', 'm-name', nameTag(d.mvp, mvpRel)),
      el('div', 'm-line', d.mvp.line),
    );
    this.stats.replaceChildren(
      ...d.stats.map((s) => el('div', 'stat', el('b', '', s.value), el('span', '', s.label))),
    );
    this.table.setTitle('PLACAR FINAL');
    this.table.setRows(d.rows);
    this.table.show(true);
    this.menu.hidden = !actions.onMenu;
    this.visible = true;
    this.againFired = false;
    this.menuFired = false;
    this.shown.set(true);
    // Foco no botão: Enter/Espaço já funcionam e leitor de tela anuncia
    cancelAnimationFrame(this.focusFrame);
    this.focusFrame = requestAnimationFrame(() => {
      this.focusFrame = 0;
      if (this.visible) this.again.focus({ preventScroll: true });
    });
  }

  hide() {
    cancelAnimationFrame(this.focusFrame);
    this.focusFrame = 0;
    this.visible = false;
    this.actions = null;
    this.shown.set(false);
  }

  get isShown() {
    return this.visible;
  }
}
