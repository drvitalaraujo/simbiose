import type { Vec3 } from '../../sim/vec';

export const MAX_VOICES = 24;
export const MAX_HRTF = 8;

/** Duas vagas reservadas para passos, sem dar a eles preferência sobre tiros no roubo de voz. */
export function useHrtf(priority: number, distance: number, active: number, reserved = false): boolean {
  return priority >= 5 && distance < 32 && active < (reserved ? MAX_HRTF : MAX_HRTF - 2);
}

export interface VoiceRank { priority: number; started: number }

/** Só substitui uma voz de prioridade menor/igual; desempate pela mais antiga. */
export function voiceToSteal(voices: readonly VoiceRank[], priority: number, limit = MAX_VOICES): number {
  if (voices.length < limit) return -1;
  let candidate = 0;
  for (let i = 1; i < voices.length; i++) {
    if (voices[i].priority < voices[candidate].priority ||
        (voices[i].priority === voices[candidate].priority && voices[i].started < voices[candidate].started)) candidate = i;
  }
  return voices[candidate].priority <= priority ? candidate : -2;
}

/** Corte explícito: maxDistance do Panner sozinho não torna sons distantes inaudíveis. */
export function audibility(listener: Vec3, source: Vec3, range: number, blocked: boolean) {
  const distance = Math.hypot(source.x - listener.x, source.y - listener.y, source.z - listener.z);
  const fade = Math.max(0, 1 - (distance / range) ** 2);
  return { distance, gain: fade / (1 + distance / 9) * (blocked ? 0.42 : 1), cutoff: blocked ? 1700 : Math.max(2800, 18000 - distance * 180) };
}
