// Papel desta conexão na sala (Modo Live): jogador ou fila. O servidor manda o papel de forma
// idempotente (`vaga {seat}` ao promover, `banco` ao rebaixar) e REENVIA o atual quando a
// conexão volta (onReconnect). Mensagem chega antes do patch: virar jogador só vale quando o
// NetPlayer com a MESMA geração (`seat`) estiver no estado. Um rastreador por sala, ligado
// logo ao entrar (sobrevive à troca jogo ↔ espectador e ao import da tela nova).
import type { Room } from '@colyseus/sdk';
import type { ArenaState, NetPlayer } from './schema';
import { type BenchedMsg, type SeatMsg, SPECTATE_MSG } from './spectate';

export type RoleState =
  /** Ainda sem mensagem de papel (entrou e o estado decide). */
  | { kind: 'unknown' }
  /** Jogador da participação `seat`. */
  | { kind: 'player'; seat: number }
  /** No banco (perdeu no rodízio ou voltou à fila). */
  | { kind: 'bench'; msg: BenchedMsg };

interface Players {
  get(id: string): Pick<NetPlayer, 'seat'> | undefined;
}

/** Lógica pura do papel (sem sala): testável sem servidor. */
export class RoleTracker {
  role: RoleState = { kind: 'unknown' };
  /** Muda a cada mensagem de papel (quem guarda o último visto sabe que houve troca). */
  version = 0;
  private readonly listeners = new Set<() => void>();

  seat(msg: SeatMsg) {
    const seat = Number(msg?.seat);
    if (!Number.isInteger(seat) || seat <= 0) return;
    this.role = { kind: 'player', seat };
    this.changed();
  }

  bench(msg: BenchedMsg) {
    this.role = { kind: 'bench', msg: { place: Number(msg?.place) || 0, waiting: Number(msg?.waiting) || 0 } };
    this.changed();
  }

  /**
   * O seu jogador, se o estado já mostra a participação que o servidor anunciou. Sem
   * anúncio (`unknown`, ex.: entrou direto como jogador), vale o que estiver no estado.
   */
  seated(players: Players, me: string): Pick<NetPlayer, 'seat'> | null {
    const p = players.get(me);
    if (!p) return null;
    if (this.role.kind === 'bench') return null;
    if (this.role.kind === 'player' && p.seat !== this.role.seat) return null; // ainda o boneco antigo
    return p;
  }

  /** O jogo ligado a `seat` ficou para trás (banco ou outra participação)? */
  stale(seat: number): boolean {
    if (this.role.kind === 'bench') return true;
    return this.role.kind === 'player' && this.role.seat !== seat;
  }

  on(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private changed() {
    this.version += 1;
    for (const cb of [...this.listeners]) cb();
  }
}

const trackers = new WeakMap<object, RoleTracker>();

/** O rastreador da sala (criado na primeira chamada; ligue logo ao entrar na sala). */
export function roleOf(room: Room<unknown, ArenaState>): RoleTracker {
  let t = trackers.get(room);
  if (t) return t;
  const tracker = new RoleTracker();
  t = tracker;
  trackers.set(room, tracker);
  // Vivem enquanto a sala viver: o papel precisa ser ouvido mesmo entre uma tela e outra
  room.onMessage(SPECTATE_MSG.seat, (m: SeatMsg) => tracker.seat(m));
  room.onMessage(SPECTATE_MSG.benched, (m: BenchedMsg) => tracker.bench(m));
  return tracker;
}
