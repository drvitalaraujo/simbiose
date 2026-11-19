import * as THREE from 'three';
import { type CameraMotion, reducedMotion, setCameraMotionScale, setReducedMotion } from './movement-camera';
import { MovementBursts, type MovementSample, type Puff } from './movement-fx-logic';
import { GLOW, PALETTE, toonWith } from './toon';
import './movement-fx.css';

// Efeitos do movimento do jogador local (só visual): poeira nas passadas, nuvem na
// aterrissagem, rastro de poeira e faíscas no slide e linhas de velocidade de anime nas
// bordas da tela. As decisões (quando, quanto, para onde) moram em movement-fx-logic.ts.

const MAX_DUST = 140;
const MAX_SPARKS = 48;
const DUST_COLORS = [PALETTE.paper, PALETTE.paper, PALETTE.cal];
const LINE_FRAMES = 3;
const noRaycast = () => {};

if (typeof matchMedia === 'function') {
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  setReducedMotion(query.matches);
  query.addEventListener?.('change', e => setReducedMotion(e.matches));
}

class InstancedPool {
  readonly mesh: THREE.InstancedMesh;
  readonly live: Puff[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly pos = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private static readonly FORWARD = new THREE.Vector3(0, 0, 1);

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, private readonly max: number, private readonly stretch: boolean) {
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // as instâncias andam pelo mapa; a caixa fixa cortaria
    this.mesh.raycast = noRaycast;
    this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  add(p: Puff) {
    if (this.live.length >= this.max) this.live.shift();
    this.live.push(p);
  }

  update(dt: number, step: (p: Puff, dt: number) => number) {
    let n = 0;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      const size = step(p, dt);
      if (p.age >= p.life) { this.live.splice(i, 1); continue; }
      this.pos.set(p.x, p.y, p.z);
      if (this.stretch) {
        this.dir.set(p.vx, p.vy, p.vz);
        const speed = this.dir.length();
        this.quat.setFromUnitVectors(InstancedPool.FORWARD, speed > 1e-4 ? this.dir.multiplyScalar(1 / speed) : InstancedPool.FORWARD);
        this.scale.set(size * 0.25, size * 0.25, size * (1 + speed * 0.06));
      } else {
        this.quat.setFromAxisAngle(InstancedPool.FORWARD, p.spin * p.age);
        this.scale.set(size, size * 0.9, size);
      }
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.mesh.setMatrixAt(n, this.matrix);
      if (this.mesh.instanceColor) this.mesh.setColorAt(n, this.color.setHex(p.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

/** Linhas de velocidade: 3 quadros pré-desenhados que piscam (custo só de composição). */
class SpeedLines {
  readonly el = document.createElement('div');
  private readonly frames: HTMLCanvasElement[] = [];
  private frame = 0;
  private timer = 0;
  private shown = -1;

  constructor() {
    this.el.className = 'movement-lines';
    for (let i = 0; i < LINE_FRAMES; i++) {
      const c = document.createElement('canvas');
      c.width = 960; c.height = 540;
      drawLines(c, i);
      this.frames.push(c);
      this.el.append(c);
    }
  }

  update(dt: number, amount: number) {
    const a = Math.round(Math.min(1, amount) * 100) / 100;
    if (a !== this.shown) {
      this.shown = a;
      this.el.style.opacity = String(a);
      this.el.hidden = a <= 0;
    }
    if (a <= 0) return;
    this.timer -= dt;
    if (this.timer > 0 && !reducedMotion()) return;
    this.timer = 0.055;
    if (!reducedMotion()) this.frame = (this.frame + 1) % LINE_FRAMES;
    this.frames.forEach((c, i) => c.classList.toggle('on', i === this.frame));
  }
}

function hexRgb(hex: number, alpha: number) {
  return `rgba(${hex >> 16 & 255}, ${hex >> 8 & 255}, ${hex & 255}, ${alpha})`;
}

/** Riscos afinando para o centro, só nas bordas (o centro da tela fica limpo para mirar). */
function drawLines(canvas: HTMLCanvasElement, seed: number) {
  const g = canvas.getContext('2d');
  if (!g) return;
  let s = 0x9e3779b9 ^ (seed * 0x85ebca6b);
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
  const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
  const far = Math.hypot(cx, cy) * 1.05;
  for (let i = 0; i < 110; i++) {
    const angle = rnd() * Math.PI * 2;
    // Elipse interna no formato da tela: as linhas começam mais perto nas laterais.
    const inner = 0.62 + rnd() * 0.3;
    const ix = Math.cos(angle) * cx * inner, iy = Math.sin(angle) * cy * inner;
    const width = 1.5 + rnd() * rnd() * 9;
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    g.fillStyle = rnd() < 0.22 ? hexRgb(PALETTE.ink, 0.6) : hexRgb(PALETTE.paper, 0.65 + rnd() * 0.35);
    g.beginPath();
    g.moveTo(cx + ix, cy + iy);
    g.lineTo(cx + Math.cos(angle) * far + nx * width, cy + Math.sin(angle) * far + ny * width);
    g.lineTo(cx + Math.cos(angle) * far - nx * width, cy + Math.sin(angle) * far - ny * width);
    g.closePath();
    g.fill();
  }
}

export interface MovementFxInput extends MovementSample {
  alive: boolean;
}

/** Poeira, faíscas e linhas de velocidade do jogador local. Mesmo uso no treino e no online. */
export class MovementFx {
  private readonly dust: InstancedPool;
  private readonly sparks: InstancedPool;
  private readonly lines = new SpeedLines();
  private readonly bursts = new MovementBursts(DUST_COLORS);

  constructor(private readonly scene: THREE.Scene, canvas: HTMLCanvasElement) {
    const dustGeo = new THREE.IcosahedronGeometry(1, 1);
    this.dust = new InstancedPool(dustGeo, toonWith({ color: 0xffffff }), MAX_DUST, false);
    this.dust.mesh.setColorAt(0, new THREE.Color(PALETTE.paper)); // cria o atributo de cor
    const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.yellow).multiplyScalar(GLOW) });
    this.sparks = new InstancedPool(new THREE.BoxGeometry(1, 1, 1), sparkMat, MAX_SPARKS, true);
    scene.add(this.dust.mesh, this.sparks.mesh);
    canvas.insertAdjacentElement('afterend', this.lines.el);
    if (new URLSearchParams(location.search).has('debug')) {
      Object.assign(window, { __cameraMotion: setCameraMotionScale });
    }
  }

  /** Por quadro, depois de posicionar a câmera. `quality`: nível de render/quality.ts. */
  update(dt: number, s: MovementFxInput, motion: CameraMotion, quality: number) {
    const replay = document.body.classList.contains('replay-on');
    if (!s.alive || replay) { this.reset(); return; }
    if (s.alive && dt > 0) {
      // A simulação pode declarar velocidade de slide mesmo encostada numa parede.
      const ratio = Math.min(1, motion.speed / (Math.hypot(s.vel.x, s.vel.z) || 1));
      const sample = { ...s, vel: { x: s.vel.x * ratio, y: s.vel.y, z: s.vel.z * ratio } };
      for (const p of this.bursts.emit(dt, sample, motion.cue, quality)) (p.spark ? this.sparks : this.dust).add(p);
    }
    this.dust.update(dt, (p, h) => this.bursts.stepDust(p, h));
    this.sparks.update(dt, (p, h) => this.bursts.stepSpark(p, h));
    this.lines.update(dt, quality < 2 ? motion.lines * (reducedMotion() ? 0.5 : 1) : 0);
  }

  reset() {
    this.bursts.reset();
    for (const pool of [this.dust, this.sparks]) {
      pool.live.length = 0;
      pool.mesh.count = 0;
      pool.mesh.visible = false;
    }
    this.lines.update(0, 0);
  }

  dispose() {
    this.scene.remove(this.dust.mesh, this.sparks.mesh);
    this.dust.mesh.geometry.dispose();
    this.sparks.mesh.geometry.dispose();
    (this.dust.mesh.material as THREE.Material).dispose();
    (this.sparks.mesh.material as THREE.Material).dispose();
    this.dust.mesh.dispose();
    this.sparks.mesh.dispose();
    this.lines.el.remove();
  }
}
