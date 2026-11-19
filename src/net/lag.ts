// Simulador de rede ruim, só no cliente: `?online&lag=150&jitter=20&perda=5`.
// - lag: atraso extra de ida e volta em ms (metade em cada sentido);
// - jitter: variação em ms, para mais ou para menos, em cada sentido;
// - perda: % de pacotes "perdidos". WebSocket é TCP: pacote perdido não some, chega
//   atrasado (retransmissão) e segura os de trás. É isso que simulamos.
// A ordem dos pacotes sempre se mantém (como no TCP).

export interface LagOptions {
  /** Ida e volta extra (ms). */
  lag: number;
  /** ± ms em cada sentido. */
  jitter: number;
  /** Fração de 0 a 1. */
  loss: number;
}

/** Lê `lag`, `jitter` e `perda` da URL. Sem nenhum deles, devolve null. */
export function parseLag(search: string): LagOptions | null {
  const q = new URLSearchParams(search);
  if (!q.has('lag') && !q.has('jitter') && !q.has('perda')) return null;
  const num = (k: string) => Math.max(0, Number(q.get(k)) || 0);
  return { lag: num('lag'), jitter: num('jitter'), loss: Math.min(1, num('perda') / 100) };
}

/** Retransmissão de TCP: o pacote perdido chega pelo menos isto mais tarde. */
const RETRANSMIT_MS = 200;

/** Quando liberar o próximo pacote de um sentido (nunca antes do anterior). */
export function releaseAt(now: number, last: number, o: LagOptions, rand: () => number): number {
  let delay = o.lag / 2 + (rand() * 2 - 1) * o.jitter;
  if (o.loss > 0 && rand() < o.loss) delay += Math.max(RETRANSMIT_MS, o.lag);
  return Math.max(now + Math.max(0, delay), last);
}

export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
}

const realScheduler: Scheduler = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
};

/** Fila com hora de saída: entrega em ordem, cada item na sua hora. */
export class DelayLine {
  private readonly queue: { at: number; fn: () => void }[] = [];
  private last = 0;
  private armed = false;

  constructor(
    private readonly opts: LagOptions,
    private readonly rand: () => number = Math.random,
    private readonly clock: Scheduler = realScheduler,
  ) {}

  push(fn: () => void) {
    // Entrega o que já venceu antes de enfileirar: aba em segundo plano segura os
    // timers (~1 s), mas pacotes novos chegam/saem o tempo todo e destravam a fila.
    this.deliverDue();
    const at = releaseAt(this.clock.now(), this.last, this.opts, this.rand);
    this.last = at;
    this.queue.push({ at, fn });
    this.arm();
  }

  get pending() {
    return this.queue.length;
  }

  private arm() {
    if (this.armed || this.queue.length === 0) return;
    this.armed = true;
    this.clock.setTimeout(() => this.flush(), Math.max(0, this.queue[0].at - this.clock.now()));
  }

  private flush() {
    this.armed = false;
    this.deliverDue();
    this.arm();
  }

  /**
   * Entrega o que já venceu. O jogo chama a cada quadro: em aba escondida o navegador
   * segura os timers (até ~1 s) e o lag simulado ficaria bem maior que o pedido.
   */
  deliverDue() {
    const now = this.clock.now();
    while (this.queue.length > 0 && this.queue[0].at <= now + 0.5) this.queue.shift()!.fn();
  }
}

/** O que o simulador precisa de um WebSocket (do navegador ou do pacote `ws`). */
export interface SocketLike {
  send(data: unknown): void;
  onmessage: ((ev: unknown) => void) | null;
}

/** Cópia dos bytes de um envio (strings e outros tipos passam como estão). */
export function snapshotBytes(data: unknown): unknown {
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  if (data instanceof ArrayBuffer) return data.slice(0);
  return data;
}

/**
 * Coloca atraso nos dois sentidos de um WebSocket já aberto (envio e recebimento).
 * O relógio do Colyseus (ping) passa pelo mesmo caminho, então mede o lag simulado.
 */
export function installLag(ws: SocketLike, opts: LagOptions, rand: () => number = Math.random, clock?: Scheduler) {
  const up = new DelayLine(opts, rand, clock);
  const down = new DelayLine(opts, rand, clock);
  const send = ws.send.bind(ws);
  ws.send = (data: unknown) => {
    // O SDK do Colyseus reaproveita o mesmo buffer a cada envio: sem copiar agora, o envio
    // atrasado mandaria os bytes de um comando mais novo (carimbo e comando errados).
    const copy = snapshotBytes(data);
    up.push(() => send(copy));
  };
  const receive = ws.onmessage;
  if (receive) ws.onmessage = (ev: unknown) => down.push(() => receive.call(ws, ev));
  return { up, down };
}
