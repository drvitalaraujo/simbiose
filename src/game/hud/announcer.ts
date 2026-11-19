// Faixa de anúncio da OTIMIZA (topo-centro): "Sua derrota foi otimizada ✨", "Rodada 3",
// "Faltam 30 segundos"... Fila curta: um anúncio por vez.
import { el, replay } from './dom';

export type AnnounceStyle = 'otimiza' | 'ally' | 'enemy' | 'neutral';

interface Item {
  title: string;
  line: string;
  style: AnnounceStyle;
  seconds: number;
}

const MAX_QUEUE = 3;

export class Announcer {
  readonly root = el('div', 'ch-announce');
  private readonly title = el('div', 'a-title');
  private readonly line = el('div', 'a-line');
  private queue: Item[] = [];
  private left = 0;

  constructor() {
    this.root.append(el('div', 'a-brand', 'OTIMIZA'), this.title, this.line);
  }

  /**
   * Mostra um anúncio. `title` é a parte grande (pode ser vazia); `line`, a fala embaixo.
   * Se já houver um na tela, entra na fila (no máximo 3 esperando).
   */
  announce(title: string, line = '', style: AnnounceStyle = 'otimiza', seconds = 3.2) {
    const item = { title, line, style, seconds };
    if (this.left > 0) {
      if (this.queue.length < MAX_QUEUE) this.queue.push(item);
      return;
    }
    this.play(item);
  }

  clear() {
    this.queue = [];
    this.left = 0;
    this.root.classList.remove('show');
  }

  update(dt: number) {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left > 0) return;
    const next = this.queue.shift();
    if (next) this.play(next);
    else this.root.classList.remove('show');
  }

  private play(item: Item) {
    this.title.textContent = item.title;
    this.line.textContent = item.line;
    this.title.hidden = !item.title;
    this.line.hidden = !item.line;
    this.root.dataset.style = item.style;
    this.root.style.setProperty('--dur', `${item.seconds}s`);
    replay(this.root, 'show');
    this.left = item.seconds;
  }
}
