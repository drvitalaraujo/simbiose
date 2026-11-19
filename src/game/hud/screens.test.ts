import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchEndScreen } from './screens';
import type { MatchEndData } from './types';

// DOM mínimo: exercita os handlers reais sem depender de navegador/GPU.
class FakeEl {
  className = '';
  textContent = '';
  children: (FakeEl | string)[] = [];
  dataset = {};
  hidden = false;
  type = '';
  handlers = new Map<string, () => void>();
  classList = { add: () => {}, toggle: () => {} };
  append(...children: (FakeEl | string)[]) { this.children.push(...children); }
  replaceChildren(...children: (FakeEl | string)[]) { this.children = children; }
  addEventListener(type: string, fn: () => void) { this.handlers.set(type, fn); }
  click() { this.handlers.get('click')?.(); }
}

const data: MatchEndData = { outcome: 'win', mvp: { id: 'me', name: 'Lia', line: '20 abates' }, stats: [], rows: [] };

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const keys = new Map<string, (e: unknown) => void>();
  vi.stubGlobal('document', { createElement: () => new FakeEl() });
  vi.stubGlobal('window', { addEventListener: (type: string, fn: (e: unknown) => void) => keys.set(type, fn), removeEventListener: (type: string) => keys.delete(type) });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const screen = new MatchEndScreen(() => ({ id: 'me' }));
  const root = screen.root as unknown as FakeEl;
  const wrap = root.children[0] as FakeEl;
  const actions = wrap.children[wrap.children.length - 1] as FakeEl;
  return { screen, keys, again: actions.children[0] as FakeEl, menu: actions.children[1] as FakeEl };
}

describe('ações de fim de partida', () => {
  it('permite sair para menu após pedir revanche, deduplicando ambos', () => {
    const { screen, again, menu } = setup();
    const onPlayAgain = vi.fn();
    const onMenu = vi.fn();
    screen.show(data, { onPlayAgain, onMenu });
    again.click(); again.click(); menu.click(); menu.click(); again.click();
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
    screen.show(data, { onPlayAgain, onMenu });
    again.click(); menu.click();
    expect(onPlayAgain).toHaveBeenCalledTimes(2);
    expect(onMenu).toHaveBeenCalledTimes(2);
    screen.destroy();
  });

  it('mantém ativação de menu pelo teclado e ignora ações após descarte', () => {
    const { screen, keys, menu, again } = setup();
    const onPlayAgain = vi.fn();
    const onMenu = vi.fn();
    const preventDefault = vi.fn();
    screen.show(data, { onPlayAgain, onMenu });
    keys.get('keydown')!({ code: 'Enter', target: menu, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onPlayAgain).not.toHaveBeenCalled();
    menu.click();
    expect(onMenu).toHaveBeenCalledTimes(1);
    screen.destroy();
    again.click(); menu.click();
    expect(onPlayAgain).not.toHaveBeenCalled();
    expect(onMenu).toHaveBeenCalledTimes(1);
    expect(keys.has('keydown')).toBe(false);
  });
});
