// Barramento de eventos da simulação: a sim só anuncia o que aconteceu; o cliente
// (câmera, som, partículas, juice) reage. No servidor, os mesmos eventos viram mensagens.
import type { Vec3 } from './vec';

/** Disparo: sai um por tiro, acerte ou não. */
export interface ShotEvent {
  type: 'shot';
  origin: Vec3;
  dir: Vec3;
  /** Onde o tiro parou (parede, alvo ou alcance máximo). */
  end: Vec3;
  hit: 'none' | 'world' | 'target';
  target?: number;
  weaponIndex?: number;
  /** Uma cartucho gera vários raios, mas só um coice/clarão/som. */
  pellets?: ShotEvent[];
}

/** Tiro acertou um alvo e ele sobreviveu. */
export interface HitEvent {
  type: 'hit';
  target: number;
  point: Vec3;
  dir: Vec3;
}

/** Tiro acertou e destruiu o alvo. */
export interface KillEvent {
  type: 'kill';
  target: number;
  point: Vec3;
  dir: Vec3;
}

/** O jogador levou dano. */
export interface HurtEvent {
  type: 'hurt';
  amount: number;
  hp: number;
  fatal: boolean;
}

export type SimEvent = ShotEvent | HitEvent | KillEvent | HurtEvent;

/** Fila simples: a sim chama `emit`; o cliente chama `drain` depois de cada tick. */
export class EventBus {
  private queue: SimEvent[] = [];

  emit(e: SimEvent) {
    this.queue.push(e);
  }

  drain(): SimEvent[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  get size() {
    return this.queue.length;
  }
}
