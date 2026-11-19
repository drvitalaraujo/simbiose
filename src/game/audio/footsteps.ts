import type { Vec3 } from '../../sim/vec';

export interface FootMotion {
  position: Vec3;
  grounded: boolean;
  sliding: boolean;
  walking?: boolean;
  crouch: number;
  alive: boolean;
  vy: number;
  life?: number;
}
interface Track { position: Vec3; grounded: boolean; vy: number; distance: number; alive: boolean; life?: number }
export interface FootCue { kind: 'step' | 'land'; strength: number }

/** Percurso real, não velocidade declarada: parado contra parede não produz passos. */
export class Footsteps {
  private readonly tracks = new Map<string, Track>();

  update(id: string, motion: FootMotion): FootCue | null {
    const previous = this.tracks.get(id);
    const track: Track = { position: { ...motion.position }, grounded: motion.grounded, vy: motion.vy, distance: previous?.distance ?? 0, alive: motion.alive, life: motion.life };
    this.tracks.set(id, track);
    if (!previous || !motion.alive || !previous.alive || previous.life !== motion.life) { track.distance = 0; return null; }
    const distance = Math.hypot(motion.position.x - previous.position.x, motion.position.z - previous.position.z);
    // Teleporte/reconciliação grande nunca vira uma passada nem uma aterrissagem.
    if (distance > 3 || Math.abs(motion.position.y - previous.position.y) > 3) { track.distance = 0; return null; }
    if (motion.grounded && !previous.grounded && previous.vy < -2) {
      track.distance = 0;
      return { kind: 'land', strength: Math.min(1, -previous.vy / 12) };
    }
    if (!motion.grounded || motion.sliding || motion.walking || motion.crouch > 0.5) { track.distance = 0; return null; }
    track.distance += distance;
    if (track.distance < 2.15) return null;
    track.distance %= 2.15;
    return { kind: 'step', strength: 0.65 };
  }

  forget(id: string) { this.tracks.delete(id); }
  reset() { this.tracks.clear(); }
}
