// Ambiente sonoro por mapa, sempre baixo no mix (passos e tiros vêm primeiro):
// vento e cidade ao longe em todos; pássaros e sino no Pelourinho; burburinho e roda de
// samba no Terraço do Choro (Lapa); rádio abafado numa laje da Favela; neon e drones no Bairro.
import type { Vec3 } from '../../sim/vec';
import { Groove } from './music-groove';
import type { StyleId, Track } from './music-patterns';
import { MusicSynth, noiseBuffer } from './music-synth';

export type Spatial = (position: Vec3, range: number) => { gain: number; cutoff: number };

/** Pontos de onde vem o som posicionado (coordenadas dos mapas competitivos). */
export const EMITTERS = {
  roda: { x: 16.5, y: 2.5, z: 33 }, // Terraço do Choro, Lapa
  radio: { x: 16, y: 5.5, z: 10 }, // laje do Varal, Favela
} as const;

interface Emitter { position: Vec3; range: number; level: number; filter: BiquadFilterNode; gain: GainNode; input: GainNode }

interface Scene {
  id: StyleId;
  gain: GainNode;
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  emitters: Emitter[];
  grooves: Groove[];
  next: Record<string, number>;
}

const RODA = new Set(['pluck', 'surdo', 'tamborim', 'ganza']);

export class Ambience {
  private scene: Scene | null = null;
  private spatialAt = 0;

  constructor(private readonly ctx: AudioContext, private readonly out: AudioNode, private readonly spatial: Spatial) {}

  get id() { return this.scene?.id ?? null; }
  get stats() { return { scene: this.id, emitters: this.scene?.emitters.map(e => +e.gain.gain.value.toFixed(3)) ?? [] }; }

  /** Troca o ambiente com fade; `null` desliga (menu). */
  setScene(id: StyleId | null) {
    if ((this.scene?.id ?? null) === id) return;
    if (this.scene) this.teardown(this.scene);
    this.scene = id && id !== 'menu' ? this.build(id) : null;
  }

  /** Agenda os eventos (relógio do áudio) e atualiza o som posicionado ~6x por segundo. */
  pump(now: number, horizon: number) {
    const s = this.scene;
    if (!s) return;
    for (const g of s.grooves) g.pump(now, horizon);
    if (now >= this.spatialAt) {
      this.spatialAt = now + 0.16;
      for (const e of s.emitters) {
        const space = this.spatial(e.position, e.range);
        e.gain.gain.setTargetAtTime(space.gain * e.level, now, 0.25);
        e.filter.frequency.setTargetAtTime(Math.min(space.cutoff, 6000), now, 0.25);
      }
    }
    const due = (key: string, min: number, max: number) => {
      if (now < s.next[key]) return false;
      s.next[key] = now + min + Math.random() * (max - min);
      return true;
    };
    if (s.id === 'pelourinho') {
      if (due('bird', 1.2, 4.5)) this.bird(s, now + 0.05);
      if (due('bell', 22, 40)) this.churchBell(s, now + 0.05);
    }
    if (s.id === 'bairro' && due('drone', 7, 15)) this.droneFlyby(s, now + 0.05);
    if (s.id === 'favela' && due('moto', 14, 26)) this.flyby(s, now + 0.05, 'triangle', 85, 130, 0.014, 3.2);
  }

  stop() { if (this.scene) this.teardown(this.scene); this.scene = null; }

  private build(id: StyleId): Scene {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    gain.connect(this.out);
    const now = ctx.currentTime;
    const s: Scene = { id, gain, nodes: [gain], sources: [], emitters: [], grooves: [], next: { bird: now + 1, bell: now + 8, drone: now + 3, moto: now + 6 } };
    // Vento: ruído num passa-banda que passeia devagar.
    const wind = this.loop(s, 'bandpass', 480, 0.5, id === 'bairro' ? 0.02 : 0.03);
    this.lfo(s, 0.07, 260, wind.filter.frequency);
    this.lfo(s, 0.045, 0.012, wind.gain.gain);
    // Cidade ao longe: ronco grave.
    this.loop(s, 'lowpass', 170, 0.7, id === 'bairro' ? 0.06 : 0.04);
    if (id === 'bairro') {
      // Zumbido de neon com leve tremulação.
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth'; osc.frequency.value = 120;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 380;
      const hum = ctx.createGain(); hum.gain.value = 0.006;
      osc.connect(filter).connect(hum).connect(gain);
      osc.start();
      s.sources.push(osc); s.nodes.push(osc, filter, hum);
      this.lfo(s, 3.1, 0.002, hum.gain);
    }
    if (id === 'lapa') {
      // Burburinho e roda de samba vindos do Terraço do Choro.
      const e = this.emitter(s, EMITTERS.roda, 48, 0.9);
      const crowd = this.loop(s, 'bandpass', 650, 0.8, 0.045, e.input);
      this.lfo(s, 0.23, 0.02, crowd.gain.gain);
      const synth = new MusicSynth(ctx, e.input, { bassWave: 'triangle', bell: 74 });
      s.grooves.push(this.groove('lapa', synth, t => RODA.has(t.inst)));
    }
    if (id === 'favela') {
      // Rádio de pilha numa laje: o funk do mapa passando por um alto-falante pequeno.
      const e = this.emitter(s, EMITTERS.radio, 36, 1.1);
      const speaker = ctx.createBiquadFilter();
      speaker.type = 'bandpass'; speaker.frequency.value = 1500; speaker.Q.value = 0.9;
      const drive = ctx.createGain(); drive.gain.value = 1.6;
      drive.connect(speaker).connect(e.input);
      s.nodes.push(speaker, drive);
      const synth = new MusicSynth(ctx, drive, { bassWave: 'sine', leadWave: 'square', bell: 77 });
      s.grooves.push(this.groove('favela', synth));
    }
    return s;
  }

  private groove(id: StyleId, synth: MusicSynth, only?: (t: Track) => boolean) {
    const g = new Groove(id, synth, only);
    g.intensity = 1;
    g.nextTime = this.ctx.currentTime + 0.5;
    return g;
  }

  private loop(s: Scene, type: BiquadFilterType, cutoff: number, q: number, level: number, out: AudioNode = s.gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx); src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = cutoff; filter.Q.value = q;
    const gain = this.ctx.createGain(); gain.gain.value = level;
    src.connect(filter).connect(gain).connect(out);
    src.start(this.ctx.currentTime, Math.random());
    s.sources.push(src); s.nodes.push(src, filter, gain);
    return { filter, gain };
  }

  private lfo(s: Scene, rate: number, depth: number, param: AudioParam) {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = rate;
    const amount = this.ctx.createGain(); amount.gain.value = depth;
    osc.connect(amount).connect(param);
    osc.start();
    s.sources.push(osc); s.nodes.push(osc, amount);
  }

  /** Fonte posicionada: volume e abafamento vêm do mixer (distância e paredes). */
  private emitter(s: Scene, position: Vec3, range: number, level: number): Emitter {
    const ctx = this.ctx;
    const input = ctx.createGain();
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2000;
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower'; panner.rolloffFactor = 0;
    panner.setPosition(position.x, position.y, position.z);
    const gain = ctx.createGain(); gain.gain.value = 0;
    input.connect(filter).connect(panner).connect(gain).connect(s.gain);
    s.nodes.push(input, filter, panner, gain);
    const e = { position, range, level, filter, gain, input };
    s.emitters.push(e);
    this.spatialAt = 0;
    return e;
  }

  /** Um evento curto com oscilador: liga, toca e se desmonta sozinho. */
  private voice(s: Scene, time: number, dur: number, wave: OscillatorType, pan: number) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.type = wave;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const panner = ctx.createStereoPanner(); panner.pan.value = pan;
    osc.connect(gain).connect(panner).connect(s.gain);
    osc.start(time); osc.stop(time + dur + 0.05);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); panner.disconnect(); };
    return { osc, gain, panner };
  }

  private bird(s: Scene, time: number) {
    const pan = Math.random() * 1.6 - 0.8;
    const base = 2400 + Math.random() * 1400;
    const notes = 2 + Math.floor(Math.random() * 3);
    const { osc, gain } = this.voice(s, time, notes * 0.11, 'sine', pan);
    for (let i = 0; i < notes; i++) {
      const t = time + i * 0.11;
      osc.frequency.setValueAtTime(base * (1 + (i % 2) * 0.12), t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.06);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.012);
      gain.gain.linearRampToValueAtTime(0, t + 0.08);
    }
  }

  /** Sino de igreja distante (duas parciais). */
  private churchBell(s: Scene, time: number) {
    for (const [f, level] of [[196, 0.012], [196 * 2.4, 0.005]] as const) {
      const { osc, gain } = this.voice(s, time, 4, 'sine', -0.3);
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(level, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 4);
    }
  }

  private droneFlyby(s: Scene, time: number) { this.flyby(s, time, 'triangle', 620, 780, 0.007, 3); }

  /** Passagem de um lado a outro (drone no Bairro, moto ao longe na Favela). */
  private flyby(s: Scene, time: number, wave: OscillatorType, from: number, peak: number, level: number, dur: number) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const { osc, gain, panner } = this.voice(s, time, dur, wave, -0.8 * side);
    osc.frequency.setValueAtTime(from, time);
    osc.frequency.linearRampToValueAtTime(peak, time + dur * 0.45);
    osc.frequency.linearRampToValueAtTime(from * 0.92, time + dur);
    panner.pan.linearRampToValueAtTime(0.8 * side, time + dur);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + dur * 0.45);
    gain.gain.linearRampToValueAtTime(0, time + dur);
  }

  private teardown(s: Scene) {
    const now = this.ctx.currentTime;
    s.gain.gain.cancelScheduledValues(now);
    s.gain.gain.setTargetAtTime(0, now, 0.3);
    s.grooves.length = 0;
    // Relógio só de limpeza (o som já sumiu no fade).
    setTimeout(() => {
      for (const src of s.sources) { try { src.stop(); } catch { /* já parou */ } }
      for (const n of s.nodes) n.disconnect();
    }, 1600);
  }
}
