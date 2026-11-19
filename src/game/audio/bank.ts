import { SYNTHS, synthesize } from './synthesis';

export const SAMPLE_FILES = {
  rifle: 'rifle.ogg', smg: 'smg.ogg', sniper: 'sniper.ogg', shotgun: 'shotgun.ogg',
  magOut: 'mag-out.ogg', magIn: 'mag-in.ogg', bolt: 'bolt.ogg',
  step0: 'step-0.ogg', step1: 'step-1.ogg', step2: 'step-2.ogg', step3: 'step-3.ogg',
  metal: 'metal.ogg', slap: 'slap.ogg', debris: 'debris.ogg',
} as const;

export class SoundBank {
  readonly buffers = new Map<string, AudioBuffer>();
  readonly failed: string[] = [];
  readonly ready: Promise<void>;

  constructor(ctx: AudioContext) {
    for (const [id, spec] of Object.entries(SYNTHS)) {
      const buffer = ctx.createBuffer(1, Math.ceil(spec.duration * ctx.sampleRate), ctx.sampleRate);
      buffer.copyToChannel(synthesize(spec, ctx.sampleRate), 0);
      this.buffers.set(id, buffer);
    }
    this.ready = Promise.all(Object.entries(SAMPLE_FILES).map(async ([id, file]) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/${file}`);
        if (!response.ok) throw new Error(String(response.status));
        this.buffers.set(id, await ctx.decodeAudioData(await response.arrayBuffer()));
      } catch {
        this.failed.push(file);
        console.warn(`[SIMBIOSE] áudio ${file}: usando síntese de reserva`);
      }
    })).then(() => {});
  }

  get(id: string) {
    return this.buffers.get(id) ?? this.buffers.get(id.startsWith('step') ? 'hurt' : 'click')!;
  }
}
