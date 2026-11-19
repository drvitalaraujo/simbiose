// Até onde o servidor volta no tempo para o tiro de um jogador (lag compensation), sem
// confiar no carimbo do cliente. O cliente diz "eu via o mundo no instante X" (renderTime do
// Colyseus), mas esse número é forjável: um trapaceiro escolheria o passado mais vantajoso.
// Então o servidor estima por conta própria quanto aquele cliente vê no passado:
//   interpolação (100 ms) + ping medido PELO SERVIDOR + meio tick de fila,
// aceita o carimbo só perto dessa estimativa (± tolerância) e limita o quanto ele pode mudar
// de um tiro para o outro. Não existe prova absoluta do que o cliente viu: o objetivo é que a
// vantagem possível de um carimbo forjado fique pequena (dezenas de ms, não 350).
import { INTERP_DELAY_MS, REWIND_MAX_MS } from './protocol';

/** Quanto o carimbo pode se afastar da estimativa do servidor (ms). */
export const VIEW_TOLERANCE_MS = 70;
/** Quanto a profundidade do rewind pode mudar entre tiros seguidos (ms). */
export const VIEW_JUMP_MS = 40;
/** Fila média do comando no servidor antes de ser simulado (~meio tick a 60 Hz + folga). */
const QUEUE_MS = 16;
/** Tiros com mais que isto de intervalo não limitam o salto (a rede pode ter mudado). */
const JUMP_WINDOW_MS = 1000;
const RTT_EMA = 0.25;

export class ViewClock {
  /** Ping medido pelo servidor (ms), média móvel; -1 = ainda sem medida. */
  rtt = -1;
  private lastDepth = -1;
  private lastAt = -Infinity;

  /** Uma medida de ida e volta feita pelo servidor (eco do `sync`). */
  observeRtt(ms: number) {
    if (!Number.isFinite(ms) || ms < 0) return;
    const v = Math.min(1000, ms);
    this.rtt = this.rtt < 0 ? v : this.rtt + (v - this.rtt) * RTT_EMA;
  }

  /** Quanto no passado este cliente deve estar vendo os outros, pela conta do servidor (ms). */
  expectedDepth(): number {
    return INTERP_DELAY_MS + Math.max(0, this.rtt) + QUEUE_MS;
  }

  /**
   * Instante (relógio do servidor, ms) para onde voltar no tiro processado em `now`.
   * `stamp` é o carimbo do cliente (0 = sem carimbo). Chame uma vez por tiro.
   */
  resolve(now: number, stamp: number): number {
    const expected = this.expectedDepth();
    let depth = stamp > 0 ? now - stamp : expected;
    depth = clamp(depth, expected - VIEW_TOLERANCE_MS, expected + VIEW_TOLERANCE_MS);
    if (now - this.lastAt < JUMP_WINDOW_MS && this.lastDepth >= 0) {
      depth = clamp(depth, this.lastDepth - VIEW_JUMP_MS, this.lastDepth + VIEW_JUMP_MS);
    }
    depth = clamp(depth, 0, REWIND_MAX_MS);
    this.lastDepth = depth;
    this.lastAt = now;
    return now - depth;
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
