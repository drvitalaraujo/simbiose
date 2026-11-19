// Diretor automático do Modo Live (puro): escolhe quem a câmera segue. Cada tiro, acerto e
// abate esquenta o jogador ("calor" que esfria sozinho); a câmera vai para quem está em
// combate ou acabou de abater, mas fica um tempo mínimo em cada plano (sem pular feito
// pipoca). Quem morreu em cena passa a vez para quem o abateu, depois de ver a queda.

export interface DirectorOptions {
  /** Tempo mínimo de um plano (s). */
  minShot: number;
  /** Plano longo demais: troca para outro com ação, se houver (s). */
  maxShot: number;
  /** Quanto tempo mostrar a queda de quem estava em cena antes de cortar (s). */
  deathHold: number;
  /** Meia-vida do calor (s). */
  halfLife: number;
  /** Outro precisa estar este tanto mais quente para roubar o plano. */
  margin: number;
}

export const DIRECTOR_DEFAULTS: Readonly<DirectorOptions> = {
  minShot: 4,
  maxShot: 14,
  deathHold: 1.6,
  halfLife: 3,
  margin: 1.6,
};

/** Peso de cada acontecimento no calor do jogador. */
const HEAT = { shot: 0.4, hit: 2, hurt: 1, kill: 8 } as const;

export type DirectorEvent =
  | { type: 'shot'; by: string; target?: string; damage?: number }
  | { type: 'kill'; killerId: string; victimId: string };

export interface DirectorPlayer {
  id: string;
  alive: boolean;
}

export class AutoDirector {
  private readonly opts: DirectorOptions;
  private readonly heat = new Map<string, number>();
  private current: string | null = null;
  private since = 0;
  /** Quem matou quem estava em cena (próximo plano) e quando. */
  private killerOfCurrent: string | null = null;
  private diedAt = -1;
  private time = 0;

  constructor(opts: Partial<DirectorOptions> = {}) {
    this.opts = { ...DIRECTOR_DEFAULTS, ...opts };
  }

  get target(): string | null {
    return this.current;
  }

  heatOf(id: string): number {
    return this.heat.get(id) ?? 0;
  }

  note(e: DirectorEvent) {
    if (e.type === 'shot') {
      this.add(e.by, HEAT.shot);
      if (e.target && (e.damage ?? 0) > 0) {
        this.add(e.by, HEAT.hit);
        this.add(e.target, HEAT.hurt);
      }
      return;
    }
    if (e.killerId && e.killerId !== e.victimId) this.add(e.killerId, HEAT.kill);
    this.heat.set(e.victimId, 0);
    if (e.victimId === this.current) {
      this.killerOfCurrent = e.killerId && e.killerId !== e.victimId ? e.killerId : null;
      this.diedAt = this.time;
    }
  }

  /** Avança o relógio e devolve quem seguir agora. */
  update(dt: number, players: readonly DirectorPlayer[]): string | null {
    this.time += dt;
    const decay = Math.pow(0.5, dt / this.opts.halfLife);
    for (const [id, h] of this.heat) this.heat.set(id, h * decay);
    const ids = new Set(players.map(p => p.id));
    for (const id of this.heat.keys()) if (!ids.has(id)) this.heat.delete(id);
    if (players.length === 0) return this.cut(null);
    if (!this.current || !ids.has(this.current)) return this.cut(this.hottest(players, null) ?? players[0].id);

    const held = this.time - this.since;
    const me = players.find(p => p.id === this.current)!;
    if (!me.alive) {
      // Mostra a queda; depois vai para quem matou (se ainda está aí) ou para a ação
      if (this.diedAt < 0) this.diedAt = this.time;
      if (this.time - this.diedAt < this.opts.deathHold) return this.current;
      const killer = this.killerOfCurrent && players.find(p => p.id === this.killerOfCurrent && p.alive);
      return this.cut(killer ? killer.id : this.hottest(players, this.current) ?? this.current);
    }
    if (held < this.opts.minShot) return this.current;
    const best = this.hottest(players, this.current);
    if (!best) return this.current;
    const mine = this.heatOf(this.current);
    const theirs = this.heatOf(best);
    if (theirs > Math.max(0.5, mine * this.opts.margin)) return this.cut(best);
    if (held >= this.opts.maxShot && theirs > 0.3) return this.cut(best);
    return this.current;
  }

  private add(id: string, amount: number) {
    if (id) this.heat.set(id, (this.heat.get(id) ?? 0) + amount);
  }

  private hottest(players: readonly DirectorPlayer[], except: string | null): string | null {
    let best: string | null = null;
    let score = -1;
    for (const p of players) {
      if (!p.alive || p.id === except) continue;
      const h = this.heatOf(p.id);
      if (h > score) {
        score = h;
        best = p.id;
      }
    }
    return best;
  }

  private cut(id: string | null): string | null {
    if (id !== this.current) {
      this.current = id;
      this.since = this.time;
    }
    this.killerOfCurrent = null;
    this.diedAt = -1;
    return this.current;
  }
}
