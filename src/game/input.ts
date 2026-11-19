// Teclado + mouse com pointer lock. A mira (yaw/pitch) anda a cada movimento do mouse,
// para a câmera responder no quadro; `command()` monta o PlayerCommand de um tick.
import type { PlayerCommand } from '../sim/command';
import { PITCH_LIMIT } from '../sim/player';

const SENS = 0.0022;

/**
 * Mira depois de um movimento do mouse: aplica a sensibilidade UMA vez e limita o pitch
 * UMA vez (limitar antes de multiplicar inverte o movimento perto do limite).
 */
export function applyLook(yaw: number, pitch: number, dx: number, dy: number, sensitivity = 1): { yaw: number; pitch: number } {
  const k = SENS * sensitivity;
  return { yaw: yaw - dx * k, pitch: Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch - dy * k)) };
}

export class Input {
  private keys = new Set<string>();
  private seq = 0;
  weaponSlot = 0;
  fireHeld = false;
  rightHeld = false;
  locked = false;
  jumpPressed = false;
  /** Mira atual (radianos). O comando de cada tick leva estes ângulos. */
  yaw = 0;
  pitch = 0;
  /** Desligado enquanto o jogador está morto (a câmera tomba sozinha). */
  lookEnabled = true;
  /** Multiplicador da sensibilidade (Configurações do menu; 1 = padrão, usado no ?debug). */
  sensitivity = 1;
  /** Razão do FOV para manter a sensibilidade da mira proporcional ao zoom. */
  aimSensitivity = 1;

  /** Ouvintes da janela/documento, para `dispose()` tirar todos. */
  private readonly listeners: [Window | Document, string, (e: Event) => void][] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.listen(window, 'keydown', (e: KeyboardEvent) => {
      if (this.locked && ['Space', 'KeyC', 'Tab', 'ControlLeft', 'ControlRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space' && !this.keys.has('Space')) this.jumpPressed = true;
      this.keys.add(e.code);
    });
    this.listen(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    this.listen(window, 'mousemove', (e: MouseEvent) => {
      if (!this.locked || !this.lookEnabled) return;
      const look = applyLook(this.yaw, this.pitch, e.movementX, e.movementY, this.sensitivity * this.aimSensitivity);
      this.yaw = look.yaw;
      this.pitch = look.pitch;
    });
    this.listen(window, 'mousedown', (e: MouseEvent) => {
      if (!this.locked) return;
      if (e.button === 0) this.fireHeld = true;
      if (e.button === 2) this.rightHeld = true;
    });
    this.listen(window, 'mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.rightHeld = false;
    });
    this.listen(window, 'contextmenu', (e: Event) => e.preventDefault());
    this.listen(window, 'blur', () => this.clearHeld());
    this.listen(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.clearHeld();
      }
    });
  }

  private listen<E extends Event>(target: Window | Document, type: string, fn: (e: E) => void) {
    const handler = fn as (e: Event) => void;
    target.addEventListener(type, handler);
    this.listeners.push([target, type, handler]);
  }

  /** Tira todos os ouvintes (troca jogador ↔ espectador do Modo Live). */
  dispose() {
    for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn);
    this.listeners.length = 0;
    this.clearHeld();
    this.locked = false;
  }

  clearHeld() {
    this.keys.clear();
    this.fireHeld = this.rightHeld = this.jumpPressed = false;
  }

  /** Hack no E; botão direito é exclusivo da mira. */
  get hackHeld(): boolean {
    return this.keys.has('KeyE');
  }

  lock() {
    // Aba sem foco/automação pode recusar. O menu segue aberto até um clique válido.
    void this.canvas.requestPointerLock()?.catch(() => {});
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  resetLook() {
    this.yaw = 0;
    this.pitch = 0;
  }

  consumeJump(): boolean {
    const j = this.jumpPressed;
    this.jumpPressed = false;
    return j;
  }

  /** Comando de UM tick. Consome o pulo (borda), então chame uma vez por tick. */
  command(): PlayerCommand {
    const k = (code: string) => (this.keys.has(code) ? 1 : 0);
    const weaponSlot = this.weaponSlot;
    return {
      weaponSlot,
      seq: ++this.seq,
      moveX: k('KeyD') - k('KeyA'),
      moveZ: k('KeyW') - k('KeyS'),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      jump: this.consumeJump(),
      crouch: this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyC'),
      melee: this.keys.has('KeyV'),
      throwSlipper: this.keys.has('KeyG'),
      grenade: this.keys.has('KeyQ'),
      yaw: this.yaw,
      pitch: this.pitch,
      fire: this.fireHeld,
      reload: this.keys.has('KeyR'),
      aim: this.rightHeld,
      alt: this.hackHeld,
    };
  }
}
