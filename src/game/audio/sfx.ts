import type { Vec3 } from '../../sim/vec';
import { Footsteps, type FootMotion } from './footsteps';
import { AudioMixer, type SoundLayer, type SoundOptions } from './mixer';

const vary = () => 0.97 + Math.random() * 0.06;
const layer = (id: string, gain: number, rate = 1, delay = 0): SoundLayer => ({ id, gain, rate, delay });
const WEAPONS: Record<string, { sample: string; body: number; tail: number; rate: number; gain: number }> = {
  mk2: { sample: 'rifle', body: 0.3, tail: 0.09, rate: 1, gain: 0.74 },
  smg: { sample: 'smg', body: 0.16, tail: 0.035, rate: 1.16, gain: 0.55 },
  sniper: { sample: 'sniper', body: 0.5, tail: 0.16, rate: 0.87, gain: 0.86 },
  shotgun: { sample: 'shotgun', body: 0.45, tail: 0.12, rate: 0.92, gain: 0.82 },
};

/** Momentos do jogo que a trilha escuta (tiro seu, acerto, abate, dano, morte, onda...). */
export type SfxCue = 'shot' | 'hit' | 'kill' | 'hurt' | 'death' | 'wave' | 'reset' | 'win' | 'lose';

/** Fachada do áudio: o jogo dispara eventos, o mixer cuida de custo e posicionamento. */
export class Sfx {
  readonly mixer = new AudioMixer();
  readonly feet = new Footsteps();
  private stepVariant = 0;
  private lastLowHealth = false;
  /** Ouvinte dos momentos de jogo (a trilha liga aqui, de fora das classes de jogo). */
  onCue: ((cue: SfxCue) => void) | null = null;

  unlock() { this.mixer.unlock(); }
  setVolume(value: number) { this.mixer.setVolume(value); }

  shot(weapon = 'mk2', position?: Vec3, source = 'local') {
    const spec = WEAPONS[weapon] ?? WEAPONS.mk2;
    if (!position) this.onCue?.('shot');
    const pitch = vary();
    this.mixer.play(`shot:${source}`, [
      layer(spec.sample, spec.gain, pitch), layer('crack', 0.1, pitch * spec.rate),
      layer('body', spec.body * (position ? 0.55 : 1), pitch * spec.rate),
      layer('tail', spec.tail, spec.rate, 0.025),
    ], { position, range: 65, priority: 8 });
    if (!position && weapon === 'sniper') this.mixer.play('cycle', [layer('bolt', 0.23, 0.9, 0.19)], { priority: 3 });
  }

  reload(phase: 'out' | 'in' | 'bolt') {
    this.mixer.play('reload', [layer(phase === 'out' ? 'magOut' : phase === 'in' ? 'magIn' : 'bolt', 0.5, vary()),
      layer('click', 0.08, phase === 'in' ? 0.7 : 1)], { priority: 6 });
  }
  equip() { this.mixer.play('equip', [layer('magOut', 0.22, 1.3), layer('click', 0.12, 0.8, 0.05)], { priority: 4 }); }
  hit(head = false) {
    this.onCue?.('hit');
    this.mixer.play('hit', [layer('hit', 0.65), ...(head ? [layer('head', 0.6)] : [])], { bus: 'feedback', priority: 10 });
  }
  kill(head = false) {
    this.onCue?.('kill');
    this.mixer.play('kill', [layer('hit', 0.5), layer('kill', 0.7), layer('digital', 0.5, 1.5, 0.07),
      ...(head ? [layer('head', 0.7)] : [])], { bus: 'feedback', priority: 11 });
  }
  hurt() { this.onCue?.('hurt'); this.mixer.play('hurt', [layer('hurt', 0.6), layer('slap', 0.35, 0.85)], { bus: 'feedback', priority: 9 }); }
  death() { this.onCue?.('death'); this.mixer.play('death', [layer('death', 0.6), layer('hurt', 0.35, 0.65)], { bus: 'feedback', priority: 11 }); }
  impact(position: Vec3, metal = false) {
    this.mixer.play('impact', [layer(metal ? 'metal' : 'debris', 0.25, vary())], { position, range: 20, priority: 2 });
  }
  slipper(action: 'melee' | 'throw', position?: Vec3, source = 'local') {
    this.mixer.play(`slipper:${source}`, [layer('whoosh', action === 'throw' ? 0.18 : 0.12, action === 'throw' ? 0.85 : 1.2)], { position, range: 16, priority: 5 });
  }
  grenade(phase: 'throw' | 'explode', position: Vec3, source: string, local = false) {
    if (local && phase === 'throw') this.onCue?.('shot');
    this.mixer.play(`grenade:${source}`, phase === 'throw'
      ? [layer('click', 0.35), layer('whoosh', 0.22, 0.85)]
      : [layer('explosion', 0.85), layer('debris', 0.4, 0.7, 0.06)],
    { position, range: phase === 'throw' ? 16 : 55, priority: 7 });
  }
  slap(position: Vec3) { this.mixer.play('slap', [layer('slap', 0.7, vary()), layer('body', 0.12, 1.6)], { position, range: 24, priority: 6 }); }
  slide(position?: Vec3) {
    this.mixer.play('slide', [layer('whoosh', 0.12, 0.65), layer('step0', 0.15, 0.7)], { position, range: 20, priority: 4 });
  }
  movement(id: string, motion: FootMotion, remote = false, ally = false) {
    const cue = this.feet.update(id, motion);
    if (!cue) return;
    const position = remote ? { ...motion.position, y: motion.position.y - 0.55 } : undefined;
    // Alterna sem repetir imediatamente; variação leve de altura mantém textura orgânica.
    this.stepVariant = (this.stepVariant + 1 + Math.floor(Math.random() * 3)) % 4;
    this.mixer.play(`feet:${id}`, [layer(`step${this.stepVariant}`, cue.kind === 'land' ? (remote ? 0.8 : 0.6) * cue.strength : remote ? 0.8 : 0.22, vary()),
      ...(cue.kind === 'land' ? [layer('body', 0.12 * cue.strength, 1.4)] : [])],
    { position, range: cue.kind === 'land' ? 28 : 24, priority: remote ? (ally ? 5 : 7) : 3, duck: 0, reserveHrtf: remote && !ally });
  }
  health(hp: number) {
    const low = hp > 0 && hp <= 30;
    if (low && !this.lastLowHealth) this.mixer.play('health', [layer('digital', 0.28, 0.55), layer('digital', 0.2, 0.45, 0.16)], { bus: 'feedback', priority: 9 });
    this.lastLowHealth = low;
  }
  charge(position?: Vec3) { this.mixer.play('charge', [layer('charge', 0.45)], { position, range: 35, priority: 5 }); }
  droneShot(position: Vec3) { this.mixer.play('drone', [layer('charge', 0.35, 1.8), layer('click', 0.16)], { position, range: 40, priority: 5 }); }
  spawn(position?: Vec3) { this.mixer.play('spawn', [layer('charge', 0.2, 1.4)], { position, range: 24, priority: 3 }); }
  wave() { this.onCue?.('wave'); this.chime('wave', [1, 1.5], 0.15); }
  hack() { this.chime('hack', [0.8, 1, 1.2, 1.6], 0.055); }
  hackTick(progress: number) { this.mixer.play('hackTick', [layer('digital', 0.12, 0.6 + progress)], { bus: 'feedback', priority: 4 }); }
  overload(position?: Vec3) { this.mixer.play('explosion', [layer('explosion', 0.75), layer('debris', 0.4, 0.7, 0.06)], { position, range: 55, priority: 6 }); }
  match(won: boolean) { this.onCue?.(won ? 'win' : 'lose'); this.chime('match', won ? [1, 1.25, 1.5, 2] : [1, 0.85, 0.7], 0.13); }
  private chime(key: string, notes: number[], spacing: number) {
    const options: SoundOptions = { bus: 'feedback', priority: 10 };
    this.mixer.play(key, notes.map((rate, i) => layer('digital', 0.5, rate, i * spacing)), options);
  }
  reset() { this.onCue?.('reset'); this.feet.reset(); this.lastLowHealth = false; this.mixer.stopAll(); }
  dispose() { this.mixer.dispose(); }
}
