// Vida + escudo (canto inferior esquerdo) e munição com aviso de recarga (inferior direito),
// em placas inclinadas de nanquim. A barra fina embaixo do pente mostra quanto ainda tem nele.
import { el, Style, Text, Toggle } from './dom';

const LOW_HP = 0.35;
const LOW_AMMO = 0.25;

export class Vitals {
  readonly root: HTMLElement;
  private readonly hpText: Text;
  private readonly shieldText: Text;
  private readonly hpFill: Style;
  private readonly hpGhost: Style;
  private readonly shieldFill: Style;
  private readonly lowHp: Toggle;
  private readonly hasShield: Toggle;
  private readonly magText: Text;
  private readonly reserveText: Text;
  private readonly warnText: Text;
  private readonly lowAmmo: Toggle;
  private readonly empty: Toggle;
  private readonly reloading: Toggle;
  private readonly reloadP: Style;
  private readonly weaponText: Text;
  private readonly magFill: Style;

  constructor() {
    const hpNum = el('b', 'num');
    const shNum = el('b', 'num');
    const hpFill = el('i', 'fill');
    const hpGhost = el('i', 'ghost');
    const shFill = el('i', 'fill');
    const health = el(
      'div',
      'ch-vitals',
      el('div', 'row shield', el('span', 'tag', 'ESCUDO'), el('div', 'bar', shFill), shNum),
      el('div', 'row hp', el('span', 'tag', 'VIDA'), el('div', 'bar', hpGhost, hpFill), hpNum),
    );

    const mag = el('b', 'mag');
    const reserve = el('span', 'reserve');
    const warn = el('div', 'warn');
    const weapon = el('div', 'weapon');
    const ring = el('i', 'reload-ring');
    const magFill = el('i', 'fill');
    const ammo = el('div', 'ch-ammo', weapon, el('div', 'count', mag, el('span', 'sep', '/'), reserve), warn, ring, el('div', 'magbar', magFill));

    this.root = el('div', 'ch-bottom', health, ammo);
    this.hpText = new Text(hpNum);
    this.shieldText = new Text(shNum);
    this.hpFill = new Style(hpFill, 'width');
    this.hpGhost = new Style(hpGhost, 'width');
    this.shieldFill = new Style(shFill, 'width');
    this.lowHp = new Toggle(health, 'low');
    this.hasShield = new Toggle(health, 'has-shield');
    this.magText = new Text(mag);
    this.reserveText = new Text(reserve);
    this.warnText = new Text(warn);
    this.lowAmmo = new Toggle(ammo, 'low');
    this.empty = new Toggle(ammo, 'empty');
    this.reloading = new Toggle(ammo, 'reloading');
    this.reloadP = new Style(ammo, '--p');
    this.weaponText = new Text(weapon);
    this.magFill = new Style(magFill, 'width');
  }

  setVitals(hp: number, maxHp: number, shield = 0, maxShield = 0) {
    // Sem saída antecipada: Style/Text/Toggle já ignoram valores repetidos, e assim uma
    // mudança só dos máximos (vida 100→200, escudo 0→50) também redesenha (revisão I3).
    const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    // O "fantasma" (faixa clara) encolhe atrasado pela transição do CSS: mostra o dano levado
    this.hpGhost.set(`${hpPct * 100}%`);
    this.hpFill.set(`${hpPct * 100}%`);
    this.hpText.set(String(Math.max(0, Math.ceil(hp))));
    this.lowHp.set(hpPct > 0 && hpPct < LOW_HP);
    this.hasShield.set(maxShield > 0);
    const shPct = maxShield > 0 ? Math.max(0, Math.min(1, shield / maxShield)) : 0;
    this.shieldFill.set(`${shPct * 100}%`);
    this.shieldText.set(String(Math.max(0, Math.ceil(shield))));
  }

  /**
   * Munição. `reloadProgress` (0..1) só conta quando `reloading`; o anel em volta do pente
   * enche junto. Sem munição no pente aparece "RECARREGUE [R]".
   */
  setAmmo(mag: number, reserve: number, magSize: number, reloading = false, reloadProgress = 0) {
    this.magText.set(String(mag));
    this.reserveText.set(String(reserve));
    const low = magSize > 0 && mag / magSize <= LOW_AMMO;
    this.lowAmmo.set(low && !reloading);
    this.empty.set(mag === 0 && !reloading);
    this.reloading.set(reloading);
    this.reloadP.set(reloading ? reloadProgress.toFixed(2) : '0');
    // Recarregando, a barra enche junto com o anel; fora disso, mostra o pente
    const frac = reloading ? reloadProgress : magSize > 0 ? mag / magSize : 0;
    this.magFill.set(`${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`);
    let warn = '';
    if (reloading) warn = 'RECARREGANDO…';
    else if (mag === 0 && reserve === 0) warn = 'SEM MUNIÇÃO';
    else if (mag === 0) warn = 'RECARREGUE [R]';
    else if (low) warn = 'POUCA MUNIÇÃO [R]';
    this.warnText.set(warn);
  }

  setWeapon(name: string) {
    this.weaponText.set(name.toUpperCase());
  }

  /** Armas sem munição limitada não devem mostrar um pente vazio fictício. */
  setInfiniteAmmo() {
    this.setAmmo(1, 1, 1);
    this.magText.set('∞');
    this.reserveText.set('∞');
  }
}
