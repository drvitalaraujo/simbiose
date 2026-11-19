// Plateia da sala (puro, sem Colyseus): quem assiste em vez de jogar. Dois tipos:
//  - espectador por escolha (`espectador: true` na entrada, ex.: o anfitrião da live);
//  - fila de espera: entrou pelo convite com a sala cheia de gente (ou perdeu no rodízio,
//    ver rotation.ts). Assiste e vira jogador quando abrir vaga, na ordem da fila.
// O servidor (server/arena-room.ts) decide com isto; espectador nunca entra na simulação.
// A plateia (voluntários + fila) tem teto próprio: nunca ocupa as vagas de jogador.

/** Vagas extras da sala só para quem assiste (além da capacidade de jogadores do modo). */
export const SPECTATOR_SLOTS = 8;

/** Mensagens avulsas da plateia (servidor → espectadores). */
export const SPECTATE_MSG = {
  /** Quantos jogam, assistem e esperam vaga (só para quem assiste). */
  audience: 'plateia',
  /** Rodízio: você perdeu, saiu da partida e foi para o fim da fila (mesma conexão). */
  benched: 'banco',
  /** Você é jogador desta participação (`seat` = geração do seu NetPlayer). Idempotente. */
  seat: 'vaga',
} as const;

/** Papel de jogador: vale quando o NetPlayer com esta geração aparecer no estado. */
export interface SeatMsg {
  seat: number;
}

/** Aviso do rodízio para quem saiu da partida. */
export interface BenchedMsg {
  /** Sua posição na fila (1 = próximo). */
  place: number;
  /** Total na fila. */
  waiting: number;
}

export interface AudienceMsg {
  /** Gente jogando (sem bots). */
  players: number;
  /** Capacidade de jogadores do modo. */
  capacity: number;
  /** Total assistindo (inclui quem espera vaga). */
  spectators: number;
  /** Na fila esperando vaga. */
  waiting: number;
  /** Só para quem está na fila: sua posição (1 = próximo). */
  place?: number;
}

/** `full`: a plateia está no teto (SPECTATOR_SLOTS); a entrada é recusada. */
export type Admission = 'player' | 'spectator' | 'waiting' | 'full';

/**
 * Reserva de vaga por papel, ANTES de a conexão ocupar um lugar na sala. `pending`: pedidos
 * já reservados que ainda não entraram (true = quer assistir), na ordem. Quem quer jogar e
 * cabe na capacidade sempre passa; o resto é plateia, até SPECTATOR_SLOTS.
 */
export function seatFor(wantsSpectator: boolean, capacity: number, humans: number, audience: number, pending: Iterable<boolean>): 'player' | 'audience' | 'full' {
  let players = humans;
  let watching = audience;
  const place = (spectator: boolean) => {
    if (!spectator && players < capacity) { players += 1; return 'player' as const; }
    if (watching < SPECTATOR_SLOTS) { watching += 1; return 'audience' as const; }
    return 'full' as const;
  };
  for (const p of pending) place(p);
  return place(wantsSpectator);
}

interface Entry {
  name: string;
  waiting: boolean;
  order: number;
}

export class Audience {
  private readonly entries = new Map<string, Entry>();
  private order = 0;

  /**
   * Decide o papel de quem entra: pediu para assistir → espectador; sala cheia de gente →
   * fila de espera; senão joga. Espectador e fila ficam registrados aqui.
   */
  admit(id: string, name: string, wantsSpectator: boolean, humans: number, capacity: number): Admission {
    const full = this.entries.size >= SPECTATOR_SLOTS;
    if (wantsSpectator) {
      if (full) return 'full';
      this.entries.set(id, { name, waiting: false, order: ++this.order });
      return 'spectator';
    }
    // Já tem gente esperando: ninguém fura a fila, mesmo se uma vaga acabou de abrir.
    if (humans >= capacity || this.waitingCount > 0) {
      if (full) return 'full';
      this.entries.set(id, { name, waiting: true, order: ++this.order });
      return 'waiting';
    }
    return 'player';
  }

  /** Rodízio: quem perdeu sai da partida e vai para o FIM da fila (não conta no teto: troca). */
  bench(id: string, name: string) {
    this.entries.set(id, { name, waiting: true, order: ++this.order });
  }

  /** Posição na fila (1 = próximo); 0 = não está na fila. */
  placeOf(id: string): number {
    const me = this.entries.get(id);
    if (!me?.waiting) return 0;
    let n = 1;
    for (const e of this.entries.values()) if (e.waiting && e.order < me.order) n += 1;
    return n;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  isWaiting(id: string): boolean {
    return this.entries.get(id)?.waiting ?? false;
  }

  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  get size(): number {
    return this.entries.size;
  }

  get waitingCount(): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.waiting) n += 1;
    return n;
  }

  /** Tira da fila (ordem de chegada) quem cabe nas `free` vagas; devolve quem vira jogador. */
  promote(free: number): { id: string; name: string }[] {
    if (free <= 0) return [];
    const line = [...this.entries].filter(([, e]) => e.waiting).sort((a, b) => a[1].order - b[1].order).slice(0, free);
    for (const [id] of line) this.entries.delete(id);
    return line.map(([id, e]) => ({ id, name: e.name }));
  }

  message(players: number, capacity: number): AudienceMsg {
    return { players, capacity, spectators: this.size, waiting: this.waitingCount };
  }
}
