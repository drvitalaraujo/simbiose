// HUD competitivo (FFA, Duelo, TDM, "Hackeia e Segura"). Fachada única: a rede chama estes
// métodos quando o estado muda e `update(dt)` uma vez por quadro. O HUD não conhece regras
// de jogo nem a rede; só desenha. Cada parte mexe no DOM apenas quando o valor muda.
//
// Uso:
//   const hud = new CompetitiveHud();          // cria o DOM dentro do <body>
//   hud.setLocalPlayer({ id: 'eu', team: 'a' });
//   hud.setVitals(100, 100, 50, 50);  hud.setAmmo(12, 48, 12);
//   hud.pushKill({ killer, victim, weapon: 'Pistola', headshot: true });
//   no loop:  hud.update(dt);
import './hud.css';
import './hud-screens.css';
import { Announcer, type AnnounceStyle } from './announcer';
import { el, Toggle } from './dom';
import type { LocalView } from './format';
import { Killfeed } from './killfeed';
import { Markers } from './markers';
import { Minimap } from './minimap';
import { Scoreboard } from './scoreboard';
import { DeathScreen, type MatchEndActions, MatchEndScreen } from './screens';
import { type SideScore, Topbar } from './topbar';
import type { DeathData, HitKind, KillEvent, MatchEndData, MinimapDot, MinimapSelf, MinimapSolid, PlayerRef, ScoreRow } from './types';
import { Vitals } from './vitals';

export type * from './types';
export type { AnnounceStyle, LocalView, MatchEndActions, SideScore };
export { damageAngle, relation } from './format';

export class CompetitiveHud {
  readonly root = el('div', 'chud');
  private local: LocalView = { id: '' };
  private readonly view = () => this.local;
  private readonly vitals = new Vitals();
  private readonly killfeed = new Killfeed(this.view);
  private readonly scoreboard = new Scoreboard(this.view);
  private readonly topbar = new Topbar();
  private readonly markers = new Markers();
  private readonly death = new DeathScreen(this.view);
  private readonly end = new MatchEndScreen(this.view);
  private readonly announcer = new Announcer();
  private readonly minimap = new Minimap();
  private readonly shown = new Toggle(this.root, 'off');
  /** Fim de partida aberto: o resto do HUD some por baixo. */
  private readonly ending = new Toggle(this.root, 'ending');
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Tab') return;
    e.preventDefault(); // Tab não pode tirar o foco do jogo
    if (!this.end.isShown) this.scoreboard.show(true);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Tab') this.scoreboard.show(false);
  };
  private readonly onBlur = () => this.scoreboard.show(false);

  constructor(parent: HTMLElement = document.body) {
    this.root.append(
      this.markers.root,
      this.topbar.root,
      this.killfeed.root,
      this.minimap.root,
      this.announcer.root,
      this.vitals.root,
      this.death.root,
      this.scoreboard.root,
      this.end.root,
    );
    parent.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** Quem é você (decide as cores: amarelo você, ciano aliado, rosa inimigo). */
  setLocalPlayer(view: LocalView) {
    this.local = { ...view };
  }

  // --- Vida, escudo e munição -------------------------------------------------------
  setVitals(hp: number, maxHp: number, shield = 0, maxShield = 0) {
    this.vitals.setVitals(hp, maxHp, shield, maxShield);
  }
  setAmmo(mag: number, reserve: number, magSize: number, reloading = false, reloadProgress = 0) {
    this.vitals.setAmmo(mag, reserve, magSize, reloading, reloadProgress);
  }
  setWeapon(name: string) {
    this.vitals.setWeapon(name);
  }
  setInfiniteAmmo() {
    this.vitals.setInfiniteAmmo();
  }

  // --- Killfeed e placar ------------------------------------------------------------
  pushKill(e: KillEvent) {
    this.killfeed.push(e);
  }
  setScoreboard(rows: ScoreRow[]) {
    this.scoreboard.setRows(rows);
  }
  /** Mostra/esconde o placar na mão (o Tab já faz isso sozinho). */
  showScoreboard(on: boolean) {
    this.scoreboard.show(on);
  }
  setScoreboardTitle(text: string) {
    this.scoreboard.setTitle(text);
  }
  setTeamNames(a: string, b: string) {
    this.scoreboard.setTeamNames(a, b);
    this.end.setTeamNames(a, b);
  }

  // --- Topo: cronômetro, rodada e placar resumido ----------------------------------
  setTimer(seconds: number, running = true, urgentBelow = 30) {
    this.topbar.setTimer(seconds, running, urgentBelow);
  }
  setRound(text: string) {
    this.topbar.setRound(text);
  }
  setModeLabel(text: string) {
    this.topbar.setMode(text);
  }
  setTopScores(left: SideScore | null, right: SideScore | null = null) {
    this.topbar.setSides(left, right);
  }

  // --- Marcadores -------------------------------------------------------------------
  hitMarker(kind: HitKind = 'body') {
    this.markers.hitMarker(kind);
  }
  killMarker(victim: PlayerRef, headshot = false) {
    this.markers.killMarker(victim, headshot);
  }
  /** Ângulo de tela (0 = frente, + = direita). Use `damageAngle(origem, eu, yaw)`. */
  damageFrom(angle: number, strength = 1) {
    this.markers.damageFrom(angle, strength);
  }

  // --- Telas -------------------------------------------------------------------------
  showDeath(d: DeathData) {
    this.scoreboard.show(false);
    this.death.show(d);
  }
  hideDeath() {
    this.death.hide();
  }
  showMatchEnd(d: MatchEndData, actions: MatchEndActions) {
    this.death.hide();
    this.scoreboard.show(false);
    this.end.show(d, actions);
    this.ending.set(true);
  }
  hideMatchEnd() {
    this.end.hide();
    this.ending.set(false);
  }
  announce(title: string, line = '', style: AnnounceStyle = 'otimiza', seconds = 3.2) {
    this.announcer.announce(title, line, style, seconds);
  }

  // --- Minimapa ----------------------------------------------------------------------
  setMinimap(solids: readonly MinimapSolid[]) {
    this.minimap.setMap(solids);
  }
  setMinimapPlayers(self: MinimapSelf | null, others: MinimapDot[] = []) {
    this.minimap.setPlayers(self, others);
  }

  // --- Geral -------------------------------------------------------------------------
  setVisible(on: boolean) {
    this.shown.set(!on);
  }

  /** Volta ao estado de começo de partida (sem telas, killfeed limpo). */
  reset() {
    this.killfeed.clear();
    this.announcer.clear();
    this.markers.reset();
    this.death.hide();
    this.hideMatchEnd();
    this.scoreboard.show(false);
  }

  /** Uma vez por quadro (contagens, killfeed sumindo, minimapa a 15 Hz). */
  update(dt: number) {
    this.killfeed.update(dt);
    this.topbar.update(dt);
    this.markers.update(dt);
    this.death.update(dt);
    this.announcer.update(dt);
    this.minimap.update(dt);
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.end.destroy();
    this.root.remove();
  }
}

/**
 * Esconde as partes do HUD do Treino (onda, drones, esquadrão, vida antiga, chefe, hack) e
 * deixa só mira e marcador de acerto: use ao entrar numa partida online.
 */
export function setCompetitiveMode(on: boolean) {
  document.body.classList.toggle('mode-competitive', on);
}

