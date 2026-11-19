// IA dos bots do modo online (puro, roda no servidor): gera um `PlayerCommand` por tick, que
// passa pela MESMA simulação dos jogadores (stepNet). Anda pela grade de navegação até
// pontos do mapa, procura inimigos com cone de visão + linha de visão (raio contra AABB) e
// mira como gente: demora para reagir, gira com velocidade limitada e erra um pouco.
// Cada bot tem uma persona (bot-persona.ts): arma, distância preferida e jeito de lutar
// (bot-fight.ts); as pernas ficam em bot-mover.ts.
import type { PlayerCommand } from '../sim/command';
import type { Box } from '../sim/physics';
import { PITCH_LIMIT } from '../sim/player';
import { eyeOffset } from '../sim/crouch';
import { lineOfSight } from '../sim/ray';
import type { Rng } from '../sim/rng';
import type { Vec3 } from '../sim/vec';
import type { BotNav } from './bot-nav';
import type { FlatPlayer } from './protocol';
import { HACK_RULES } from './hack-objectives';
import { type BotDifficulty, type BotLevel, type BotPersona, type BotSkill, DEFAULT_SKILL, DIFFICULTY, PERSONAS, type PersonaId, pickPersona } from './bot-persona';
import { BotFight } from './bot-fight';
import { BotMover } from './bot-mover';

export { DEFAULT_SKILL, type BotSkill } from './bot-persona';

export const BOT_NAMES = [
  'Capivara', 'Saci', 'Curupira', 'Boto', 'Tatu', 'Jabuti', 'Sabiá', 'Mico', 'Arara', 'Onça',
  'Tucano', 'Quati', 'Preá', 'Jacaré', 'Siri', 'Gambá',
];

/** O que o bot sabe de cada outro jogador (posição atual: o servidor não tem atraso). */
export interface BotView {
  id: string;
  x: number;
  y: number;
  z: number;
  alive: boolean;
  invuln: boolean;
  crouchAmount?: number;
  /** Para onde olha (golpe pelas costas) e a vida (finalizar com o chinelo). */
  yaw?: number;
  hp?: number;
}

/** Extras do tick: onde está o chinelo dele caído no chão (para ir buscar). */
export interface BotExtras {
  slipper?: Vec3 | null;
}

const VISION_EVERY = 0.1;
const LOSE_AFTER = 0.6;
const CHEST = 0.3; // acima do centro do corpo
const HEAD = 0.78;
const CHASE_TIME = 3.5;
const SLIPPER_GIVE_UP = 10;

export interface BotWorld {
  solids: readonly Box[];
  nav: BotNav | null;
  rng: Rng;
}

/** Bot novo com persona escolhida pela sala (a menos usada) e o nível da sala. */
export function createBot(world: BotWorld, difficulty: BotDifficulty = 'normal', inUse: readonly (PersonaId | undefined)[] = []): BotBrain {
  const level = DIFFICULTY[difficulty];
  return new BotBrain(world, level.skill, pickPersona(world.rng, inUse), level);
}

export class BotBrain {
  private seq = 0;
  private aimYaw = 0;
  private aimPitch = 0;
  private readonly mover: BotMover;
  private readonly fighter: BotFight;
  private readonly skill: BotSkill;
  // combate
  private target: string | null = null;
  private aimPoint: Vec3 | null = null;
  private seenFor = 0;
  private lostFor = 0;
  private reaction = 0.3;
  private visionTimer = 0;
  private errYaw = 0;
  private errPitch = 0;
  private errTimer = 0;
  private lastSeen: Vec3 | null = null;
  private chaseLeft = 0;
  private slipperKey = '';
  private lookBack = 0;
  private lookBackYaw = 0;
  private aimHeight = CHEST;

  constructor(
    private readonly world: BotWorld,
    skill: BotSkill = DEFAULT_SKILL,
    readonly persona: BotPersona = PERSONAS.soldado,
    level: BotLevel = DIFFICULTY.normal,
  ) {
    this.skill = { ...skill, sight: skill.sight * persona.sight };
    this.mover = new BotMover(world, persona);
    this.fighter = new BotFight(persona, level, world.rng, world.solids);
  }

  /** Acabou de nascer: olha para onde o servidor sugeriu e esquece o combate. */
  reset(yaw: number) {
    this.aimYaw = yaw;
    this.aimPitch = 0;
    this.target = null;
    this.aimPoint = null;
    this.seenFor = 0;
    this.chaseLeft = 0;
    this.mover.reset();
    this.fighter.reset();
  }

  /** Alvo atual (para teste/depuração). */
  get targetId(): string | null {
    return this.target;
  }

  /** Arma que o bot quer na mão (índice do ARSENAL). */
  get wantedWeapon(): number {
    return this.fighter.slot;
  }

  think(self: FlatPlayer, others: readonly BotView[], dt: number, objectives: readonly Vec3[] = [], extras: BotExtras = {}): PlayerCommand {
    if (this.target && !others.some(p => p.id === this.target && p.alive)) { this.target = null; this.aimPoint = null; this.chaseLeft = 0; }
    const cmd: PlayerCommand = {
      seq: ++this.seq, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: this.aimYaw, pitch: this.aimPitch, fire: false, alt: false,
    };
    if (self.hp <= 0) {
      this.target = null;
      return cmd;
    }
    const eye = { x: self.x, y: self.y + eyeOffset(self), z: self.z };
    this.visionTimer -= dt;
    if (this.visionTimer <= 0) {
      this.visionTimer = VISION_EVERY;
      this.look(eye, others);
    }
    const nearest = [...objectives].sort((a, b) => Math.hypot(a.x - self.x, a.z - self.z) - Math.hypot(b.x - self.x, b.z - self.z))[0];
    const near = nearest && Math.hypot(nearest.x - eye.x, nearest.y - eye.y, nearest.z - eye.z) < HACK_RULES.range && lineOfSight(eye, nearest, this.world.solids);
    const view = this.target ? others.find((o) => o.id === this.target) : undefined;
    // Entre as checagens de visão a mira acompanha o corpo (a mesma parte que estava à vista)
    if (view && this.aimPoint) this.aimPoint = { x: view.x, y: view.y + this.aimHeight, z: view.z };
    if (nearest && (near || !this.target)) {
      this.fighter.idle(cmd, self, dt);
      this.seekObjective(cmd, self, nearest, dt);
    } else if (view && this.aimPoint) this.fight(cmd, self, eye, view, dt);
    else {
      this.fighter.idle(cmd, self, dt);
      this.roam(cmd, self, dt, extras);
    }
    cmd.weaponSlot = this.fighter.slot + 1;
    cmd.yaw = this.aimYaw;
    cmd.pitch = this.aimPitch;
    return cmd;
  }

  private seekObjective(cmd: PlayerCommand, self: FlatPlayer, target: Vec3, dt: number) {
    const eye = { x: self.x, y: self.y + eyeOffset(self), z: self.z };
    const dx = target.x - self.x, dz = target.z - self.z;
    if (Math.hypot(dx, target.y - eye.y, dz) < HACK_RULES.range - 0.2 && lineOfSight(eye, target, this.world.solids)) {
      this.turnTowards(Math.atan2(-dx, -dz), Math.atan2(target.y - eye.y, Math.hypot(dx, dz)), dt, 6);
      cmd.alt = true;
      return;
    }
    this.walkTo(cmd, self, this.mover.pathTo(self, target, 1.8), dt);
  }

  /** Vira para o destino e anda até ele. */
  private walkTo(cmd: PlayerCommand, self: FlatPlayer, dest: Vec3, dt: number) {
    const vx = dest.x - self.x, vz = dest.z - self.z;
    if (Math.hypot(vx, vz) < 0.05) return;
    this.turnTowards(Math.atan2(-vx, -vz), 0, dt, 6);
    this.mover.steer(cmd, self, dest, this.aimYaw, dt);
  }

  /** Procura o inimigo visível mais perto (quem já é o alvo é seguido mesmo fora do cone). */
  private look(eye: Vec3, others: readonly BotView[]) {
    const fx = -Math.sin(this.aimYaw);
    const fz = -Math.cos(this.aimYaw);
    const cosFov = Math.cos(this.skill.fov);
    let best: { id: string; point: Vec3; d: number } | null = null;
    for (const o of others) {
      if (!o.alive || o.invuln) continue;
      const dx = o.x - eye.x;
      const dz = o.z - eye.z;
      const d = Math.hypot(dx, o.y - eye.y, dz);
      if (d > this.skill.sight || (best && d >= best.d)) continue;
      const tracked = o.id === this.target;
      const flat = Math.hypot(dx, dz) || 1;
      if (!tracked && (fx * dx + fz * dz) / flat < cosFov) continue;
      const point = this.visiblePoint(eye, o);
      if (point) best = { id: o.id, point, d };
    }
    if (best) {
      if (best.id !== this.target) {
        this.target = best.id;
        this.seenFor = 0;
        const [lo, hi] = this.skill.reaction;
        this.reaction = lo + (hi - lo) * this.world.rng();
        this.rollError(this.skill.errorStart);
        this.mover.stopHolding();
      }
      this.aimPoint = best.point;
      this.aimHeight = best.point.y - (others.find((o) => o.id === best!.id)?.y ?? best.point.y);
      this.lastSeen = { ...best.point };
      this.lostFor = 0;
    } else if (this.target) {
      this.lostFor += VISION_EVERY;
      this.aimPoint = null;
      if (this.lostFor >= LOSE_AFTER) {
        this.target = null;
        // Quem gosta de briga vai atrás de onde viu o alvo por último
        if (this.persona.aggression >= 0.5 && this.world.rng() < this.persona.aggression) this.chaseLeft = CHASE_TIME;
      }
    }
  }

  /** Peito ou cabeça, o que estiver à vista (atrás de mureta baixa, só a cabeça). */
  private visiblePoint(eye: Vec3, o: BotView): Vec3 | null {
    const chest = { x: o.x, y: o.y + CHEST - (o.crouchAmount ?? 0) * 0.4, z: o.z };
    if (lineOfSight(eye, chest, this.world.solids)) return chest;
    const head = { x: o.x, y: o.y + HEAD - (o.crouchAmount ?? 0) * 0.55, z: o.z };
    if (lineOfSight(eye, head, this.world.solids)) return head;
    return null;
  }

  private rollError(size: number) {
    const g = () => (this.world.rng() + this.world.rng() + this.world.rng() - 1.5) / 1.5; // ~gaussiano em [-1, 1]
    this.errYaw = g() * size;
    this.errPitch = g() * size * 0.6;
    this.errTimer = 0.25 + this.world.rng() * 0.35;
  }

  private fight(cmd: PlayerCommand, self: FlatPlayer, eye: Vec3, view: BotView, dt: number) {
    const p = this.aimPoint!;
    this.seenFor += dt;
    const want = this.fighter.aimFor(eye, p);
    // Erro humano: grande ao ver alguém, menor com a mira assentada; muda de tempos em tempos
    this.errTimer -= dt;
    if (this.errTimer <= 0) {
      const k = Math.min(1, this.seenFor / this.skill.settle);
      this.rollError(this.skill.errorStart + (this.skill.errorSettled - this.skill.errorStart) * k);
    }
    this.turnTowards(want.yaw + this.errYaw, want.pitch + this.errPitch, dt, this.skill.turnRate);
    const off = Math.hypot(angleDiff(this.aimYaw, want.yaw), this.aimPitch - want.pitch);
    this.fighter.act(cmd, self, eye, view, off, this.seenFor >= this.reaction, dt, this.mover, this.skill.fireCone);
  }

  /** Sem inimigo à vista: busca o chinelo, persegue, segura posição ou passeia pelo mapa. */
  private roam(cmd: PlayerCommand, self: FlatPlayer, dt: number, extras: BotExtras) {
    const slipper = extras.slipper;
    const key = slipper ? `${slipper.x.toFixed(1)},${slipper.z.toFixed(1)}` : '';
    if (key !== this.slipperKey) { this.slipperKey = key; this.mover.pathTime = 0; }
    // Levou tiro sem ver de onde: larga a posição e vira para trás procurando
    if (self.sinceHurt < 0.05 && this.lookBack <= 0) {
      this.lookBack = 0.7;
      this.lookBackYaw = wrap(this.aimYaw + Math.PI * (this.world.rng() < 0.5 ? 0.85 : -0.85));
      this.mover.stopHolding();
    }
    if (this.lookBack > 0) {
      this.lookBack -= dt;
      this.turnTowards(this.lookBackYaw, 0, dt, this.skill.turnRate);
      return;
    }
    if (slipper && !self.slipperReady && this.mover.pathTime < SLIPPER_GIVE_UP) {
      this.mover.pathTime += dt;
      const close = Math.hypot(slipper.x - self.x, slipper.z - self.z) < 6 && lineOfSight({ x: self.x, y: self.y, z: self.z }, { x: slipper.x, y: slipper.y + 0.1, z: slipper.z }, this.world.solids);
      this.walkTo(cmd, self, close ? slipper : this.mover.pathTo(self, slipper), dt);
      return;
    }
    if (this.chaseLeft > 0 && this.lastSeen) {
      this.chaseLeft -= dt;
      if (Math.hypot(this.lastSeen.x - self.x, this.lastSeen.z - self.z) > 1.5) {
        this.walkTo(cmd, self, this.lastSeen, dt);
        return;
      }
      this.chaseLeft = 0;
    }
    const watch = this.mover.holding(dt);
    if (watch !== null) {
      this.turnTowards(watch, -0.03, dt, 2);
      cmd.crouch = this.persona.crouchShoot && self.reloadRemaining > 0;
      return;
    }
    const dest = this.mover.roamTarget(self);
    if (dest) this.walkTo(cmd, self, dest, dt);
  }

  private turnTowards(yaw: number, pitch: number, dt: number, rate: number) {
    const max = rate * dt;
    const dy = angleDiff(yaw, this.aimYaw);
    this.aimYaw = wrap(this.aimYaw + clamp(dy * 0.35, -max, max));
    const dp = pitch - this.aimPitch;
    this.aimPitch = clamp(this.aimPitch + clamp(dp * 0.35, -max, max), -PITCH_LIMIT, PITCH_LIMIT);
  }
}

function wrap(a: number): number {
  const two = Math.PI * 2;
  return a - two * Math.floor((a + Math.PI) / two);
}

/** a - b no círculo, em [-π, π). */
function angleDiff(a: number, b: number): number {
  return wrap(a - b);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
