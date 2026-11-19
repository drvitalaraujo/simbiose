// Padrões da trilha: lógica pura (sem Web Audio), testada em music-patterns.test.ts.
// Cada estilo é um compasso 4/4 em 16 semicolcheias; as faixas entram por intensidade
// (0 calma, 1 combate, 2 tensão) e as mudanças só valem na virada do compasso.
import { STYLES } from './music-styles';

export type StyleId = 'menu' | 'bairro' | 'pelourinho' | 'lapa' | 'favela';
export type Intensity = 0 | 1 | 2;
export type Instrument =
  | 'surdo' | 'surdoMute' | 'kick' | 'tom' | 'snare' | 'clap' | 'repique' | 'tamborim'
  | 'agogoLow' | 'agogoHigh' | 'ganza' | 'hat' | 'bass' | 'pad' | 'pluck' | 'lead';
export type ChordQuality = 'm' | 'M' | 'm7' | 'maj7' | '7' | 'm9';
export type StingerKind = 'start' | 'kill' | 'win' | 'lose';

export interface Chord { root: number; quality: ChordQuality }

/**
 * Uma faixa. `pattern` tem 16 caracteres por compasso (espaços e `|` só ajudam a ler) e
 * toca em ciclo. Percussão: X forte, x normal, g fantasma, o/O instrumento `alt`.
 * Harmonia (bass/pad/pluck): 1 3 5 7 = notas do acorde, 8 = tônica uma oitava acima,
 * 9 = nona, x/X = acorde inteiro. Com `scale`, 0-9 e a-e são graus da escala.
 * `-` prolonga a nota anterior; `.` é pausa.
 */
export interface Track {
  inst: Instrument;
  pattern: string;
  min: Intensity;
  max?: Intensity;
  gain?: number;
  alt?: Instrument;
  scale?: boolean;
  octave?: number;
}

export interface Style {
  id: StyleId;
  name: string;
  bpm: number;
  /** Atraso das semicolcheias ímpares, em fração do passo (balanço do samba). */
  swing: number;
  key: number;
  scale: readonly number[];
  chords: readonly Chord[];
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  tracks: readonly Track[];
}

export interface NoteEvent {
  inst: Instrument;
  step: number;
  vel: number;
  /** Notas MIDI (vazio para percussão). */
  notes: number[];
  /** Duração em passos (semicolcheias). */
  length: number;
}

export const STEPS = 16;
export const COMBAT_WINDOW = 6;
export const TENSION_TIME = 60;
export const TENSION_BPM = 1.05;

const INTERVALS: Record<ChordQuality, readonly number[]> = {
  m: [0, 3, 7, 12], M: [0, 4, 7, 12], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '7': [0, 4, 7, 10], m9: [0, 3, 7, 10, 14],
};
const TONE: Record<string, number> = { '1': 0, '3': 1, '5': 2, '7': 3 };
const HARMONIC = new Set<Instrument>(['bass', 'pad', 'pluck', 'lead']);

const cleaned = new Map<string, string>();
/** Tira espaços e barras (só servem para ler o padrão). */
export function clean(pattern: string): string {
  let c = cleaned.get(pattern);
  if (c === undefined) { c = pattern.replace(/[ |]/g, ''); cleaned.set(pattern, c); }
  return c;
}

export const midi = (octave: number, pitch: number) => 12 * (octave + 1) + pitch;
export const stepDuration = (bpm: number) => 60 / bpm / 4;
export const barDuration = (bpm: number) => stepDuration(bpm) * STEPS;
/** Andamento efetivo: na tensão a música acelera um pouco. */
export const tempo = (style: Style, intensity: Intensity) => style.bpm * (intensity === 2 ? TENSION_BPM : 1);

export function chordAt(style: Style, bar: number): Chord {
  return style.chords[((bar % style.chords.length) + style.chords.length) % style.chords.length];
}

export function chordNotes(chord: Chord, octave: number): number[] {
  return INTERVALS[chord.quality].slice(0, 4).map(i => midi(octave, chord.root) + i);
}

function chordTone(chord: Chord, ch: string, octave: number): number | null {
  const base = midi(octave, chord.root);
  const iv = INTERVALS[chord.quality];
  if (ch === '8') return base + 12;
  if (ch === '9') return base + 14;
  const index = TONE[ch];
  return index === undefined ? null : base + iv[index];
}

export function scaleNote(style: Style, degree: number, octave: number): number {
  const n = style.scale.length;
  return midi(octave, style.key) + 12 * Math.floor(degree / n) + style.scale[degree % n];
}

const VEL: Record<string, number> = { X: 1, x: 0.7, g: 0.35, o: 0.7, O: 1 };

export const trackActive = (track: Track, intensity: Intensity) => intensity >= track.min && intensity <= (track.max ?? 2);

/** Eventos de um compasso inteiro, ordenados por passo. */
export function barEvents(style: Style, bar: number, intensity: Intensity, only?: (t: Track) => boolean): NoteEvent[] {
  const out: NoteEvent[] = [];
  const chord = chordAt(style, bar);
  for (const track of style.tracks) {
    if (!trackActive(track, intensity) || (only && !only(track))) continue;
    const p = clean(track.pattern);
    const bars = Math.max(1, Math.floor(p.length / STEPS));
    const offset = (bar % bars) * STEPS;
    const octave = track.octave ?? (track.inst === 'bass' ? 2 : 4);
    for (let step = 0; step < STEPS; step++) {
      const ch = p[offset + step];
      if (ch === '.' || ch === '-' || ch === undefined) continue;
      let length = 1;
      while (step + length < STEPS && p[offset + step + length] === '-') length++;
      const accent = step % 4 === 0 ? 0.12 : 0;
      const gain = track.gain ?? 1;
      if (!HARMONIC.has(track.inst)) {
        const vel = VEL[ch];
        if (vel === undefined) continue;
        const inst = (ch === 'o' || ch === 'O') && track.alt ? track.alt : track.inst;
        out.push({ inst, step, vel: Math.min(1, vel + accent) * gain, notes: [], length });
        continue;
      }
      let notes: number[];
      if (ch === 'x' || ch === 'X') notes = chordNotes(chord, octave);
      else if (track.scale) {
        const degree = parseInt(ch, 16);
        if (Number.isNaN(degree)) continue;
        notes = [scaleNote(style, degree, octave)];
      } else {
        const note = chordTone(chord, ch, octave);
        if (note === null) continue;
        notes = [note];
      }
      if (track.inst === 'pad') length = Math.max(length, STEPS - step);
      out.push({ inst: track.inst, step, vel: Math.min(1, (ch === 'X' ? 1 : 0.75) + accent) * gain, notes, length });
    }
  }
  return out.sort((a, b) => a.step - b.step);
}

/** Virada de caixa nos 4 últimos passos quando a intensidade vai subir. */
export function fillEvents(intensity: Intensity): NoteEvent[] {
  const inst: Instrument = 'snare';
  const base = intensity >= 1 ? 0.5 : 0.35;
  return [12, 13, 14, 15].map((step, i) => ({ inst, step, vel: base + i * 0.12, notes: [], length: 1 }));
}

/** Próximo múltiplo de `grid` (a partir de `origin`) que ainda não passou. */
export function quantize(now: number, origin: number, grid: number): number {
  if (grid <= 0) return now;
  const n = Math.ceil((now - origin) / grid - 1e-9);
  return origin + Math.max(0, n) * grid;
}

export interface StingerNote { inst: Instrument; offset: number; vel: number; notes: number[]; length: number }

/** Vinhetas curtas no tom do estilo. `offset` em passos depois do ponto quantizado. */
export function stinger(kind: StingerKind, style: Style): StingerNote[] {
  const root = midi(4, style.key);
  const n = (inst: Instrument, offset: number, vel: number, notes: number[], length = 1): StingerNote => ({ inst, offset, vel, notes, length });
  switch (kind) {
    case 'start': // "VALENDO!": rufo de caixa, surdo e acorde subindo
      return [n('snare', 0, 0.4, []), n('snare', 1, 0.55, []), n('snare', 2, 0.7, []), n('snare', 3, 0.85, []),
        n('surdo', 4, 1, []), n('agogoHigh', 4, 0.6, []),
        n('lead', 4, 0.8, [root + 12]), n('lead', 5, 0.8, [root + 19]), n('lead', 6, 0.9, [root + 24], 4),
        n('pad', 4, 0.7, [root, root + 7, root + 12, root + 14], 12)];
    case 'kill': // acento sutil: duas notas de cavaco
      return [n('pluck', 0, 0.45, [root + 19]), n('pluck', 1, 0.5, [root + 24])];
    case 'win':
      return [n('surdo', 0, 1, []), n('lead', 0, 0.85, [root + 12]), n('lead', 2, 0.85, [root + 16]),
        n('lead', 4, 0.9, [root + 19]), n('lead', 6, 1, [root + 24], 8), n('agogoLow', 0, 0.6, []), n('agogoHigh', 2, 0.6, []),
        n('agogoLow', 4, 0.6, []), n('agogoHigh', 6, 0.7, []), n('pad', 6, 0.8, [root, root + 4, root + 7, root + 12], 16)];
    case 'lose':
      return [n('lead', 0, 0.6, [root + 12]), n('lead', 3, 0.55, [root + 10]), n('lead', 6, 0.5, [root + 7]),
        n('lead', 9, 0.5, [root + 3], 8), n('surdoMute', 9, 0.6, []), n('pad', 9, 0.55, [root - 12, root + 3, root + 7], 16)];
  }
}

export interface MusicContext {
  /** Segundos desde o último tiro/acerto/dano seu (Infinity se nunca). */
  sinceCombat: number;
  /** Segundos que faltam na partida (null no treino). */
  timeLeft?: number | null;
  /** Abates que faltam para alguém fechar a partida (null se não se aplica). */
  leaderGap?: number | null;
  /** Limiar de `leaderGap` para a tensão (padrão 3). */
  gapThreshold?: number;
  /** Chefe em campo (treino). */
  boss?: boolean;
  /** Fora de jogo (tela de fim, aguardando): sempre calma. */
  idle?: boolean;
}

/** Intensidade desejada; quem toca só aplica na virada do compasso. */
export function targetIntensity(c: MusicContext): Intensity {
  if (c.idle) return 0;
  const lastMinute = c.timeLeft != null && c.timeLeft > 0 && c.timeLeft <= TENSION_TIME;
  const close = c.leaderGap != null && c.leaderGap >= 0 && c.leaderGap <= (c.gapThreshold ?? 3);
  if (lastMinute || close || c.boss) return 2;
  return c.sinceCombat <= COMBAT_WINDOW ? 1 : 0;
}

/** Quantos abates antes do limite a tensão começa (duelo curto não fica tenso o tempo todo). */
export function gapThreshold(limit: number, mode = 'ffa'): number {
  if (mode === 'hack') return Math.max(3, Math.ceil(limit * 0.1));
  return Math.max(1, Math.min(3, Math.floor(limit / 4)));
}

/** Estilo da trilha para o id do mapa (do menu, da URL ou do servidor). */
export function styleForMap(mapId: string | null | undefined): StyleId {
  if (mapId === 'pelourinho' || mapId === 'arena1') return 'pelourinho';
  if (mapId === 'patacho') return 'pelourinho';
  if (mapId === 'lapa' || mapId === 'favela') return mapId;
  return 'bairro';
}

export const styleById = (id: StyleId): Style => STYLES[id];

/** Notas por compasso médias (para teste e para depurar a densidade). */
export function density(style: Style, intensity: Intensity, bars = 8): number {
  let total = 0;
  for (let bar = 0; bar < bars; bar++) total += barEvents(style, bar, intensity).length;
  return total / bars;
}
