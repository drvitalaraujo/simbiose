import * as THREE from 'three';
import { HACK_CONE, HACK_RANGE, hackProgress } from './brain';
import type { Drone } from './drones';
import { GLOW, PALETTE } from './toon';

const LOS_GRACE = 0.4;
const BOSS_HACK_RATE = 0.35;

/**
 * O verbo-assinatura: segurar E (ou botão direito) mirando num drone em pane para
 * convertê-lo. A mira tem ajuda (cone), porque o jogo é para ser fácil de jogar.
 */
export class Hacker {
  progress = 0;
  target: Drone | null = null;
  private lostFor = 0;
  private tooFar = false;
  private readonly ring = document.getElementById('hack-ring')!;
  private readonly label = document.getElementById('hack-label')!;
  /** Feixe ciano da arma até o drone enquanto o hack carrega. */
  private readonly beam: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1, true);
    geo.rotateX(Math.PI / 2); // eixo do cilindro ao longo de Z, para usar lookAt
    geo.translate(0, 0, 0.5); // começa na origem e vai até z = 1
    this.beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.cyan).multiplyScalar(GLOW), transparent: true, depthWrite: false }));
    this.beam.raycast = () => {};
    this.beam.visible = false;
    scene.add(this.beam);
  }

  /** Posiciona o feixe a partir da boca da arma. Chamar depois de `update`. */
  drawBeam(from: THREE.Vector3) {
    const on = !!this.target && this.target.alive && this.progress > 0;
    this.beam.visible = on;
    if (!on) return;
    const to = this.target!.position;
    this.beam.position.copy(from);
    this.beam.lookAt(to);
    const w = 0.3 + Math.random() * 0.5 + this.progress * 0.8; // treme e engrossa com o progresso
    this.beam.scale.set(w, w, from.distanceTo(to));
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.random() * 0.5;
  }

  /** Retorna o drone convertido neste quadro, se houver. */
  update(
    dt: number,
    holding: boolean,
    camera: THREE.PerspectiveCamera,
    drones: Drone[],
    canSee: (from: THREE.Vector3, to: THREE.Vector3) => boolean,
  ): Drone | null {
    let candidate = this.pick(camera, drones, canSee);
    // Tolerância: um poste ou fio cortando a visão por um instante não zera o hack
    if (holding && !candidate && this.target && this.stillAimed(camera, this.target)) {
      this.lostFor += dt;
      if (this.lostFor < LOS_GRACE) candidate = this.target;
    } else {
      this.lostFor = 0;
    }
    const same = !!candidate && candidate === this.target;
    if (holding && candidate !== this.target) this.target = candidate;
    // O chefe resiste: leva ~3x mais tempo para hackear
    const rate = candidate?.kind === 'boss' ? BOSS_HACK_RATE : 1;
    this.progress = hackProgress(this.progress, dt * rate, holding && !!candidate, same);
    if (!holding && this.progress === 0) this.target = candidate;

    let done: Drone | null = null;
    if (this.progress >= 1 && this.target) {
      done = this.target;
      this.progress = 0;
      this.target = null;
    }
    this.render(candidate);
    return done;
  }

  /** Alvo atual continua hackeável e na mira (ignorando linha de visão). */
  private stillAimed(camera: THREE.PerspectiveCamera, d: Drone): boolean {
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const to = d.position.clone().sub(eye);
    return d.glitched && to.length() <= HACK_RANGE && to.angleTo(camera.getWorldDirection(new THREE.Vector3())) < HACK_CONE * 1.5;
  }

  private pick(camera: THREE.PerspectiveCamera, drones: Drone[], canSee: (a: THREE.Vector3, b: THREE.Vector3) => boolean): Drone | null {
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    let best: Drone | null = null;
    let bestAngle = HACK_CONE;
    this.tooFar = false;
    for (const d of drones) {
      if (!d.glitched) continue;
      const to = d.position.clone().sub(eye);
      const angle = to.angleTo(fwd);
      if (angle >= bestAngle) continue;
      if (to.length() > HACK_RANGE) {
        this.tooFar = true; // mirando num drone em pane, mas longe: avisa o jogador
        continue;
      }
      if (canSee(eye, d.position)) {
        best = d;
        bestAngle = angle;
      }
    }
    return best;
  }

  private render(candidate: Drone | null) {
    this.ring.style.setProperty('--p', String(this.progress));
    this.ring.classList.toggle('show', !!candidate || this.progress > 0);
    const hint = candidate ? 'SEGURE <b>E</b> PARA HACKEAR' : this.tooFar ? 'CHEGUE MAIS PERTO PARA HACKEAR' : '';
    if (hint && this.label.innerHTML !== hint) this.label.innerHTML = hint;
    this.label.classList.toggle('show', !!hint && this.progress === 0);
  }
}
