// "Teste de Admissão da Resistência": tutorial curto e pulável do Treino. Observa o estado de
// verdade do jogo (posição, arma, chinelo, drones) e traduz em sinais para os passos puros de
// tutorial-steps.ts. Os alvos são drones da OTIMIZA parados (`frozen`): o tiro, a chinelada e o
// hack funcionam pelas mesmas regras do Treino. Ganchos no game.ts: tick, update e chinelo.
import * as THREE from 'three';
import type { Box } from '../sim/physics';
import { EYE_HEIGHT, type PlayerState } from '../sim/player';
import type { SlipperState } from '../sim/slipper';
import type { WeaponState } from '../sim/weapon';
import { clearanceAlong, yawDir } from '../net/spawn-view';
import { Drone } from './drones';
import { GLOW, PALETTE, toon } from './toon';
import { TutorialUi } from './tutorial-ui';
import { createProgress, currentStep, feed, type Outcome, SEEN_KEY, skipStep, stepFraction, type TargetRole, type TargetSpec, type TutorialSignal } from './tutorial-steps';

/** O que o tutorial precisa do jogo (montado pelo game.ts). */
export interface TutorialHost {
  scene: THREE.Scene;
  /** Lista de drones do Treino (`director.drones`): os alvos entram nela. */
  drones: Drone[];
  blockers: readonly Box[];
  player: PlayerState;
  gun: WeaponState;
  slipper: SlipperState;
  /** Mira atual (yaw da câmera). */
  yaw(): number;
  /** Segura as ondas de drones enquanto o teste roda. */
  holdWaves(): void;
  /** Efeito de festa (som + partículas) num ponto. */
  burst(at: THREE.Vector3, color: number): void;
  cheer(): void;
  /** Solta o mouse (para clicar no convite final). */
  release(): void;
  /** Trava o mouse de novo (ficar no Treino). */
  resume(): void;
}

interface Target {
  drone: Drone;
  spec: TargetSpec;
  beacon: THREE.Mesh;
  /** Para onde a cara do drone aponta (o boneco: "costas" é o lado oposto). */
  face: THREE.Vector3;
  done: boolean;
}

const HOLD_TO_QUIT = 1.2;
const BEACON_GEO = new THREE.CylinderGeometry(0.05, 0.05, 7, 6, 1, true);
const BACK_GEO = new THREE.CircleGeometry(0.42, 20);
const BACK_RING_GEO = new THREE.RingGeometry(0.2, 0.3, 20);

/** Marca que o tutorial já abriu sozinho (try/catch: armazenamento pode estar bloqueado). */
export function markTutorialSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // sem armazenamento: abre de novo na próxima visita, sem problema
  }
}

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export class Tutorial {
  private readonly progress = createProgress();
  private readonly ui: TutorialUi;
  private targets: Target[] = [];
  private readonly lastPos = new THREE.Vector3();
  private wasCrouching = false;
  private wasReloading = false;
  private wasReady = true;
  private pendingMelee = false;
  private pHeld = 0;
  private pDown = false;
  private finished = false;
  private nextStepIn = -1;
  private ended = false;

  constructor(private readonly host: TutorialHost, private readonly onArena: () => void, private readonly onEnd: () => void) {
    markTutorialSeen();
    this.ui = new TutorialUi(() => this.goArena(), () => this.stay());
    this.syncEdges();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    this.enterStep();
  }

  /** Para o teste agora (sair, repetir ou trocar de modo). */
  end() {
    if (this.ended) return;
    this.ended = true;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.clearTargets();
    this.ui.destroy();
    this.onEnd();
  }

  get active() {
    return !this.ended;
  }

  /** Passo atual (para testes no console: `__game.tutorial.stepId`). */
  get stepId(): string | null {
    return currentStep(this.progress)?.id ?? (this.finished ? 'fim' : null);
  }

  /** Um tick do jogo (depois do jogador, da arma e do chinelo). */
  tick(dt: number, playing: boolean) {
    if (this.ended) return;
    this.host.holdWaves();
    if (this.nextStepIn >= 0) {
      this.nextStepIn -= dt;
      if (this.nextStepIn < 0) this.enterStep();
    }
    if (playing && !this.finished) this.observe();
    else this.syncEdges();
    this.pendingMelee = false;
    if (this.pDown) {
      this.pHeld += dt;
      if (this.pHeld >= HOLD_TO_QUIT) {
        this.pDown = false;
        this.end();
      }
    }
  }

  /** Quadro visual: carimbo, bronca e faróis dos alvos. */
  update(dt: number) {
    if (this.ended) return;
    this.ui.update(dt);
    for (const t of this.targets) {
      t.beacon.visible = t.drone.alive && t.drone.team === 'enemy';
      t.beacon.position.set(t.drone.position.x, t.drone.position.y + 4.2, t.drone.position.z);
    }
  }

  /** Gancho do chinelo: a ação sai antes do acerto, no mesmo tick. */
  onSlipperAction(action: 'melee' | 'throw') {
    this.pendingMelee = action === 'melee';
  }

  /** Gancho do chinelo: acertou um drone. */
  onSlipperHit(d: Drone) {
    if (!this.pendingMelee || this.ended) return;
    const t = this.targets.find((x) => x.drone === d && x.spec.role === 'dummy');
    if (!t) return;
    const p = this.host.player.pos;
    const to = new THREE.Vector3(p.x - d.position.x, 0, p.z - d.position.z);
    const back = to.lengthSq() > 1e-6 && to.normalize().dot(t.face) < -0.5;
    if (back) {
      t.done = true;
      this.host.burst(d.position.clone(), PALETTE.yellow);
      d.damage(new THREE.Vector3(), 999);
    }
    this.apply(feed(this.progress, { type: 'melee', back }));
  }

  private observe() {
    const st = this.host.player;
    const moved = Math.hypot(st.pos.x - this.lastPos.x, st.pos.z - this.lastPos.z);
    if (moved > 0.001 && moved < 2 && st.onGround) {
      this.signal({ type: 'moved', meters: moved, walking: st.walking && !st.crouching });
    }
    if (st.crouching && !this.wasCrouching) this.signal({ type: 'crouch' });
    const reloading = this.host.gun.reloadRemaining > 0;
    if (reloading && !this.wasReloading) this.signal({ type: 'reload' });
    const ready = this.host.slipper.slipperReady;
    if (this.wasReady && !ready) this.signal({ type: 'throw' });
    if (!this.wasReady && ready) this.signal({ type: 'pickup' });
    this.syncEdges();

    for (const t of this.targets) {
      if (t.done) continue;
      const d = t.drone;
      if (t.spec.role === 'pane' && d.alive && d.team === 'ally') {
        t.done = true;
        this.signal({ type: 'hack' });
      } else if (!d.alive) {
        t.done = true;
        if (t.spec.role === 'pane') this.wrong('Era para HACKEAR (segure E), não para atirar! Outro drone em pane chegando...', 'pane');
        else this.signal({ type: 'targetDown', role: t.spec.role, weapon: this.host.gun.weaponIndex, aiming: this.host.gun.aimAmount > 0.5 });
      }
    }
  }

  private syncEdges() {
    const st = this.host.player;
    this.lastPos.set(st.pos.x, st.pos.y, st.pos.z);
    this.wasCrouching = st.crouching;
    this.wasReloading = this.host.gun.reloadRemaining > 0;
    this.wasReady = this.host.slipper.slipperReady;
  }

  private signal(s: TutorialSignal) {
    this.apply(feed(this.progress, s));
  }

  private apply(o: Outcome) {
    if (o.kind === 'progress') this.ui.setFraction(stepFraction(this.progress));
    else if (o.kind === 'wrong') this.wrong(o.line, o.role);
    else if (o.kind === 'passed') this.pass(o.step, o.finished);
  }

  private wrong(line: string, role?: TargetRole) {
    this.ui.scold(line);
    if (!role) return;
    const spec = currentStep(this.progress)?.targets.find((t) => t.role === role);
    if (spec) this.spawnTarget(spec);
  }

  private pass(step: NonNullable<ReturnType<typeof currentStep>>, finished: boolean) {
    this.ui.setFraction(1);
    this.ui.celebrate(step);
    this.host.cheer();
    const eye = this.host.player.pos;
    this.host.burst(new THREE.Vector3(eye.x, eye.y + 1.5, eye.z), PALETTE.yellow);
    // Alvos que sobraram do passo somem com estilo
    for (const t of this.targets) if (t.drone.alive && t.drone.team === 'enemy') this.host.burst(t.drone.position.clone(), PALETTE.cyan);
    this.clearTargets();
    if (finished) {
      this.finished = true;
      this.nextStepIn = -1;
      window.setTimeout(() => {
        if (this.ended) return;
        this.ui.finish();
        this.host.release();
      }, 1400);
    } else {
      this.nextStepIn = 1.6; // tempo para o carimbo
    }
  }

  private enterStep() {
    const step = currentStep(this.progress);
    if (!step) return;
    this.ui.showStep(step);
    for (const spec of step.targets) this.spawnTarget(spec);
  }

  /** Coloca um alvo à frente da mira, numa direção com espaço livre (vale em qualquer mapa). */
  private spawnTarget(spec: TargetSpec) {
    const p = this.host.player.pos;
    const eye = { x: p.x, y: p.y + EYE_HEIGHT, z: p.z };
    const margin = spec.role === 'dummy' ? 4 : 1.5;
    const base = this.host.yaw();
    let yaw = base;
    let room = -1;
    for (const off of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3, Math.PI]) {
      const c = clearanceAlong(eye, base + off, this.host.blockers, spec.distance + margin + 1);
      if (c >= spec.distance + margin) { yaw = base + off; room = c; break; }
      if (c > room) { room = c; yaw = base + off; }
    }
    const dist = Math.max(2.5, Math.min(spec.distance, room - margin));
    const fwd = yawDir(yaw);
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const side = spec.side ?? 0;
    const at = new THREE.Vector3(eye.x + fwd.x * dist + right.x * side, eye.y + (spec.rise ?? 0), eye.z + fwd.z * dist + right.z * side);
    const d = new Drone(this.host.scene, at, 'shooter');
    d.frozen = true;
    d.hp = spec.hp;
    // Encara o jogador (a cara do drone fica em +z local)
    const toPlayer = new THREE.Vector3(eye.x - at.x, 0, eye.z - at.z).normalize();
    const face = spec.facing === 'away' ? toPlayer.clone().negate() : toPlayer;
    d.group.rotation.y = Math.atan2(face.x, face.z);
    if (spec.role === 'dummy') this.dressDummy(d);
    this.host.drones.push(d);
    this.host.burst(at, PALETTE.pink);
    const color = spec.role === 'pane' ? PALETTE.cyan : spec.role === 'dummy' ? PALETTE.pink : PALETTE.yellow;
    const beacon = new THREE.Mesh(BEACON_GEO, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(GLOW), transparent: true, opacity: 0.55, depthWrite: false }));
    beacon.raycast = () => {};
    this.host.scene.add(beacon);
    this.targets.push({ drone: d, spec, beacon, face, done: false });
  }

  /** Boneco de treino: alvo pintado nas costas, para saber onde a chinelada dói o dobro. */
  private dressDummy(d: Drone) {
    const disc = new THREE.Mesh(BACK_GEO, toon(PALETTE.paper));
    const ring = new THREE.Mesh(BACK_RING_GEO, toon(PALETTE.pink));
    for (const m of [disc, ring]) {
      m.raycast = () => {};
      m.rotation.y = Math.PI; // virado para -z local (as costas)
      d.body.add(m);
    }
    disc.position.z = -0.72;
    ring.position.z = -0.73;
  }

  private clearTargets() {
    for (const t of this.targets) {
      t.done = true; // sumir não conta como abate no passo seguinte
      this.host.scene.remove(t.beacon);
      (t.beacon.material as THREE.Material).dispose();
      if (t.drone.alive && t.drone.team === 'enemy') t.drone.damage(new THREE.Vector3(), 999);
    }
    this.targets = [];
  }

  private goArena() {
    this.end();
    this.onArena();
  }

  private stay() {
    this.ui.hideFinal();
    this.end();
    this.host.resume();
  }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.code !== 'KeyP' || e.repeat || this.finished) return;
    this.pDown = true;
    this.pHeld = 0;
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'KeyP' || !this.pDown) return;
    this.pDown = false;
    if (this.pHeld < HOLD_TO_QUIT && !this.finished && this.nextStepIn < 0) {
      this.clearTargets();
      this.apply(skipStep(this.progress));
    }
  };

  /** Atalho de teste: pula o passo atual (console: `__game.tutorial.skip()`). */
  skip() {
    if (this.finished || this.nextStepIn >= 0) return;
    this.clearTargets();
    this.apply(skipStep(this.progress));
  }
}
