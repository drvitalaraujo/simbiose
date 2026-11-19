// Tela do "Teste de Admissão": cartão com a fala da Kaia/Bit, teclas, barra de progresso,
// carimbo "APROVADO!" e o convite final para a Arena. Só DOM; quem decide é o tutorial.ts.
import './tutorial.css';
import { el } from './hud/dom';
import { keycap } from './menu/keys';
import { FINAL_LINE, STEPS, type StepDef } from './tutorial-steps';

export class TutorialUi {
  readonly root = el('div', 'tut');
  private readonly card = el('div', 'tut-card');
  private readonly count = el('span', 'tut-count');
  private readonly title = el('b', 'tut-title');
  private readonly speaker = el('span', 'tut-speaker');
  private readonly line = el('p', 'tut-line');
  private readonly hints = el('div', 'tut-hints');
  private readonly fill = el('i', 'tut-fill');
  private readonly retort = el('p', 'tut-retort');
  private readonly stamp = el('div', 'tut-stamp', el('b', '', 'APROVADO!'), el('span', 'tut-praise'));
  private readonly final = el('div', 'tut-final');
  private stampLeft = 0;
  private retortLeft = 0;

  constructor(onArena: () => void, onStay: () => void) {
    const bar = el('div', 'tut-bar', this.fill);
    const skip = el('p', 'tut-skip', keycap('P'), ' pula o passo · segure ', keycap('P'), ' para sair do teste');
    this.card.append(
      el('div', 'tut-head', el('span', 'tut-kicker', 'TESTE DE ADMISSÃO'), this.count),
      this.title,
      el('div', 'tut-say', this.speaker, this.line),
      this.hints,
      bar,
      this.retort,
      skip,
    );
    const arena = el('button', 'tut-btn tut-go', 'IR PARA A ARENA');
    arena.type = 'button';
    arena.addEventListener('click', onArena);
    const stay = el('button', 'tut-btn tut-stay', 'FICAR NO TREINO');
    stay.type = 'button';
    stay.addEventListener('click', onStay);
    this.final.append(
      el(
        'div',
        'tut-final-card',
        el('span', 'tut-kicker', 'RESULTADO'),
        el('h2', '', 'APROVADO!'),
        el('p', 'tut-final-line', el('b', '', 'KAIA: '), FINAL_LINE),
        el('h3', '', 'PRONTO PARA A ARENA?'),
        el('div', 'tut-final-btns', arena, stay),
      ),
    );
    this.root.append(this.card, this.stamp, this.final);
    document.body.append(this.root);
  }

  showStep(step: StepDef) {
    const i = STEPS.indexOf(step);
    this.count.textContent = `${i + 1}/${STEPS.length}`;
    this.title.textContent = step.title;
    this.speaker.textContent = step.speaker;
    this.speaker.classList.toggle('bit', step.speaker === 'BIT');
    this.line.textContent = step.line;
    this.hints.replaceChildren(...step.hints.map((h) => el('span', 'tut-hint', ...h.keys.map(keycap), el('em', '', h.text))));
    this.retort.textContent = '';
    this.setFraction(0);
    // Reanima o cartão a cada passo novo
    this.card.classList.remove('in');
    void this.card.offsetWidth;
    this.card.classList.add('in');
  }

  setFraction(f: number) {
    this.fill.style.width = `${Math.round(f * 100)}%`;
  }

  /** Bronca rápida (ação certa do jeito errado). */
  scold(text: string) {
    this.retort.textContent = text;
    this.retortLeft = 3.5;
    this.card.classList.remove('shake');
    void this.card.offsetWidth;
    this.card.classList.add('shake');
  }

  /** Carimbo "APROVADO!" estilo anime com a fala de quem avaliou. */
  celebrate(step: StepDef) {
    (this.stamp.querySelector('.tut-praise') as HTMLElement).textContent = `${step.speaker}: ${step.praise}`;
    this.stamp.classList.remove('show');
    void this.stamp.offsetWidth;
    this.stamp.classList.add('show');
    this.stampLeft = 1.8;
  }

  /** Fim do teste: some o cartão e aparece o convite para a Arena. */
  finish() {
    this.card.classList.add('gone');
    this.stamp.classList.remove('show'); // o convite já traz o APROVADO grande
    this.stampLeft = 0;
    this.final.classList.add('show');
  }

  hideFinal() {
    this.final.classList.remove('show');
  }

  get finalVisible() {
    return this.final.classList.contains('show');
  }

  update(dt: number) {
    if (this.stampLeft > 0) {
      this.stampLeft -= dt;
      if (this.stampLeft <= 0) this.stamp.classList.remove('show');
    }
    if (this.retortLeft > 0) {
      this.retortLeft -= dt;
      if (this.retortLeft <= 0) this.retort.textContent = '';
    }
  }

  destroy() {
    this.root.remove();
  }
}
