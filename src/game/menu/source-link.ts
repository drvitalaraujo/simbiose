// Link "código-fonte" mostrado em toda porta de entrada do jogo (menu, entrada online, Modo
// Live): o jogo é código aberto (MIT) e convida quem joga a ver e contribuir.
import { el } from '../hud/dom';
import { sourceUrl } from './source';

export function sourceLink(className: string): HTMLAnchorElement {
  const a = el('a', className, 'CÓDIGO-FONTE · MIT');
  a.href = sourceUrl();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
