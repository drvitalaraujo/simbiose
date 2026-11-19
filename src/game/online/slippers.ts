// Visual procedural original: chinelo na mão e arremessos sincronizados pelo servidor.
import * as THREE from 'three';
import type { SlipperAction } from '../../sim/slipper';
import type { SlipperProjectile } from '../../net/slipper-combat';
import { PALETTE, toonVertexColors } from '../toon';
import { PartList, type Vec } from '../viewmodel/parts';

// Chinelo de dedo (centímetros, dedão em -z): sola amarela de duas camadas com contorno de
// pé, palmilha cor de cal, tiras em Y ciano com pino entre os dedos e etiqueta rosa.
// Na mão (primeira pessoa) vem com a luva sem dedos segurando pelo calcanhar.

/** Contorno da sola: [z, x] (o x vira largura depois de deitar a peça). */
const SOLE: [number, number][] = [
  [12, 0], [11.4, 2.7], [9, 3.7], [4, 3.4], [-2, 3.6], [-7, 4.5], [-10.6, 4.1], [-12.7, 2.3],
  [-13.3, 0], [-12.7, -2.5], [-10.6, -4.1], [-7, -3.9], [-2, -3.2], [4, -3.3], [9, -3.7], [11.4, -2.7],
];
const FLAT: Vec = [0, 0, Math.PI / 2]; // perfil [z, y] extrudado em x → deitado no chão

function slipperParts(p: PartList) {
  p.profile(SOLE, 1.3, { at: [0, 0.65, 0], rot: FLAT, color: PALETTE.yellow, bone: 0, bevel: 0.3, edge: PALETTE.paper, wear: 0.5 });
  p.profile(SOLE.map(([z, x]) => [z * 0.95, x * 0.9] as [number, number]), 0.5, { at: [0, 1.5, 0], rot: FLAT, color: PALETTE.cal, bone: 0, bevel: 0.15, wear: 0 });
  // Tiras em Y: pino entre os dedos até as laterais do meio do pé
  for (const s of [-1, 1]) {
    p.tube([[0, 1.9, -8.6], [s * 1.4, 3.2, -6.6], [s * 2.8, 3.1, -3.4], [s * 3.3, 1.9, -1.4]], 0.55, { color: PALETTE.cyan, bone: 0 });
    p.cyl(0.7, 0.7, 0.6, 8, { at: [s * 3.3, 1.7, -1.4], rot: [0, 0, Math.PI / 2], color: PALETTE.cyan, bone: 0 });
  }
  p.cyl(0.55, 0.65, 1.6, 8, { at: [0, 2.2, -8.6], color: PALETTE.cyan, bone: 0 });
  p.box(1.4, 0.5, 1, { at: [0, 3.1, -7.2], color: PALETTE.pink, bone: 0, bevel: 0.15 });
}

/** Mão enluvada segurando o calcanhar por baixo e a boca da manga (o golpe gira tudo junto). */
function handParts(p: PartList) {
  const glove = { color: PALETTE.bark, bone: 0, wear: 0 } as const;
  p.box(5.4, 3.4, 5.6, { ...glove, at: [0, -1.5, 9.6], bevel: 1 });
  for (let i = 0; i < 4; i++) {
    const x = -2.4 + i * 1.6;
    p.span([x, -0.6, 7.4], [x, 1.6, 6.6], 0.85, 0.8, 7, glove);
    p.span([x, 1.6, 6.6], [x, 2.9, 8.4], 0.8, 0.68, 7, { ...glove, color: PALETTE.skinWarm });
  }
  p.span([3, -1, 10], [3.6, 2.4, 9], 1.1, 0.85, 7, glove);
  p.box(0.6, 3.6, 5.8, { at: [-2.95, -1.5, 9.6], color: PALETTE.clothTeal, bone: 0, bevel: 0.2, wear: 0 });
  p.span([0, -2.2, 12], [0.4, -4, 16.5], 2.9, 3, 9, glove);
  p.span([0.4, -4, 16.5], [0.6, -4.5, 18.5], 3.6, 3.8, 10, { color: PALETTE.clothTeal, bone: 0, wear: 0 });
  p.span([0.6, -4.5, 18.5], [0.8, -5, 21], 3.9, 4, 10, { color: PALETTE.inkSoft, bone: 0, wear: 0 });
}

let shared: { sole: THREE.BufferGeometry; hand: THREE.BufferGeometry } | null = null;
const material = () => toonVertexColors();

/** Geometrias montadas uma vez e compartilhadas por todos os chinelos (mão e chão). */
function geometry() {
  if (shared) return shared;
  const a = new PartList(0.01);
  slipperParts(a);
  const b = new PartList(0.01);
  slipperParts(b);
  handParts(b);
  shared = { sole: a.build().toon, hand: b.build().toon };
  return shared;
}

function model(withHand = false): THREE.Group {
  const g = new THREE.Group();
  const geo = geometry();
  g.add(new THREE.Mesh(withHand ? geo.hand : geo.sole, material()));
  g.traverse(n => { n.raycast = () => {}; });
  return g;
}

/** Geometria e material são compartilhados: só sai da cena. */
function dispose(g: THREE.Group) {
  g.removeFromParent();
}

export class SlipperVisuals {
  private readonly hand = model(true);
  private readonly drops = new Map<string, THREE.Group>();
  private actionTime = 0;
  private action: SlipperAction = 'melee';

  constructor(private readonly scene: THREE.Scene, camera: THREE.Camera) {
    camera.add(this.hand);
    this.hand.visible = false;
    this.hand.traverse(n => { n.frustumCulled = false; n.renderOrder = 5; });
  }

  play(action: SlipperAction) { this.action = action; this.actionTime = 0.35; }

  update(dt: number, projectiles: Iterable<[string, SlipperProjectile]>, alive: boolean): boolean {
    this.actionTime = Math.max(0, this.actionTime - dt);
    this.hand.visible = alive && this.actionTime > 0;
    const t = 1 - this.actionTime / 0.35;
    this.hand.position.set(0.22 - Math.sin(t * Math.PI) * 0.3, -0.18 + Math.sin(t * Math.PI) * 0.15, -0.4 - Math.sin(t * Math.PI) * 0.25);
    this.hand.rotation.set(-0.3 - Math.sin(t * Math.PI) * 1.5, this.action === 'throw' ? t * 2 : 0.4, -0.7);
    const seen = new Set<string>();
    for (const [id, p] of projectiles) {
      seen.add(id);
      let object = this.drops.get(id);
      if (!object) { object = model(); this.drops.set(id, object); this.scene.add(object); }
      object.position.set(p.x, p.y + (p.resting ? 0.035 : 0), p.z);
      object.rotation.set(p.resting ? 0 : p.age * 20, Math.atan2(p.vx, p.vz), 0);
    }
    for (const [id, object] of this.drops) if (!seen.has(id)) { dispose(object); this.drops.delete(id); }
    return this.hand.visible;
  }

  dispose() {
    dispose(this.hand);
    for (const object of this.drops.values()) dispose(object);
    this.drops.clear();
  }
}
