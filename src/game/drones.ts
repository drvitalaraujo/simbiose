import * as THREE from 'three';
import { accelerate, DRONE_SPEED, escortSlot, steer, type Team, turnToward, wander } from './brain';
import { type Box, sweepAxis } from './physics';
import { ORB_SPEED } from './projectiles';
import { addOutline, outlineMaterial, PALETTE, toon } from './toon';

// Drones da OTIMIZA. Inimigos caçam o jogador e os aliados; drones hackeados (aliados)
// escoltam o jogador e atiram nos inimigos. Ver "Hackear" no docs/GDD.md.

export type DroneKind = 'shooter' | 'hugger' | 'boss';

const ENEMY_HP = 3;
const HUGGER_HP = 2;
const HUG_SPEED = 10.5;
const RUSH_RANGE = 30;
const FUSE_RANGE = 2.4;
const FUSE_TIME = 0.55; // apito antes de explodir: dá tempo de atirar ou fugir
// Chefe: Gerente de Felicidade
export const BOSS_HP = 40;
const BOSS_ALLY_HP = 30;
const BOSS_SCALE = 2.6;
const BOSS_PANE_HP = 8;
const BOSS_PANE_TIME = 6;
const BOSS_REBOOT_HP = 16;
const BOSS_FAN = 5;
const BOSS_FAN_SPREAD = 0.2;
const BOSS_FIRE_INTERVAL = 2.1;
const BOSS_CHARGE = 0.8;
const BOSS_SUMMON = 9;
const ALLY_HP = 5;
const HALF = { x: 0.7, y: 0.7, z: 0.7 };
const SIGHT_RANGE = 45;
const ALLY_RANGE = 35;
const ACCEL = 16; // m/s²: inércia que faz as curvas virarem arcos
const ALLY_SPEED = 11;
const DASH_SPEED = 11;
const DODGE_CHANCE = 0.9; // chance por segundo de esquivar quando está na mira
const TURN_RATE = 5; // rad/s
const MIN_ALT = 1.2;
const STUCK_TIME = 0.15;
const CHARGE_TIME = 0.5; // aviso antes do tiro inimigo: o jogador tem tempo de reagir
const ALLY_CHARGE = 0.15;
const ALLY_FIRE_INTERVAL = 0.55; // aliado tem que parecer um ganho real
const FLASH = new THREE.MeshBasicMaterial({ color: 0xffffff });
// Geometrias compartilhadas: cada onda cria drones novos sem alocar malhas novas
const BODY_GEO = new THREE.SphereGeometry(0.7, 20, 14);
const FACE_GEO = new THREE.PlaneGeometry(0.9, 0.5);
const RING_GEO = new THREE.TorusGeometry(0.85, 0.08, 6, 24);

export interface DroneContext {
  player: THREE.Vector3;
  playerYaw: number;
  /** Para onde o jogador está mirando (unitário). */
  playerForward: THREE.Vector3;
  solids: Box[];
  drones: Drone[];
  fireInterval: number;
  canSee: (from: THREE.Vector3, to: THREE.Vector3) => boolean;
  shoot: (from: THREE.Vector3, dir: THREE.Vector3, team: Team) => void;
  onCharge: (at: THREE.Vector3) => void;
  spark: (at: THREE.Vector3) => void;
  /** Explosão do Abraço Grátis (ou de um aliado-míssil). */
  explode: (at: THREE.Vector3, team: Team) => void;
  /** Chefe chama reforços. */
  summon: (at: THREE.Vector3) => void;
}

export class Drone {
  readonly group = new THREE.Group();
  readonly body: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly face: THREE.Mesh;
  private readonly outline: THREE.Mesh;
  team: Team = 'enemy';
  hp = ENEMY_HP;
  alive = true;
  /** Momento em que virou aliado (para a sobrecarga estourar os mais antigos). */
  hackedAt = 0;
  /** Alvo parado do tutorial: não voa nem atira enquanto for inimigo (só anima). */
  frozen = false;
  readonly vel = new THREE.Vector3();
  private readonly bodyColor: number;
  private fuse = 0;
  private size = 1;
  private half = HALF;
  private paneTime = 0;
  private paneArmed = true;
  private summonTimer = BOSS_SUMMON * 0.6;
  /** Drone que este drone está mirando (para o aliado antecipar o movimento). */
  private targetDrone: Drone | null = null;
  private target: THREE.Vector3 | null = null;
  private readonly lastKnown = new THREE.Vector3();
  private targetVisible = false;
  private flash = 0;
  private squash = 0;
  private spawnAnim = 0;
  private sightTimer = Math.random() * 0.25;
  private cooldown = 1.5 + Math.random() * 1.5;
  private charge = 0;
  private sparkTimer = 0;
  private readonly phase = Math.random() * 10;
  // "Humor" atual: muda a cada poucos segundos para o drone não parecer um trilho
  private orbit = 1;
  private prefDist = 10;
  private height = 2.5;
  private speed = DRONE_SPEED;
  private rethink = 0;
  private dodgeCooldown = 1 + Math.random() * 2;
  private blockedAhead = false;
  private stuck = 0;
  private yaw = 0;
  private readonly tilt = new THREE.Vector2(); // x = pitch, y = roll

  constructor(private scene: THREE.Scene, at: THREE.Vector3, readonly kind: DroneKind = 'shooter') {
    this.bodyColor = kind === 'hugger' ? PALETTE.yellow : PALETTE.paper;
    this.hp = kind === 'hugger' ? HUGGER_HP : kind === 'boss' ? BOSS_HP : ENEMY_HP;
    if (kind === 'boss') {
      this.size = BOSS_SCALE;
      this.half = { x: HALF.x * BOSS_SCALE, y: HALF.y * BOSS_SCALE, z: HALF.z * BOSS_SCALE };
    }
    this.body = new THREE.Mesh(BODY_GEO, toon(this.bodyColor));
    this.body.userData.drone = this;
    this.outline = addOutline(this.body, 0.06, PALETTE.pink); // inimigo = contorno rosa

    this.face = new THREE.Mesh(FACE_GEO, faceMaterial(this.enemyFace));
    this.face.position.set(0, 0.05, 0.69);
    this.face.raycast = () => {};
    this.body.add(this.face);

    this.ring = new THREE.Mesh(RING_GEO, toon(PALETTE.pink));
    this.ring.rotation.x = Math.PI / 2;
    this.ring.raycast = () => {};
    this.body.add(this.ring);

    if (kind === 'boss') {
      // Gravata de gerente: leitura instantânea de "chefe corporativo"
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.06), toon(PALETTE.pink));
      tie.position.set(0, -0.5, 0.6);
      tie.rotation.x = -0.35;
      tie.raycast = () => {};
      addOutline(tie, 0.02);
      this.body.add(tie);
    }

    this.group.add(this.body);
    this.group.position.copy(at);
    this.lastKnown.copy(at);
    this.group.scale.setScalar(0.01);
    this.newMood();
    scene.add(this.group);
  }

  private get enemyFace(): FaceKind {
    return this.kind === 'hugger' ? 'hug' : this.kind === 'boss' ? 'boss' : 'enemy';
  }

  /** Chefe: está em pane agora (janela para hackear)? */
  get paneLeft(): number {
    return this.paneTime;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Em pane: inimigo vivo com até 1 de vida, pronto para ser hackeado. */
  get glitched(): boolean {
    if (!this.alive || this.team !== 'enemy') return false;
    return this.kind === 'boss' ? this.paneTime > 0 : this.hp > 0 && this.hp <= 1;
  }

  /** Retorna true se o dano destruiu o drone. */
  damage(dir: THREE.Vector3, amount = 1): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flash = 0.06;
    this.squash = 1;
    this.charge = 0; // levar tiro cancela o disparo: recompensa a agressividade
    this.vel.addScaledVector(dir, this.kind === 'boss' ? 1 : 6);
    if (this.kind === 'boss' && this.hp > 0) {
      // Chefe com pouca vida entra em pane: janela de 6 s para o hack mais épico do jogo
      if (this.team === 'enemy' && this.paneArmed && this.hp <= BOSS_PANE_HP) {
        this.paneArmed = false;
        this.paneTime = BOSS_PANE_TIME;
      }
      return false;
    }
    if (this.hp > 0) {
      // Levou tiro e sobreviveu: às vezes foge de lado (fica vivo, não um alvo parado)
      if (this.team === 'enemy' && this.hp > 1 && Math.random() < 0.5) this.dash(this.position.clone().sub(dir));
      return false;
    }
    this.alive = false;
    this.scene.remove(this.group);
    return true;
  }

  /** O hack: o drone troca de lado. */
  convert(now: number) {
    this.team = 'ally';
    this.hp = this.kind === 'boss' ? BOSS_ALLY_HP : ALLY_HP;
    this.paneTime = 0;
    this.hackedAt = now;
    this.charge = 0;
    this.cooldown = 0.3;
    this.squash = 1;
    this.outline.material = outlineMaterial(PALETTE.cyan); // aliado = contorno ciano
    this.ring.material = toon(PALETTE.cyan);
    this.face.material = faceMaterial('ally');
  }

  update(dt: number, time: number, ctx: DroneContext) {
    if (!this.alive) return;
    if (this.frozen && this.team === 'enemy') {
      this.animate(dt, time);
      return;
    }
    const pos = this.group.position;
    const ally = this.team === 'ally';

    this.sightTimer -= dt;
    if (this.sightTimer <= 0) {
      this.sightTimer = 0.25;
      this.target = ally ? this.nearestEnemy(ctx) : this.enemyTarget(ctx);
      this.targetVisible = !!this.target && ctx.canSee(pos, this.target);
      this.blockedAhead = this.probeAhead(ctx.solids);
    }

    // Personalidade: de tempos em tempos o drone muda de ideia (raio, altura, sentido)
    this.rethink -= dt;
    if (this.rethink <= 0) this.newMood();

    const hugger = this.kind === 'hugger' && !this.glitched;
    const desired = hugger && this.rushTarget()
      ? this.rushVelocity()
      : ally ? this.escortVelocity(ctx) : this.huntVelocity(time);
    const w = wander(time, this.phase);
    const drift = this.glitched ? 3.5 : 1.6; // em pane ele cambaleia
    desired.x += w.x * drift;
    desired.y += w.y * drift;
    desired.z += w.z * drift;
    if (this.glitched) desired.y -= 0.8; // perde altitude, como quem tá sem bateria
    // Sobe por cima do obstáculo em vez de raspar na parede (ou ficar entalado entre postes)
    if (this.blockedAhead || this.stuck > STUCK_TIME) desired.y += 7;

    for (const o of ctx.drones) {
      if (o === this || !o.alive) continue;
      const d = pos.distanceTo(o.position);
      if (d < 2.6 && d > 0) {
        const push = (2.6 - d) * 3;
        desired.x += ((pos.x - o.position.x) / d) * push;
        desired.y += ((pos.y - o.position.y) / d) * push;
        desired.z += ((pos.z - o.position.z) / d) * push;
      }
    }

    // Esquiva: inimigo sente a mira do jogador e dá um "dash" lateral de vez em quando
    this.dodgeCooldown -= dt;
    if (!ally && !this.glitched && this.dodgeCooldown <= 0 && this.inPlayerSights(ctx) && Math.random() < dt * DODGE_CHANCE) {
      this.dash(ctx.player);
    }

    const prev = this.vel.clone();
    const next = accelerate(this.vel, desired, ACCEL, dt);
    this.vel.set(next.x, next.y, next.z);

    const before = pos.clone();
    sweepAxis(pos, this.half, 'x', this.vel.x * dt, ctx.solids);
    sweepAxis(pos, this.half, 'z', this.vel.z * dt, ctx.solids);
    sweepAxis(pos, this.half, 'y', this.vel.y * dt, ctx.solids);
    // Entalado: queria andar mas quase não saiu do lugar
    const wanted = Math.hypot(this.vel.x, this.vel.z) * dt;
    const moved = Math.hypot(pos.x - before.x, pos.z - before.z);
    this.stuck = wanted > 0.02 && moved < wanted * 0.3 ? this.stuck + dt : Math.max(0, this.stuck - dt * 0.5);
    const minAlt = MIN_ALT * this.size;
    if (pos.y < minAlt) {
      pos.y = minAlt;
      this.vel.y = Math.max(0, this.vel.y);
    }

    this.orient(dt, prev, ctx);

    if (this.kind === 'hugger') this.updateFuse(dt, ctx);
    else if (this.kind === 'boss') this.updateBoss(dt, ctx);
    else this.updateFiring(dt, ctx);
    if (!this.alive) return;

    if (this.glitched) {
      this.sparkTimer -= dt;
      if (this.sparkTimer <= 0) {
        this.sparkTimer = 0.25 + Math.random() * 0.25;
        ctx.spark(pos);
      }
    }
    this.animate(dt, time);
  }

  /** Abraço Grátis: tem alvo perto o bastante para sair correndo? */
  private rushTarget(): THREE.Vector3 | null {
    if (!this.target) return null;
    const d = this.target.distanceTo(this.group.position);
    return d < RUSH_RANGE && (this.targetVisible || d < 8) ? this.target : null;
  }

  private rushVelocity() {
    const to = this.rushTarget()!.clone().sub(this.group.position);
    const d = to.length() || 1e-6;
    const v = this.fuse > 0 ? 4 : HUG_SPEED; // com o pavio aceso, gruda no alvo
    return { x: (to.x / d) * v, y: (to.y / d) * v + 0.5, z: (to.z / d) * v };
  }

  /** Chegou perto: acende o pavio; quando acaba, explode. */
  private updateFuse(dt: number, ctx: DroneContext) {
    if (this.glitched) {
      this.fuse = 0; // em pane o pavio apaga (e dá para hackear)
      return;
    }
    if (this.fuse > 0) {
      this.fuse -= dt;
      if (this.fuse <= 0) this.detonate(ctx);
      return;
    }
    if (this.target && this.target.distanceTo(this.group.position) < FUSE_RANGE) {
      this.fuse = FUSE_TIME;
      ctx.onCharge(this.position);
    }
  }

  private detonate(ctx: DroneContext) {
    this.alive = false;
    this.scene.remove(this.group);
    ctx.explode(this.group.position.clone(), this.team);
  }

  private newMood() {
    this.rethink = 2 + Math.random() * 3;
    if (this.kind === 'boss') {
      this.orbit = (Math.random() < 0.5 ? -1 : 1) * 0.5;
      this.prefDist = 14 + Math.random() * 5;
      this.height = 6 + Math.random() * 2;
      this.speed = 4;
      return;
    }
    if (Math.random() < 0.35 || this.orbit === 1) this.orbit = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.8);
    this.prefDist = 7 + Math.random() * 7;
    this.height = 1.6 + Math.random() * 3.2;
    this.speed = DRONE_SPEED * (0.8 + Math.random() * 0.45);
  }

  /** Inimigo: circula o alvo no raio/altura do humor atual. */
  private huntVelocity(time: number) {
    const target = this.target ?? this.lastKnown;
    if (this.target) this.lastKnown.copy(this.target);
    // Em pane, desorientado, ele vem para perto (dá para hackear sem caçar o drone pelo mapa)
    const dist = this.glitched ? (this.kind === 'boss' ? 11 : 6) : this.prefDist;
    const speed = this.glitched ? this.speed * 1.15 : this.speed;
    return steer(this.group.position, target, time + this.phase, this.glitched ? this.orbit * 0.2 : this.orbit, dist, this.height, speed);
  }

  /** Aliado: voa para o seu lugar na formação atrás do jogador, sem passar na frente da mira. */
  private escortVelocity(ctx: DroneContext) {
    // Chefe aliado é grande demais para formação: circula alto em volta do jogador
    if (this.kind === 'boss') return steer(this.group.position, ctx.player, 0, 0.4, 9, 5, 7);
    const allies = ctx.drones.filter((d) => d.alive && d.team === 'ally' && d.kind !== 'boss').sort((a, b) => a.hackedAt - b.hackedAt);
    const slot = escortSlot(Math.max(0, allies.indexOf(this)), ctx.playerYaw);
    const pos = this.group.position;
    const dx = ctx.player.x + slot.x - pos.x;
    const dy = ctx.player.y - 0.6 + slot.y - pos.y;
    const dz = ctx.player.z + slot.z - pos.z;
    const d = Math.hypot(dx, dy, dz) || 1e-6;
    const v = Math.min(ALLY_SPEED, d * 2.2); // desacelera ao chegar: sem tremer no lugar
    return { x: (dx / d) * v, y: (dy / d) * v, z: (dz / d) * v };
  }

  /** Há prédio logo à frente na direção do movimento? */
  private probeAhead(solids: Box[]): boolean {
    const p = this.group.position;
    const r = 1.2;
    // Vários pontos ao longo do caminho: um ponto só pularia postes e grades finas
    for (const t of [0.15, 0.35, 0.6]) {
      const ax = p.x + this.vel.x * t;
      const ay = p.y + this.vel.y * t;
      const az = p.z + this.vel.z * t;
      const hit = solids.some((b) =>
        ax > b.min.x - r && ax < b.max.x + r && ay > b.min.y - r && ay < b.max.y + r && az > b.min.z - r && az < b.max.z + r);
      if (hit) return true;
    }
    return false;
  }

  private inPlayerSights(ctx: DroneContext): boolean {
    const to = this.group.position.clone().sub(ctx.player);
    return to.length() < 40 && to.normalize().dot(ctx.playerForward) > Math.cos(0.09);
  }

  /** Impulso lateral em relação a `from` (de onde vem a ameaça). */
  private dash(from: THREE.Vector3) {
    const away = this.group.position.clone().sub(from).setY(0).normalize();
    const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1);
    this.vel.addScaledVector(side, DASH_SPEED);
    this.vel.y += (Math.random() - 0.3) * 3;
    this.dodgeCooldown = 2 + Math.random() * 2;
    this.squash = 0.6;
  }

  /** Vira com inércia e inclina nas curvas, como um drone de verdade. */
  private orient(dt: number, prevVel: THREE.Vector3, ctx: DroneContext) {
    const pos = this.group.position;
    const look = this.target ?? ctx.player;
    this.yaw = turnToward(this.yaw, Math.atan2(look.x - pos.x, look.z - pos.z), TURN_RATE, dt);

    // Aceleração no referencial do drone: frente/trás inclina o "nariz", lateral rola
    const ax = (this.vel.x - prevVel.x) / Math.max(dt, 1e-4);
    const az = (this.vel.z - prevVel.z) / Math.max(dt, 1e-4);
    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);
    const forwardAcc = ax * fwdX + az * fwdZ;
    const sideAcc = ax * fwdZ - az * fwdX;
    const vf = this.vel.x * fwdX + this.vel.z * fwdZ;
    const vs = this.vel.x * fwdZ - this.vel.z * fwdX;
    const targetPitch = THREE.MathUtils.clamp(vf * 0.05 + forwardAcc * 0.012, -0.5, 0.5);
    const targetRoll = THREE.MathUtils.clamp(-vs * 0.06 - sideAcc * 0.015, -0.6, 0.6);
    const k = Math.min(1, dt * 6);
    this.tilt.x += (targetPitch - this.tilt.x) * k;
    this.tilt.y += (targetRoll - this.tilt.y) * k;
    this.group.rotation.set(this.tilt.x, this.yaw, this.tilt.y, 'YXZ');
  }

  /** Chefe: leque de orbes com aviso longo, chama Abraços e entra/sai de pane. */
  private updateBoss(dt: number, ctx: DroneContext) {
    if (this.paneTime > 0) {
      this.paneTime -= dt;
      if (this.paneTime <= 0 && this.team === 'enemy') {
        this.hp = Math.max(this.hp, BOSS_REBOOT_HP); // não hackeou a tempo: reinicia com mais vida
        this.paneArmed = true;
      }
      return;
    }
    const pos = this.group.position;
    if (this.team === 'enemy') {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = BOSS_SUMMON;
        ctx.summon(pos.clone().add(new THREE.Vector3(2.5, 0, 0)));
        ctx.summon(pos.clone().add(new THREE.Vector3(-2.5, 0, 0)));
      }
    }
    if (this.charge > 0) {
      this.charge -= dt;
      if (this.charge > 0 || !this.target) return;
      const base = this.target.clone().sub(pos);
      const muzzle = pos.clone().addScaledVector(base.clone().normalize(), 2.2);
      for (let i = 0; i < BOSS_FAN; i++) {
        const a = (i - (BOSS_FAN - 1) / 2) * BOSS_FAN_SPREAD;
        const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        ctx.shoot(muzzle, dir, this.team);
      }
      this.cooldown = BOSS_FIRE_INTERVAL * (0.8 + Math.random() * 0.4);
    } else if (this.targetVisible) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.charge = BOSS_CHARGE;
        ctx.onCharge(this.position);
      }
    }
  }

  private updateFiring(dt: number, ctx: DroneContext) {
    const ally = this.team === 'ally';
    if (this.charge > 0) {
      this.charge -= dt;
      if (this.charge > 0 || !this.target) return;
      const pos = this.group.position;
      // Aliado antecipa para onde o inimigo vai (inimigo não faz isso: o jogo fica justo)
      const aimAt = this.target.clone();
      if (ally && this.targetDrone?.alive) {
        const flight = aimAt.distanceTo(pos) / ORB_SPEED.ally;
        aimAt.addScaledVector(this.targetDrone.vel, flight);
      }
      const dir = aimAt.sub(pos);
      // Inimigo erra de propósito (mais quanto mais longe); aliado é mais preciso
      const miss = (ally ? 0.03 : 0.08) * dir.length();
      dir.x += (Math.random() - 0.5) * 2 * miss;
      dir.y += (Math.random() - 0.5) * miss;
      dir.z += (Math.random() - 0.5) * 2 * miss;
      ctx.shoot(pos.clone().addScaledVector(dir.clone().normalize(), 1), dir, this.team);
      const interval = ally ? ALLY_FIRE_INTERVAL : ctx.fireInterval;
      this.cooldown = interval * (0.7 + Math.random() * 0.6);
    } else if (this.targetVisible && !this.glitched) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.charge = ally ? ALLY_CHARGE : CHARGE_TIME;
        if (!ally) ctx.onCharge(this.position);
      }
    }
  }

  /** Inimigo mira no jogador, mas troca para um aliado que esteja bem mais perto. */
  private enemyTarget(ctx: DroneContext): THREE.Vector3 | null {
    const pos = this.group.position;
    let best = ctx.player;
    let bestScore = pos.distanceTo(ctx.player) * 0.7; // prefere o jogador
    for (const d of ctx.drones) {
      if (!d.alive || d.team !== 'ally') continue;
      const s = pos.distanceTo(d.position);
      if (s < bestScore) {
        best = d.position;
        bestScore = s;
      }
    }
    return bestScore < SIGHT_RANGE ? best : null;
  }

  private nearestEnemy(ctx: DroneContext): THREE.Vector3 | null {
    const pos = this.group.position;
    let best: Drone | null = null;
    let bestDist = ALLY_RANGE;
    for (const d of ctx.drones) {
      if (!d.alive || d.team !== 'enemy') continue;
      const dist = pos.distanceTo(d.position);
      if (dist < bestDist) {
        best = d;
        bestDist = dist;
      }
    }
    this.targetDrone = best;
    return best ? best.position : null;
  }

  private animate(dt: number, time: number) {
    this.spawnAnim = Math.min(1, this.spawnAnim + dt * 3);
    const charging = this.charge > 0;
    const glitched = this.glitched;
    this.flash -= dt;
    // Pavio aceso: pisca cada vez mais rápido
    const fuseBlink = this.fuse > 0 && Math.sin(time * (30 + (1 - this.fuse / FUSE_TIME) * 50)) > 0;
    this.body.material = this.flash > 0 || fuseBlink ? FLASH : toon(this.bodyColor);
    if (this.team === 'enemy') {
      this.ring.material = toon(charging ? PALETTE.yellow : PALETTE.pink);
      this.face.material = faceMaterial(glitched && Math.sin(time * 40) > -0.3 ? 'glitch' : this.enemyFace);
    }
    this.ring.rotation.z += dt * (charging ? 25 : glitched ? -12 : 3);

    this.squash = Math.max(0, this.squash - dt * 7);
    const s = this.squash;
    const grow = charging ? 1 + (1 - this.charge / (this.team === 'ally' ? ALLY_CHARGE : CHARGE_TIME)) * 0.25 : 1;
    const pop = easeOutBack(this.spawnAnim) * this.size;
    this.group.scale.set(pop * grow * (1 + s * 0.35), pop * grow * (1 - s * 0.3), pop * grow * (1 + s * 0.35));
    // Em pane, o drone treme (fica fácil de ler na tela que ele está "hackeável")
    this.body.position.set(glitched ? (Math.random() - 0.5) * 0.08 : 0, glitched ? (Math.random() - 0.5) * 0.08 : 0, 0);
  }
}

function easeOutBack(t: number) {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

export type FaceKind = 'enemy' | 'hug' | 'boss' | 'glitch' | 'ally';
const faceCache = new Map<FaceKind, THREE.MeshBasicMaterial>();

export function faceMaterial(kind: FaceKind) {
  let m = faceCache.get(kind);
  if (!m) {
    const tex = new THREE.CanvasTexture(drawFace(kind));
    tex.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    faceCache.set(kind, m);
  }
  return m;
}

/** Visor: sorriso padronizado da OTIMIZA, pane (estática) ou o sorriso livre do aliado. */
function drawFace(kind: FaceKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1a1026';
  g.beginPath();
  g.roundRect(8, 8, 240, 112, 40);
  g.fill();
  g.lineWidth = 14;
  g.lineCap = 'round';

  if (kind === 'glitch') {
    for (let i = 0; i < 26; i++) {
      g.fillStyle = ['#ff3d7f', '#2de2e6', '#f4ecff', '#ffd23f'][i % 4];
      g.fillRect(20 + Math.random() * 200, 20 + Math.random() * 88, 10 + Math.random() * 50, 4 + Math.random() * 6);
    }
    g.strokeStyle = '#ffd23f';
    for (const x of [80, 176]) {
      g.beginPath(); g.moveTo(x - 16, 46); g.lineTo(x + 16, 78); g.stroke();
      g.beginPath(); g.moveTo(x + 16, 46); g.lineTo(x - 16, 78); g.stroke();
    }
    return c;
  }

  if (kind === 'boss') {
    // Sorriso corporativo de gerente: sobrancelhas confiantes e dentes demais
    g.strokeStyle = '#ffd23f';
    g.beginPath(); g.moveTo(52, 40); g.lineTo(104, 50); g.stroke();
    g.beginPath(); g.moveTo(204, 40); g.lineTo(152, 50); g.stroke();
    g.strokeStyle = '#2de2e6';
    g.beginPath(); g.arc(80, 70, 14, Math.PI, 0); g.stroke();
    g.beginPath(); g.arc(176, 70, 14, Math.PI, 0); g.stroke();
    g.fillStyle = '#f4ecff';
    g.beginPath(); g.roundRect(78, 84, 100, 26, 10); g.fill();
    g.strokeStyle = '#1a1026';
    g.lineWidth = 4;
    for (let x = 98; x < 178; x += 20) { g.beginPath(); g.moveTo(x, 86); g.lineTo(x, 108); g.stroke(); }
    return c;
  }

  if (kind === 'hug') {
    // Olhos de coração e sorrisão: "Abraço Grátis!"
    g.fillStyle = '#ff3d7f';
    for (const x of [80, 176]) {
      g.beginPath();
      g.moveTo(x, 78);
      g.bezierCurveTo(x - 30, 58, x - 18, 30, x, 46);
      g.bezierCurveTo(x + 18, 30, x + 30, 58, x, 78);
      g.fill();
    }
    g.strokeStyle = '#ffd23f';
    g.beginPath(); g.arc(128, 66, 40, 0.15, Math.PI - 0.15); g.stroke();
    return c;
  }

  if (kind === 'ally') {
    g.strokeStyle = '#ffd23f';
    for (const x of [80, 176]) {
      g.beginPath(); g.moveTo(x - 18, 70); g.lineTo(x, 46); g.lineTo(x + 18, 70); g.stroke();
    }
    g.fillStyle = '#2de2e6';
    g.beginPath(); g.arc(128, 74, 26, 0, Math.PI); g.fill();
    return c;
  }

  g.strokeStyle = '#2de2e6';
  g.beginPath(); g.arc(80, 62, 18, Math.PI, 0); g.stroke();
  g.beginPath(); g.arc(176, 62, 18, Math.PI, 0); g.stroke();
  g.strokeStyle = '#ff3d7f';
  g.beginPath(); g.arc(128, 70, 30, 0.2, Math.PI - 0.2); g.stroke();
  return c;
}
