// Barra do topo: cronômetro da partida/rodada no meio, placar dos times (ou o seu e o do
// líder no FFA) dos lados e uma linha com o modo/objetivo.
import { el, Text, Toggle } from './dom';
import { formatClock } from './format';

export interface SideScore {
  value: number;
  /** Rótulo pequeno embaixo do número (ex.: "VOCÊ", "LÍDER", "RESISTÊNCIA"). */
  label: string;
}

export class Topbar {
  readonly root: HTMLElement;
  private readonly clock: Text;
  private readonly urgent: Toggle;
  private readonly round: Text;
  private readonly mode: Text;
  private readonly leftVal: Text;
  private readonly leftLabel: Text;
  private readonly rightVal: Text;
  private readonly rightLabel: Text;
  private readonly sides: Toggle;
  private readonly hidden: Toggle;
  private seconds = 0;
  private running = false;
  private urgentBelow = 30;

  constructor() {
    const clock = el('div', 'tb-clock');
    const round = el('div', 'tb-round');
    const lv = el('b');
    const ll = el('span');
    const rv = el('b');
    const rl = el('span');
    const mode = el('div', 'tb-mode');
    this.root = el(
      'div',
      'ch-topbar',
      el(
        'div',
        'tb-main',
        el('div', 'tb-side left', lv, ll),
        el('div', 'tb-center', round, clock),
        el('div', 'tb-side right', rv, rl),
      ),
      mode,
    );
    this.clock = new Text(clock);
    this.urgent = new Toggle(this.root, 'urgent');
    this.round = new Text(round);
    this.mode = new Text(mode);
    this.leftVal = new Text(lv);
    this.leftLabel = new Text(ll);
    this.rightVal = new Text(rv);
    this.rightLabel = new Text(rl);
    this.sides = new Toggle(this.root, 'has-sides');
    this.hidden = new Toggle(this.root, 'off');
  }

  /**
   * Cronômetro em segundos. `running` faz a contagem regressiva andar sozinha no `update`
   * (a rede pode corrigir a qualquer momento chamando de novo).
   */
  setTimer(seconds: number, running = true, urgentBelow = 30) {
    this.seconds = seconds;
    this.running = running;
    this.urgentBelow = urgentBelow;
    this.renderClock();
  }

  /** "RODADA 3" etc.; vazio esconde. */
  setRound(text: string) {
    this.round.set(text);
  }

  /** Linha embaixo (modo/objetivo), ex.: "FFA · PRIMEIRO A 20 ABATES". */
  setMode(text: string) {
    this.mode.set(text);
  }

  /** Placar dos lados (esquerda = você/seu time, direita = líder/rival). `null` esconde. */
  setSides(left: SideScore | null, right: SideScore | null = null) {
    this.sides.set(!!left);
    if (!left) return;
    this.leftVal.set(String(left.value));
    this.leftLabel.set(left.label);
    this.rightVal.set(right ? String(right.value) : '');
    this.rightLabel.set(right ? right.label : '');
  }

  setVisible(on: boolean) {
    this.hidden.set(!on);
  }

  update(dt: number) {
    if (!this.running || this.seconds <= 0) return;
    this.seconds = Math.max(0, this.seconds - dt);
    this.renderClock();
  }

  private renderClock() {
    this.clock.set(formatClock(this.seconds, true));
    this.urgent.set(this.seconds > 0 && this.seconds <= this.urgentBelow);
  }
}
