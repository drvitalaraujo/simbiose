import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLOW, PALETTE } from '../toon';

// Peças low-poly do viewmodel: perfis laterais extrudados com chanfro de 1 segmento (a
// rampa toon pega a quina como faixa de luz própria), cilindros de poucos lados e tubos.
// Tudo vira UMA geometria toon + UMA de brilho, com cor e osso por vértice.

export type Vec = [number, number, number];

export interface PartOpts {
  at?: Vec;
  rot?: Vec;
  /** Cor da paleta (hex). */
  color: number;
  /** Índice do osso (ver `BONE` em model.ts). */
  bone: number;
  /** Brilha no bloom (sem luz, cor × GLOW). */
  glow?: boolean;
  /** Vidro de óptica: lote aditivo próprio (soma reflexo, não tapa a mira). */
  lens?: boolean;
  /**
   * Desgaste das quinas chanfradas (0 a 1): a tinta gasta mostra o metal e pega luz.
   * Padrão pela cor: aço e tinta gastam, polímero quase nada; luvas/tecido passam 0.
   */
  wear?: number;
  /** Cor das quinas gastas (padrão: aço claro). */
  edge?: number;
}

/** Desgaste padrão das quinas por cor (tecido e luva sempre passam `wear: 0`). */
function defaultWear(color: number): number {
  if (color === PALETTE.polymer || color === PALETTE.inkSoft || color === PALETTE.ink) return 0.2;
  if (color === PALETTE.steel || color === PALETTE.steelLight) return 0.55;
  return 0.6;
}

/**
 * Marca os triângulos do chanfro (anel entre a tampa e a parede da extrusão): são as
 * quinas que o uso gasta. Tampas (normal ±z) e paredes (0 ≤ z ≤ depth) ficam de fora.
 */
function markBevel(geo: THREE.BufferGeometry, depth: number) {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const edge = new Float32Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const eps = 1e-4;
  for (let i = 0; i + 2 < n; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const outside = [a.z, b.z, c.z].some(z => z < -eps || z > depth + eps);
    if (!outside) continue;
    const nz = Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).normalize().z);
    if (nz < 0.95) edge[i] = edge[i + 1] = edge[i + 2] = 1;
  }
  geo.setAttribute('vmEdge', new THREE.BufferAttribute(edge, 1));
}

export class PartList {
  /** `unit`: metros por unidade de entrada (0.01 = modelar em centímetros, como a folha). */
  constructor(readonly unit = 1) {}

  private readonly toonParts: THREE.BufferGeometry[] = [];
  private readonly glowParts: THREE.BufferGeometry[] = [];
  private readonly lensParts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, o: PartOpts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'vmEdge') g.deleteAttribute(name);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(o.at ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0]))),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    const c = new THREE.Color(o.color);
    if (o.glow) c.multiplyScalar(GLOW);
    // Quina gasta: cor puxada para o metal e um pouco mais clara (faixa de luz no chanfro).
    const wear = o.glow || o.lens ? 0 : (o.wear ?? defaultWear(o.color));
    const worn = c.clone().lerp(new THREE.Color(o.edge ?? PALETTE.steelLight), wear * 0.75).multiplyScalar(1 + wear * 0.35);
    const edges = g.getAttribute('vmEdge') as THREE.BufferAttribute | undefined;
    const colors = new Float32Array(n * 3);
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    const metal = o.color === PALETTE.steel || o.color === PALETTE.steelLight ? 1 : 0;
    const surface = new Float32Array(n).fill(metal);
    for (let i = 0; i < n; i++) {
      const e = wear > 0 && edges ? edges.getX(i) : 0;
      const k = e > 0 ? worn : c;
      colors.set([k.r, k.g, k.b], i * 3);
      if (e > 0) surface[i] = Math.max(metal, wear);
      skinIndex[i * 4] = o.bone;
      skinWeight[i * 4] = 1;
    }
    if (edges) g.deleteAttribute('vmEdge');
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    // Aço (e quina gasta) recebe uma resposta especular discreta. Tecido, tinta e borracha
    // continuam foscos, no mesmo lote: um atributo escalar substitui materiais e draw calls.
    g.setAttribute('vmSurface', new THREE.BufferAttribute(surface, 1));
    (o.lens ? this.lensParts : o.glow ? this.glowParts : this.toonParts).push(g);
  }

  /** Perfil lateral (pontos [z, y], sentido qualquer) extrudado na largura `w` (eixo x). */
  profile(points: [number, number][], w: number, o: PartOpts & { bevel?: number; holes?: [number, number][][] }) {
    const bevel = o.bevel ?? 0.004 / this.unit;
    const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
    for (const hole of o.holes ?? []) shape.holes.push(new THREE.Path(hole.map(([z, y]) => new THREE.Vector2(z, y))));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.0005, w - 2 * bevel),
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: 1,
    });
    markBevel(geo, Math.max(0.0005, w - 2 * bevel));
    // shape (x, y) → (z, y); extrusão (z) → x, centrada
    geo.translate(0, 0, -(w - 2 * bevel) / 2);
    geo.applyMatrix4(new THREE.Matrix4().set(0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    this.add(geo, o);
  }

  /** Caixa chanfrada de tamanho total (w, h, d) centrada em `at`. */
  box(w: number, h: number, d: number, o: PartOpts & { bevel?: number }) {
    const b = Math.min(o.bevel ?? 0.003 / this.unit, w / 3, h / 3, d / 3);
    const hz = d / 2 - b;
    const hy = h / 2 - b;
    this.profile([[-hz, -hy], [hz, -hy], [hz, hy], [-hz, hy]], w, { ...o, bevel: b });
  }

  /** Cilindro (eixo y local; gire com `rot`). `spin` gira as facetas em torno do eixo. */
  cyl(rTop: number, rBottom: number, len: number, sides: number, o: PartOpts & { spin?: number }) {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, len, sides, 1);
    if (o.spin) geo.rotateY(o.spin);
    this.add(geo, o);
  }

  /** Anel (toro de poucos lados) no plano lateral YZ: sorriso, aros. `arc` < 2π = arco. */
  ring(radius: number, tube: number, o: PartOpts & { arc?: number }) {
    const geo = new THREE.TorusGeometry(radius, tube, 3, 12, o.arc ?? Math.PI * 2);
    geo.rotateY(Math.PI / 2);
    this.add(geo, o);
  }

  /** Cilindro de `from` até `to` (antebraços, cano). */
  span(from: Vec, to: Vec, rFrom: number, rTo: number, sides: number, o: Omit<PartOpts, 'at' | 'rot'>) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const geo = new THREE.CylinderGeometry(rTo, rFrom, dir.length(), sides, 1);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
    const mid = a.add(b).multiplyScalar(0.5);
    geo.translate(mid.x, mid.y, mid.z);
    this.add(geo, o);
  }

  /** Tubo por pontos de controle (fios da gambiarra). */
  tube(points: Vec[], radius: number, o: Omit<PartOpts, 'at' | 'rot'>) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    this.add(new THREE.TubeGeometry(curve, 14, radius, 5, false), o);
  }

  build(): { toon: THREE.BufferGeometry; glow: THREE.BufferGeometry; lens: THREE.BufferGeometry | null } {
    // Lote vazio (ex.: chinelo sem neon) vira geometria vazia, não erro do merge
    const merge = (parts: THREE.BufferGeometry[]) => parts.length ? mergeGeometries(parts)! : new THREE.BufferGeometry();
    const toon = merge(this.toonParts);
    const glow = merge(this.glowParts);
    const lens = this.lensParts.length ? mergeGeometries(this.lensParts)! : null;
    for (const g of [toon, glow, lens]) g?.scale(this.unit, this.unit, this.unit);
    for (const g of [...this.toonParts, ...this.glowParts, ...this.lensParts]) g.dispose();
    return { toon, glow, lens };
  }
}
