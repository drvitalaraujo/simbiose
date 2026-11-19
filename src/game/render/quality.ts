// Qualidade adaptativa: se o quadro ficar lento por um tempo, baixa a resolução e depois
// desliga o bloom (sensação de tiro > beleza). Nunca sobe de volta sozinha, para não oscilar.

/**
 * 0 = tudo ligado na resolução cheia · 1 = resolução 85% · 2 = resolução 70% (`?low`) e
 * sem oclusão e sem brilho do sol · 3 = resolução 60%, também sem bloom e sem brilho
 * do sol. O contorno de nanquim e a luz pintada do cenário nunca desligam (custam quase nada).
 */
export type QualityLevel = 0 | 1 | 2 | 3;

export const SLOW_MS = 22; // abaixo de ~45 fps
const SLOW_FOR = 2; // segundos seguidos lento antes de baixar
/**
 * Quadro mais longo que isso não é lentidão de GPU: é a aba voltando do segundo plano,
 * o navegador compilando shader ou a janela sendo arrastada. Esses quadros são ignorados.
 */
export const HITCH_MS = 250;

export interface QualityState {
  level: QualityLevel;
  avgMs: number;
  slowFor: number;
}

export interface QualitySettings {
  /** Multiplicador da resolução sobre o `pixelRatio` base. */
  scale: number;
  bloom: boolean;
  /** Amostras da oclusão ambiente de meia resolução (0 = desligada). */
  aoSamples: number;
  /** Brilho do sol na lente (5 leituras de profundidade por pixel). */
  glare: boolean;
}

const SETTINGS: Record<QualityLevel, QualitySettings> = {
  0: { scale: 1, bloom: true, aoSamples: 8, glare: true },
  1: { scale: 0.85, bloom: true, aoSamples: 8, glare: true },
  2: { scale: 0.7, bloom: true, aoSamples: 0, glare: false },
  3: { scale: 0.6, bloom: false, aoSamples: 0, glare: false },
};

export function qualitySettings(level: QualityLevel): QualitySettings {
  return SETTINGS[level];
}

/**
 * GPU integrada/móvel (Intel, AMD APU, Mali, Adreno, renderizador por software): começa
 * com `pixelRatio` 1, mesmo em tela de alta densidade.
 */
export function isWeakGpu(rendererName: string): boolean {
  return /intel|mali|adreno|powervr|swiftshader|llvmpipe|software|microsoft basic|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics/i.test(rendererName);
}

/** `pixelRatio` do nível 0: 1 em GPU fraca, até 1.5 nas outras. */
export function basePixelRatio(devicePixelRatio: number, weakGpu: boolean): number {
  return weakGpu ? 1 : Math.min(devicePixelRatio, 1.5);
}

export function initialQuality(search: string): QualityState {
  const low = new URLSearchParams(search).has('low');
  return { level: low ? 2 : 0, avgMs: 16, slowFor: 0 };
}

/** Atualiza a média de tempo de quadro e decide se é hora de baixar um nível. */
export function stepQuality(s: QualityState, frameMs: number, dt: number): QualityState {
  if (frameMs > HITCH_MS) return s; // soluço (aba em segundo plano etc.): não conta
  const avgMs = s.avgMs + (frameMs - s.avgMs) * Math.min(1, dt * 3);
  const slowFor = avgMs > SLOW_MS ? s.slowFor + dt : 0;
  if (slowFor >= SLOW_FOR && s.level < 3) {
    return { level: (s.level + 1) as QualityLevel, avgMs: 16, slowFor: 0 };
  }
  return { level: s.level, avgMs, slowFor };
}
