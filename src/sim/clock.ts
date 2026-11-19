// Passo fixo da simulação: o quadro (dt variável) enche um acumulador e a sim avança em
// ticks de 1/60 s. Assim ela roda igual em qualquer fps, no cliente e no servidor.

export const TICK_RATE = 60;
export const TICK = 1 / TICK_RATE;
/** Máximo de ticks por quadro: abaixo de ~12 fps o jogo desacelera em vez de travar. */
export const MAX_TICKS_PER_FRAME = 5;
/** Quadro maior que isto (aba voltando do segundo plano) é tratado como este valor. */
const MAX_FRAME = 0.25;

export class FixedStep {
  private acc = 0;

  constructor(readonly dt = TICK, readonly maxTicks = MAX_TICKS_PER_FRAME) {}

  /** Soma o tempo do quadro e devolve quantos ticks rodar agora. */
  advance(frameDt: number): number {
    this.acc += Math.min(Math.max(frameDt, 0), MAX_FRAME);
    let n = Math.floor((this.acc + 1e-9) / this.dt); // folga: 1/60 somado 60 vezes conta 60 ticks
    if (n > this.maxTicks) {
      n = this.maxTicks;
      this.acc = 0; // joga fora o atraso em vez de acumular uma "espiral da morte"
    } else {
      this.acc = Math.max(0, this.acc - n * this.dt);
    }
    return n;
  }

  /** Quanto já andou rumo ao próximo tick (0 a 1): usado para interpolar o desenho. */
  get alpha(): number {
    return Math.min(1, this.acc / this.dt);
  }

  reset() {
    this.acc = 0;
  }
}
