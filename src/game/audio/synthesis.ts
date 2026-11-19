export interface SynthSpec {
  duration: number;
  noise?: number;
  from?: number;
  to?: number;
  tone?: number;
  decay?: number;
}

/** Buffers mono preparados uma vez; nenhuma síntese no caminho quente do disparo. */
export function synthesize(spec: SynthSpec, rate: number, random = Math.random): Float32Array<ArrayBuffer> {
  const data = new Float32Array(Math.ceil(spec.duration * rate));
  let phase = 0;
  let smooth = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    const progress = t / spec.duration;
    const frequency = (spec.from ?? 100) * ((spec.to ?? spec.from ?? 100) / (spec.from ?? 100)) ** progress;
    phase += 2 * Math.PI * frequency / rate;
    const white = random() * 2 - 1;
    smooth += (white - smooth) * 0.2;
    const attack = Math.min(1, t / 0.0015);
    const envelope = attack * Math.exp(-progress * (spec.decay ?? 7)) * Math.min(1, (1 - progress) * 30);
    data[i] = ((white * 0.65 + smooth * 0.35) * (spec.noise ?? 0) + Math.sin(phase) * (spec.tone ?? 0)) * envelope;
  }
  return data;
}

export const SYNTHS: Record<string, SynthSpec> = {
  crack: { duration: 0.07, noise: 0.9, decay: 9 },
  body: { duration: 0.2, from: 155, to: 42, tone: 0.65 },
  tail: { duration: 0.5, noise: 0.5, decay: 6 },
  click: { duration: 0.065, noise: 0.5, from: 700, to: 180, tone: 0.25, decay: 10 },
  whoosh: { duration: 0.24, noise: 0.6, decay: 3 },
  hit: { duration: 0.085, noise: 0.25, from: 1300, to: 900, tone: 0.3, decay: 8 },
  head: { duration: 0.15, from: 2400, to: 1700, tone: 0.3, noise: 0.08 },
  kill: { duration: 0.25, from: 740, to: 1480, tone: 0.35, noise: 0.04, decay: 5 },
  hurt: { duration: 0.22, from: 160, to: 55, tone: 0.5, noise: 0.2 },
  death: { duration: 0.7, from: 360, to: 55, tone: 0.25, noise: 0.12, decay: 4 },
  digital: { duration: 0.15, from: 660, to: 670, tone: 0.25 },
  charge: { duration: 0.35, from: 260, to: 1100, tone: 0.25, noise: 0.07, decay: 2 },
  explosion: { duration: 0.65, from: 85, to: 27, tone: 0.6, noise: 0.4, decay: 5 },
};
