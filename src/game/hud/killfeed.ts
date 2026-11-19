// Killfeed (canto superior direito): "matador [arma] (cabeça) vítima", cores pela relação
// com você, etiqueta BOT, e destaque quando você está no lance. Some sozinho.
import { el, nameTag } from './dom';
import { type LocalView, relation } from './format';
import type { KillEvent } from './types';

const MAX_ENTRIES = 5;
const LIFE = 6; // segundos na tela
const FADE = 0.5;

/** Ícone de tiro na cabeça (SVG fixo, nunca texto do jogador). */
const HEAD_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 0v6M12 18v6M0 12h6M18 12h6" stroke="currentColor" stroke-width="2.5"/></svg>';

interface Entry {
  node: HTMLElement;
  age: number;
  fading: boolean;
}

export class Killfeed {
  readonly root = el('div', 'ch-killfeed');
  private entries: Entry[] = [];

  constructor(private readonly local: () => LocalView) {}

  push(e: KillEvent) {
    const me = this.local();
    const victimRel = relation(e.victim, me);
    const row = el('div', 'kf-row');
    if (e.killer) {
      const killerRel = relation(e.killer, me);
      row.append(nameTag(e.killer, killerRel));
      if (killerRel === 'self') row.classList.add('mine');
    }
    const weapon = el('span', 'kf-weapon', e.weapon.toUpperCase());
    row.append(weapon);
    if (e.headshot) {
      const hs = el('span', 'kf-head');
      hs.innerHTML = HEAD_ICON;
      hs.title = 'Tiro na cabeça';
      row.append(hs);
    }
    row.append(nameTag(e.victim, victimRel));
    if (victimRel === 'self') row.classList.add('me-died');
    this.root.prepend(row);
    this.entries.unshift({ node: row, age: 0, fading: false });
    while (this.entries.length > MAX_ENTRIES) this.entries.pop()!.node.remove();
  }

  clear() {
    for (const e of this.entries) e.node.remove();
    this.entries = [];
  }

  update(dt: number) {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      e.age += dt;
      if (!e.fading && e.age > LIFE - FADE) {
        e.fading = true;
        e.node.classList.add('out');
      }
      if (e.age > LIFE) {
        e.node.remove();
        this.entries.splice(i, 1);
      }
    }
  }
}
