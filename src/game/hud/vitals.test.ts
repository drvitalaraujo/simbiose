import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// DOM mínimo em memória (os testes rodam em Node, sem navegador)
class FakeEl {
  className = '';
  textContent = '';
  children: FakeEl[] = [];
  props = new Map<string, string>();
  classes = new Set<string>();
  style = { setProperty: (k: string, v: string) => void this.props.set(k, v) };
  classList = {
    toggle: (c: string, on: boolean) => void (on ? this.classes.add(c) : this.classes.delete(c)),
  };
  append(...nodes: (FakeEl | string)[]) {
    for (const n of nodes) if (typeof n !== 'string') this.children.push(n);
  }
}

let saved: unknown;
beforeAll(() => {
  saved = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { createElement: () => new FakeEl() };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = saved;
});

describe('vida e escudo', () => {
  it('mostra infinito sem sugerir recarga para arma ilimitada', async () => {
    const { Vitals } = await import('./vitals');
    const v = new Vitals();
    const ammo = (v.root as unknown as FakeEl).children[1];
    v.setAmmo(0, 0, 30);
    expect(ammo.classes.has('empty')).toBe(true);
    v.setInfiniteAmmo();
    expect(ammo.children[1].children[0].textContent).toBe('∞');
    expect(ammo.children[1].children[2].textContent).toBe('∞');
    expect(ammo.classes.has('empty')).toBe(false);
    expect(ammo.classes.has('low')).toBe(false);
    expect(ammo.children[2].textContent).toBe('');
  });
  it('redesenha quando só os máximos mudam (revisão I3)', async () => {
    const { Vitals } = await import('./vitals');
    const v = new Vitals();
    const root = v.root as unknown as FakeEl;
    const health = root.children[0];
    const hpFill = health.children[1].children[1].children[1]; // row hp > bar > fill
    v.setVitals(100, 100, 0, 0);
    expect(hpFill.props.get('width')).toBe('100%');
    expect(health.classes.has('has-shield')).toBe(false);
    v.setVitals(100, 200, 0, 50);
    expect(hpFill.props.get('width')).toBe('50%');
    expect(health.classes.has('has-shield')).toBe(true);
  });
});
