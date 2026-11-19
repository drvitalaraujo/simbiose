// Animação procedural do viewmodel (arma + mãos em primeira pessoa), pura: sem Three.js.
// Entra o estado do jogador (velocidade, chão, mira) e os eventos visuais (tiro, recarga);
// sai a pose da arma em relação à câmera. NÃO muda nada da simulação: o coice da mira,
// a cadência e o espalhamento continuam em src/sim/weapon.ts — aqui é só o desenho.

import { RELOAD_TIME } from '../../sim/ammo';
import { boltCycle, clamp, magazineReload, pumpCycle, restReload, shellReload, smooth } from './reload-pose';
export { RELOAD_TIME } from '../../sim/ammo';

/** Mola amortecida (x'' = -k·(x - alvo) - c·x'), em subpassos para aguentar dt grande. */
export class Spring {
  value = 0;
  velocity = 0;
  target = 0;

  constructor(public stiffness: number, public damping: number) {}

  step(dt: number) {
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(left, 1 / 240);
      const acc = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += acc * h;
      this.value += this.velocity * h;
      left -= h;
    }
  }

  reset(v = 0) {
    this.value = v;
    this.velocity = 0;
    this.target = v;
  }
}

/** O que o viewmodel precisa saber do jogador a cada quadro. */
export interface MotionInput {
  /** Velocidade (m/s) no mundo. */
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  /** Fase do balanço da caminhada (a mesma da câmera, `Player.bobPhase`). */
  bobPhase: number;
  yaw: number;
  pitch: number;
  sliding?: boolean;
  crouchAmount?: number;
  /** Quando presente, a pose segue a simulação, inclusive correções da rede. */
  reloadRemaining?: number;
  reloadDuration?: number;
  aimAmount?: number;
  weaponIndex?: number;
}

/** Pose da arma relativa à pose de descanso (metros e radianos, eixos da câmera). */
export interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  /** Ferrolho: 0 fechado, 1 todo para trás. */
  bolt: number;
  /** Alavanca do ferrolho manual: 0 abaixada, 1 levantada. */
  boltLift: number;
  /** Equipar: 1 guardada (abaixo da tela), 0 em posição; passa um pouco de 0 (mola). */
  equip: number;
  /** Recarga: deslocamento do carregador e da mão de apoio (eixos da arma). */
  magY: number;
  magZ: number;
  magRx: number;
  handX: number;
  handY: number;
  handZ: number;
  /** Brilho da célula de energia (0 a 1): apaga na troca e volta com um pico. */
  cell: number;
  /** 0 a 1: quanto da pose de corrida está aplicada. */
  sprint: number;
  pump: number;
}

const BOLT_TIME = 0.075; // < 1/9 s: o ferrolho fecha antes do próximo tiro
const SPRINT_FROM = 8.5; // m/s (andar = 7, correr = 11)
const FIRE_HOLDS_SPRINT = 0.35; // atirando correndo, a arma sobe por este tempo

const REST_RELOAD = restReload();
const EQUIP_RACK = 0.2; // s depois de sacar: puxa o ferrolho / bombeia
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class ViewmodelMotion {
  // Coice: recuo (z), sobe (rx), torce (rz/ry) e volta com mola "estalada" (anime)
  private readonly kickZ = new Spring(520, 26);
  private readonly kickRx = new Spring(420, 22);
  private readonly kickRz = new Spring(300, 18);
  private readonly kickY = new Spring(380, 24);
  // Inércia da mira: a arma atrasa um pouco ao virar
  private readonly lagX = new Spring(140, 18);
  private readonly lagY = new Spring(140, 18);
  // Pouso de pulo
  private readonly land = new Spring(180, 14);
  // Sacar: sobe de baixo com antecipação e passa um pouco do ponto (subamortecida)
  private readonly equipSpring = new Spring(240, 19);
  private rackIn = -1;
  private readonly reloadOut = restReload();
  private sprintAmt = 0;
  private moveAmt = 0;
  private airAmt = 0;
  private slideAmt = 0;
  private roll = 0;
  private boltT = 1;
  private reloadT = -1;
  private sinceShot = 9;
  private time = 0;
  /** Histórico da mira/chão; `fresh` = começa da próxima entrada (após criar ou reset). */
  private fresh = true;
  private prevYaw = 0;
  private prevPitch = 0;
  private wasOnGround = true;
  private prevVy = 0;
  private kickSign = 1;

  readonly pose: Pose = {
    x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, bolt: 0, boltLift: 0, equip: 0,
    magY: 0, magZ: 0, magRx: 0, handX: 0, handY: 0, handZ: 0, cell: 1, sprint: 0, pump: 0,
  };

  constructor(private readonly rng: () => number = Math.random) {}

  /** Um disparo (evento `shot`): coice visual + ferrolho. */
  shot(strength = 1) {
    // Impulsos nas molas (pico ~ impulso / sqrt(rigidez)): recua ~3 cm e sobe ~5°
    const r = this.rng();
    this.kickZ.velocity += 1.0 * strength;
    this.kickRx.velocity += (1.8 + r * 0.6) * strength;
    this.kickSign = -this.kickSign;
    this.kickRz.velocity += this.kickSign * (0.22 + r * 0.16) * strength;
    this.kickY.velocity += 0.12 * strength;
    this.boltT = 0;
    this.sinceShot = 0;
  }

  /** Prévia isolada: toca a animação inteira. No jogo, MotionInput sincroniza o tempo. */
  reload() {
    if (this.reloadT < 0) this.reloadT = 0;
  }

  get reloading() {
    return this.reloadT >= 0;
  }

  /** Troca de arma: a nova sobe de baixo, passa do ponto e estala o ferrolho. */
  equip() {
    this.equipSpring.reset(1);
    this.equipSpring.target = 0;
    this.rackIn = EQUIP_RACK;
  }

  /**
   * Volta tudo ao descanso NA HORA (renascer, teleporte): molas, pose de saída, ferrolho,
   * recarga e o histórico de mira/chão (sem pouso nem tranco de mira falsos depois).
   */
  reset() {
    for (const s of [this.kickZ, this.kickRx, this.kickRz, this.kickY, this.lagX, this.lagY, this.land, this.equipSpring]) s.reset();
    this.rackIn = -1;
    this.sprintAmt = this.moveAmt = this.airAmt = this.roll = 0;
    this.slideAmt = 0;
    this.boltT = 1;
    this.reloadT = -1;
    this.sinceShot = 9;
    this.fresh = true;
    const p = this.pose;
    p.x = p.y = p.z = p.rx = p.ry = p.rz = p.bolt = p.boltLift = p.equip = p.sprint = 0;
    p.magY = p.magZ = p.magRx = p.handX = p.handY = p.handZ = 0;
    p.cell = 1;
    p.pump = 0;
  }

  /** Avança um quadro (dt = 0 congela, como no hit-stop). */
  update(dt: number, p: MotionInput): Pose {
    if (p.reloadRemaining !== undefined) {
      this.reloadT = p.reloadRemaining > 0 ? RELOAD_TIME * (1 - p.reloadRemaining / (p.reloadDuration ?? RELOAD_TIME)) : -1;
    }
    if (dt <= 0) return this.pose;
    this.time += dt;
    this.sinceShot += dt;
    const speed = Math.hypot(p.vx, p.vz);
    const follow = (cur: number, to: number, rate: number) => cur + (to - cur) * (1 - Math.exp(-dt * rate));

    // Andar/correr
    const posture = p.crouchAmount ?? 0;
    this.slideAmt += ((p.sliding ? 1 : 0) - this.slideAmt) * (1 - Math.exp(-dt * 16));
    this.moveAmt = follow(this.moveAmt, p.onGround && !p.sliding ? clamp(speed / 7, 0, 1.6) * (1 - posture * 0.7) : 0, 10);
    const wantSprint = !(p.aimAmount && p.aimAmount > 0) && p.onGround && !p.sliding && posture < 0.1 && speed > SPRINT_FROM && this.sinceShot > FIRE_HOLDS_SPRINT && this.reloadT < 0;
    this.sprintAmt = follow(this.sprintAmt, wantSprint ? 1 : 0, wantSprint ? 7 : 14);
    this.airAmt = follow(this.airAmt, p.onGround ? 0 : 1, 8);

    // Inclina para o lado em que anda (em relação à mira)
    const lateral = p.vx * Math.cos(p.yaw) - p.vz * Math.sin(p.yaw);
    this.roll = follow(this.roll, clamp(-lateral / 11, -1, 1), 8);

    // Inércia da mira: a velocidade de giro empurra o alvo da mola
    if (this.fresh) {
      this.fresh = false;
      this.prevYaw = p.yaw;
      this.prevPitch = p.pitch;
      this.wasOnGround = p.onGround;
      this.prevVy = p.vy;
    }
    const yawRate = wrapAngle(p.yaw - this.prevYaw) / dt;
    const pitchRate = (p.pitch - this.prevPitch) / dt;
    this.prevYaw = p.yaw;
    this.prevPitch = p.pitch;
    this.lagX.target = clamp(yawRate * 0.006, -0.035, 0.035);
    this.lagY.target = clamp(-pitchRate * 0.005, -0.03, 0.03);

    // Pouso: tranco proporcional à velocidade de queda
    if (p.onGround && !this.wasOnGround && this.prevVy < -2) this.land.velocity -= clamp(-this.prevVy * 0.035, 0, 0.6);
    if (!p.onGround && this.wasOnGround && p.vy > 2) this.land.velocity += 0.15; // impulso do pulo
    this.wasOnGround = p.onGround;
    this.prevVy = p.vy;

    for (const s of [this.kickZ, this.kickRx, this.kickRz, this.kickY, this.lagX, this.lagY, this.land, this.equipSpring]) s.step(dt);
    if (this.rackIn >= 0) {
      this.rackIn -= dt;
      if (this.rackIn < 0) {
        this.boltT = 0; // estalo do ferrolho ao sacar
        if (p.weaponIndex === 3 && this.reloadT < 0) this.sinceShot = 0; // e bombeia a escopeta
      }
    }

    // Balanço em "8" (figura de Lissajous) pela fase da caminhada
    const b = p.bobPhase * 0.5;
    const amp = this.moveAmt * (1 - this.sprintAmt * 0.3);
    const runAmp = this.sprintAmt;
    const bobX = Math.cos(b) * 0.011 * amp + Math.cos(b) * 0.02 * runAmp;
    const bobY = -Math.abs(Math.sin(b)) * 0.009 * amp - Math.abs(Math.sin(b)) * 0.014 * runAmp;
    const breathe = Math.sin(this.time * 1.7) * 0.0025 * (1 - Math.min(1, this.moveAmt));

    // Ferrolho: volta todo no tiro e fecha com aceleração
    this.boltT = Math.min(1, this.boltT + dt / BOLT_TIME);
    const bolt = this.boltT < 0.25 ? 1 : 1 - smooth((this.boltT - 0.25) / 0.75);

    const r = this.reloadPose(p.reloadRemaining === undefined ? dt : 0, p.weaponIndex ?? 0);
    // Sniper: ferrolho manual depois de cada tiro (fora da recarga)
    const cycle = p.weaponIndex === 2 && this.reloadT < 0 ? boltCycle(this.sinceShot) : { lift: 0, back: 0 };
    const s = this.sprintAmt;
    const pose = this.pose;
    const eq = this.equipSpring.value;
    pose.x = bobX + this.lagX.value - s * 0.03 + r.x - this.slideAmt * 0.018 + eq * 0.04;
    pose.y = bobY + breathe + this.lagY.value + this.land.value + this.airAmt * 0.012 - s * 0.035 + this.kickY.value + r.y - this.slideAmt * 0.026 - cycle.lift * 0.008 - eq * 0.2;
    pose.z = this.kickZ.value + s * 0.02;
    const steady = 1 - (p.aimAmount ?? 0) * 0.8;
    pose.rx = this.kickRx.value * (1 - (p.aimAmount ?? 0) * 0.55) + (-this.land.value * 1.4 + this.airAmt * 0.05 + this.lagY.value * 1.5) * steady - s * 0.32 + r.rx - eq * 0.55;
    pose.ry = this.lagX.value * 2.2 + s * 0.55 + Math.cos(b) * 0.03 * runAmp + r.ry + eq * 0.25;
    pose.rz = this.kickRz.value + this.roll * 0.085 + this.lagX.value * 1.2 + s * 0.12 + Math.sin(b) * 0.02 * amp + r.rz - this.slideAmt * 0.3 + eq * 0.4 + cycle.lift * 0.07;
    pose.bolt = Math.max(bolt * (p.weaponIndex === 2 ? 0 : 1), r.bolt, cycle.back);
    pose.boltLift = Math.max(r.boltLift, cycle.lift);
    pose.equip = eq;
    pose.sprint = s;
    pose.pump = p.weaponIndex === 3 && this.reloadT < 0 ? pumpCycle(this.sinceShot) : 0;
    return pose;
  }

  /**
   * Linha do tempo da recarga, por arma (reload-pose.ts): carregador na MK-2, Faísca e
   * Linha Morta (esta com o ferrolho manual no fim); cartucho a cartucho na escopeta.
   */
  private reloadPose(dt: number, weaponIndex: number) {
    const pose = this.pose;
    const out = Object.assign(this.reloadOut, REST_RELOAD);
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      const t = this.reloadT / RELOAD_TIME; // 0..1
      if (t >= 1) this.reloadT = -1;
      else if (weaponIndex === 3) shellReload(t, out);
      else magazineReload(t, weaponIndex, out);
    }
    pose.magY = out.magY;
    pose.magZ = out.magZ;
    pose.magRx = out.magRx;
    pose.handX = out.handX;
    pose.handY = out.handY;
    pose.handZ = out.handZ;
    pose.cell = out.cell;
    return out;
  }
}
