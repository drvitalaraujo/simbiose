import * as THREE from 'three';
import { GLOW, PALETTE } from '../toon';
import { vmBasic } from './material';

// Clarão de boca de anime, por arma: estrelas de pontas irregulares desenhadas em 2–3
// quadros (o 1º cheio, o 2º aberto e girado, o 3º só um anel nas armas pesadas), lança
// para a frente e jatos laterais no freio de boca da sniper. Variantes pré-montadas: nada
// é criado por tiro. Uma luz breve acompanha (intensidade cai quadro a quadro).

const glow = (c: number, k = GLOW) => new THREE.Color(c).multiplyScalar(k);

interface FlashStyle {
  points: number;
  rOut: number;
  rIn: number;
  spear: number;
  spearW: number;
  /** Jatos laterais (freio de boca). */
  side: number;
  frames: number;
  light: number;
  tip: number;
}

/** MK-2, Faísca, Linha Morta, Quebra-Beco. */
const STYLES: FlashStyle[] = [
  { points: 8, rOut: 0.075, rIn: 0.022, spear: 0.15, spearW: 0.02, side: 0, frames: 2, light: 2.6, tip: PALETTE.yellow },
  { points: 6, rOut: 0.055, rIn: 0.018, spear: 0.1, spearW: 0.016, side: 0, frames: 2, light: 1.8, tip: PALETTE.pink },
  { points: 4, rOut: 0.1, rIn: 0.024, spear: 0.26, spearW: 0.026, side: 0.16, frames: 3, light: 4.5, tip: PALETTE.yellow },
  { points: 10, rOut: 0.11, rIn: 0.04, spear: 0.11, spearW: 0.04, side: 0, frames: 3, light: 4, tip: PALETTE.orange },
];

/** Gerador determinístico simples (as variantes são as mesmas em toda partida). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Estrela + lança (+ jatos), miolo branco e pontas na cor da arma (cor por vértice). */
function flashGeometry(st: FlashStyle, seed: number, open: boolean): THREE.BufferGeometry {
  const r = rng(seed);
  const pos: number[] = [];
  const col: number[] = [];
  const core = glow(PALETTE.paper);
  const tip = glow(st.tip);
  const edge = glow(PALETTE.orange);
  const tri = (a: number[], ca: THREE.Color, b: number[], cb: THREE.Color, c: number[], cc: THREE.Color) => {
    pos.push(...a, ...b, ...c);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  };
  // Pontas com comprimentos e ângulos irregulares: cada variante tem silhueta própria
  const star = (points: number, rOut: number, rIn: number, z: number, cIn: THREE.Color, cOut: THREE.Color, hole: number) => {
    const n = points * 2;
    const radius: number[] = [];
    const angle: number[] = [];
    for (let i = 0; i < n; i++) {
      angle.push(((i + (r() - 0.5) * 0.5) / n) * Math.PI * 2);
      radius.push(i % 2 === 0 ? rOut * (0.55 + r() * 0.6) : rIn * (0.8 + r() * 0.4));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = [Math.cos(angle[i]) * radius[i], Math.sin(angle[i]) * radius[i], z];
      const b = [Math.cos(angle[j]) * radius[j], Math.sin(angle[j]) * radius[j], z];
      const ca = radius[i] > rIn * 1.3 ? cOut : cIn;
      const cb = radius[j] > rIn * 1.3 ? cOut : cIn;
      if (hole > 0) {
        // Quadro "aberto": anel de pontas com o miolo vazado (o clarão se desfazendo)
        const ha = [Math.cos(angle[i]) * hole, Math.sin(angle[i]) * hole, z];
        const hb = [Math.cos(angle[j]) * hole, Math.sin(angle[j]) * hole, z];
        tri(ha, cIn, a, ca, b, cb);
        tri(ha, cIn, b, cb, hb, cIn);
      } else {
        tri([0, 0, z], cIn, a, ca, b, cb);
      }
    }
  };
  star(st.points, st.rOut, st.rIn, 0, core, tip, open ? st.rIn * 0.9 : 0);
  if (!open) star(4, st.rOut * 0.45, st.rIn * 0.5, 0.002, core, core, 0);
  // Lança: dois losangos cruzados apontando para a frente (-z)
  const spear = st.spear * (open ? 0.6 : 1) * (0.85 + r() * 0.3);
  for (const [ax, ay] of [[1, 0], [0, 1]]) {
    const w = st.spearW;
    tri([0, 0, 0.01], core, [ax * w, ay * w, -spear * 0.22], tip, [0, 0, -spear], edge);
    tri([0, 0, 0.01], core, [-ax * w, -ay * w, -spear * 0.22], tip, [0, 0, -spear], edge);
  }
  // Jatos laterais do freio de boca: losangos achatados para os dois lados
  if (st.side > 0) {
    for (const s of [-1, 1]) {
      const L = st.side * (open ? 1.2 : 1) * (0.85 + r() * 0.3);
      for (const z of [0.012, 0.03]) {
        tri([0, 0, z], core, [s * L * 0.3, 0.018, z], tip, [s * L, 0, z], edge);
        tri([0, 0, z], core, [s * L * 0.3, -0.018, z], tip, [s * L, 0, z], edge);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

const VARIANTS = 3;

export class MuzzleFlash {
  readonly mesh: THREE.Mesh;
  readonly light = new THREE.PointLight(PALETTE.yellow, 0, 8);
  private readonly full: THREE.BufferGeometry[] = [];
  private readonly open: THREE.BufferGeometry[] = [];
  private readonly style: FlashStyle;
  private readonly material: THREE.MeshBasicMaterial;
  private frame = -1;
  private variant = 0;
  private baseScale = 1;

  constructor(parent: THREE.Object3D, weaponIndex = 0) {
    this.style = STYLES[weaponIndex] ?? STYLES[0];
    for (let i = 0; i < VARIANTS; i++) {
      this.full.push(flashGeometry(this.style, 101 + i * 7919 + weaponIndex * 31, false));
      this.open.push(flashGeometry(this.style, 503 + i * 6151 + weaponIndex * 17, true));
    }
    this.material = vmBasic({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.full[0], this.material);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11;
    this.mesh.raycast = () => {};
    this.light.color.setHex(this.style.tip === PALETTE.pink ? PALETTE.sky : PALETTE.horizon);
    this.light.position.set(0, 0, -0.6); // à frente: ilumina o mundo e só esquenta a arma
    parent.add(this.mesh, this.light);
  }

  dispose() {
    for (const g of [...this.full, ...this.open]) g.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
    this.light.removeFromParent();
  }

  fire() {
    this.frame = 0; // quadros desenhados, em qualquer taxa de quadros
    this.variant = Math.floor(Math.random() * VARIANTS);
    this.mesh.rotation.z = Math.random() * Math.PI;
    this.baseScale = 1.2 + Math.random() * 0.5;
    this.mesh.scale.set(this.baseScale, this.baseScale, 0.8 + Math.random() * 0.6);
  }

  reset() {
    this.frame = -1;
    this.mesh.visible = false;
    this.light.intensity = 0;
  }

  /** Chamar uma vez por quadro desenhado (dt = 0 congela no hit-stop). */
  update(dt: number) {
    const f = this.frame;
    const on = f >= 0 && f < this.style.frames;
    this.mesh.visible = on;
    this.light.intensity = on ? this.style.light * (f === 0 ? 1 : f === 1 ? 0.55 : 0.2) : 0;
    if (!on) return;
    // Quadro 0: estrela cheia. Quadro 1: aberta, girada e maior. Quadro 2: anel tênue.
    this.mesh.geometry = f === 0 ? this.full[this.variant] : this.open[(this.variant + f) % VARIANTS];
    if (f > 0) {
      const k = this.baseScale * (1 + f * 0.28);
      this.mesh.scale.x = this.mesh.scale.y = k;
    }
    this.material.opacity = f === 0 ? 1 : f === 1 ? 0.85 : 0.45;
    if (dt > 0) {
      if (f > 0) this.mesh.rotation.z += 0.35;
      this.frame++;
    }
  }
}
