import type { Vec3 } from '../../sim/vec';
import { SoundBank } from './bank';
import { audibility, MAX_VOICES, useHrtf, voiceToSteal } from './policy';

const MUSIC_LEVEL = 0.3;
const AMBIENCE_LEVEL = 1;

export interface SoundLayer { id: string; gain: number; rate?: number; delay?: number }
export interface SoundOptions { position?: Vec3; range?: number; priority?: number; gain?: number; bus?: 'world' | 'feedback'; duck?: number; reserveHrtf?: boolean }
interface Voice {
  key: string; priority: number; started: number; hrtf: boolean;
  sources: AudioBufferSourceNode[]; nodes: AudioNode[]; gate: GainNode;
}

/** Une todas as camadas de um evento em uma voz; corta excesso sem perder acertos. */
export class AudioMixer {
  private ctx: AudioContext | null = null;
  private bank: SoundBank | null = null;
  private master: GainNode | null = null;
  private world: GainNode | null = null;
  private feedback: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  /** Trilha e ambiente passam por um "duck" que cede espaço a tiros e acertos perto. */
  private duckNode: GainNode | null = null;
  private music: GainNode | null = null;
  private ambience: GainNode | null = null;
  private musicVolume = 0.6;
  private duckedAt = -1;
  private readonly voices: Voice[] = [];
  private listener: Vec3 = { x: 0, y: 0, z: 0 };
  private canSee: (from: Vec3, to: Vec3) => boolean = () => true;
  private volume = 0.8;
  private disposed = false;
  private readonly onVisibility = () => {
    if (document.hidden) this.stopAll();
    else if (this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {});
    this.applyVolume();
  };

  /** Contexto de áudio (null até o primeiro gesto do jogador). */
  get context() { return this.ctx; }
  get buses() { return this.music && this.ambience ? { music: this.music, ambience: this.ambience } : null; }
  get ready() { return this.bank?.ready ?? Promise.resolve(); }
  get stats() {
    return { state: this.ctx?.state ?? 'locked', voices: this.voices.length, hrtf: this.voices.filter(v => v.hrtf).length,
      loaded: this.bank?.buffers.size ?? 0, failed: this.bank?.failed ?? [], volume: this.volume, maxVoices: MAX_VOICES,
      compressionDb: this.compressor?.reduction ?? 0, baseLatency: this.ctx?.baseLatency ?? 0 };
  }

  unlock() {
    if (this.disposed) return;
    if (!this.ctx) {
      const ctx = this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.master = ctx.createGain();
      this.world = ctx.createGain();
      this.feedback = ctx.createGain();
      this.world.gain.value = 0.9;
      this.feedback.gain.value = 1;
      const compressor = this.compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -8; compressor.knee.value = 6; compressor.ratio.value = 8;
      compressor.attack.value = 0.003; compressor.release.value = 0.12;
      this.world.connect(this.master); this.feedback.connect(this.master);
      this.duckNode = ctx.createGain();
      this.music = ctx.createGain();
      this.ambience = ctx.createGain();
      this.music.gain.value = this.musicVolume * MUSIC_LEVEL;
      this.ambience.gain.value = AMBIENCE_LEVEL;
      this.music.connect(this.duckNode); this.ambience.connect(this.duckNode);
      this.duckNode.connect(this.master);
      this.master.connect(compressor).connect(ctx.destination);
      this.bank = new SoundBank(ctx);
      document.addEventListener('visibilitychange', this.onVisibility);
      this.applyVolume();
    }
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
    // Safari também precisa iniciar uma fonte durante o gesto.
    const silence = this.ctx.createBufferSource();
    silence.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    silence.connect(this.master!); silence.onended = () => silence.disconnect(); silence.start();
  }

  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    this.applyVolume();
  }
  private applyVolume() {
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(document.hidden ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  /** Volume da trilha (preferência "Música"), de 0 a 1; o volume geral vale por cima. */
  setMusicVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.ctx && this.music) this.music.gain.setTargetAtTime(this.musicVolume * MUSIC_LEVEL, this.ctx.currentTime, 0.05);
  }
  get musicLevel() { return this.musicVolume; }

  /** Abaixa trilha e ambiente por um instante (ouvir a ameaça vem antes da música). */
  duck(depth = 0.5) {
    const ctx = this.ctx;
    if (!ctx || !this.duckNode || ctx.currentTime - this.duckedAt < 0.05) return;
    this.duckedAt = ctx.currentTime;
    const g = this.duckNode.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(1 - depth, ctx.currentTime, 0.012);
    g.setTargetAtTime(1, ctx.currentTime + 0.12, 0.35);
  }

  /** Volume e abafamento de uma fonte contínua (ambiente) vista do ouvinte, com paredes. */
  spatial(position: Vec3, range: number) {
    let space = audibility(this.listener, position, range, false);
    if (space.gain >= 0.008 && !this.canSee(this.listener, position)) space = audibility(this.listener, position, range, true);
    return space;
  }

  setOcclusion(canSee: (from: Vec3, to: Vec3) => boolean) { this.canSee = canSee; }

  updateListener(position: Vec3, forward: Vec3, up: Vec3, _quality: number) {
    this.listener = { ...position };
    const listener = this.ctx?.listener;
    if (!listener) return;
    // setPosition/setOrientation também funcionam no Safari sem AudioParam no listener.
    listener.setPosition(position.x, position.y, position.z);
    listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }

  play(key: string, layers: readonly SoundLayer[], options: SoundOptions = {}) {
    const { ctx, bank } = this;
    if (!ctx || !bank || ctx.state !== 'running' || document.hidden || this.volume === 0 || this.disposed) return;
    const position = options.position;
    // Descarta fora do alcance antes de consultar as caixas do mapa.
    let space = position ? audibility(this.listener, position, options.range ?? 60, false) : null;
    if (space && space.gain < 0.008) return;
    if (position && !this.canSee(this.listener, position)) space = audibility(this.listener, position, options.range ?? 60, true);
    if (space && space.gain < 0.008) return;
    const priority = options.priority ?? (position ? 4 : 7);
    if (layers.length === 0) return;
    const duck = options.duck ?? (priority >= 9 ? 0.55 : 0.4);
    if (duck > 0 && priority >= 5 && (space?.gain ?? 1) * (options.gain ?? 1) > 0.2) this.duck(duck);
    const same = this.voices.filter(v => v.key === key);
    if (same.length >= 4) this.release(same[0]);
    const steal = voiceToSteal(this.voices, priority);
    if (steal === -2) return;
    if (steal >= 0) this.release(this.voices[steal]);
    const gate = ctx.createGain();
    gate.gain.value = (options.gain ?? 1) * (space?.gain ?? 1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = space?.cutoff ?? 18000;
    gate.connect(filter);
    const nodes: AudioNode[] = [gate, filter];
    let output: AudioNode = filter;
    let hrtf = false;
    if (position) {
      const panner = ctx.createPanner();
      // Informação competitiva não depende da GPU. Reserva HRTF aos eventos relevantes;
      // detritos não ocupam as vagas usadas por passos e disparos.
      hrtf = useHrtf(priority, space!.distance, this.voices.filter(v => v.hrtf).length, options.reserveHrtf);
      panner.panningModel = hrtf ? 'HRTF' : 'equalpower';
      panner.rolloffFactor = 0; // a curva de alcance é aplicada no gate, uma única vez
      panner.setPosition(position.x, position.y, position.z);
      output.connect(panner); output = panner; nodes.push(panner);
    }
    output.connect(options.bus === 'feedback' ? this.feedback! : this.world!);
    const voice: Voice = { key, priority, started: ctx.currentTime, sources: [], nodes, gate, hrtf };
    this.voices.push(voice);
    let pending = layers.length;
    for (const layer of layers) {
      const source = ctx.createBufferSource(); source.buffer = bank.get(layer.id);
      source.playbackRate.value = layer.rate ?? 1;
      const gain = ctx.createGain(); gain.gain.value = layer.gain;
      source.connect(gain).connect(gate);
      voice.sources.push(source); voice.nodes.push(source, gain);
      source.onended = () => { if (--pending === 0) this.release(voice); };
      source.start(ctx.currentTime + (layer.delay ?? 0));
    }
  }

  private release(voice: Voice) {
    const index = this.voices.indexOf(voice);
    if (index < 0) return;
    this.voices.splice(index, 1);
    // Rampa curta antes de parar evita estalo no roubo de voz.
    const now = this.ctx!.currentTime;
    voice.gate.gain.setTargetAtTime(0, now, 0.003);
    for (const source of voice.sources) { source.onended = null; source.stop(now + 0.012); }
    // Relógio só de limpeza; sequenciamento musical usa o relógio do AudioContext.
    setTimeout(() => { for (const node of voice.nodes) node.disconnect(); }, 30);
  }
  stopAll() { for (const voice of [...this.voices]) this.release(voice); }
  dispose() {
    this.disposed = true; this.stopAll(); document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.ctx) void this.ctx.close();
  }
}
