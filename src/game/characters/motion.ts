// Movimento secundário do boneco em lógica pura (sem Three.js): molas, inclinação no strafe
// e nas curvas, coice por arma e envelopes de recarga. Tudo é apresentação: o acerto continua
// vindo só de `hitbox.ts`, então nada aqui pode mudar regra de jogo.

/** Mola amortecida de um valor só; estável com dt grande (subpassos de no máximo 1/120 s). */
export class Spring {
  value = 0;
  velocity = 0;
  constructor(
    /** Rigidez em Hz (quanto maior, mais rápido chega ao alvo). */
    readonly hz = 6,
    /** 1 = sem balanço; abaixo de 1 passa do alvo e volta. */
    readonly damping = 0.7,
  ) {}

  update(target: number, dt: number): number {
    const w = Math.PI * 2 * this.hz;
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (w * w * (target - this.value) - 2 * this.damping * w * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  /** Empurrão instantâneo (m/s ou rad/s, conforme o valor). */
  kick(impulse: number): void {
    this.velocity += impulse;
  }

  reset(): void {
    this.value = this.velocity = 0;
  }
}

/** Inclinação máxima do tronco para o lado (rad): leitura de strafe sem tirar a cabeça da hitbox. */
export const MAX_LEAN = 0.13;

/**
 * Quanto o tronco tomba para o lado: correndo de lado ele "deita" para dentro do movimento,
 * e numa curva rápida inclina para dentro da curva. `lateral` é a velocidade para a direita
 * da mira (m/s); `yawRate`, o giro da mira (rad/s, positivo = para a esquerda).
 * Positivo = tomba para a direita do personagem.
 */
export function leanTarget(lateral: number, yawRate: number): number {
  const v = lateral * 0.022 - yawRate * 0.03;
  return Math.max(-MAX_LEAN, Math.min(MAX_LEAN, v));
}

export interface RecoilFeel {
  /** Recuo da arma para trás ao longo do cano (m). */
  back: number;
  /** Cano sobe (rad). */
  rise: number;
  /** Tranco do tronco para trás (rad). */
  body: number;
  /** Quanto o coice dura (1/s de decaimento). */
  decay: number;
}

/** Coice visível por arma, na ordem do `ARSENAL` (fuzil, SMG, sniper, escopeta). */
export const RECOIL: readonly RecoilFeel[] = [
  { back: 0.05, rise: 0.09, body: 0.035, decay: 16 },
  { back: 0.032, rise: 0.05, body: 0.02, decay: 22 },
  { back: 0.09, rise: 0.2, body: 0.08, decay: 9 },
  { back: 0.085, rise: 0.17, body: 0.075, decay: 10 },
];

export const recoilFeel = (index: number): RecoilFeel => RECOIL[index] ?? RECOIL[0];

/** Suave entre 0 e 1. */
export function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Envelope da recarga a partir do progresso (0 → 1): `lower` abaixa e gira a arma; `mag`
 * leva a mão de apoio ao carregador (0 no guarda-mão, 1 no carregador); `drop` desce a mão
 * com o carregador velho e volta com o novo.
 */
export function reloadEnvelope(progress: number): { lower: number; mag: number; drop: number } {
  const p = Math.max(0, Math.min(1, progress));
  const lower = smooth(0, 0.14, p) * (1 - smooth(0.82, 1, p));
  const mag = smooth(0.1, 0.24, p) * (1 - smooth(0.7, 0.86, p));
  const drop = Math.sin(Math.PI * smooth(0.24, 0.58, p));
  return { lower, mag, drop };
}

/** Correndo rápido (e sem atirar há um tempo) a arma vai para a guarda baixa. */
export function lowReady(speed: number, sinceShot: number): number {
  return smooth(5.6, 6.8, speed) * smooth(0.35, 0.7, sinceShot);
}
