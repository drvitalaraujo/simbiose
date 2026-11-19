// Teclas desenhadas como capinhas (menu, tela de entrada do online e tutorial).
import { el } from '../hud/dom';

const MOUSE: Record<'mouseL' | 'mouseR', string> = {
  // Mouse com o botão do lado pintado (amarelo = o botão a apertar)
  mouseL: '<rect x="5" y="2" width="14" height="20" rx="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 9h7V2.3A7 7 0 0 0 5 9z" style="fill:var(--yellow)"/><path d="M12 2v7M5 9h14" stroke="currentColor" stroke-width="2"/>',
  mouseR: '<rect x="5" y="2" width="14" height="20" rx="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9h7a7 7 0 0 0-7-6.7z" style="fill:var(--yellow)"/><path d="M12 2v7M5 9h14" stroke="currentColor" stroke-width="2"/>',
};

/** Uma tecla: texto ("R", "SHIFT") ou `mouseL`/`mouseR` para os botões do mouse. */
export function keycap(key: string): HTMLElement {
  const k = el('kbd', 'mn-key');
  if (key === 'mouseL' || key === 'mouseR') {
    k.classList.add('mouse');
    k.setAttribute('aria-label', key === 'mouseL' ? 'botão esquerdo do mouse' : 'botão direito do mouse');
    k.innerHTML = `<svg viewBox="0 0 24 24">${MOUSE[key]}</svg>`;
  } else {
    k.textContent = key;
  }
  return k;
}

/** Várias teclas lado a lado ("SHIFT" + "C"). */
export function keys(list: readonly string[], joiner = '+'): HTMLElement {
  const box = el('span', 'mn-keys');
  list.forEach((k, i) => {
    if (i > 0) box.append(el('i', 'mn-join', joiner));
    box.append(keycap(k));
  });
  return box;
}

/** Controles principais da partida (pares teclas → ação). */
export const MAIN_CONTROLS: readonly [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'mover'],
  [['ESPAÇO'], 'pular'],
  [['SHIFT'], 'andar em silêncio'],
  [['C'], 'agachar'],
  [['mouseL'], 'atirar'],
  [['mouseR'], 'mirar'],
  [['R'], 'recarregar'],
  [['1', '2', '3', '4'], 'escopeta · SMG · fuzil · sniper'],
  [['V'], 'chinelada'],
  [['G'], 'arremessar chinelo'],
  [['Q'], 'granada HE · uma por vida'],
  [['E'], 'hackear (segure)'],
  [['TAB'], 'placar'],
];

/** Grade de controles com capinhas. */
export function controlsGrid(list: readonly [string[], string][] = MAIN_CONTROLS): HTMLElement {
  const grid = el('div', 'mn-controls');
  for (const [k, label] of list) grid.append(el('div', 'mn-ctl', keys(k, ''), el('span', '', label)));
  return grid;
}
