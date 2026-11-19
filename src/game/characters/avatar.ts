import * as THREE from 'three';
import { BODY } from './hitbox';
import { classify, GAIT_SPEED, gaitWeights, legTwist, type Pose, wrap } from './locomotion';
import { type CharacterAsset, instantiate, type Team } from './model';
import type { SkinId } from './skins/types';
import { CombatRig, locomotionClip } from './combat-rig';
import { RemoteWeapon } from './remote-weapon';
import { GunRig } from './gun-rig';
import { leanTarget, lowReady, recoilFeel, Spring } from './motion';
import { gunSpec } from '../../sim/weapons';
import { characterShading } from './shading';

// Um jogador remoto animado: recebe o estado (posição, velocidade, yaw, pitch, agachado,
// no chão, morto) e cuida do resto — mistura das passadas, pernas giradas para correr de
// lado/de costas, tronco que acompanha a mira e animações de uma vez (pulo, morte).
// Só visual: o acerto usa `hitbox.ts`, nunca os ossos.

export interface AvatarState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  /** Online: postura já interpolada no mesmo instante da posição e da hitbox. */
  crouchAmount?: number;
  grounded: boolean;
  dead: boolean;
  weaponIndex?: number;
  reloadRemaining?: number;
}

export function emptyState(): AvatarState {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: false, grounded: true, dead: false };
}

// Clipes de laço que ficam sempre tocando com peso variável (peso 0 não custa nada no mixer).
const LOOPS = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  crouchIdle: 'Crouch_Idle_Loop',
  crouchMove: 'Crouch_Fwd_Loop',
  air: 'Jump_Loop',
} as const;
type LoopKey = keyof typeof LOOPS;
const GAITS = ['walk', 'jog', 'sprint', 'crouchMove'] as const;

/** Velocidade de mistura dos pesos (1/s): ~0.15 s para trocar de pose. */
const BLEND_RATE = 12;
/** Quanto as pernas demoram a virar para a direção nova. */
const TWIST_RATE = 10;
const SPINE = ['DEF-spine.001', 'DEF-spine.002', 'DEF-spine.003'];

const _q = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _qd = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _right = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _qb = new THREE.Quaternion();

/** Arma remota um pouco maior que a de 1ª pessoa: o fuzil fica com ~0,9 m e lê de longe. */
export const WEAPON_SCALE = 1.15;
/** Giro do peito na postura de fuzil (rad). */
const BLADE = 0.5;

export class Avatar {
  readonly root = new THREE.Group();
  readonly state = emptyState();
  pose: Pose = 'idle';
  private readonly model: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly loops = new Map<LoopKey, THREE.AnimationAction>();
  private readonly weights = new Map<LoopKey, number>();
  private readonly oneShots = new Map<string, THREE.AnimationAction>();
  private overlay: THREE.AnimationAction | null = null;
  private overlayWeight = 0;
  private readonly spine: THREE.Bone[] = [];
  private readonly neck: THREE.Bone | null;
  /** Rotação que a animação deu aos ossos da mira, antes do nosso ajuste (ver `update`). */
  private aimed: { bone: THREE.Bone; anim: THREE.Quaternion }[] = [];
  private phase = 0;
  private crouchPhase = 0;
  private twist = 0;
  private wasGrounded = true;
  private wasDead = false;
  private readonly combat: CombatRig;
  readonly weapon = new RemoteWeapon();
  private readonly arms: THREE.Object3D[] = [];
  private readonly shading = characterShading();
  /** Piscar: segundos até a próxima piscada e quanto dela já passou. */
  private blinkIn = 1 + Math.random() * 3;
  private blinkT = -1;
  private hitFlash = 0;
  private readonly gunRig: GunRig;
  // Movimento secundário (só visual): tombo lateral, tranco de dano, aterrissagem e coice
  private readonly lean = new Spring(3.2, 0.75);
  private readonly hitPitch = new Spring(6, 0.32);
  private readonly hitTwist = new Spring(6, 0.32);
  private readonly land = new Spring(5, 0.4);
  private recoil = 0;
  private freshShot = false;
  private sinceShot = 10;
  private lastYaw: number | null = null;
  /** 1 = postura de fuzil completa; cai na guarda baixa da corrida. */
  private bladeK = 1;

  constructor(asset: CharacterAsset, team: Team, readonly skin: SkinId = 'lia') {
    this.model = instantiate(asset, team, skin, this.shading);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.combat = new CombatRig(asset, this.mixer);
    // A arma fica no grupo do boneco; o `GunRig` a põe no ombro e leva as mãos até ela.
    this.weapon.root.scale.setScalar(WEAPON_SCALE);
    this.root.add(this.weapon.root);
    this.gunRig = new GunRig(this.model, asset, this.weapon);

    for (const [key, name] of Object.entries(LOOPS) as [LoopKey, string][]) {
      const action = this.mixer.clipAction(locomotionClip(clip(asset, name)));
      action.play();
      action.setEffectiveWeight(0);
      // Passadas são tocadas "na mão" (fase sincronizada com a velocidade)
      if ((GAITS as readonly string[]).includes(key)) action.timeScale = 0;
      this.loops.set(key, action);
      this.weights.set(key, key === 'idle' ? 1 : 0);
    }
    for (const name of ['Jump_Start', 'Jump_Land', 'Death01', 'Hit_Chest', 'Hit_Head']) {
      const original = clip(asset, name);
      const action = this.mixer.clipAction(name === 'Death01' ? original : locomotionClip(original));
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      this.oneShots.set(name, action);
    }
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.overlay && e.action !== this.oneShots.get('Death01')) this.overlay = null;
    });

    for (const name of SPINE) {
      // o GLTFLoader tira os pontos dos nomes (DEF-spine.001 → DEF-spine001)
      const bone = this.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)) as THREE.Bone | undefined;
      if (bone) this.spine.push(bone);
    }
    if (this.spine.length !== SPINE.length) console.warn('[characters] ossos da coluna não encontrados: sem mira no tronco');
    this.neck = (this.model.getObjectByName('DEF-neck') as THREE.Bone | undefined) ?? null;
    for (const name of ['DEF-upper_armL', 'DEF-forearmL', 'DEF-handL', 'DEF-upper_armR', 'DEF-forearmR', 'DEF-handR']) {
      const bone = this.model.getObjectByName(name);
      if (bone) this.arms.push(bone);
    }
    this.aimed = [...this.spine, ...(this.neck ? [this.neck] : []), ...this.arms]
      .map((bone) => ({ bone: bone as THREE.Bone, anim: bone.quaternion.clone() }));
  }

  /** Toca uma animação de uma vez por cima da locomoção (ex.: 'Hit_Head'). */
  playOneShot(name: string): void {
    const action = this.oneShots.get(name);
    if (!action) return;
    action.reset().play();
    this.overlay = action;
  }

  /** Tiro confirmado acertou: tranco do tronco (cabeça joga mais para trás). */
  react(part: 'head' | 'torso' | 'legs'): void {
    if (this.state.dead) return;
    this.hitPitch.kick(part === 'head' ? 5 : part === 'torso' ? 3.5 : -1.8);
    this.hitTwist.kick((Math.random() - 0.5) * 5);
    this.hitFlash = 1;
    this.playOneShot(part === 'head' ? 'Hit_Head' : 'Hit_Chest');
  }

  update(dt: number): void {
    const s = this.state;
    const yawRate = this.wasDead || this.lastYaw === null || dt <= 0 ? 0 : wrap(s.yaw - this.lastYaw) / dt;
    this.lastYaw = s.yaw;
    const pose = classify({ vx: s.vx, vz: s.vz, yaw: s.yaw, grounded: s.grounded, crouch: s.crouch, dead: s.dead });
    this.events(pose);
    this.pose = pose;

    const speed = Math.hypot(s.vx, s.vz);
    const { twist, reverse } = legTwist(s.vx, s.vz, s.yaw);
    const dir = reverse ? -1 : 1;
    this.twist += wrap(twist - this.twist) * Math.min(1, dt * TWIST_RATE);

    // Pesos-alvo de cada laço
    const target: Record<LoopKey, number> = { idle: 0, walk: 0, jog: 0, sprint: 0, crouchIdle: 0, crouchMove: 0, air: 0 };
    if (pose === 'idle') target.idle = 1;
    else if (pose === 'crouchIdle') target.crouchIdle = 1;
    else if (pose === 'crouchMove') target.crouchMove = 1;
    else if (pose === 'air') target.air = 1;
    else if (pose === 'move') Object.assign(target, gaitWeights(speed));
    const networkPosture = s.crouchAmount !== undefined && !s.dead;
    if (networkPosture) {
      for (const key of Object.keys(target) as LoopKey[]) target[key] = 0;
      if (!s.grounded) target.air = 1;
      else if (speed > 0.1) Object.assign(target, gaitWeights(speed));
      else target.idle = 1;
      target[s.grounded && speed > 0.1 ? 'crouchMove' : 'crouchIdle'] = 1;
    }

    // Fase compartilhada: ciclos por segundo = velocidade / (distância percorrida por ciclo)
    const g = gaitWeights(speed);
    const cyclesPerSec =
      g.walk * (speed / (GAIT_SPEED.walk * this.duration('walk'))) +
      g.jog * (speed / (GAIT_SPEED.jog * this.duration('jog'))) +
      g.sprint * (speed / (GAIT_SPEED.sprint * this.duration('sprint')));
    this.phase = fract(this.phase + dir * cyclesPerSec * dt);
    this.crouchPhase = fract(this.crouchPhase + (dir * speed * dt) / (GAIT_SPEED.crouch * this.duration('crouchMove')));

    const k = Math.min(1, dt * BLEND_RATE);
    const overlayTarget = this.overlay ? 1 : 0;
    this.overlayWeight += (overlayTarget - this.overlayWeight) * Math.min(1, dt * (this.overlay ? 20 : 8));
    for (const [key, action] of this.loops) {
      const w = this.weights.get(key)! + (target[key] - this.weights.get(key)!) * k;
      this.weights.set(key, w);
      action.setEffectiveWeight(w * (1 - this.overlayWeight));
      if (key === 'crouchMove') action.time = this.crouchPhase * action.getClip().duration;
      else if (key === 'walk' || key === 'jog' || key === 'sprint') action.time = this.phase * action.getClip().duration;
    }
    if (networkPosture) {
      const amount = Math.min(1, Math.max(0, s.crouchAmount!));
      const low = this.weights.get('crouchIdle')! + this.weights.get('crouchMove')!;
      const high = ['idle', 'walk', 'jog', 'sprint', 'air'].reduce((sum, key) => sum + this.weights.get(key as LoopKey)!, 0);
      // Locomoção mantém seu blend; a proporção alto/baixo acompanha a hitbox interpolada.
      for (const [key, action] of this.loops) {
        const crouched = key === 'crouchIdle' || key === 'crouchMove';
        const proportion = crouched ? amount / Math.max(low, 1e-6) : (1 - amount) / Math.max(high, 1e-6);
        action.setEffectiveWeight(this.weights.get(key)! * proportion * (1 - this.overlayWeight));
      }
    }
    for (const action of this.oneShots.values()) {
      action.setEffectiveWeight(action === this.overlay ? this.overlayWeight : 0);
    }
    this.combat.update(dt, s.dead, this.overlay === this.oneShots.get('Death01') ? this.overlayWeight : 0,
      s.weaponIndex ?? 0, s.reloadRemaining ?? 0);
    this.weapon.equip(s.weaponIndex ?? 0);
    this.weapon.update(dt, s.dead);
    // Coice: o disparo novo aparece inteiro no próximo quadro, mesmo com dt grande
    if (!this.freshShot) this.recoil *= Math.exp(-dt * recoilFeel(s.weaponIndex ?? 0).decay);
    this.freshShot = false;
    this.sinceShot += dt;
    this.bladeK = 1 - 0.6 * lowReady(speed, this.sinceShot);
    const lateral = s.vx * Math.cos(s.yaw) - s.vz * Math.sin(s.yaw);
    this.lean.update(s.dead || !s.grounded ? 0 : leanTarget(lateral, yawRate), dt);
    this.hitPitch.update(0, dt);
    this.hitTwist.update(0, dt);
    this.land.update(0, dt);
    this.face(dt);
    if (s.dead) { this.hitPitch.reset(); this.hitTwist.reset(); this.land.reset(); this.recoil = 0; }

    // O mixer só reescreve um osso quando o valor animado MUDA; sem desfazer o ajuste da mira
    // do quadro anterior, a inclinação se acumularia nos quadros em que o clipe está parado.
    for (const a of this.aimed) a.bone.quaternion.copy(a.anim);
    this.mixer.update(dt);
    for (const a of this.aimed) a.anim.copy(a.bone.quaternion);

    // Corpo: posição do jogo, pernas giradas pelo movimento (o modelo olha para +Z: soma π)
    this.root.position.set(s.x, s.y, s.z);
    const legsYaw = s.dead ? s.yaw : s.yaw + this.twist;
    this.model.rotation.y = legsYaw + Math.PI;
    if (!s.dead) {
      this.aimSpine(-this.twist, s.pitch);
      const index = s.weaponIndex ?? 0;
      this.root.getWorldQuaternion(_qb);
      this.gunRig.update(_qb, {
        yaw: s.yaw,
        pitch: s.pitch,
        weaponIndex: index,
        speed,
        reload: (s.reloadRemaining ?? 0) > 0 ? 1 - s.reloadRemaining! / gunSpec(index).reloadTime : -1,
        sinceShot: this.sinceShot,
        recoil: this.recoil,
        dip: this.land.value * 0.6 + this.hitPitch.value * -0.5,
      });
    }
  }

  fire(index = this.state.weaponIndex ?? 0): THREE.Vector3 {
    this.combat.fire(index);
    this.weapon.fire(index);
    this.recoil = 1;
    this.freshShot = true;
    this.sinceShot = 0;
    return this.weapon.muzzleWorld();
  }

  /** Desfaz o giro das pernas e inclina o tronco pela mira, dividido pela coluna. */
  private aimSpine(yawTwist: number, pitch: number): void {
    if (this.spine.length !== SPINE.length) return;
    const n = this.spine.length;
    const s = this.state;
    _right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    this.root.getWorldQuaternion(_q);
    _right.applyQuaternion(_q);
    // Tronco: mira + tranco do dano/coice/aterrissagem (pitch), tombo lateral e torção do dano
    const extraPitch = this.hitPitch.value + this.recoil * recoilFeel(s.weaponIndex ?? 0).body - this.land.value;
    const bend = pitch * BODY.pitchBend + extraPitch;
    _fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw)).applyQuaternion(_qb.copy(_q));
    // Postura de fuzil: o peito gira para a direita (ombro esquerdo à frente) para a mão de
    // apoio alcançar o guarda-mão; o pescoço desfaz o giro e a cabeça olha para a mira.
    const blade = -BLADE * this.bladeK;
    _qd.setFromAxisAngle(UP, (yawTwist + blade + this.hitTwist.value) / n)
      .multiply(_q.setFromAxisAngle(_right, bend / n))
      .multiply(_qb.setFromAxisAngle(_fwd, this.lean.value / n));
    // w = rotação de mundo do pai do primeiro osso; a cada osso, aplica o delta em
    // espaço de mundo e propaga (o delta acumula ao longo da coluna)
    this.spine[0].parent!.getWorldQuaternion(_qw);
    for (const bone of this.spine) {
      _qi.copy(_qw).invert();
      bone.quaternion.premultiply(_q.copy(_qw)).premultiply(_qd).premultiply(_qi);
      _qw.multiply(bone.quaternion);
    }
    // O resto do pitch vai para o pescoço (olhar), sem mexer na hitbox
    // (_qw já é a rotação de mundo do último osso da coluna, pai do pescoço)
    if (this.neck) {
      _qi.copy(_qw).invert();
      // Bochecha encosta na coronha: cabeça tomba um pouco para a direita e para a mira
      _qd.setFromAxisAngle(UP, -blade * 0.9)
        .multiply(_q.setFromAxisAngle(_right, pitch * (1 - BODY.pitchBend) * 0.6 - 0.03 * this.bladeK))
        .multiply(_qb.setFromAxisAngle(_fwd, 0.14 * this.bladeK));
      this.neck.quaternion.premultiply(_q.copy(_qw)).premultiply(_qd).premultiply(_qi);
    }
  }

  /** Piscar ocasional (barato: um uniform) e clarão de dano que some em ~0,15 s. */
  private face(dt: number): void {
    this.hitFlash = Math.max(0, this.hitFlash - dt * 7);
    this.shading.hit.value = this.hitFlash * this.hitFlash;
    if (this.blinkT < 0) {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) this.blinkT = 0;
    } else {
      this.blinkT += dt;
      if (this.blinkT > 0.14) {
        this.blinkT = -1;
        // às vezes pisca duas vezes seguidas
        this.blinkIn = Math.random() < 0.2 ? 0.12 : 2 + Math.random() * 3.5;
      }
    }
    this.shading.blink.value = this.state.dead ? 1 : this.blinkT < 0 ? 0 : Math.sin((this.blinkT / 0.14) * Math.PI);
  }

  private events(pose: Pose): void {
    const s = this.state;
    if (s.dead && !this.wasDead) this.playOneShot('Death01');
    if (!s.dead && this.wasDead) {
      this.oneShots.get('Death01')!.stop();
      this.overlay = null;
      this.overlayWeight = 0;
      // Uma vida nova não herda trancos, disparo recente nem aterrissagem da anterior.
      for (const spring of [this.lean, this.hitPitch, this.hitTwist, this.land]) spring.reset();
      this.recoil = this.hitFlash = 0;
      this.freshShot = false;
      this.sinceShot = 10;
      this.wasGrounded = s.grounded;
    }
    if (!s.dead) {
      if (this.wasGrounded && !s.grounded && s.vy > 0) this.playOneShot('Jump_Start');
      if (!this.wasGrounded && s.grounded) this.land.kick(Math.min(4, 1.2 + Math.max(0, -s.vy) * 0.25));
      if (!this.wasGrounded && s.grounded && pose !== 'crouchIdle' && pose !== 'crouchMove') this.playOneShot('Jump_Land');
      // Jump_Start acabou no ar: solta para o laço de queda
      if (this.overlay === this.oneShots.get('Jump_Start') && s.grounded) this.overlay = null;
      if (this.overlay === this.oneShots.get('Jump_Land') && pose === 'move') this.overlay = null;
    }
    this.wasGrounded = s.grounded;
    this.wasDead = s.dead;
  }

  private duration(key: LoopKey): number {
    return this.loops.get(key)!.getClip().duration;
  }

  /**
   * Libera o que é só deste boneco: o mixer e o esqueleto (cada esqueleto guarda uma
   * textura de ossos na GPU) e o material de sombreamento próprio. Geometrias e materiais
   * de contorno são compartilhados e NÃO podem ser descartados aqui.
   */
  dispose(): void {
    this.weapon.dispose();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    const skeletons = new Set<THREE.Skeleton>();
    this.model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((o as THREE.SkinnedMesh).skeleton);
    });
    for (const s of skeletons) s.dispose();
    this.shading.material.dispose(); // material é deste boneco; o programa continua em cache
    this.root.removeFromParent();
  }
}

function clip(asset: CharacterAsset, name: string): THREE.AnimationClip {
  const c = asset.clips.get(name);
  if (!c) throw new Error(`clipe ${name} não existe no boneco`);
  return c;
}

const fract = (v: number) => v - Math.floor(v);
