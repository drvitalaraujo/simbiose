import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { beveledBox, profile } from './forms';
import { SURFACE, type Surface, surfaceOf } from '../shading';

// Kit de peças low-poly de uma skin (cabelo, máscara, ombreiras, mochila...).
// Cada peça é desenhada em coordenadas de MUNDO da pose de descanso (T-pose, metros,
// boneco olhando para +Z, esquerda do personagem em +X) e presa a um osso com peso 1.
// Todas as peças de uma skin viram UMA malha com esqueleto (cor por vértice): é o mesmo
// que `bone.add(mesh)` para cada peça, mas custa 1 draw call em vez de dezenas.

export type Vec = readonly [number, number, number];

export interface PieceOptions {
  /** Rotação em graus (ordem XYZ). */
  rot?: Vec;
  /** Escala aplicada antes da rotação. */
  scale?: Vec;
  /** Multiplica a cor (telas que brilham no bloom: > ~1,05 em luz linear). */
  glow?: number;
  /** Espessura do contorno de time, relativa à do corpo (0 = sem contorno). */
  outline?: number;
  /** Resposta à luz (`shading.ts`); padrão: pela cor (pele, aço) ou o `surface` do kit. */
  surface?: Surface;
  /** Peça do olho: centro (pose de descanso) para onde ela achata ao piscar. */
  eye?: Vec;
}

/** Um ponto de um cabo: posição de descanso e até dois ossos (o 2º com peso `mix`). */
export interface CablePoint {
  at: Vec;
  bone: string;
  bone2?: string;
  mix?: number;
}

interface BoneRef {
  index: number;
  /** Matriz do osso na pose de descanso (boneMatrix = matrixWorld × inversa do bind). */
  rest: THREE.Matrix4;
}

const DEG = Math.PI / 180;
const _m = new THREE.Matrix4();
const _mi = new THREE.Matrix4();
const _n3 = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();

export class Kit {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly col: number[] = [];
  private readonly out: number[] = [];
  private readonly idx: number[] = [];
  private readonly wgt: number[] = [];
  private readonly mat: number[] = [];
  /** Superfície forçada para as próximas peças (ex.: cabelo); null = pela cor. */
  surface: Surface | null = null;

  constructor(private readonly bones: Map<string, BoneRef>) {}

  box(bone: string, size: Vec, at: Vec, color: number, o: PieceOptions = {}): void {
    this.add(new THREE.BoxGeometry(size[0], size[1], size[2]), bone, at, color, o);
  }

  bevel(bone: string, size: Vec, at: Vec, color: number, o: PieceOptions & { bevel?: number } = {}): void {
    this.add(beveledBox(size, o.bevel ?? Math.min(...size) * 0.22), bone, at, color, o);
  }

  panel(bone: string, points: readonly (readonly [number, number])[], depth: number, at: Vec, color: number, o: PieceOptions = {}): void {
    this.add(profile(points, depth), bone, at, color, o);
  }

  /** Fita achatada que acompanha a coluna, em vez de uma régua presa a um osso só. */
  ribbon(points: CablePoint[], width: number, color: number): void {
    const rgb = this.rgb(color);
    const normal = new THREE.Vector3(0, 0, points[0].at[2] < 0 ? -1 : 1);
    const edge = points.map((_, i) => {
      const a = points[Math.max(0, i - 1)].at;
      const b = points[Math.min(points.length - 1, i + 1)].at;
      return new THREE.Vector3(b[1] - a[1], a[0] - b[0], 0).normalize().multiplyScalar(width / 2);
    });
    for (let i = 0; i < points.length - 1; i++) {
      const corners = [[i, -1], [i, 1], [i + 1, -1], [i + 1, 1]] as const;
      const verts = corners.map(([j, side]) => new THREE.Vector3(...points[j].at).addScaledVector(edge[j], side));
      const winding = normal.z > 0 ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3];
      for (const vi of winding) {
        const pt = points[corners[vi][0]];
        this.push(verts[vi], normal, new THREE.Vector3(), rgb, this.surfaceFor(color), pt.bone, pt.bone2, pt.mix ?? 0);
      }
    }
  }

  /** Cilindro (ou cone, com `top` = 0) ao longo de `axis`. */
  cyl(
    bone: string,
    radius: number,
    height: number,
    at: Vec,
    color: number,
    o: PieceOptions & { top?: number; segs?: number; axis?: 'x' | 'y' | 'z'; open?: boolean } = {},
  ): void {
    const geo = new THREE.CylinderGeometry(o.top ?? radius, radius, height, o.segs ?? 8, 1, o.open ?? false);
    if (o.axis === 'x') geo.rotateZ(-Math.PI / 2);
    else if (o.axis === 'z') geo.rotateX(Math.PI / 2);
    this.add(geo, bone, at, color, o);
  }

  /** Esfera de poucos gomos; `half` deixa só a metade de cima. */
  ball(bone: string, radius: number, at: Vec, color: number, o: PieceOptions & { half?: boolean; segs?: number } = {}): void {
    const segs = o.segs ?? 6;
    const geo = new THREE.SphereGeometry(radius, segs, Math.max(2, segs >> 1), 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI);
    this.add(geo, bone, at, color, o);
  }

  /** Arco de toro (sorriso, alças curvas). O arco começa em +X e gira para +Y. */
  arc(bone: string, radius: number, tube: number, arc: number, at: Vec, color: number, o: PieceOptions = {}): void {
    this.add(new THREE.TorusGeometry(radius, tube, 3, 8, arc), bone, at, color, o);
  }

  /** Cabo grosso que dobra com o corpo: cada ponto segue o seu osso (ou a mistura de dois). */
  cable(points: CablePoint[], radius: number, color: number, o: PieceOptions = {}): void {
    const sides = 5;
    const rings: { p: THREE.Vector3; t: THREE.Vector3 }[] = points.map((pt, i) => {
      const a = new THREE.Vector3(...points[Math.max(0, i - 1)].at);
      const b = new THREE.Vector3(...points[Math.min(points.length - 1, i + 1)].at);
      return { p: new THREE.Vector3(...pt.at), t: b.sub(a).normalize() };
    });
    const ringVerts = rings.map(({ p, t }) => {
      const side = Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const u = new THREE.Vector3().crossVectors(t, side).normalize();
      const v = new THREE.Vector3().crossVectors(t, u).normalize();
      return Array.from({ length: sides }, (_, k) => {
        const ang = (k / sides) * Math.PI * 2;
        const n = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang));
        return { p: p.clone().addScaledVector(n, radius), n };
      });
    });
    const tri: { p: THREE.Vector3; n: THREE.Vector3; ring: number }[] = [];
    for (let i = 0; i < rings.length - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        const a = { ...ringVerts[i][k], ring: i };
        const b = { ...ringVerts[i][k2], ring: i };
        const c = { ...ringVerts[i + 1][k], ring: i + 1 };
        const d = { ...ringVerts[i + 1][k2], ring: i + 1 };
        tri.push(a, c, b, b, c, d);
      }
    }
    const rgb = this.rgb(color, o.glow);
    const width = o.outline ?? 0.5;
    for (const vtx of tri) {
      const pt = points[vtx.ring];
      this.push(vtx.p, vtx.n, vtx.n.clone().multiplyScalar(width), rgb, this.surfaceFor(color, o), pt.bone, pt.bone2, pt.mix ?? 0);
    }
  }

  /** Junta tudo numa geometria com esqueleto, mais a geometria da casca do contorno. */
  finish(): { geometry: THREE.BufferGeometry; shell: THREE.BufferGeometry; triangles: number } {
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.Float32BufferAttribute(this.pos, 3);
    const skinIndex = new THREE.Uint16BufferAttribute(this.idx, 4);
    const skinWeight = new THREE.Float32BufferAttribute(this.wgt, 4);
    geometry.setAttribute('position', position);
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geometry.setAttribute('skinIndex', skinIndex);
    geometry.setAttribute('skinWeight', skinWeight);
    geometry.setAttribute('charMat', new THREE.Float32BufferAttribute(this.mat, 4));
    // A casca usa as mesmas posições, mas "normal" = direção suavizada do contorno
    // (nas quinas a casca não abre) já multiplicada pela espessura relativa.
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position', position);
    shell.setAttribute('normal', new THREE.Float32BufferAttribute(this.out, 3));
    shell.setAttribute('skinIndex', skinIndex);
    shell.setAttribute('skinWeight', skinWeight);
    // Só une vértices com posição, normal, cor E pesos iguais; quinas e cores continuam nítidas.
    const indexed = mergeVertices(geometry, 1e-6);
    const indexedShell = mergeVertices(shell, 1e-6);
    geometry.dispose();
    shell.dispose();
    return { geometry: indexed, shell: indexedShell, triangles: this.pos.length / 9 };
  }

  private add(geo: THREE.BufferGeometry, bone: string, at: Vec, color: number, o: PieceOptions): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...((o.rot ?? [0, 0, 0]).map((d) => d * DEG) as [number, number, number]))),
      new THREE.Vector3(...(o.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(m);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    // Direção do contorno: média das normais de todos os vértices na mesma posição
    const sum = new Map<string, THREE.Vector3>();
    const key = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    for (let i = 0; i < p.count; i++) {
      const k = key(i);
      const s = sum.get(k) ?? new THREE.Vector3();
      sum.set(k, s.add(_v.fromBufferAttribute(n, i)));
    }
    const width = o.outline ?? 0.7;
    const rgb = this.rgb(color, o.glow);
    for (let i = 0; i < p.count; i++) {
      const pos = new THREE.Vector3().fromBufferAttribute(p, i);
      const nor = new THREE.Vector3().fromBufferAttribute(n, i);
      const dir = sum.get(key(i))!.clone().normalize().multiplyScalar(width);
      this.push(pos, nor, dir, rgb, this.surfaceFor(color, o), bone, undefined, 0, o.eye);
    }
    geo.dispose();
    if (g !== geo) g.dispose();
  }

  private push(
    world: THREE.Vector3,
    normal: THREE.Vector3,
    outline: THREE.Vector3,
    rgb: [number, number, number],
    surface: Surface,
    bone: string,
    bone2?: string,
    mix = 0,
    eye?: Vec,
  ): void {
    const b1 = this.bone(bone);
    const b2 = bone2 ? this.bone(bone2) : b1;
    const w2 = bone2 ? mix : 0;
    // Posição na geometria tal que o skinning na pose de descanso devolva `world`:
    // (Σ wᵢ·Mᵢ) · pos = world  →  pos = (Σ wᵢ·Mᵢ)⁻¹ · world
    blend(_m, b1.rest, b2.rest, w2);
    _mi.copy(_m).invert();
    _v.copy(world).applyMatrix4(_mi);
    this.pos.push(_v.x, _v.y, _v.z);
    _n3.setFromMatrix4(_mi);
    _v.copy(normal).applyMatrix3(_n3).normalize();
    this.nrm.push(_v.x, _v.y, _v.z);
    _v.copy(outline).applyMatrix3(_n3);
    this.out.push(_v.x, _v.y, _v.z);
    this.col.push(...rgb);
    // Centro do olho no espaço da geometria (mesma transformação da posição)
    if (eye) _v.set(eye[0], eye[1], eye[2]).applyMatrix4(_mi);
    else _v.set(0, 0, 0);
    this.mat.push(eye ? SURFACE.blink : surface, _v.x, _v.y, _v.z);
    this.idx.push(b1.index, b2.index, 0, 0);
    this.wgt.push(1 - w2, w2, 0, 0);
  }

  private surfaceFor(color: number, o: PieceOptions = {}): Surface {
    if (o.surface !== undefined) return o.surface;
    if ((o.glow ?? 1) > 1.05) return SURFACE.glow;
    return this.surface ?? surfaceOf(color);
  }

  private bone(name: string): BoneRef {
    const ref = this.bones.get(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!ref) throw new Error(`osso ${name} não existe no boneco`);
    return ref;
  }

  private rgb(color: number, glow = 1): [number, number, number] {
    _c.set(color).multiplyScalar(glow);
    return [_c.r, _c.g, _c.b];
  }
}

function blend(out: THREE.Matrix4, a: THREE.Matrix4, b: THREE.Matrix4, w: number): THREE.Matrix4 {
  for (let i = 0; i < 16; i++) out.elements[i] = a.elements[i] * (1 - w) + b.elements[i] * w;
  return out;
}
