// Teclado e mouse do espectador (sem pointer lock: arrastar gira a câmera livre).
//   1 livre · 2 3ª pessoa · 3 1ª pessoa · 4 diretor automático
//   ←/→ ou clique: trocar de jogador · WASD + Q/E (Shift rápido): voar · H: esconde o convite
import type { CameraMode, FlyInput } from './cameras';

export interface SpectatorControlEvents {
  mode(mode: CameraMode): void;
  /** Próximo (+1) ou anterior (-1) jogador. */
  cycle(step: 1 | -1): void;
  /** Tecla H (tela da live: mostra/esconde o convite). */
  toggleInvite(): void;
  /** Primeiro gesto do usuário (o áudio só destrava assim). */
  gesture(): void;
}

const MODE_KEYS: Record<string, CameraMode> = { Digit1: 'free', Digit2: 'chase', Digit3: 'eyes', Digit4: 'director' };
const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']);
/** Arrastar mais que isto (px) não conta como clique. */
const CLICK_SLOP = 5;
/** Radianos por pixel arrastado. */
const DRAG_TURN = 0.0045;

export class SpectatorControls {
  private readonly keys = new Set<string>();
  private dragging = false;
  private moved = 0;
  private dx = 0;
  private dy = 0;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    this.on.gesture();
    const mode = MODE_KEYS[e.code];
    if (mode) this.on.mode(mode);
    else if (e.code === 'ArrowRight') this.on.cycle(1);
    else if (e.code === 'ArrowLeft') this.on.cycle(-1);
    else if (e.code === 'KeyH' && !e.repeat) this.on.toggleInvite();
    if (FLY_KEYS.has(e.code)) {
      // Começar a voar a partir de qualquer câmera: vira câmera livre no lugar
      if (!this.keys.has(e.code)) this.on.mode('free');
      this.keys.add(e.code);
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.add('Shift');
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.delete('Shift');
  };
  private readonly onBlur = () => this.keys.clear();
  private readonly onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.on.gesture();
    this.dragging = true;
    this.moved = 0;
  };
  private readonly onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    this.dx += e.movementX;
    this.dy += e.movementY;
  };
  private readonly onUp = (e: PointerEvent) => {
    if (e.button !== 0 || !this.dragging) return;
    this.dragging = false;
    if (this.moved < CLICK_SLOP && !this.freeLook()) this.on.cycle(1);
  };

  constructor(private readonly target: HTMLElement, private readonly on: SpectatorControlEvents, private readonly freeLook: () => boolean) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }

  /** Voo livre deste quadro. */
  fly(): FlyInput {
    const k = (code: string) => (this.keys.has(code) ? 1 : 0);
    return { right: k('KeyD') - k('KeyA'), up: k('KeyE') - k('KeyQ'), forward: k('KeyW') - k('KeyS'), fast: this.keys.has('Shift') };
  }

  /** Giro acumulado pelo arrasto desde o último quadro (yaw, pitch em radianos). */
  takeTurn(): { yaw: number; pitch: number } {
    const out = { yaw: -this.dx * DRAG_TURN, pitch: -this.dy * DRAG_TURN };
    this.dx = 0;
    this.dy = 0;
    return out;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }
}
