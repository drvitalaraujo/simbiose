// Sequenciador de um estilo no relógio do AudioContext (padrão "two clocks": um timer
// barato acorda a cada ~25 ms e agenda com antecedência as notas que caem na janela).
import { barEvents, STEPS, stepDuration, styleById, tempo, type Intensity, type NoteEvent, type StyleId, type Track } from './music-patterns';
import type { MusicSynth } from './music-synth';

export class Groove {
  bar = 0;
  step = 0;
  /** Hora (relógio do áudio) do próximo passo a agendar. */
  nextTime = 0;
  intensity: Intensity = 0;
  private events: NoteEvent[] = [];
  private cursor = 0;
  /** Chamado no início de cada compasso, antes de gerar as notas (troca de estilo/intensidade). */
  onBar: ((time: number) => void) | null = null;
  /** Chamado a cada passo agendado (viradas, vinhetas quantizadas). */
  onStep: ((step: number, time: number, stepSeconds: number) => void) | null = null;

  constructor(public style: StyleId, private readonly synth: MusicSynth, private readonly only?: (t: Track) => boolean) {}

  get stepSeconds() { return stepDuration(tempo(styleById(this.style), this.intensity)); }

  /** Recomeça do compasso 1 (troca de estilo). */
  restart() { this.bar = 0; this.step = 0; }

  /** Agenda tudo até `horizon`. Se o relógio passou à frente (aba voltou), ressincroniza. */
  pump(now: number, horizon: number) {
    if (this.nextTime < now) this.nextTime = now + 0.03;
    while (this.nextTime < horizon) {
      if (this.step === 0) {
        this.onBar?.(this.nextTime);
        this.events = barEvents(styleById(this.style), this.bar, this.intensity, this.only);
        this.cursor = 0;
      }
      const seconds = this.stepSeconds;
      const swing = this.step % 2 === 1 ? styleById(this.style).swing * seconds : 0;
      const time = this.nextTime + swing;
      while (this.cursor < this.events.length && this.events[this.cursor].step === this.step) {
        const e = this.events[this.cursor++];
        this.synth.play(e.inst, time, e.vel, e.notes, e.length, seconds);
      }
      this.onStep?.(this.step, this.nextTime, seconds);
      this.nextTime += seconds;
      if (++this.step >= STEPS) { this.step = 0; this.bar++; }
    }
  }
}
