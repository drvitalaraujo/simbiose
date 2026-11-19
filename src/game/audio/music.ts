// Trilha dinâmica: um Groove por vez, troca de estilo e de intensidade só na virada do
// compasso, virada de caixa antes de subir, abafado na morte e vinhetas quantizadas.
import { Groove } from './music-groove';
import { fillEvents, STEPS, stinger, styleById, type Intensity, type StingerKind, type StyleId } from './music-patterns';
import { MusicSynth } from './music-synth';

const CUTOFF: Record<Intensity, number> = { 0: 5200, 1: 11000, 2: 18000 };
const MUFFLED = 420;

interface QueuedNote { time: number; inst: Parameters<MusicSynth['play']>[0]; vel: number; notes: number[]; length: number; step: number }

export class Music {
  readonly synth: MusicSynth;
  private readonly groove: Groove;
  private readonly tone: BiquadFilterNode;
  private readonly level: GainNode;
  private pendingStyle: StyleId | null = null;
  private target: Intensity = 0;
  private muffled = false;
  private started = false;
  private readonly queue: QueuedNote[] = [];
  lastStinger: StingerKind | null = null;

  constructor(private readonly ctx: AudioContext, out: AudioNode, style: StyleId = 'menu') {
    this.level = ctx.createGain();
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass'; this.tone.frequency.value = CUTOFF[0]; this.tone.Q.value = 0.5;
    const input = ctx.createGain();
    input.connect(this.tone).connect(this.level).connect(out);
    this.synth = new MusicSynth(ctx, input, { echo: true });
    this.groove = new Groove(style, this.synth);
    this.applyStyleVoice(style);
    this.groove.onBar = time => this.onBar(time);
    this.groove.onStep = (step, time, seconds) => this.onStep(step, time, seconds);
  }

  get style(): StyleId { return this.pendingStyle ?? this.groove.style; }
  get intensity(): Intensity { return this.groove.intensity; }
  get targetIntensity(): Intensity { return this.target; }
  get bar() { return this.groove.bar; }
  get isMuffled() { return this.muffled; }

  setStyle(id: StyleId) {
    if (id === this.style) return;
    if (!this.started) { this.groove.style = id; this.applyStyleVoice(id); return; }
    this.pendingStyle = id;
    // Some até a virada do compasso; o estilo novo entra no tempo 1.
    const now = this.ctx.currentTime;
    const swap = this.groove.nextTime + (STEPS - this.groove.step) * this.groove.stepSeconds;
    const g = this.level.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.05, Math.max(now + 0.2, swap - 0.02));
  }

  setIntensity(value: Intensity) { this.target = value; }

  /** Morte: passa-baixa abafado até renascer. */
  setMuffled(on: boolean) {
    if (on === this.muffled) return;
    this.muffled = on;
    this.applyTone(this.ctx.currentTime, on ? 0.25 : 0.4);
  }

  /** Vinheta: abate cai na próxima colcheia; as outras no próximo passo do tempo forte. */
  stinger(kind: StingerKind) {
    if (!this.started) return;
    this.lastStinger = kind;
    const seconds = this.groove.stepSeconds;
    let step = this.groove.step;
    let time = this.groove.nextTime;
    const grid = kind === 'kill' ? 2 : kind === 'start' ? 4 : 1;
    while (step % grid !== 0) { step++; time += seconds; }
    for (const n of stinger(kind, styleById(this.style))) {
      this.queue.push({ time: time + n.offset * seconds, inst: n.inst, vel: n.vel, notes: n.notes, length: n.length, step: seconds });
    }
  }

  /** Agenda até `horizon` (segundos do relógio do áudio). */
  pump(now: number, horizon: number) {
    if (!this.started) {
      this.started = true;
      this.groove.nextTime = now + 0.05;
      this.level.gain.setValueAtTime(0, now);
      this.level.gain.linearRampToValueAtTime(1, now + 1.2);
    }
    this.groove.pump(now, horizon);
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if (q.time >= horizon) continue;
      this.queue.splice(i, 1);
      this.synth.play(q.inst, Math.max(now, q.time), q.vel, q.notes, q.length, q.step);
    }
  }

  /** Parou de tocar (volume zero, aba escondida): da próxima vez recomeça com fade. */
  halt() {
    if (!this.started) return;
    this.started = false;
    this.queue.length = 0;
    const now = this.ctx.currentTime;
    this.level.gain.cancelScheduledValues(now);
    this.level.gain.setTargetAtTime(0, now, 0.05);
  }

  private onBar(time: number) {
    if (this.pendingStyle) {
      this.groove.style = this.pendingStyle;
      this.applyStyleVoice(this.pendingStyle);
      this.pendingStyle = null;
      this.groove.restart();
      this.level.gain.setTargetAtTime(1, time, 0.08);
    }
    const changed = this.groove.intensity !== this.target;
    this.groove.intensity = this.target;
    if (changed) this.applyTone(time, 0.6);
    this.synth.setEchoTime(this.groove.stepSeconds);
  }

  private onStep(step: number, time: number, seconds: number) {
    if (step !== 12 || this.target <= this.groove.intensity || this.pendingStyle) return;
    for (const e of fillEvents(this.target)) {
      this.synth.play(e.inst, time + (e.step - 12) * seconds, e.vel, e.notes, e.length, seconds);
    }
  }

  private applyTone(time: number, constant: number) {
    const f = this.tone.frequency;
    f.cancelScheduledValues(time);
    f.setTargetAtTime(this.muffled ? MUFFLED : CUTOFF[this.groove.intensity], time, constant);
  }

  private applyStyleVoice(id: StyleId) {
    const s = styleById(id);
    this.synth.options = { ...this.synth.options, bassWave: s.bassWave, leadWave: s.leadWave, bell: 12 * 6 + s.key };
  }
}
