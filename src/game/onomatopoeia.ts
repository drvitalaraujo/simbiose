/** Faixa lateral oposta ao alvo: reserva o miolo para a mira e a silhueta. */
export function onomaPlacement(x: number, y: number) {
  return { x: x >= 0 ? 0.16 : 0.84, y: Math.max(0.3, Math.min(0.6, 0.5 - y * 0.5)) };
}
/** Texto é acento da rajada; som, hitmarker e partículas continuam por acerto. */
export class OnomaCadence {
  private remaining = 0;
  tick(dt: number) { this.remaining = Math.max(0, this.remaining - dt); }
  reset() { this.remaining = 0; }
  allow(important: boolean): boolean {
    if (!important && this.remaining > 0) return false;
    this.remaining = important ? 0.4 : 0.22;
    return true;
  }
}
