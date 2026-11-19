// Ponte do menu para o modo online: monta o link `?online&nome=...` e, dentro da partida
// online, mostra só uma tela pequena "ENTRAR NA PARTIDA" (o mouse precisa de um clique
// para travar). A lógica do online mora em `game/online.ts`, não aqui.
import './menu-entry.css';
import { el } from '../hud/dom';
import { icon, logo } from './art';
import { controlsGrid } from './keys';
import { sourceLink } from './source-link';
import { difficultyLabel, mapLabel, modeLabel, thumbUrl } from './map-info';
import { bindReducedMotion } from './motion';
import { type Difficulty, type MapId, settings } from './settings';
import type { MatchMode } from '../../net/modes';

/** Parâmetros de teste/rede que continuam valendo ao ir do menu para o online. */
const KEEP = ['servidor', 'lag', 'debug', 'low'];

/**
 * `?online&nome=<apelido>` (+ `&mapa=pelourinho`, `&dificuldade=normal`), mantendo `servidor`,
 * `lag`, `debug`, `low`.
 */
export function onlineSearch(current: string, nickname: string, map: MapId, mode: MatchMode = 'ffa', difficulty?: Difficulty): string {
  const from = new URLSearchParams(current);
  const p = new URLSearchParams();
  p.set('online', '');
  p.set('nome', nickname);
  if (mode !== 'ffa') p.set('modo', mode);
  if (map === 'pelourinho' || map === 'lapa' || map === 'favela' || map === 'patacho') p.set('mapa', map);
  if (difficulty) p.set('dificuldade', difficulty);
  for (const k of KEEP) {
    const v = from.get(k);
    if (v !== null) p.set(k, v);
  }
  const s = p.toString().replace(/=(?=&|$)/g, '');
  return `?${s}`;
}

/** Busca da URL para voltar ao menu saindo do online (tira sala/apelido/online). */
export function menuSearch(current: string): string {
  const p = new URLSearchParams(current);
  for (const k of ['online', 'sala', 'nome', 'mapa', 'modo', 'dificuldade']) p.delete(k);
  const s = p.toString().replace(/=(?=&|$)/g, '');
  return s ? `?${s}` : '';
}

/** O que a tela de entrada mostra sobre a partida. */
export interface MatchInfo {
  /** Id do mapa da sala (`pelourinho`, `lapa`, `favela`...). */
  map?: string | null;
  mode?: string | null;
  difficulty?: string | null;
}

/** Tela "ENTRAR NA PARTIDA" do online: aparece sempre que o mouse está solto. */
export class PauseOverlay {
  private readonly thumb = el('div', 'mn-entry-thumb');
  private readonly mapName = el('b', 'mn-entry-map');
  private readonly mapWhere = el('span', 'mn-entry-where');
  private readonly mode = el('span', 'mn-chip-on');
  private readonly difficulty = el('span', 'mn-chip-on');
  private shown = '';
  /** Desfaz os ouvintes e tira os filhos do `#menu` (o callback de entrar referencia o jogo). */
  private readonly offs: (() => void)[] = [];

  constructor(
    private readonly root: HTMLElement,
    onEnter: () => void,
  ) {
    const enter = el(
      'button',
      'mn-mode mode-ffa',
      icon('ffa'),
      el('span', 'tx', el('span', 't', 'ENTRAR NA PARTIDA'), el('span', 's', 'Clique para travar o mouse · ESC solta')),
    );
    enter.type = 'button';
    enter.addEventListener('click', onEnter);
    this.offs.push(() => enter.removeEventListener('click', onEnter), bindReducedMotion(settings()));
    const back = el('button', 'mn-mode mode-settings', el('span', 'tx', el('span', 't', 'VOLTAR AO MENU'), el('span', 's', 'Sai da sala')), icon('chevron'));
    back.type = 'button';
    back.addEventListener('click', () => (location.search = menuSearch(location.search)));
    const card = el(
      'div',
      'mn-entry',
      this.thumb,
      el(
        'div',
        'mn-entry-info',
        this.mapName,
        this.mapWhere,
        el('div', 'mn-entry-chips', el('span', 'mn-chip-cap', 'MODO'), this.mode, el('span', 'mn-chip-cap', 'BOTS'), this.difficulty),
      ),
    );
    root.replaceChildren(
      el('div', 'mn-bg'),
      el(
        'div',
        'mn-pause',
        el('span', 'mn-kicker', 'PARTIDA ONLINE'),
        logo(),
        card,
        el('nav', 'mn-modes', enter, back),
        el('div', 'mn-help', el('b', '', 'CONTROLES'), controlsGrid()),
        sourceLink('mn-source'),
      ),
    );
    // Antes de conectar, o que a URL pediu (entrar por `sala` corrige quando a sala responder)
    const q = new URLSearchParams(location.search);
    this.setInfo({ map: q.get('mapa'), mode: q.get('modo'), difficulty: q.get('dificuldade') ?? (q.has('sala') ? 'sala' : null) });
  }

  /** Atualiza mapa/modo/dificuldade (chamado de novo quando a sala informa os dela). */
  setInfo(info: MatchInfo) {
    const key = `${info.map}|${info.mode}|${info.difficulty}`;
    if (key === this.shown) return;
    this.shown = key;
    const map = mapLabel(info.map);
    this.mapName.textContent = map.name;
    this.mapWhere.textContent = map.where;
    this.mode.textContent = modeLabel(info.mode);
    this.difficulty.textContent = info.mode === 'duel' ? 'SEM BOTS' : info.difficulty === 'sala' ? 'DA SALA' : difficultyLabel(info.difficulty);
    const id = info.map === 'patacho' || info.map === 'lapa' || info.map === 'favela' || info.map === 'pelourinho' ? info.map : info.map === 'arena' ? null : 'pelourinho';
    this.thumb.style.backgroundImage = id ? `url("${thumbUrl(id)}")` : '';
  }

  setVisible(on: boolean) {
    this.root.classList.toggle('hidden', !on);
  }

  /** Troca de papel (Modo Live): esconde e solta o jogo descartado (ouvintes e filhos). */
  dispose() {
    this.setVisible(false);
    for (const off of this.offs.splice(0)) off();
    this.root.replaceChildren();
  }
}
