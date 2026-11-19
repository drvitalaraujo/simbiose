// Apresentação do movimento: não altera corpo, hitbox, mira nem origem dos tiros.
// A simulação mira por `input.yaw/pitch` e atira do olho do `PlayerState`; tudo aqui só
// desloca a câmera desenhada. Para a mira (centro da tela) não "mentir", a câmera usa
// quase só altura, rolagem (gira em torno do centro da tela) e FOV; inclinação para
// frente/trás fica abaixo de meio grau e por instantes.
import type * as THREE from 'three';

export interface CameraMovement {
  x: number;
  y: number;
  z: number;
  onGround: boolean;
  alive: boolean;
  sliding: boolean;
  crouch: number;
  aim: number;
  /** Direção do olhar (rad), para separar andar de lado de andar para frente. */
  yaw?: number;
}

/** Algo que a câmera percebeu neste quadro, para poeira e afins (`movement-fx.ts`). */
export interface MovementCue {
  /** Pé que tocou o chão numa passada: -1 esquerdo, 1 direito, 0 nenhum. */
  step: -1 | 0 | 1;
  /** Aterrissagem: 0 nada; 1 queda pesada (~12 m/s ou mais). */
  land: number;
  jump: boolean;
}

export interface CameraMotion {
  /** Velocidade horizontal observada, zero em descontinuidades. */
  speed: number;
  /** Altura do corpo com a subida de degraus amortecida. */
  y: number;
  /** Balanço vertical da passada (m, sempre ≥ 0). */
  bob: number;
  /** Balanço lateral (m, ao longo da direita do olhar). */
  sway: number;
  /** Afundamento da aterrissagem/impulso do pulo (m, negativo = para baixo). */
  dip: number;
  /** Rolagem (rad): passada, andar de lado e slide. */
  roll: number;
  /** Inclinação extra (rad, positivo = para cima), mínima. */
  pitch: number;
  /** Graus a somar ao FOV base (corrida +, slide ++, queda rápida +; some na mira). */
  fov: number;
  /** Agachamento suavizado para o olho (a hitbox usa o valor da simulação). */
  crouch: number;
  /** Intensidade das linhas de velocidade (0 a 1). */
  lines: number;
  cue: MovementCue;
}

// ---- Conforto ---------------------------------------------------------------------------

const comfort = { scale: 1, reduced: false };

/**
 * Multiplicador global do movimento de câmera (0 = câmera parada, 1 = padrão, até 1.5).
 * Gancho para a opção "Movimento da câmera" do menu (W7). Vale para balanço, inclinação,
 * afundamento, FOV dinâmico e o tremor do `Juice`.
 */
export function setCameraMotionScale(scale: number) {
  comfort.scale = Math.min(1.5, Math.max(0, Number.isFinite(scale) ? scale : 1));
}

/** `prefers-reduced-motion` do sistema: corta o movimento para ~30%. */
export function setReducedMotion(reduced: boolean) {
  comfort.reduced = reduced;
}

export function cameraMotionScale() {
  return comfort.scale * (comfort.reduced ? 0.3 : 1);
}

export function reducedMotion() {
  return comfort.reduced;
}

// ---- Molas ------------------------------------------------------------------------------

const SUBSTEP = 1 / 240;

/** Mola amortecida 1D com subpassos fixos: mesma resposta a 30, 60 ou 144 Hz. */
export class Spring {
  value = 0;
  velocity = 0;
  target = 0;

  /** `omega` = rigidez (rad/s); `zeta` = amortecimento (1 = sem oscilar, < 1 = quica). */
  constructor(readonly omega: number, readonly zeta: number) {}

  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return this.value;
    const n = Math.max(1, Math.ceil(dt / SUBSTEP - 1e-9));
    const h = dt / n;
    const k = this.omega * this.omega, c = 2 * this.zeta * this.omega;
    for (let i = 0; i < n; i++) {
      this.velocity += (k * (this.target - this.value) - c * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  /** Velocidade inicial que leva a mola parada a um pico de `depth` (sinal incluso). */
  impulseFor(depth: number) {
    const w = this.omega, z = Math.min(this.zeta, 0.999);
    const wd = w * Math.sqrt(1 - z * z);
    const tp = Math.atan2(wd, z * w) / wd;
    const peak = Math.exp(-z * w * tp) * Math.sin(wd * tp) / wd; // pico por unidade de velocidade
    return depth / peak;
  }

  kick(depth: number) {
    this.velocity += this.impulseFor(depth);
  }

  reset() {
    this.value = this.velocity = this.target = 0;
  }
}

// ---- Curvas -----------------------------------------------------------------------------

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Profundidade do afundamento (m) pela velocidade de queda ao tocar o chão (m/s). */
export function landingDepth(fallSpeed: number) {
  // Pulo parado chega a ~9 m/s (≈ 4 cm); queda de 6 m chega a ~17,7 m/s (≈ 12 cm).
  return Math.min(0.14, Math.max(0, fallSpeed - 3) * 0.0082);
}

/** Força da aterrissagem para efeitos (0 a 1). */
export function landingStrength(fallSpeed: number) {
  return clamp01((fallSpeed - 6) / 10);
}

export interface FovInput { speed: number; sliding: boolean; vy: number; onGround: boolean; aim: number }

/** Graus somados ao FOV: corrida +5, slide até +10, queda rápida até +4. A mira cancela. */
export function dynamicFov({ speed, sliding, vy, onGround, aim }: FovInput) {
  const sprint = clamp01((speed - 6.5) / 3) * 5;
  // Pela distância real: slide travado numa parede não abre a lente.
  const slide = sliding ? clamp01(speed / 6) * 6 + clamp01((speed - 7) / 7) * 4 : 0;
  const fall = onGround ? 0 : clamp01((-vy - 10) / 8) * 4;
  return (Math.max(sprint, slide) + fall) * (1 - aim);
}

/** Intensidade das linhas de velocidade: leve correndo, forte no slide e na queda rápida. */
export function speedLineAmount({ speed, sliding, vy, onGround, aim }: FovInput) {
  const sprint = clamp01((speed - 8.5) / 1) * 0.22;
  const slide = sliding ? clamp01(speed / 6) * 0.45 + clamp01((speed - 7) / 6) * 0.55 : 0;
  const fall = onGround ? 0 : clamp01((-vy - 11) / 7);
  return Math.min(1, Math.max(sprint, slide, fall)) * (1 - aim);
}

// ---- Câmera do movimento ----------------------------------------------------------------

const STAIR_RATE = 20; // recupera 95% da altura em ~150 ms
const MAX_LAG = 0.45; // evita afundar o olho em escadarias rápidas, inclusive agachado
const BOB_RATE = 12;
/** Mesmo passo do som (`audio/footsteps.ts`): o vale do balanço cai em cada passada. */
export const STRIDE = 2.15;
/** Fase do balanço da arma por metro: meia volta por passada, no ritmo da câmera e do som. */
export const WALK_PHASE_PER_METER = (2 * Math.PI) / STRIDE;
const BOB_HEIGHT = 0.03; // pico a 9,5 m/s; anda (6 m/s) fica em ~1,9 cm
const SWAY = 0.012;
const BOB_ROLL = 0.0035;
const STRAFE_ROLL = 0.016; // ~0,9° andando de lado
const SLIDE_ROLL = 0.04; // ~2,3° no slide
const AIR_GRACE = 0.15; // s no ar que ainda contam como passada (ladeira)
const LAND_PITCH = 0.05; // rad por metro de afundamento (máx. ~0,4°)

/** Amortece só a subida apoiada. Saltos/quedas mantêm o deslocamento do corpo. */
export class MovementCamera {
  private previous: CameraMovement | null = null;
  private offset = 0;
  private bobWeight = 0;
  private stride = 0; // metros desde a última passada
  private foot: -1 | 1 = 1;
  private airVy = 0;
  private airTime = 0;
  private jumping = false;
  private readonly dip = new Spring(12, 0.5);
  private readonly pitch = new Spring(12, 0.6);
  private readonly roll = new Spring(7, 0.85);
  private readonly fov = new Spring(9, 1);
  private readonly crouch = new Spring(24, 1);
  private readonly lines = new Spring(10, 1);
  private crouchReady = false;

  reset() {
    this.previous = null;
    this.offset = this.bobWeight = this.stride = this.airVy = this.airTime = 0;
    this.jumping = false;
    for (const s of [this.dip, this.pitch, this.roll, this.fov, this.lines]) s.reset();
    this.crouchReady = false;
  }

  update(p: CameraMovement, dt: number): CameraMotion {
    const previous = this.previous;
    const travel = previous ? Math.hypot(p.x - previous.x, p.z - previous.z) : 0;
    const rise = previous ? p.y - previous.y : 0;
    const elapsed = Math.min(0.1, Math.max(0, dt));
    const cue: MovementCue = { step: 0, land: 0, jump: false };
    // Teleporte/renascimento não vira uma viagem da câmera pelo mapa.
    const discontinuity = travel > 2 || Math.abs(rise) > 1 || dt > 0.25;
    if (!previous || discontinuity || !p.alive) {
      this.offset = this.bobWeight = this.stride = this.airVy = this.airTime = 0;
      this.jumping = false;
      for (const s of [this.dip, this.pitch, this.roll, this.fov, this.lines]) s.reset();
      this.crouchReady = false;
    } else {
      const decay = Math.exp(-STAIR_RATE * elapsed);
      const stair = previous.onGround && p.onGround && rise > 0 && travel > 1e-6;
      // Integra a entrada linear entre quadros; a resposta não depende de 30/60/144 Hz.
      const follow = elapsed > 0 ? (1 - decay) / (STAIR_RATE * elapsed) : 1;
      this.offset = Math.max(-MAX_LAG, this.offset * decay - (stair ? rise * follow : 0));
      // Distância real: pressionar contra uma parede não mantém o balanço da cabeça.
      const speed = elapsed > 0 ? travel / elapsed : 0;
      const vy = elapsed > 0 ? rise / elapsed : 0;
      this.airTime = p.onGround ? 0 : this.airTime + elapsed;
      // Microdegraus de ladeira tiram o corpo do chão por instantes: isso ainda é passada.
      const footed = p.onGround || (!this.jumping && this.airTime < AIR_GRACE);
      const target = footed && !p.sliding ? Math.min(1, speed / 9.5) : 0;
      this.bobWeight += (target - this.bobWeight) * (1 - Math.exp(-BOB_RATE * elapsed));
      this.updateEvents(p, previous, travel, vy, footed, cue);
      this.updateTargets(p, previous, speed, vy, elapsed);
    }
    if (!this.crouchReady) { this.crouch.value = this.crouch.target = p.crouch; this.crouch.velocity = 0; this.crouchReady = true; }
    this.crouch.target = p.crouch;
    for (const s of [this.dip, this.pitch, this.roll, this.fov, this.crouch, this.lines]) s.step(elapsed);
    this.previous = { ...p };

    const scale = cameraMotionScale();
    const weight = this.bobWeight * (1 - p.crouch) * (1 - p.aim * 0.85) * scale;
    const phase = this.stride / STRIDE; // 0 = pé no chão, 0,5 = meio da passada
    const sway = Math.sin(Math.PI * phase) * this.foot; // alterna esquerda/direita a cada passo
    return {
      speed: previous && !discontinuity && p.alive && elapsed > 0 ? travel / elapsed : 0,
      y: p.y + this.offset,
      // Cosseno: vale suave em cada passada (a quina do abs(sin) incomodava).
      bob: (1 - Math.cos(phase * Math.PI * 2)) * 0.5 * BOB_HEIGHT * weight,
      sway: sway * SWAY * weight,
      dip: this.dip.value * scale,
      roll: (this.roll.value + sway * BOB_ROLL * this.bobWeight * (1 - p.aim * 0.85)) * scale,
      pitch: this.pitch.value * scale,
      fov: this.fov.value * Math.min(1, scale),
      crouch: Math.min(1, Math.max(0, this.crouch.value)),
      lines: Math.min(1, Math.max(0, this.lines.value)),
      cue,
    };
  }

  private updateEvents(p: CameraMovement, previous: CameraMovement, travel: number, vy: number, footed: boolean, cue: MovementCue) {
    if (!p.onGround) {
      if (previous.onGround && vy > 2) {
        cue.jump = true;
        this.jumping = true;
        this.dip.kick(-0.025); // impulso: o corpo sobe, o olho atrasa um pouco
        this.pitch.kick(0.004);
      }
      this.airVy = Math.min(this.airVy, vy);
      if (!footed) { this.stride = 0; return; }
    } else if (!previous.onGround) {
      const fall = -this.airVy;
      this.airVy = 0;
      this.jumping = false;
      const depth = landingDepth(fall);
      if (depth > 0) {
        this.dip.kick(-depth);
        this.pitch.kick(-depth * LAND_PITCH);
        cue.land = Math.max(0.05, landingStrength(fall));
      }
      if (fall > 4) { this.stride = 0; return; } // queda de verdade recomeça a passada
    }
    if (p.sliding || p.crouch > 0.5) { this.stride = 0; return; }
    this.stride += travel;
    if (this.stride >= STRIDE) {
      this.stride %= STRIDE;
      this.foot = this.foot === 1 ? -1 : 1;
      cue.step = this.foot;
    }
  }

  private updateTargets(p: CameraMovement, previous: CameraMovement, speed: number, vy: number, elapsed: number) {
    const yaw = p.yaw ?? 0;
    const vx = elapsed > 0 ? (p.x - previous.x) / elapsed : 0;
    const vz = elapsed > 0 ? (p.z - previous.z) / elapsed : 0;
    // Direita do olhar (câmera YXZ olhando para -Z quando yaw = 0).
    const lateral = vx * Math.cos(yaw) - vz * Math.sin(yaw);
    const strafe = Math.max(-1, Math.min(1, lateral / 9.5));
    // Rolagem positiva tomba para a esquerda: inclina para o lado em que se move.
    let roll = -strafe * STRAFE_ROLL;
    if (p.sliding) roll += (lateral > 1 ? -1 : 1) * SLIDE_ROLL * Math.min(1, speed / 9);
    this.roll.target = roll * (1 - p.aim * 0.7);
    const fovInput = { speed, sliding: p.sliding, vy, onGround: p.onGround, aim: p.aim };
    this.fov.target = dynamicFov(fovInput);
    this.lines.target = speedLineAmount(fovInput);
  }
}

// ---- Soco de câmera (acerto, abate, dano) -----------------------------------------------

export type KickKind = 'hit' | 'head' | 'kill' | 'headkill' | 'hurt';

/**
 * Tremor "anime" direcional: em vez de sacudir a mira, a câmera gira em torno do centro
 * da tela (rolagem), dá um zoom de impacto (FOV) e é empurrada alguns centímetros. O
 * centro da tela continua apontando para onde a simulação atira.
 */
export class CameraKick {
  private readonly roll = new Spring(19, 0.4);
  private readonly fov = new Spring(20, 0.55);
  private readonly push = [new Spring(15, 0.7), new Spring(15, 0.7), new Spring(15, 0.7)];
  private side = 1;

  /**
   * `lateral` (-1 a 1): de que lado veio o dano em relação ao olhar (1 = da direita).
   * `push`: direção (mundo) para onde empurrar a câmera, já normalizada.
   */
  add(kind: KickKind, lateral?: number, push?: { x: number; y: number; z: number }) {
    this.side = -this.side; // alterna para acertos seguidos não somarem para um lado só
    if (kind === 'hit' || kind === 'head') {
      this.roll.kick(this.side * (kind === 'head' ? 0.011 : 0.006));
      this.fov.kick(kind === 'head' ? -1.6 : -0.8);
    } else if (kind === 'kill' || kind === 'headkill') {
      // Pose do impacto aplicada na hora: o hit-stop congela o quadro já "socado".
      this.roll.value = this.side * (kind === 'headkill' ? 0.045 : 0.032);
      this.roll.velocity = 0;
      this.fov.value = Math.min(this.fov.value, kind === 'headkill' ? -5 : -3.5);
      this.fov.velocity = 0;
    } else {
      const side = lateral === undefined ? this.side : Math.sign(lateral) || this.side;
      // Tiro da direita tomba a cabeça para a esquerda (rolagem positiva), como um tranco.
      this.roll.kick(side * (0.025 + 0.02 * Math.min(1, Math.abs(lateral ?? 0.5))));
      this.fov.kick(2.2);
      if (push) this.push.forEach((s, i) => s.kick((i === 0 ? push.x : i === 1 ? push.y : push.z) * 0.06));
    }
  }

  step(dt: number) {
    this.roll.step(dt);
    this.fov.step(dt);
    for (const s of this.push) s.step(dt);
  }

  /** Valores já com a escala de conforto (o retorno nunca some de todo: é informação). */
  read() {
    const k = 0.25 + 0.75 * Math.min(1, cameraMotionScale());
    // Uma salva de escopeta confirma vários projéteis juntos: o feedback tem teto.
    const bounded = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v)) * k;
    return {
      roll: bounded(this.roll.value, -0.06, 0.06),
      fov: bounded(this.fov.value, -5, 3),
      x: bounded(this.push[0].value, -0.06, 0.06), y: bounded(this.push[1].value, -0.06, 0.06), z: bounded(this.push[2].value, -0.06, 0.06),
    };
  }

  reset() {
    this.roll.reset(); this.fov.reset();
    for (const s of this.push) s.reset();
  }
}

/** Lado (-1 a 1) de onde vem algo em `from`, visto de `eye` olhando para `yaw` (1 = direita). */
export function lateralOf(from: { x: number; z: number }, eye: { x: number; z: number }, yaw: number) {
  const dx = from.x - eye.x, dz = from.z - eye.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return 0;
  return (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / len;
}

/**
 * Coloca a câmera no olho: corpo amortecido + agachamento suave + balanço + afundamento.
 * Mesmo código no treino e no online. `extra` soma coice/queda da morte.
 */
export function placeEye(
  camera: THREE.PerspectiveCamera, x: number, z: number, eyeY: number, motion: CameraMotion,
  yaw: number, pitch: number, extraRoll = 0,
) {
  const s = motion.sway;
  camera.position.set(x + Math.cos(yaw) * s, eyeY + motion.bob + motion.dip, z - Math.sin(yaw) * s);
  camera.rotation.set(pitch + motion.pitch, yaw, motion.roll + extraRoll, 'YXZ');
}
