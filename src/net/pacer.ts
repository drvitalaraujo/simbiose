// Ritmo dos comandos de cada jogador no servidor (puro). Regras:
//  - 1 crédito por tick, até BURST guardados: ninguém simula mais que 60 comandos/s na média
//    (sem speedhack), mas rajadas da rede (jitter) passam;
//  - sem comando por mais de STARVE ticks (aba escondida, rede caiu, trapaça), o servidor
//    simula um passo VAZIO por tick: a gravidade continua e quem parou no ar cai;
//  - cada passo vazio vira "dívida": quando os comandos atrasados chegarem, o mesmo número é
//    descartado (sem simular), para o total de passos nunca passar do tempo real.

export const BURST = 4;
/** Ticks sem comando antes de o servidor simular sozinho (~100 ms). */
export const STARVE = 6;
/** Dívida máxima guardada (~1 s): mais que isso já foi descartado pela fila de 64. */
const MAX_DEBT = 60;

export interface TickPlan {
  /** Comandos da fila descartados sem simular (pagam passos vazios já dados). */
  skip: number;
  /** Comandos da fila a simular neste tick. */
  steps: number;
  /** Simular um passo vazio (comando neutro). */
  idle: boolean;
}

export class InputPacer {
  private credit = 1;
  private starve = 0;
  private debt = 0;
  /** Ticks que passaram sem nenhum passo (antes de começar o passo vazio): pode recuperar. */
  private owed = 0;

  /** Plano do tick, dado quantos comandos estão esperando na fila. */
  plan(queued: number): TickPlan {
    this.credit = Math.min(BURST, this.credit + 1);
    if (queued <= 0) {
      this.starve += 1;
      if (this.starve > STARVE && this.credit >= 1) {
        this.credit -= 1;
        this.debt = Math.min(MAX_DEBT, this.debt + 1);
        return { skip: 0, steps: 0, idle: true };
      }
      if (this.credit >= BURST) this.owed = Math.min(STARVE, this.owed + 1);
      return { skip: 0, steps: 0, idle: false };
    }
    this.starve = 0;
    // Paga a dívida, mas sempre deixa o comando mais novo para simular
    const skip = Math.min(this.debt, queued - 1);
    this.debt -= skip;
    let steps = Math.min(Math.floor(this.credit), queued - skip);
    this.credit -= steps;
    // Fila acumulada: recupera os ticks que ficaram sem passo (nunca passa do tempo real)
    const extra = Math.min(this.owed, queued - skip - steps);
    this.owed -= extra;
    steps += extra;
    return { skip, steps, idle: false };
  }
}
