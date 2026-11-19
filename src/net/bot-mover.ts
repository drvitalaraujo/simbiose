// Pernas dos bots (puro): passeio pelos pontos do mapa (o atirador prefere os altos e segura
// posição olhando a linha mais longa), caminho até um ponto qualquer (drone, chinelo no
// chão), destravar de quinas (passo de lado + pulo).
import type { PlayerCommand } from '../sim/command';
import { raycastBoxes } from '../sim/ray';
import type { Vec3 } from '../sim/vec';
import { nodeAt, walkDistances } from '../game/maps/nav';
import type { BotPersona } from './bot-persona';
import type { BotWorld } from './bot';
import type { FlatPlayer } from './protocol';

const STUCK_CHECK = 1;
const LOOK_RAYS = 16;

export class BotMover {
  private goal = -1;
  private field: Float64Array | null = null;
  private pathKey = '';
  private pathField: Float64Array | null = null;
  private stuckTimer = STUCK_CHECK;
  private stuckCount = 0;
  private lastX = 0;
  private lastZ = 0;
  private jumpNext = false;
  private sidestep = 0;
  private sideDir = 1;
  private holdLeft = 0;
  private lookYaws: number[] = [];
  private lookIndex = 0;
  private lookTimer = 0;
  /** Tempo seguindo o mesmo destino avulso (para desistir de chinelo inalcançável). */
  pathTime = 0;

  constructor(private readonly world: BotWorld, private readonly persona: BotPersona) {}

  reset() {
    this.goal = -1;
    this.field = null;
    this.stuckCount = 0;
    this.holdLeft = 0;
    this.sidestep = 0;
    this.pathKey = '';
  }

  /** Segurando posição (atirador no alto): para onde olhar agora; null = não está segurando. */
  holding(dt: number): number | null {
    if (this.holdLeft <= 0) return null;
    this.holdLeft -= dt;
    if (this.holdLeft <= 0 || this.lookYaws.length === 0) return null;
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookIndex = (this.lookIndex + 1) % this.lookYaws.length;
      this.lookTimer = 1.5 + this.world.rng() * 2;
    }
    return this.lookYaws[this.lookIndex];
  }

  /** Larga a posição (levou tiro, viu alguém perto, etc.). */
  stopHolding() {
    this.holdLeft = 0;
  }

  /** Próximo ponto do passeio; ao chegar, escolhe outro (ou segura posição, se for o estilo). */
  roamTarget(self: FlatPlayer): Vec3 | null {
    const nav = this.world.nav;
    if (!nav) return null;
    if (this.goal < 0 || !this.field) this.pickGoal();
    const node = nav.nodeAt({ x: self.x, y: self.y - 0.85, z: self.z });
    let dest: Vec3 | null = null;
    if (this.field && node !== null) {
      if (this.field[node] < 2.5 || !Number.isFinite(this.field[node])) {
        if (this.field[node] < 2.5 && this.persona.hold[1] > 0) this.beginHold(self);
        this.pickGoal();
      }
      if (this.field) dest = nav.waypoint(this.field, node, this.stuckCount > 0 ? 2 : 5);
    }
    if (!dest && this.goal >= 0) dest = nav.goals[this.goal];
    return dest;
  }

  /** Próximo ponto do caminho a pé até `target` (pés no chão em `target.y - feetDrop`). */
  pathTo(self: FlatPlayer, target: Vec3, feetDrop = 0): Vec3 {
    const nav = this.world.nav;
    if (!nav) return target;
    const key = `${Math.round(target.x * 2)},${Math.round(target.y * 2)},${Math.round(target.z * 2)}`;
    if (key !== this.pathKey) {
      this.pathKey = key;
      this.pathTime = 0;
      const node = nodeAt(nav.grid, { x: target.x, y: target.y - feetDrop, z: target.z });
      this.pathField = node === null ? null : walkDistances(nav.grid, node);
    }
    const from = nav.nodeAt({ x: self.x, y: self.y - 0.85, z: self.z });
    if (from === null || !this.pathField) return target;
    return nav.waypoint(this.pathField, from, this.stuckCount > 0 ? 2 : 5) ?? target;
  }

  /**
   * Converte "quero ir até `dest`" em eixos do comando, a partir da mira atual. Destrava de
   * quinas com um passo de lado ou pulo.
   */
  steer(cmd: PlayerCommand, self: FlatPlayer, dest: Vec3, yaw: number, dt: number) {
    let dx = dest.x - self.x;
    let dz = dest.z - self.z;
    const len0 = Math.hypot(dx, dz);
    if (len0 < 0.05) return;
    dx /= len0;
    dz /= len0;
    if (this.sidestep > 0) {
      // Passo de lado: soma uma perpendicular ao caminho para soltar da quina
      const px = -dz * this.sideDir, pz = dx * this.sideDir;
      dx += px * 1.3;
      dz += pz * 1.3;
    }
    this.axes(cmd, dx, dz, yaw);
    cmd.sprint = false;
    this.unstick(cmd, self, dt);
  }

  /** Eixos do comando (moveX lateral, moveZ frente) para andar na direção (dx, dz) do mundo. */
  axes(cmd: PlayerCommand, dx: number, dz: number, yaw: number) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    cmd.moveZ = fx * dx + fz * dz;
    cmd.moveX = rx * dx + rz * dz;
    const len = Math.hypot(cmd.moveX, cmd.moveZ) || 1;
    cmd.moveX /= len;
    cmd.moveZ /= len;
  }

  /** Preso numa quina: pula e dá um passo de lado; preso de novo, troca de destino. */
  unstick(cmd: PlayerCommand, self: FlatPlayer, dt: number) {
    if (this.jumpNext) {
      cmd.jump = true;
      this.jumpNext = false;
    }
    this.sidestep = Math.max(0, this.sidestep - dt);
    this.stuckTimer -= dt;
    if (this.stuckTimer > 0) return;
    this.stuckTimer = STUCK_CHECK;
    const moved = Math.hypot(self.x - this.lastX, self.z - this.lastZ);
    this.lastX = self.x;
    this.lastZ = self.z;
    if (moved > 1 || (cmd.moveX === 0 && cmd.moveZ === 0)) {
      this.stuckCount = 0;
      return;
    }
    this.stuckCount += 1;
    this.jumpNext = true;
    this.sidestep = 0.45;
    this.sideDir = this.world.rng() < 0.5 ? -1 : 1;
    if (this.stuckCount >= 3) {
      this.stuckCount = 0;
      this.pickGoal();
      this.pathKey = '';
    }
  }

  /** Chegou ao ponto alto: guarda as direções com as linhas de visão mais longas. */
  private beginHold(self: FlatPlayer) {
    const [lo, hi] = this.persona.hold;
    this.holdLeft = lo + (hi - lo) * this.world.rng();
    const eye = { x: self.x, y: self.y + 0.6, z: self.z };
    const rays: { yaw: number; len: number }[] = [];
    for (let k = 0; k < LOOK_RAYS; k++) {
      const yaw = (k / LOOK_RAYS) * Math.PI * 2 - Math.PI;
      const hit = raycastBoxes(eye, { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) }, this.world.solids, 90);
      rays.push({ yaw, len: hit ? hit.t : 90 });
    }
    rays.sort((a, b) => b.len - a.len);
    this.lookYaws = rays.slice(0, 3).filter((r) => r.len > 12).map((r) => r.yaw);
    this.lookIndex = 0;
    this.lookTimer = 1.5;
    if (this.lookYaws.length === 0) this.holdLeft = 0;
  }

  private pickGoal() {
    const nav = this.world.nav;
    if (!nav) return;
    const n = nav.goals.length;
    if (n === 0) return;
    for (let tries = 0; tries < 4; tries++) {
      let g = Math.floor(this.world.rng() * n);
      if (this.persona.high) {
        // Prefere o mais alto de três sorteados
        for (let k = 0; k < 2; k++) {
          const h = Math.floor(this.world.rng() * n);
          if (nav.goals[h].y > nav.goals[g].y) g = h;
        }
      }
      if (g === this.goal) g = (g + 1) % n;
      const field = nav.field(g);
      if (field) {
        this.goal = g;
        this.field = field;
        return;
      }
    }
  }
}
