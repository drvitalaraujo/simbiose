// Menu inicial: Arena, Duelo e Treino, apelido, mapa, bots da Arena, tutorial e Configurações.
// O menu só monta a tela e chama `requestPlay` (ver modes.ts); quem começa a partida é o
// handler registrado para o modo. Visual de cartaz anime: painel de nanquim inclinado, mapa
// escolhido em destaque, letreiro correndo no pé e parallax leve que segue o mouse.
import './menu.css';
import './menu-entry.css';
import { el } from '../hud/dom';
import { icon, logo } from './art';
import { keycap } from './keys';
import { mapArt } from './map-art';
import { ARENA_CHOICES, arenaInfo, DIFFICULTIES, MAP_INFO, thumbUrl } from './map-info';
import { hasHandler, MODES, onHandlersChange, type PlayMode, requestPlay } from './modes';
import { bindReducedMotion, uiMotionAllowed } from './motion';
import { type PanelWiring, SettingsPanel } from './panel';
import { type ArenaMapId, mapFromSearch, type MapId, resolveArenaMap, sanitizeNickname, type SettingsStore } from './settings';
import { bindSelectionKeys } from './selection';
import { sourceLink } from './source-link';

export interface MenuOptions {
  root: HTMLElement;
  store: SettingsStore;
  wiring: PanelWiring;
  /** "Teste de Admissão" (tutorial do Treino); sem isto o botão não aparece. */
  onTutorial?: () => void;
}

/** Frases do letreiro do pé (propaganda da OTIMIZA pichada pela Resistência). */
const TICKER = [
  'A OTIMIZA QUER VOCÊ FELIZ',
  'SORRIA, VOCÊ ESTÁ SENDO AJUDADO',
  'RESISTA',
  'META DO TRIMESTRE: 100% DE SATISFAÇÃO',
  'DESPLUGUE-SE',
  'SEU HUMOR FOI REGISTRADO',
];

export class Menu {
  private readonly root: HTMLElement;
  private readonly toast = el('div', 'mn-toast');
  private readonly modeButtons = new Map<PlayMode, HTMLButtonElement>();
  private readonly panel: SettingsPanel;
  private toastTimer = 0;
  private trainingStarted = false;
  private readonly offHandlers: () => void;
  private readonly offMotion: () => void;
  private parallaxFrame = 0;
  private pointer = { x: 0, y: 0 };

  constructor(private readonly opts: MenuOptions) {
    this.root = opts.root;
    this.panel = new SettingsPanel(opts.store, opts.wiring);
    this.toast.setAttribute('role', 'status');
    this.offMotion = bindReducedMotion(opts.store);
    this.root.replaceChildren(this.backdrop(), this.left(), this.right(), this.ticker(), this.toast, this.panel.root);
    this.refreshModes();
    this.offHandlers = onHandlersChange(() => this.refreshModes());
    this.root.addEventListener('pointermove', this.onPointer);
  }

  /** Desliga listeners globais e limpa o DOM (para remontar o menu sem acumular). */
  destroy() {
    this.offHandlers();
    this.offMotion();
    this.panel.destroy();
    clearTimeout(this.toastTimer);
    cancelAnimationFrame(this.parallaxFrame);
    this.root.removeEventListener('pointermove', this.onPointer);
    this.root.replaceChildren();
  }

  setVisible(on: boolean) {
    this.root.classList.toggle('hidden', !on);
    if (!on) this.panel.close();
  }

  /** Depois do primeiro Treino, o botão vira "CONTINUAR TREINO" (Esc volta ao menu). */
  setTrainingStarted(on: boolean) {
    this.trainingStarted = on;
    const b = this.modeButtons.get('training');
    if (b) b.querySelector('.t')!.textContent = on ? 'CONTINUAR TREINO' : 'TREINO';
  }

  get isTrainingStarted() {
    return this.trainingStarted;
  }

  /** Aviso rápido no pé da tela. */
  say(text: string, seconds = 2.8) {
    this.toast.textContent = text;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), seconds * 1000);
  }

  /** Parallax: as camadas leem `--mx`/`--my` (−1..1); no máximo uma escrita por quadro. */
  private readonly onPointer = (e: PointerEvent) => {
    this.pointer.x = (e.clientX / Math.max(1, innerWidth)) * 2 - 1;
    this.pointer.y = (e.clientY / Math.max(1, innerHeight)) * 2 - 1;
    if (this.parallaxFrame) return;
    this.parallaxFrame = requestAnimationFrame(() => {
      this.parallaxFrame = 0;
      const on = uiMotionAllowed();
      this.root.style.setProperty('--mx', on ? this.pointer.x.toFixed(3) : '0');
      this.root.style.setProperty('--my', on ? this.pointer.y.toFixed(3) : '0');
    });
  };

  /** Camadas de fundo: painel de nanquim com retícula, palavra gigante vazada e raios. */
  private backdrop(): HTMLElement {
    return el(
      'div',
      'mn-bg',
      el('i', 'mn-rays'),
      el('i', 'mn-panel'),
      el('span', 'mn-watermark', 'RESISTA'),
      el('i', 'mn-slash s1'),
      el('i', 'mn-slash s2'),
    );
  }

  private ticker(): HTMLElement {
    const line = TICKER.map((t) => `${t}  ✦  `).join('');
    // Duas cópias lado a lado: a animação anda meia faixa e recomeça sem emenda
    const track = el('div', 'mn-ticker-track', el('span', '', line), el('span', '', line));
    const t = el('div', 'mn-ticker', track);
    t.setAttribute('aria-hidden', 'true');
    return t;
  }

  private left(): HTMLElement {
    const brand = el(
      'div',
      'mn-brand',
      el('span', 'mn-kicker', 'TEMPORADA 0 · PROTÓTIPO COMPETITIVO'),
      logo(),
      el('p', 'mn-tagline', 'A OTIMIZA quer você feliz. ', el('b', '', 'À força.')),
    );

    // Apelido
    const nick = el('input', 'mn-nick');
    nick.id = 'mn-nick';
    nick.maxLength = 16;
    nick.autocomplete = 'off';
    nick.spellcheck = false;
    nick.value = this.opts.store.get().nickname;
    nick.addEventListener('input', () => {
      const clean = sanitizeNickname(nick.value);
      if (clean) this.opts.store.set({ nickname: clean });
    });
    nick.addEventListener('change', () => (nick.value = this.opts.store.get().nickname));
    // Tecla no apelido não pode virar tecla de jogo (o Input escuta a janela)
    nick.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Enter') nick.blur();
    });
    const nickLabel = el('label', 'mn-cap', 'APELIDO');
    nickLabel.htmlFor = nick.id;

    // Só os modos desta etapa; modos futuros não aparecem como promessa no menu.
    const nav = el('nav', 'mn-modes');
    const button = (cls: string, ico: string, title: string, sub: string) => {
      const b = el('button', `mn-mode ${cls}`, icon(ico), el('span', 'tx', el('span', 't', title), el('span', 's', sub)), icon('chevron'));
      b.type = 'button';
      b.title = sub;
      nav.append(b);
      return b;
    };
    for (const m of MODES) {
      const b = button(`mode-${m.id}`, m.id, m.title, m.sub);
      b.addEventListener('click', () => this.play(m.id));
      this.modeButtons.set(m.id, b);
    }
    if (this.opts.onTutorial) {
      const tut = button('mode-tutorial', 'tutorial', 'TESTE DE ADMISSÃO', 'Tutorial rápido no Treino · a Kaia avalia');
      tut.addEventListener('click', () => this.opts.onTutorial?.());
    }
    const cfg = button('mode-settings', 'settings', 'CONFIGURAÇÕES', 'Mouse, FOV, câmera, volume, gráficos');
    cfg.addEventListener('click', () => this.panel.open(() => cfg.focus({ preventScroll: true })));
    return el('div', 'mn-left', brand, el('div', 'mn-field', nickLabel, nick), nav, sourceLink('mn-source'));
  }

  private right(): HTMLElement {
    // Mapas da Arena: só os competitivos (+ sorteio). O Treino é sempre no Bairro.
    const chosen = this.opts.store.get().arenaMap;
    const featureArt = el('div', 'mn-feature-art');
    const featureName = el('b', 'n');
    const featureWhere = el('span', 'w');
    const featureTag = el('span', 'g');
    const feature = el(
      'div',
      'mn-feature',
      featureArt,
      el('span', 'mn-sticker', 'ARENA / DUELO'),
      el('div', 'mn-feature-tx', featureName, featureWhere, featureTag),
    );
    const cards = el('div', 'mn-maps');
    cards.setAttribute('role', 'radiogroup');
    cards.setAttribute('aria-label', 'Mapa da Arena e do Duelo');
    const cardOf = new Map<ArenaMapId, HTMLButtonElement>();
    for (const id of ARENA_CHOICES) {
      const info = arenaInfo(id);
      const card = el('button', `mn-map map-${id}`, this.preview(id), el('span', 'n', info.name));
      card.type = 'button';
      card.setAttribute('role', 'radio');
      card.title = `${info.name} · ${info.where}`;
      card.addEventListener('click', () => {
        this.opts.store.set({ arenaMap: id });
        mark(id);
      });
      cardOf.set(id, card);
      cards.append(card);
    }
    const mark = (id: ArenaMapId) => {
      for (const [cid, c] of cardOf) {
        c.classList.toggle('on', cid === id);
        c.setAttribute('aria-checked', String(cid === id));
        c.tabIndex = cid === id ? 0 : -1;
      }
      const info = arenaInfo(id);
      featureName.textContent = info.name;
      featureWhere.textContent = info.where;
      featureTag.textContent = info.tag;
      feature.dataset.map = id;
      featureArt.replaceChildren(this.preview(id));
      // Reinicia a entrada do destaque (troca de mapa ganha um "corte" de mangá)
      feature.classList.remove('swap');
      void feature.offsetWidth;
      feature.classList.add('swap');
    };
    mark(chosen);
    bindSelectionKeys([...cardOf.values()]);

    // Dificuldade dos bots (vai na URL do online como &dificuldade=)
    const seg = el('div', 'mn-seg mn-diff');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Dificuldade dos bots');
    const diffButtons = DIFFICULTIES.map((d) => {
      const b = el('button', 'mn-seg-btn', d.label);
      b.type = 'button';
      b.title = d.hint;
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => {
        this.opts.store.set({ difficulty: d.id });
        markDiff();
      });
      return { b, id: d.id };
    });
    const markDiff = () => {
      for (const { b, id } of diffButtons) {
        const on = this.opts.store.get().difficulty === id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      }
    };
    markDiff();
    seg.append(...diffButtons.map((d) => d.b));
    bindSelectionKeys(diffButtons.map((d) => d.b));

    // Treino: sempre no Bairro (ou no mapa que a URL pedir, para testes)
    const trainingMap = mapFromSearch(location.search);
    const training = el(
      'div',
      'mn-training',
      this.preview(trainingMap),
      el('span', 'tx', el('b', '', `TREINO · ${MAP_INFO[trainingMap].name}`), el('span', '', `${MAP_INFO[trainingMap].where} · drones da OTIMIZA em ondas`)),
    );

    const help = el(
      'div',
      'mn-help',
      el('b', '', 'CONTROLES'),
      el('span', 'mn-help-row', keycap('W'), keycap('A'), keycap('S'), keycap('D'), ' mover · ', keycap('SHIFT'), ' andar em silêncio · ', keycap('C'), ' agachar · ', keycap('R'), ' recarregar'),
      el('span', 'mn-help-row', keycap('mouseL'), ' atirar · ', keycap('mouseR'), ' mirar · ', keycap('1'), '–', keycap('4'), ' armas · ', keycap('E'), ' hackear · ', keycap('V'), keycap('G'), ' chinelo'),
    );
    return el(
      'div',
      'mn-right',
      el(
        'div',
        'mn-box',
        el('span', 'mn-cap', 'ARENA / DUELO · ESCOLHA O MAPA'),
        feature,
        cards,
        el('span', 'mn-cap mn-cap-gap', 'ARENA · BOTS'),
        seg,
      ),
      training,
      help,
    );
  }

  /** Miniatura: captura do jogo; se não carregar, a arte desenhada em canvas. */
  private preview(id: MapId | ArenaMapId): HTMLElement {
    if (id === 'aleatorio') return mapArt(id);
    const img = el('img', 'mn-preview');
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('error', () => img.replaceWith(mapArt(id)), { once: true });
    img.src = thumbUrl(id);
    return img;
  }

  private play(mode: PlayMode) {
    const s = this.opts.store.get();
    // Treino: o mundo já carregado (Bairro). Arena: o mapa competitivo escolhido no card.
    const map: MapId = mode === 'training' ? mapFromSearch(location.search) : resolveArenaMap(s.arenaMap);
    if (mode !== 'training' && s.arenaMap === 'aleatorio') this.say(`Sorteado: ${MAP_INFO[map].name}!`);
    const ok = requestPlay({ mode, map, nickname: s.nickname });
    if (!ok) this.say(MODES.find((m) => m.id === mode)!.soon);
  }

  private refreshModes() {
    for (const [id, b] of this.modeButtons) b.classList.toggle('soon', !hasHandler(id));
  }
}
