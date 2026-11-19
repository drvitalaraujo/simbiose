// Trilha + ambiente sobre o AudioMixer. Um timer de 25 ms (só agenda; o tempo musical é o
// relógio do AudioContext). Começa quando o mixer destrava no primeiro gesto e para com a
// aba em segundo plano. Quem liga aos eventos do jogo é soundtrack-links.ts.
import { Ambience } from './ambience';
import { Music } from './music';
import { targetIntensity, type Intensity, type MusicContext, type StingerKind, type StyleId } from './music-patterns';
import type { AudioMixer } from './mixer';

const LOOKAHEAD = 0.14;
const TICK_MS = 25;

export type ContextProvider = () => Omit<MusicContext, 'sinceCombat'> & { style?: StyleId | null; scene?: StyleId | null };

export class Soundtrack {
  private music: Music | null = null;
  private ambience: Ambience | null = null;
  private wanted: StyleId = 'menu';
  private scene: StyleId | null = null;
  private lastCombat = -Infinity;
  private dead = false;
  private deferred: StingerKind | null = null;
  private provider: ContextProvider | null = null;
  private providedAt = 0;
  private extra: ReturnType<ContextProvider> = {};
  private timer: ReturnType<typeof setInterval> | null;
  private running = false;

  constructor(private readonly mixer: AudioMixer) {
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Estado para testes no navegador (`window.__music` em `?debug`). */
  get style(): StyleId { return this.music?.style ?? this.wanted; }
  get intensity(): Intensity { return this.music?.intensity ?? 0; }
  get target(): Intensity { return this.music?.targetIntensity ?? 0; }
  get playing() { return this.running; }
  get state() {
    return {
      style: this.style, intensity: this.intensity, target: this.target, playing: this.playing,
      muffled: this.dead, bar: this.music?.bar ?? 0, ambience: this.ambience?.stats ?? null,
      voices: this.music?.synth.active ?? 0, dropped: this.music?.synth.dropped ?? 0,
      volume: this.mixer.musicLevel, lastStinger: this.music?.lastStinger ?? null,
    };
  }

  setStyle(id: StyleId) { this.wanted = id; this.music?.setStyle(id); }
  /** Ambiente do mapa (`null` = sem ambiente, ex.: menu). */
  setScene(id: StyleId | null) { this.scene = id; this.ambience?.setScene(id); }
  setVolume(value: number) { this.mixer.setMusicVolume(value); }
  setContext(provider: ContextProvider | null) { this.provider = provider; this.providedAt = 0; }

  /** Você atirou, acertou ou levou tiro: combate por ~6 s. */
  combat() { this.lastCombat = performance.now() / 1000; }
  get sinceCombat() { return performance.now() / 1000 - this.lastCombat; }

  setDead(dead: boolean) { this.dead = dead; this.music?.setMuffled(dead); }

  stinger(kind: StingerKind) {
    if (this.music && this.running) this.music.stinger(kind);
    else if (kind !== 'kill') this.deferred = kind;
  }

  private tick() {
    const ctx = this.mixer.context;
    const buses = this.mixer.buses;
    if (!ctx || !buses || ctx.state !== 'running') return;
    if (!this.music) {
      this.music = new Music(ctx, buses.music, this.wanted);
      this.ambience = new Ambience(ctx, buses.ambience, (p, r) => this.mixer.spatial(p, r));
      this.ambience.setScene(this.scene);
    }
    if (document.hidden) { this.halt(); return; }
    const now = ctx.currentTime;
    if (this.provider && now >= this.providedAt) {
      this.providedAt = now + 0.25;
      this.extra = this.provider();
      if (this.extra.style && this.extra.style !== this.wanted) this.setStyle(this.extra.style);
      if (this.extra.scene !== undefined && this.extra.scene !== this.scene) this.setScene(this.extra.scene);
    }
    this.music.setIntensity(targetIntensity({ ...this.extra, sinceCombat: this.sinceCombat }));
    this.ambience!.pump(now, now + LOOKAHEAD);
    if (this.mixer.musicLevel <= 0) { this.halt(); return; }
    this.music.pump(now, now + LOOKAHEAD);
    if (!this.running) {
      this.running = true;
      this.music.setMuffled(this.dead);
    }
    if (this.deferred) { this.music.stinger(this.deferred); this.deferred = null; }
  }

  private halt() {
    if (!this.running) return;
    this.running = false;
    this.music?.halt();
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.music?.halt();
    this.ambience?.stop();
  }
}
