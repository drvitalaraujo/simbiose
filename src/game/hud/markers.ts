// Marcadores no centro da tela: acerto (corpo/cabeça/abate), aviso de abate com sequência
// e indicador da direção do dano. Só visual: o som fica com o juice.
import { el, nameTag, replay } from './dom';
import type { HitKind, PlayerRef } from './types';

const STREAK_WINDOW = 4; // segundos entre abates para contar como sequência
const STREAK_NAMES = ['', 'ABATE', 'ABATE DUPLO', 'ABATE TRIPLO', 'QUÁDRUPLO!', 'OTIMIZAÇÃO EM MASSA'];
const DAMAGE_POOL = 6;

export class Markers {
  readonly root = el('div', 'ch-markers');
  private readonly hit = el('div', 'ch-hit');
  private readonly kill = el('div', 'ch-kill');
  private readonly killTitle = el('div', 'k-title');
  private readonly killWho = el('div', 'k-who');
  private readonly arcs: HTMLElement[] = [];
  private nextArc = 0;
  private streak = 0;
  private sinceKill = Infinity;

  constructor() {
    this.kill.append(this.killTitle, this.killWho);
    const ring = el('div', 'ch-damage-ring');
    for (let i = 0; i < DAMAGE_POOL; i++) {
      const a = el('i', 'arc');
      ring.append(a);
      this.arcs.push(a);
    }
    this.root.append(ring, this.hit, this.kill);
  }

  /** Acerto: branco no corpo, amarelo na cabeça, rosa grande no abate. */
  hitMarker(kind: HitKind = 'body') {
    this.hit.dataset.kind = kind;
    replay(this.hit, 'show');
  }

  /** Aviso de abate embaixo da mira, com contagem de sequência ("ABATE DUPLO"...). */
  killMarker(victim: PlayerRef, headshot = false) {
    this.streak = this.sinceKill < STREAK_WINDOW ? this.streak + 1 : 1;
    this.sinceKill = 0;
    const name = STREAK_NAMES[Math.min(this.streak, STREAK_NAMES.length - 1)];
    this.killTitle.textContent = headshot && this.streak === 1 ? 'NA CABEÇA!' : name;
    this.killWho.replaceChildren(nameTag(victim, 'enemy'));
    this.kill.dataset.streak = String(Math.min(this.streak, 5));
    replay(this.kill, 'show');
    this.hitMarker('kill');
  }

  /** Dano vindo do ângulo de tela `angle` (0 = frente, + = direita; ver `damageAngle`). */
  damageFrom(angle: number, strength = 1) {
    const arc = this.arcs[this.nextArc];
    this.nextArc = (this.nextArc + 1) % this.arcs.length;
    arc.style.setProperty('--a', `${angle}rad`);
    arc.style.setProperty('--k', String(Math.max(0.3, Math.min(1, strength))));
    replay(arc, 'show');
  }

  update(dt: number) {
    this.sinceKill += dt;
  }

  reset() {
    this.streak = 0;
    this.sinceKill = Infinity;
  }
}
