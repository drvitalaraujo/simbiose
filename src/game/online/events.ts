// Eventos do modo online para quem desenha HUD (o simples em online-hud.ts e o competitivo
// em src/game/hud/). Formatos prontos para ligar: killfeed e placar vêm de src/net/feed.ts.
//
//   const game = window.__game as OnlineGame;
//   game.events.on('kill', (e) => killfeed.push(e));      // {killer, victim, weapon, headshot, killerIsBot, victimIsBot, ...}
//   game.events.on('death', (e) => showDeath(e.killer));  // você morreu
//   const rows = game.scoreboard();                       // [{id, name, kills, deaths, ping, bot}]
import type { HitPart } from '../characters/hitbox';
import type { KillFeedEvent } from '../../net/feed';

export interface OnlineEventMap {
  /** Alguém abateu alguém (killfeed). */
  kill: KillFeedEvent;
  /** O servidor confirmou um acerto SEU (hit marker, dano). */
  hit: { target: string; part: HitPart; damage: number; killed: boolean };
  /** Você levou um tiro (confirmado pelo servidor). */
  hurt: { by: string; damage: number; part: HitPart; hp: number };
  /** Você morreu. */
  death: KillFeedEvent;
  /** Você renasceu. */
  respawn: { life: number };
  /** A partida mudou de fase ('playing' | 'ended'). */
  match: { phase: string; winnerId: string; winnerName: string; match: number };
}

type Handler<T> = (e: T) => void;

export class OnlineEvents {
  private readonly handlers = new Map<keyof OnlineEventMap, Handler<never>[]>();

  on<K extends keyof OnlineEventMap>(type: K, fn: Handler<OnlineEventMap[K]>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn as Handler<never>);
    this.handlers.set(type, list);
    return () => {
      const l = this.handlers.get(type);
      if (l) this.handlers.set(type, l.filter((h) => h !== (fn as Handler<never>)));
    };
  }

  emit<K extends keyof OnlineEventMap>(type: K, e: OnlineEventMap[K]) {
    for (const fn of this.handlers.get(type) ?? []) (fn as Handler<OnlineEventMap[K]>)(e);
  }

  clear() {
    this.handlers.clear();
  }
}
