// Regras dos efeitos de movimento (sem Three.js): quantas partículas, onde nascem e como
// vivem. `movement-fx.ts` só desenha. Tudo visual: nada aqui volta para a simulação.
import type { MovementCue } from './movement-camera';

export interface MovementSample {
  /** Pés do jogador (mundo). */
  feet: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  yaw: number;
  sliding: boolean;
  onGround: boolean;
}

export interface Puff {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; life: number; size: number;
  color: number; spin: number;
  spark: boolean;
}

const RUN_DUST_SPEED = 8; // poeira só correndo (andar a 6 m/s fica limpo)
const SLIDE_DUST_RATE = 70; // puffs por segundo no slide a toda
const SLIDE_SPARK_RATE = 22;
const SPARK_SPEED = 8; // faísca só no slide rápido (saída da corrida, ladeira)

/** Curva do puff: incha rápido e murcha até sumir (nuvem de desenho, sem transparência). */
export function puffScale(t: number) {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.18) { const k = t / 0.18; return 1 - (1 - k) * (1 - k); }
  const k = (t - 0.18) / 0.82;
  return 1 - k * k;
}

/** Quantidade por nível de qualidade (0 = cheio; 2 = metade; 3 = mínimo, sem faísca). */
export function fxBudget(quality: number) {
  return quality >= 3 ? 0.35 : quality >= 2 ? 0.55 : 1;
}

export class MovementBursts {
  private slideCarry = 0;
  private sparkCarry = 0;

  constructor(private readonly colors: readonly number[], private readonly rnd: () => number = Math.random) {}

  reset() { this.slideCarry = this.sparkCarry = 0; }

  private color() {
    return this.colors[Math.floor(this.rnd() * this.colors.length) % this.colors.length];
  }

  private puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number, spark = false): Puff {
    const r = this.rnd;
    return {
      x, y, z, vx, vy, vz, age: 0, life: life * (0.8 + r() * 0.4), size: size * (0.75 + r() * 0.5),
      color: spark ? 0 : this.color(), spin: (r() - 0.5) * 4, spark,
    };
  }

  /** Puffs novos deste quadro. */
  emit(dt: number, s: MovementSample, cue: MovementCue, quality: number): Puff[] {
    const out: Puff[] = [];
    const r = this.rnd;
    const budget = fxBudget(quality);
    const count = (n: number) => Math.max(1, Math.round(n * budget));
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw); // frente do olhar
    const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw); // direita
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const { x, y, z } = s.feet;
    const ground = y + 0.06;

    if (cue.step && speed > RUN_DUST_SPEED) {
      const side = cue.step * 0.2;
      for (let i = 0; i < count(3); i++) {
        out.push(this.puff(
          x + rx * side - s.vel.x * 0.02, ground, z + rz * side - s.vel.z * 0.02,
          -s.vel.x * 0.12 + (r() - 0.5) * 1.2, 0.5 + r() * 0.5, -s.vel.z * 0.12 + (r() - 0.5) * 1.2,
          0.11, 0.45,
        ));
      }
    }
    if (cue.jump && speed > 3) {
      for (let i = 0; i < count(3); i++) {
        out.push(this.puff(x + (r() - 0.5) * 0.4, ground, z + (r() - 0.5) * 0.4, (r() - 0.5) * 1.5, 0.4, (r() - 0.5) * 1.5, 0.1, 0.4));
      }
    }
    if (cue.land > 0) {
      // Anel que se espalha rente ao chão: a nuvem aparece na borda de baixo da tela.
      const k = cue.land;
      const n = count(k < 0.15 ? 4 : 10 + k * 16);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.4;
        const out0 = 3 + k * 5 + r() * 1.5;
        const r0 = 0.4 + k * 0.3;
        out.push(this.puff(
          x + Math.cos(a) * r0 + s.vel.x * 0.05, ground, z + Math.sin(a) * r0 + s.vel.z * 0.05,
          Math.cos(a) * out0 + s.vel.x * 0.4, 0.3 + r() * 0.6 * k, Math.sin(a) * out0 + s.vel.z * 0.4,
          0.08 + k * 0.12, 0.55 + k * 0.3,
        ));
      }
    }
    // Nos microdegraus da ladeira o corpo "voa" 0,1 m a cada passo: só a queda de verdade corta.
    if (s.sliding && (s.onGround || s.vel.y > -4) && speed > 4) {
      // Nasce um pouco à frente e acompanha o corpo: o rastro passa pelos cantos de baixo.
      const pace = Math.min(1, speed / 12);
      this.slideCarry += dt * SLIDE_DUST_RATE * pace * budget;
      while (this.slideCarry >= 1) {
        this.slideCarry -= 1;
        const side = r() < 0.5 ? -1 : 1;
        // Agachado no slide, o chão só entra no quadro a ~1,1 m dos pés.
        const ahead = 1.1 + r() * 0.8;
        const wide = 0.55 + r() * 0.5;
        out.push(this.puff(
          x + fx * ahead + rx * side * wide, ground + 0.05, z + fz * ahead + rz * side * wide,
          s.vel.x * 0.8 + rx * side * (1.2 + r() * 1.6), 1 + r() * 1.2, s.vel.z * 0.8 + rz * side * (1.2 + r() * 1.6),
          0.04 + pace * 0.045, 0.4,
        ));
      }
      if (quality < 3 && speed > SPARK_SPEED) {
        this.sparkCarry += dt * SLIDE_SPARK_RATE * Math.min(1, (speed - SPARK_SPEED) / 3 + 0.3) * budget;
        while (this.sparkCarry >= 1) {
          this.sparkCarry -= 1;
          const side = r() < 0.5 ? -1 : 1;
          out.push(this.puff(
            x + fx * 1.1 + rx * side * 0.35, ground + 0.02, z + fz * 1.1 + rz * side * 0.35,
            s.vel.x * 0.95 + rx * side * (1.5 + r() * 2.5), 1.2 + r() * 2.2, s.vel.z * 0.95 + rz * side * (1.5 + r() * 2.5),
            0.1, 0.28, true,
          ));
        }
      }
    } else {
      this.slideCarry = this.sparkCarry = 0;
    }
    return out;
  }

  /** Avança um puff; devolve o tamanho atual. */
  stepDust(p: Puff, dt: number) {
    p.age += dt;
    const drag = Math.exp(-3.5 * dt);
    p.vx *= drag; p.vz *= drag;
    p.vy = p.vy * Math.exp(-2 * dt) + 0.35 * dt; // sobe devagar, como fumaça de desenho
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    return p.size * puffScale(p.age / p.life);
  }

  stepSpark(p: Puff, dt: number) {
    p.age += dt;
    p.vy -= 14 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    return p.size * (1 - p.age / p.life);
  }
}
