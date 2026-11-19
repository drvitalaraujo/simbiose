// Ajudantes de DOM do HUD: criar elementos sem innerHTML (texto do jogador nunca vira HTML)
// e escrever no DOM só quando o valor muda (o HUD é chamado a cada quadro).
import type { PlayerRef, Relation } from './types';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  e.append(...children);
  return e;
}

/** Texto que só toca no DOM quando muda. */
export class Text {
  private last: string | null = null;
  constructor(readonly node: HTMLElement) {}
  set(value: string) {
    if (value === this.last) return;
    this.last = value;
    this.node.textContent = value;
  }
}

/** Classe CSS ligada/desligada que só toca no DOM quando muda. */
export class Toggle {
  private last: boolean | null = null;
  constructor(
    readonly node: HTMLElement,
    private readonly cls: string,
  ) {}
  set(on: boolean) {
    if (on === this.last) return;
    this.last = on;
    this.node.classList.toggle(this.cls, on);
  }
}

/** Propriedade CSS (ex.: `--p`, `width`) que só toca no DOM quando muda. */
export class Style {
  private last: string | null = null;
  constructor(
    readonly node: HTMLElement,
    private readonly prop: string,
  ) {}
  set(value: string) {
    if (value === this.last) return;
    this.last = value;
    this.node.style.setProperty(this.prop, value);
  }
}

/** Reinicia uma animação CSS (ex.: piscar o marcador de acerto de novo). */
export function replay(node: HTMLElement, cls: string) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

/** Nome colorido pela relação, com a etiqueta BOT quando for bot. */
export function nameTag(p: PlayerRef, rel: Relation): HTMLElement {
  const span = el('span', `name rel-${rel}`, p.name);
  if (p.bot) span.append(el('em', 'bot', 'BOT'));
  return span;
}
