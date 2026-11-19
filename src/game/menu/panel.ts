// Painel de Configurações em três grupos (Mira e câmera · Som · Vídeo): sensibilidade, FOV,
// movimento de câmera reduzido, volume, música e qualidade gráfica. Grava direto no
// SettingsStore (localStorage). Esc ou "Pronto" fecha.
import './settings.css';
import { el } from '../hud/dom';
import { LIMITS, type QualityPref, type Settings, type SettingsStore } from './settings';
import { bindSelectionKeys } from './selection';

type LiveKey = 'sensitivity' | 'fov' | 'volume' | 'quality' | 'music' | 'reducedMotion';

export interface PanelWiring {
  /** Quais opções o jogo já usa de verdade; as outras ganham o selo "salvo · liga em breve". */
  live: Partial<Record<LiveKey, boolean>>;
}

export class SettingsPanel {
  readonly root = el('dialog', 'mn-settings');
  private readonly note = el('p', 'mn-note');
  private onClose: (() => void) | null = null;

  constructor(
    private readonly store: SettingsStore,
    wiring: PanelWiring,
  ) {
    const s = store.get();
    const soon = (k: LiveKey) => (wiring.live[k] ? null : el('em', 'mn-soon', 'salvo · liga em breve'));
    const fmtSens = (v: number) => `${v.toFixed(2).replace('.', ',')}×`;

    const groups = el(
      'div',
      'mn-groups',
      this.group(
        'MIRA E CÂMERA',
        'cyan',
        this.slider('Sensibilidade do mouse', 'sensitivity', s.sensitivity, LIMITS.sensitivity, fmtSens, soon('sensitivity')),
        this.slider('Campo de visão (FOV)', 'fov', s.fov, LIMITS.fov, (v) => `${v}°`, soon('fov')),
        this.toggle('Movimento de câmera reduzido', 'Menos balanço, tremida e coice da câmera (para quem enjoa)', 'reducedMotion', s.reducedMotion, soon('reducedMotion')),
      ),
      this.group(
        'SOM',
        'pink',
        this.slider('Volume geral', 'volume', s.volume, LIMITS.volume, (v) => `${v}%`, soon('volume')),
        this.slider('Música', 'music', s.music, LIMITS.music, (v) => `${v}%`, soon('music')),
      ),
      this.group('VÍDEO', 'yellow', this.quality(s.quality, soon('quality'))),
    );
    const done = el('button', 'mn-btn mn-done', 'PRONTO');
    done.type = 'button';
    done.addEventListener('click', () => this.close());
    const head = el('div', 'mn-card-head', el('h2', '', 'CONFIGURAÇÕES'), el('span', 'mn-card-hint', 'Salva sozinho · ESC fecha'));
    const card = el('div', 'mn-card', head, groups, el('div', 'mn-card-foot', this.note, done));
    this.root.setAttribute('aria-label', 'Configurações');
    this.root.setAttribute('aria-modal', 'true');
    this.note.setAttribute('role', 'status');
    this.root.append(card);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    this.root.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
    // Teclas dos controles não acionam placar, arsenal ou movimento atrás do diálogo.
    this.root.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Tab') return;
      const controls = this.root.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled):not([tabindex="-1"])');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if ((e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    });
  }

  /** Descarta o diálogo e o callback de retorno antes de desmontar o menu. */
  destroy() {
    this.onClose = null;
    this.close();
    this.root.remove();
  }

  open(onClose?: () => void) {
    if (this.root.open) return;
    this.onClose = onClose ?? null;
    this.root.classList.add('show');
    // Modal nativo mantém foco aqui e torna todo o fundo inerte, inclusive o Arsenal.
    this.root.showModal();
    this.root.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
  }

  close() {
    if (!this.root.open) return;
    this.root.close();
    this.root.classList.remove('show');
    const onClose = this.onClose;
    this.onClose = null;
    onClose?.();
  }

  private group(title: string, accent: 'cyan' | 'pink' | 'yellow', ...rows: HTMLElement[]): HTMLElement {
    return el('section', `mn-group acc-${accent}`, el('h3', 'mn-group-title', title), ...rows);
  }

  private slider(
    label: string,
    key: 'sensitivity' | 'fov' | 'volume' | 'music',
    value: number,
    lim: { min: number; max: number; step: number },
    fmt: (v: number) => string,
    badge: HTMLElement | null,
  ): HTMLElement {
    const input = el('input');
    input.type = 'range';
    input.min = String(lim.min);
    input.max = String(lim.max);
    input.step = String(lim.step);
    input.value = String(value);
    input.id = `mn-${key}`;
    const out = el('output', 'mn-value', fmt(value));
    out.setAttribute('for', input.id);
    const paint = () => {
      input.style.setProperty('--fill', `${((Number(input.value) - lim.min) / (lim.max - lim.min)) * 100}%`);
      input.setAttribute('aria-valuetext', fmt(Number(input.value)));
    };
    paint();
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = fmt(v);
      paint();
      this.store.set({ [key]: v } as Partial<Settings>);
    });
    const lab = el('label', 'mn-label', label);
    lab.htmlFor = input.id;
    if (badge) lab.append(badge);
    return el('div', 'mn-row', lab, input, out);
  }

  /** Interruptor liga/desliga (botão com aria-checked, Espaço/Enter alternam). */
  private toggle(label: string, hint: string, key: 'reducedMotion', value: boolean, badge: HTMLElement | null): HTMLElement {
    const sw = el('button', 'mn-switch', el('i', 'knob'), el('span', 'st'));
    sw.type = 'button';
    sw.id = `mn-${key}`;
    sw.setAttribute('role', 'switch');
    const mark = (on: boolean) => {
      sw.classList.toggle('on', on);
      sw.setAttribute('aria-checked', String(on));
      sw.querySelector('.st')!.textContent = on ? 'LIGADO' : 'DESLIGADO';
    };
    mark(value);
    sw.addEventListener('click', () => {
      const on = !this.store.get()[key];
      this.store.set({ [key]: on });
      mark(on);
    });
    const lab = el('label', 'mn-label', label);
    lab.htmlFor = sw.id;
    if (badge) lab.append(badge);
    return el('div', 'mn-row mn-row-switch', lab, el('span', 'mn-hint', hint), sw);
  }

  private quality(value: QualityPref, badge: HTMLElement | null): HTMLElement {
    const opts: [QualityPref, string, string][] = [
      ['auto', 'AUTOMÁTICA', 'Começa no máximo e baixa sozinha se o PC sofrer'],
      ['leve', 'LEVE', 'Resolução menor desde o início (PC fraco/notebook)'],
    ];
    const group = el('div', 'mn-seg');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', 'Qualidade gráfica');
    const buttons = opts.map(([id, label, hint]) => {
      const b = el('button', 'mn-seg-btn', el('b', '', label), el('small', '', hint));
      b.type = 'button';
      b.title = hint;
      b.setAttribute('role', 'radio');
      b.dataset.id = id;
      return b;
    });
    const mark = (id: QualityPref) => {
      for (const b of buttons) {
        const on = b.dataset.id === id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      }
    };
    mark(value);
    for (const b of buttons) {
      b.addEventListener('click', () => {
        const id = b.dataset.id as QualityPref;
        if (this.store.get().quality === id) return;
        this.store.set({ quality: id });
        mark(id);
        this.note.textContent = 'A qualidade nova vale quando o jogo abrir de novo (recarregue a página).';
      });
    }
    group.append(...buttons);
    bindSelectionKeys(buttons);
    const lab = el('span', 'mn-label', 'Qualidade gráfica');
    if (badge) lab.append(badge);
    return el('div', 'mn-row mn-row-seg', lab, group);
  }
}
