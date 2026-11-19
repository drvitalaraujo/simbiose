import { ARSENAL, gunSpec } from '../sim/weapons';
import type { Input } from './input';
import './arsenal.css';

// Ordem dos atalhos; os índices do catálogo continuam estáveis no protocolo online.
const WEAPON_ORDER = ['shotgun', 'smg', 'mk2', 'sniper'].map(id => ARSENAL.findIndex(w => w.id === id));

/** Inventário completo: atalhos diretos e consulta opcional dos detalhes. */
export class ArsenalPanel {
  private readonly button = document.createElement('button');
  private readonly dialog = document.createElement('dialog');
  private readonly cards: HTMLButtonElement[] = [];
  private selected = 0;
  private readonly slots = document.createElement('div');
  private readonly slotButtons: HTMLButtonElement[] = [];
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey ||
      (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]'))) return;
    if (e.code === 'KeyB') {
      e.preventDefault();
      if (this.dialog.open) this.close(); else this.open();
    }
    if ((this.dialog.open || this.input.locked) && /^(Digit|Numpad)[1-4]$/.test(e.code)) {
      e.preventDefault(); this.choose(WEAPON_ORDER[Number(e.code.slice(-1)) - 1]);
    }
  };
  private readonly onWheel = (e: WheelEvent) => {
    if (!this.input.locked || this.dialog.open || !e.deltaY) return;
    e.preventDefault();
    const current = this.input.weaponSlot ? this.input.weaponSlot - 1 : this.selected;
    const slot = WEAPON_ORDER.indexOf(current);
    this.choose(WEAPON_ORDER[(slot + Math.sign(e.deltaY) + WEAPON_ORDER.length) % WEAPON_ORDER.length]);
  };

  constructor(private readonly input: Input, _online: boolean, private readonly onSelect: (index: number) => void) {
    this.button.className = 'arsenal-toggle';
    this.button.type = 'button';
    this.button.textContent = 'ARSENAL · DETALHES';
    this.button.addEventListener('click', () => this.open());
    this.dialog.className = 'arsenal-dialog';
    this.dialog.setAttribute('aria-label', 'Arsenal da Resistência');
    const title = document.createElement('h1'); title.textContent = 'ARSENAL DA RESISTÊNCIA';
    const hint = document.createElement('p'); hint.textContent = 'Troque com 1–4 ou a rodinha; cada arma conserva sua munição. Correr, pular e deslizar abrem a dispersão. Freie para precisão; SMG e escopeta favorecem movimento de perto. Segure direito para mirar. V/G: Chinelada.';
    this.slots.className = 'weapon-slots';
    this.slots.setAttribute('aria-label', 'Armas disponíveis');
    const grid = document.createElement('div'); grid.className = 'arsenal-grid';
    WEAPON_ORDER.forEach((i, slotIndex) => {
      const w = ARSENAL[i];
      const slot = document.createElement('button'); slot.type = 'button';
      slot.textContent = `${slotIndex + 1} · ${w.category}`;
      slot.title = `${w.name} — tecla ${slotIndex + 1}`;
      slot.addEventListener('click', () => this.choose(i));
      this.slotButtons[i] = slot; this.slots.append(slot);
      const card = document.createElement('button'); card.type = 'button'; card.dataset.weapon = w.id;
      const category = document.createElement('span'); category.textContent = `${slotIndex + 1} · ${w.category}`;
      const name = document.createElement('strong'); name.textContent = w.name;
      const role = document.createElement('p'); role.textContent = w.role;
      const details = document.createElement('small');
      details.textContent = `${w.bodyDamage}${w.pellets > 1 ? ` × ${w.pellets}` : ''} dano perto · ${w.magazineSize} / ${w.reserveAmmo} balas · recarga ${w.reloadTime.toFixed(2).replace('.', ',')} s`;
      const aim = document.createElement('small');
      aim.textContent = `${w.automatic ? 'Automática' : 'Um clique por tiro'} · ${w.zoom}× · ${w.id === 'sniper' ? 'pare para precisão máxima' : 'segure direito para mirar'}`;
      card.append(category, name, role, details, aim);
      card.addEventListener('click', () => this.choose(i));
      this.cards[i] = card; grid.append(card);
    });
    const close = document.createElement('button'); close.type = 'button'; close.className = 'arsenal-close';
    close.textContent = 'VOLTAR AO JOGO'; close.addEventListener('click', () => this.close());
    const controls = document.createElement('p'); controls.textContent = '1–4 / Rodinha: trocar arma · Botão direito: mirar · R: recarregar · E: hackear · V/G: Chinelada';
    this.dialog.append(title, hint, grid, controls, close);
    this.dialog.addEventListener('cancel', () => this.input.clearHeld());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    document.body.append(this.button, this.dialog, this.slots);
    this.sync(0, 0);
  }

  sync(active: number, selected: number) {
    this.selected = selected;
    this.cards.forEach((card, i) => { card.classList.toggle('selected', i === selected); card.setAttribute('aria-pressed', String(i === selected)); });
    this.slotButtons.forEach((button, i) => { button.classList.toggle('active', i === active); button.setAttribute('aria-pressed', String(i === active)); });
    this.button.title = `${gunSpec(active).name} · B: detalhes`;
  }

  open() {
    if (this.dialog.open) return;
    this.input.clearHeld(); this.input.locked = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.dialog.showModal(); this.cards[this.selected].focus();
  }

  private choose(index: number) {
    this.onSelect(index);
    if (this.dialog.open) this.close();
  }

  private close() { this.dialog.close(); this.input.clearHeld(); this.input.lock(); }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('wheel', this.onWheel);
    this.button.remove(); this.dialog.remove(); this.slots.remove();
  }
}
