// Atualizações do HUD do Treino (DOM). Só leitura de estado; nenhuma regra de jogo aqui.
// Desempenho: os elementos são buscados uma vez no construtor e o DOM só é tocado quando o
// valor muda (vários métodos são chamados a cada quadro pelo game.ts).

import './hud/hud.css';
import { Vitals } from './hud/vitals';
import type { WeaponState } from '../sim/weapon';
import { gunSpec } from '../sim/weapons';

const $ = (id: string) => document.getElementById(id)!;

export interface Line {
  speaker: string;
  line: string;
  seconds: number;
}

export class Hud {
  private readonly vitals = new Vitals();
  private readonly hpFill = $('hp-fill');
  private readonly score = $('score-value');
  private readonly wave = $('wave-value');
  private readonly banner = $('banner');
  private readonly bannerTitle = $('banner-title');
  private readonly bannerLine = $('banner-line');
  private readonly damage = $('damage');
  private readonly death = $('death');
  private readonly deathStats = $('death-stats');
  private readonly subtitle = $('subtitle');
  private readonly allySlots = Array.from(document.querySelectorAll<HTMLElement>('#allies .slot'));
  private readonly boss = $('boss');
  private readonly bossFill = $('boss-fill');
  private readonly bossLabel = $('boss-label');
  private readonly speedlines = $('speedlines');
  private bannerTimer = 0;
  private subtitleTimer = 0;
  private queue: Line[] = [];
  // Último valor escrito no DOM (NaN/'' = nunca escrito)
  private lastHpPct = NaN;
  private lastScore = NaN;
  private lastAllies = NaN;
  private lastBossPct = NaN;
  private lastBossShown: boolean | null = null;
  private lastBossPane: boolean | null = null;
  private lastBossLabel = '';
  private lastSpeed = '';

  constructor() {
    const root = document.createElement('div');
    root.className = 'chud training-ammo';
    root.append(this.vitals.root);
    $('hud').append(root);
    this.vitals.setWeapon('Gambiarra MK-2 · R: recarregar');
  }

  setAmmo(w: WeaponState) {
    const spec = gunSpec(w.weaponIndex);
    this.vitals.setWeapon(`${spec.name} · R: recarregar`);
    this.vitals.setAmmo(w.ammo, w.reserveAmmo, spec.magazineSize, w.reloadRemaining > 0, 1 - w.reloadRemaining / spec.reloadTime);
  }

  setHp(hp: number, max: number) {
    const pct = Math.max(0, hp / max) * 100;
    if (pct === this.lastHpPct) return;
    this.lastHpPct = pct;
    this.hpFill.style.width = `${pct}%`;
    this.hpFill.classList.toggle('low', pct < 35);
  }

  setScore(kills: number) {
    if (kills === this.lastScore) return;
    this.lastScore = kills;
    this.score.textContent = String(kills);
  }

  showWave(wave: number, line: string) {
    this.wave.textContent = String(wave);
    this.bannerTitle.textContent = `ONDA ${wave}`;
    this.bannerLine.textContent = `OTIMIZA: "${line}"`;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.bannerTimer = 3.2;
  }

  setAllies(count: number) {
    if (count === this.lastAllies) return;
    this.lastAllies = count;
    this.allySlots.forEach((el, i) => el.classList.toggle('on', i < count));
  }

  /** Barra do chefe: `fraction` nulo esconde. */
  setBoss(fraction: number | null, pane: boolean, paneLeft: number) {
    const shown = fraction !== null;
    if (shown !== this.lastBossShown) {
      this.lastBossShown = shown;
      this.boss.classList.toggle('show', shown);
    }
    if (fraction === null) return;
    const pct = Math.max(0, fraction) * 100;
    if (pct !== this.lastBossPct) {
      this.lastBossPct = pct;
      this.bossFill.style.width = `${pct}%`;
    }
    if (pane !== this.lastBossPane) {
      this.lastBossPane = pane;
      this.boss.classList.toggle('pane', pane);
    }
    const label = pane ? `EM PANE! HACKEIE JÁ (${paneLeft.toFixed(1)}s)` : 'GERENTE DE FELICIDADE';
    if (label !== this.lastBossLabel) {
      this.lastBossLabel = label;
      this.bossLabel.textContent = label;
    }
  }

  setSpeedlines(amount: number) {
    const s = amount.toFixed(2);
    if (s === this.lastSpeed) return;
    this.lastSpeed = s;
    this.speedlines.style.setProperty('--s', s);
  }

  /** Legenda de personagem (ex.: Bit) na parte de baixo da tela. Interrompe a fila. */
  say(speaker: string, line: string, seconds = 3.5) {
    this.queue.length = 0;
    this.show({ speaker, line, seconds });
  }

  /** Toca várias falas em sequência (cena de abertura). Retorna a duração total. */
  sayAll(lines: Line[]): number {
    this.queue = [...lines];
    const first = this.queue.shift();
    if (first) this.show(first);
    return lines.reduce((s, l) => s + l.seconds, 0);
  }

  private show({ speaker, line, seconds }: Line) {
    const el = this.subtitle;
    el.innerHTML = '';
    el.dataset.speaker = speaker.toLowerCase();
    const who = document.createElement('b');
    who.textContent = `${speaker}: `;
    el.append(who, line);
    el.classList.add('show');
    this.subtitleTimer = seconds;
  }

  hurt() {
    this.damage.classList.remove('show');
    void this.damage.offsetWidth;
    this.damage.classList.add('show');
  }

  showDeath(show: boolean, wave = 0, kills = 0) {
    this.death.classList.toggle('show', show);
    if (show) this.deathStats.textContent = `Onda ${wave} · ${kills} drones desligados`;
  }

  update(dt: number) {
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) {
        const next = this.queue.shift();
        if (next) this.show(next);
        else this.subtitle.classList.remove('show');
      }
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
  }
}
