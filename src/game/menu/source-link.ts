// Link "código-fonte" mostrado em toda porta de entrada do jogo (menu, entrada online, Modo
// Live). A AGPL-3.0, seção 13, pede que todo usuário que interage com o jogo pela rede
// possa obter o código da versão que está rodando.
import { el } from '../hud/dom';
import { sourceUrl } from './source';

export function sourceLink(className: string): HTMLAnchorElement {
  const a = el('a', className, 'CÓDIGO-FONTE · AGPL-3.0');
  a.href = sourceUrl();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
