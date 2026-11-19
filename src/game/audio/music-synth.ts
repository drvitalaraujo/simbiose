// Instrumentos da trilha sintetizados na hora com Web Audio (nenhum sample de terceiros).
// Poucos nós por nota (2 a 6) e um teto de vozes: percussão miúda é a primeira a cair.
import type { Instrument } from './music-patterns';

export const MAX_MUSIC_VOICES = 44;
const MINOR_INSTRUMENTS = new Set<Instrument>(['ganza', 'hat', 'tom', 'agogoLow', 'agogoHigh', 'tamborim']);

const freq = (note: number) => 440 * 2 ** ((note - 69) / 12);

export interface SynthOptions {
  bassWave?: OscillatorType;
  leadWave?: OscillatorType;
  /** Eco curto para lead e cavaco (a trilha principal liga; a roda distante não). */
  echo?: boolean;
  /** Nota-base do agogô (MIDI), afinada no tom do estilo. */
  bell?: number;
}

/** Um ruído branco de 1 s compartilhado por caixa, ganzá, chimbal e palmas. */
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x2f6e2b1;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 0x80000000 - 1;
    }
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

export class MusicSynth {
  active = 0;
  dropped = 0;
  private readonly echoIn: GainNode | null = null;
  private readonly delay: DelayNode | null = null;
  options: SynthOptions;

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode, options: SynthOptions = {}) {
    this.options = options;
    if (options.echo) {
      this.echoIn = ctx.createGain();
      this.echoIn.gain.value = 0.22;
      this.delay = ctx.createDelay(1.5);
      const feedback = ctx.createGain();
      feedback.gain.value = 0.32;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 2600;
      this.echoIn.connect(this.delay).connect(tone).connect(feedback).connect(this.delay);
      tone.connect(out);
    }
  }

  /** Eco em colcheia pontuada, acompanhando o andamento. */
  setEchoTime(stepSeconds: number) {
    if (this.delay) this.delay.delayTime.setTargetAtTime(Math.min(1.4, stepSeconds * 3), this.ctx.currentTime, 0.1);
  }

  /** Toca um evento; `step` é a duração de uma semicolcheia em segundos. */
  play(inst: Instrument, time: number, vel: number, notes: readonly number[], length: number, step: number) {
    if (this.active >= MAX_MUSIC_VOICES + 10 || (this.active >= MAX_MUSIC_VOICES && MINOR_INSTRUMENTS.has(inst))) {
      this.dropped++;
      return;
    }
    const dur = Math.max(0.05, length * step);
    switch (inst) {
      case 'surdo': return this.drum(time, vel, 84, 50, 0.6, 'sine', 1);
      case 'surdoMute': return this.drum(time, vel * 0.7, 80, 58, 0.11, 'sine', 1);
      case 'kick': return this.drum(time, vel, 150, 44, 0.32, 'sine', 1.1);
      case 'tom': return this.drum(time, vel, 210, 125, 0.22, 'sine', 0.75);
      case 'repique': return this.drum(time, vel, 560, 430, 0.08, 'triangle', 0.4);
      case 'tamborim': return this.drum(time, vel, 980, 840, 0.05, 'triangle', 0.3);
      case 'snare': return this.noise(time, vel * 0.55, 'highpass', 1600, 0.7, 0.13);
      case 'clap': return this.clap(time, vel * 0.5);
      case 'ganza': return this.noise(time, vel * 0.22, 'highpass', 5200, 0.7, 0.05, 0.012);
      case 'hat': return this.noise(time, vel * 0.18, 'highpass', 8000, 0.7, 0.035);
      case 'agogoLow': return this.bell(time, vel, 0);
      case 'agogoHigh': return this.bell(time, vel, 7);
      case 'bass': return this.bass(time, vel, notes[0], dur);
      case 'pad': return this.pad(time, vel, notes, dur);
      case 'pluck': return this.pluck(time, vel, notes);
      case 'lead': return this.lead(time, vel, notes[0], dur);
    }
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.active++;
    source.onended = () => {
      this.active--;
      for (const n of nodes) n.disconnect();
    };
  }

  private envelope(gain: GainNode, time: number, peak: number, attack: number, decay: number) {
    const g = gain.gain;
    g.setValueAtTime(0, time);
    g.linearRampToValueAtTime(peak, time + attack);
    g.exponentialRampToValueAtTime(0.0008, time + attack + decay);
  }

  /** Tambores: senoide/triângulo com queda de afinação (surdo, bumbo, atabaque, repique). */
  private drum(time: number, vel: number, from: number, to: number, decay: number, wave: OscillatorType, level: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.exponentialRampToValueAtTime(to, time + Math.min(decay, 0.18));
    this.envelope(gain, time, vel * level, 0.003, decay);
    osc.connect(gain).connect(this.out);
    osc.start(time); osc.stop(time + decay + 0.02);
    this.track(osc, [osc, gain]);
  }

  private noise(time: number, vel: number, type: BiquadFilterType, cutoff: number, q: number, decay: number, attack = 0.002) {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = cutoff; filter.Q.value = q;
    const gain = this.ctx.createGain();
    this.envelope(gain, time, vel, attack, decay);
    src.connect(filter).connect(gain).connect(this.out);
    src.start(time, Math.random() * 0.8); src.stop(time + attack + decay + 0.02);
    this.track(src, [src, filter, gain]);
  }

  /** Palmas: três estalos de ruído em bandpass e uma cauda curta. */
  private clap(time: number, vel: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1150; filter.Q.value = 1.1;
    const gain = this.ctx.createGain();
    const g = gain.gain;
    g.setValueAtTime(0, time);
    for (let i = 0; i < 3; i++) {
      g.setValueAtTime(vel, time + i * 0.011);
      g.exponentialRampToValueAtTime(vel * 0.2, time + i * 0.011 + 0.009);
    }
    g.setValueAtTime(vel * 0.8, time + 0.033);
    g.exponentialRampToValueAtTime(0.0008, time + 0.2);
    src.connect(filter).connect(gain).connect(this.out);
    src.start(time, Math.random() * 0.7); src.stop(time + 0.22);
    this.track(src, [src, filter, gain]);
  }

  /** Agogô: duas parciais inarmônicas, afinado no tom (boca grave e quinta acima). */
  private bell(time: number, vel: number, semis: number) {
    const f = freq((this.options.bell ?? 74) + semis);
    const a = this.ctx.createOscillator();
    const b = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    a.frequency.value = f; b.frequency.value = f * 2.76;
    this.envelope(gain, time, vel * 0.13, 0.002, 0.28);
    a.connect(gain); b.connect(gain); gain.connect(this.out);
    a.start(time); b.start(time); a.stop(time + 0.32); b.stop(time + 0.32);
    this.track(a, [a, b, gain]);
  }

  private bass(time: number, vel: number, note: number, dur: number) {
    const wave = this.options.bassWave ?? 'triangle';
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = wave;
    const f = freq(note);
    if (wave === 'sine') { // 808: ataque caindo de cima
      osc.frequency.setValueAtTime(f * 1.9, time);
      osc.frequency.exponentialRampToValueAtTime(f, time + 0.05);
    } else osc.frequency.value = f;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(wave === 'sine' ? 600 : 1300, time);
    filter.frequency.exponentialRampToValueAtTime(wave === 'sine' ? 300 : 320, time + Math.min(dur, 0.3));
    const peak = vel * (wave === 'sine' ? 0.5 : wave === 'sawtooth' ? 0.2 : 0.38);
    const g = gain.gain;
    g.setValueAtTime(0, time);
    g.linearRampToValueAtTime(peak, time + 0.006);
    g.setTargetAtTime(peak * 0.6, time + 0.02, 0.15);
    g.setTargetAtTime(0, time + dur * 0.9, 0.04);
    osc.connect(filter).connect(gain).connect(this.out);
    osc.start(time); osc.stop(time + dur + 0.25);
    this.track(osc, [osc, filter, gain]);
  }

  /** Pad: serras levemente desafinadas num único filtro e envelope lento. */
  private pad(time: number, vel: number, notes: readonly number[], dur: number) {
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'lowpass'; filter.frequency.value = 1100; filter.Q.value = 0.4;
    const peak = vel * 0.05;
    const g = gain.gain;
    g.setValueAtTime(0, time);
    g.linearRampToValueAtTime(peak, time + Math.min(0.5, dur * 0.3));
    g.setTargetAtTime(0, time + dur, 0.25);
    filter.connect(gain).connect(this.out);
    const nodes: AudioNode[] = [filter, gain];
    let first: OscillatorNode | null = null;
    notes.forEach((note, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq(note);
      osc.detune.value = i % 2 ? 7 : -7;
      osc.connect(filter);
      osc.start(time); osc.stop(time + dur + 1.2);
      nodes.push(osc);
      first ??= osc;
    });
    if (first) this.track(first, nodes);
  }

  /** Cavaco: notas curtas e brilhantes; acordes saem rasgueados (12 ms entre cordas). */
  private pluck(time: number, vel: number, notes: readonly number[]) {
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'lowpass'; filter.Q.value = 2;
    filter.frequency.setValueAtTime(4200, time);
    filter.frequency.exponentialRampToValueAtTime(700, time + 0.22);
    this.envelope(gain, time, vel * (notes.length > 1 ? 0.07 : 0.11), 0.002, 0.3);
    filter.connect(gain).connect(this.out);
    if (this.echoIn) gain.connect(this.echoIn);
    const nodes: AudioNode[] = [filter, gain];
    let first: OscillatorNode | null = null;
    notes.forEach((note, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq(note + 12);
      osc.connect(filter);
      osc.start(time + i * 0.012); osc.stop(time + 0.4);
      nodes.push(osc);
      first ??= osc;
    });
    if (first) this.track(first, nodes);
  }

  /** Lead: entra com uma "puxada" de afinação (cara de anime) e vai para o eco. */
  private lead(time: number, vel: number, note: number, dur: number) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = this.options.leadWave ?? 'square';
    osc.frequency.value = freq(note);
    osc.detune.setValueAtTime(-45, time);
    osc.detune.linearRampToValueAtTime(0, time + 0.06);
    filter.type = 'lowpass'; filter.frequency.value = osc.type === 'triangle' ? 5000 : 2400;
    const peak = vel * (osc.type === 'triangle' ? 0.12 : 0.06);
    const g = gain.gain;
    g.setValueAtTime(0, time);
    g.linearRampToValueAtTime(peak, time + 0.012);
    g.setTargetAtTime(peak * 0.7, time + 0.05, 0.2);
    g.setTargetAtTime(0, time + dur, 0.06);
    osc.connect(filter).connect(gain).connect(this.out);
    if (this.echoIn) gain.connect(this.echoIn);
    osc.start(time); osc.stop(time + dur + 0.4);
    this.track(osc, [osc, filter, gain]);
  }
}
