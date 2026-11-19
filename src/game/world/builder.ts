import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Box } from '../physics';
import { sceneLit, setSceneFloors } from '../render/scene-light';
import { PALETTE, plainToonColor, toon, toonScene } from '../toon';
import { chunkKey } from './chunks';
import { box } from './shapes';

// Junta a geometria estática do bairro em poucas malhas: por material *e por bloco espacial*
// (ver chunks.ts), para o frustum culling descartar o que está fora da tela. As peças de
// `toon(cor)` de todas as cores viram um material só, com a cor no vértice.
//
// Para não multiplicar os lotes, "bloqueia tiro" e "projeta sombra" não separam malhas
// visíveis: cada bloco ganha cópias só de posição para isso —
//  - `shootables`: malhas invisíveis fora da cena, só para o raycast do tiro;
//  - sombra: malhas com `userData.shadowProxy`, escondidas; o pipeline só as mostra no
//    quadro em que redesenha o mapa de sombra (que é estático, ver render/pipeline.ts).
// A colisão fica separada, em caixas AABB.

export interface AddOptions {
  /** Margem de descarte para deslocamento de vértices no shader (metros). */
  boundsPadding?: number;
  /** Bloqueia tiro (entra em `shootables`). Padrão: false. */
  shoot?: boolean;
  /** Projeta sombra. Padrão: true. */
  cast?: boolean;
  /** Recebe sombra. Padrão: true. */
  receive?: boolean;
  /** Espessura do contorno de nanquim (0 = sem contorno). Padrão: 0. */
  outline?: number;
}

export interface BlockOptions extends AddOptions {
  /** Entra na colisão. Padrão: true (e então também bloqueia tiro). */
  solid?: boolean;
}

interface Batch {
  boundsPadding: number;
  material: THREE.Material;
  geos: THREE.BufferGeometry[];
  cast: boolean;
  receive: boolean;
}

const noRaycast = () => {};
/** Material das cópias de sombra: nunca pinta nada (só aparecem no passe de sombra). */
const proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const tmpBox = new THREE.Box3();
const tmpCenter = new THREE.Vector3();

export class Builder {
  readonly solids: Box[] = [];
  /** AABBs atingíveis: independentes da colisão de movimento. */
  readonly shotBlockers: Box[] = [];
  /** Faces visuais de caixas/planos; só para colar marcas, nunca para regras de tiro. */
  readonly impactSurfaces: Box[] = [];
  readonly shootables: THREE.Object3D[] = [];
  shells = false;
  /**
   * Volume coberto pelo mapa de sombra do sol (definido pelo céu). Peça fora dele nem
   * projeta nem recebe sombra: o shader fica mais barato e o visual é o mesmo.
   */
  shadowFrustum: THREE.Frustum | null = null;
  /** Estatística de montagem: malhas criadas por `finish()`. */
  meshCount = 0;
  private readonly batches = new Map<string, Batch>();
  private readonly shooters = new Map<string, THREE.BufferGeometry[]>();
  private readonly casters = new Map<string, THREE.BufferGeometry[]>();
  private readonly outlineMat = new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide });

  constructor(private readonly scene: THREE.Scene) {}

  /** Adiciona geometria já posicionada no mundo. */
  add(geo: THREE.BufferGeometry, material: THREE.Material, opts: AddOptions = {}) {
    const shoot = opts.shoot ?? false;
    let cast = opts.cast ?? true;
    let receive = opts.receive ?? true;
    if (!geo.index) {
      const idx = new Array(geo.attributes.position.count).fill(0).map((_, i) => i);
      geo.setIndex(idx);
    }
    const plain = plainToonColor(material);
    if (plain) {
      // Toon de cor chapada: entra no lote de cor por vértice (só posição, normal e cor)
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      paintColor(geo, plain);
      material = toonScene();
    } else {
      const wantsColor = (material as THREE.MeshBasicMaterial).vertexColors === true;
      if (!wantsColor && geo.attributes.color) geo.deleteAttribute('color');
      if (wantsColor && !geo.attributes.color) paint(geo, 0xffffff);
    }
    geo.computeBoundingBox();
    tmpBox.copy(geo.boundingBox!);
    if ((geo.type === 'BoxGeometry' || geo.type === 'PlaneGeometry') && axisAligned(geo)) {
      this.impactSurfaces.push({ min: { x: tmpBox.min.x, y: tmpBox.min.y, z: tmpBox.min.z }, max: { x: tmpBox.max.x, y: tmpBox.max.y, z: tmpBox.max.z } });
    }
    if (shoot) this.shotBlockers.push({ min: { x: tmpBox.min.x, y: tmpBox.min.y, z: tmpBox.min.z }, max: { x: tmpBox.max.x, y: tmpBox.max.y, z: tmpBox.max.z } });
    if (this.shadowFrustum && !this.shadowFrustum.intersectsBox(tmpBox)) {
      cast = false;
      receive = false;
    }
    tmpBox.getCenter(tmpCenter);
    const chunk = chunkKey(tmpCenter.x, tmpCenter.z);
    if (shoot) push(this.shooters, chunk, positionsOnly(geo));
    // Material com recorte/transparência projeta sombra pela própria malha (raro no cenário)
    const alpha = material.transparent || material.alphaTest > 0;
    if (cast && !alpha) push(this.casters, chunk, positionsOnly(geo));
    const ownCast = cast && alpha;
    // Recepção de sombra vale para o lote inteiro (basta uma peça pedir): separar por isso
    // dobrava os draw calls nos blocos da borda do mapa de sombra
    const batch = this.batch(`${chunk}|${material.uuid}|${ownCast}`, material, ownCast, receive);
    batch.receive ||= receive;
    batch.boundsPadding = Math.max(batch.boundsPadding, opts.boundsPadding ?? 0);
    batch.geos.push(geo);
    // O contorno do mundo agora vem do pós-processamento (render/pipeline.ts); a casca
    // invertida só volta se `shells` for ligado (útil para comparar).
    if (opts.outline && this.shells) this.outline(geo, opts.outline, chunk);
  }

  /** Caixa de (x0,y0,z0) a (x1,y1,z1). Sólida e atingível por padrão, com contorno. */
  block(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number | THREE.Material, opts: BlockOptions = {}) {
    const b = box(x0, y0, z0, x1, y1, z1);
    const solid = opts.solid ?? true;
    if (solid) this.solids.push(b);
    const geo = boxGeo(b);
    const mat = typeof color === 'number' ? toon(color) : color;
    this.add(geo, mat, { shoot: solid, outline: 0.05, ...opts });
    return b;
  }

  /** Só colisão (limites invisíveis). */
  invisible(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    this.solids.push(box(x0, y0, z0, x1, y1, z1));
  }

  /** Contorno de casca invertida: cópia inflada em volta do centro da peça. */
  private outline(geo: THREE.BufferGeometry, thickness: number, chunk: string) {
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position', geo.attributes.position.clone());
    shell.setIndex(geo.index!.clone());
    shell.computeBoundingBox();
    const bb = shell.boundingBox!;
    const c = bb.getCenter(new THREE.Vector3());
    const s = bb.getSize(new THREE.Vector3());
    const k = (v: number) => (v > 1e-4 ? 1 + (2 * thickness) / v : 1);
    shell.translate(-c.x, -c.y, -c.z);
    shell.scale(k(s.x), k(s.y), k(s.z));
    shell.translate(c.x, c.y, c.z);
    this.batch(`${chunk}|outline`, this.outlineMat, false, false).geos.push(shell);
  }

  private batch(key: string, material: THREE.Material, cast: boolean, receive: boolean): Batch {
    let b = this.batches.get(key);
    if (!b) {
      b = { material, geos: [], cast, receive, boundsPadding: 0 };
      this.batches.set(key, b);
    }
    return b;
  }

  /** Mescla tudo e coloca na cena. Chamar uma vez, no fim. */
  finish() {
    if (this.solids.length) setSceneFloors(this.solids); // pé das paredes na luz pintada
    for (const b of this.batches.values()) {
      sceneLit(b.material); // luz pintada e névoa atmosférica (só materiais toon)
      const mesh = new THREE.Mesh(merge(b.geos), b.material);
      mesh.geometry.boundingBox!.expandByScalar(b.boundsPadding);
      mesh.geometry.boundingSphere!.radius += b.boundsPadding;
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.raycast = noRaycast;
      this.place(mesh);
    }
    for (const geos of this.shooters.values()) {
      // Fora da cena: o Raycaster não olha `visible` nem precisa da malha na cena
      const mesh = new THREE.Mesh(merge(geos), proxyMat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrixWorld();
      this.shootables.push(mesh);
    }
    for (const geos of this.casters.values()) {
      const mesh = new THREE.Mesh(merge(geos), proxyMat);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.visible = false;
      mesh.userData.shadowProxy = true;
      mesh.raycast = noRaycast;
      this.place(mesh);
    }
    this.batches.clear();
    this.shooters.clear();
    this.casters.clear();
  }

  private place(mesh: THREE.Mesh) {
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.scene.add(mesh);
    this.meshCount++;
  }
}

function push(map: Map<string, THREE.BufferGeometry[]>, key: string, geo: THREE.BufferGeometry) {
  const list = map.get(key);
  if (list) list.push(geo);
  else map.set(key, [geo]);
}

/** Cópia leve (mesmo buffer de posição e índice) para raycast e sombra. */
function positionsOnly(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geo.attributes.position);
  g.setIndex(geo.index);
  return g;
}

/** Mescla um lote; a esfera envolvente do bloco é o que o frustum culling usa. */
function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  if (!merged) throw new Error('bairro: geometrias incompatíveis no lote');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

export function boxGeo(b: Box): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
  g.translate((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
  return g;
}

function axisAligned(geo: THREE.BufferGeometry): boolean {
  const normals = geo.getAttribute('normal');
  if (!normals) return false;
  for (let i = 0; i < normals.count; i++) for (let a = 0; a < 3; a++) {
    const value = Math.abs(normals.getComponent(i, a));
    if (value > 1e-5 && Math.abs(value - 1) > 1e-5) return false;
  }
  return true;
}

/** Pinta a geometria inteira com uma cor (atributo `color`, para materiais com vertexColors). */
export function paint(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  return paintColor(geo, new THREE.Color(color));
}

/** Como `paint`, com uma cor já em luz linear (ex.: a `color` de um material). */
export function paintColor(geo: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Posiciona uma geometria: rotação em Y (e opcional em X/Z) e translação. */
export function place(geo: THREE.BufferGeometry, x: number, y: number, z: number, rotY = 0, rotX = 0, rotZ = 0) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
  m.setPosition(x, y, z);
  geo.applyMatrix4(m);
  return geo;
}
