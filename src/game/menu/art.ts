// Logo e ícones do menu, em DOM/SVG (sem imagem): referência `docs/concept/interface/
// logo-simbiose.png` — letras papel, sombra ciano à esquerda e rosa à direita, fatias de
// glitch e o acento amarelo no "O". SVGs fixos (nunca texto de jogador).
import { el } from '../hud/dom';

export function logo(): HTMLElement {
  const h = el('h1', 'mn-logo');
  h.setAttribute('aria-label', 'SIMBIOSE');
  h.dataset.text = 'SIMBIOSE';
  // "SIMBI" + O com acento + "SE": o acento amarelo fica preso ao O
  h.append(el('span', 'l', 'SIMBI'), el('span', 'l o', 'O', el('i', 'o-mark')), el('span', 'l', 'SE'));
  for (let i = 0; i < 4; i++) h.append(el('i', `slice s${i}`));
  return h;
}

const PATHS: Record<string, string> = {
  ffa: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  duel: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  training: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2.4"/>',
  settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  live: '<circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  tutorial: '<path d="M4 4h12l4 4v12H4z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
};

export function icon(name: string): HTMLElement {
  const i = el('span', `mn-ico ico-${name}`);
  i.setAttribute('aria-hidden', 'true');
  i.innerHTML = `<svg viewBox="0 0 24 24">${PATHS[name] ?? ''}</svg>`;
  return i;
}
