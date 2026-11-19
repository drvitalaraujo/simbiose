import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit } from './kit';
import { CUT_PLANES, regionOf } from './regions';
import { SKINS, type SkinId } from './index';
import { type SplitMesh, splitByPlanes } from './split';
import { tailoring } from './tailoring';
import { SURFACE, surfaceOf } from '../shading';

// Monta as geometrias de uma skin a partir do manequim carregado, uma vez por skin:
// - corpo: as duas malhas do GLB (corpo + juntas) fundidas numa só, cortada nos planos
//   das regiões (`CUT_PLANES`) e com UMA cor por triângulo (cel-shading sem degradê);
// - peças: tudo o que a skin prende nos ossos, numa malha com esqueleto só.
// Cada boneco reaproveita essas geometrias e só cria as malhas presas ao próprio esqueleto.

export interface SkinGeometry {
  body: THREE.BufferGeometry;
  pieces: THREE.BufferGeometry;
  /** Peças com "normal" = direção do contorno (casca do contorno de time). */
  piecesShell: THREE.BufferGeometry;
  triangles: { body: number; pieces: number };
}

interface Base {
  /** Corpo cortado, sem índice e sem cor (atributos compartilhados por todas as skins). */
  flat: THREE.BufferGeometry;
  /** Osso de maior peso, centro e normal de cada triângulo (pose de descanso). */
  triBone: string[];
  triCenter: Float32Array;
  triNormal: Float32Array;
  bones: Map<string, { index: number; rest: THREE.Matrix4 }>;
}

const bases = new WeakMap<THREE.Object3D, Base>();
const built = new WeakMap<THREE.Object3D, Map<SkinId, SkinGeometry>>();

export function skinGeometry(scene: THREE.Object3D, skin: SkinId): SkinGeometry {
  let perSkin = built.get(scene);
  if (!perSkin) built.set(scene, (perSkin = new Map()));
  let g = perSkin.get(skin);
  if (!g) {
    g = build(base(scene), skin);
    perSkin.set(skin, g);
  }
  return g;
}

function build(b: Base, skin: SkinId): SkinGeometry {
  const def = SKINS[skin];
  const body = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) body.setAttribute(name, b.flat.getAttribute(name));
  const tris = b.triBone.length;
  const colors = new Float32Array(tris * 9);
  const mat = new Float32Array(tris * 12);
  const c = new THREE.Color();
  for (let t = 0; t < tris; t++) {
    const p = { x: b.triCenter[t * 3], y: b.triCenter[t * 3 + 1], z: b.triCenter[t * 3 + 2] };
    const n = { x: b.triNormal[t * 3], y: b.triNormal[t * 3 + 1], z: b.triNormal[t * 3 + 2] };
    const region = regionOf(b.triBone[t], p, n);
    const color = def.colors[region];
    c.set(color);
    const surface = region === 'hair' ? SURFACE.hair : surfaceOf(color);
    for (let k = 0; k < 3; k++) {
      colors.set([c.r, c.g, c.b], t * 9 + k * 3);
      mat[t * 12 + k * 4] = surface;
    }
  }
  body.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  body.setAttribute('charMat', new THREE.BufferAttribute(mat, 4));

  const kit = new Kit(b.bones);
  def.pieces(kit);
  tailoring(kit, skin);
  const { geometry: pieces, shell: piecesShell, triangles } = kit.finish();
  // O corte por cor continua por triângulo; o índice evita transformar as cópias
  // idênticas na GPU. Atributos de cor, normal e skinning participam da comparação.
  const indexedBody = mergeVertices(body, 1e-6);
  body.dispose();
  return { body: indexedBody, pieces, piecesShell, triangles: { body: tris, pieces: triangles } };
}

function base(scene: THREE.Object3D): Base {
  const cached = bases.get(scene);
  if (cached) return cached;
  scene.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
  });
  if (!meshes.length) throw new Error('boneco sem malha com esqueleto');
  // As geometrias seguem a ordem de ossos da 1ª malha (o `instantiate` usa o esqueleto dela)
  const ref = meshes[0].skeleton;
  ref.update();
  const bones = new Map(
    ref.bones.map((bn, index) => [bn.name, { index, rest: new THREE.Matrix4().fromArray(ref.boneMatrices!, index * 16) }]),
  );

  const m: SplitMesh = { position: [], normal: [], skinIndex: [], skinWeight: [], rest: [], bone: [], index: [] };
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    mesh.skeleton.update();
    const src = mesh.geometry;
    const sp = src.getAttribute('position');
    const sn = src.getAttribute('normal');
    const si = src.getAttribute('skinIndex');
    const sw = src.getAttribute('skinWeight');
    const offset = m.bone.length;
    // Índices de osso desta malha → índices do esqueleto de referência (pelo nome)
    const remap = mesh.skeleton.bones.map((bn) => bones.get(bn.name)?.index ?? 0);
    for (let i = 0; i < sp.count; i++) {
      m.position.push(sp.getX(i), sp.getY(i), sp.getZ(i));
      v.fromBufferAttribute(sn, i).normalize();
      m.normal.push(v.x, v.y, v.z);
      let best = 0;
      let bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        const j = si.getComponent(i, k);
        m.skinIndex.push(remap[j]);
        m.skinWeight.push(w);
        if (w > bw) {
          bw = w;
          best = j;
        }
      }
      m.bone.push(mesh.skeleton.bones[best].name);
      // getVertexPosition já aplica o esqueleto: devolve a pose de descanso em metros
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
      m.rest.push(v.x, v.y, v.z);
    }
    const idx = src.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) m.index.push(idx.getX(i) + offset);
    else for (let i = 0; i < sp.count; i++) m.index.push(i + offset);
  }
  splitByPlanes(m, CUT_PLANES);

  // Sem índice: cada triângulo tem os seus 3 vértices (para ter cor própria)
  const tris = m.index.length / 3;
  const pos = new Float32Array(tris * 9);
  const nor = new Float32Array(tris * 9);
  const skI = new Uint16Array(tris * 12);
  const skW = new Float32Array(tris * 12);
  const triBone: string[] = [];
  const triCenter = new Float32Array(tris * 3);
  const triNormal = new Float32Array(tris * 3);
  for (let t = 0; t < tris; t++) {
    const tri = [m.index[t * 3], m.index[t * 3 + 1], m.index[t * 3 + 2]];
    tri.forEach((vi, k) => {
      const o = t * 3 + k;
      for (let j = 0; j < 3; j++) {
        pos[o * 3 + j] = m.position[vi * 3 + j];
        nor[o * 3 + j] = m.normal[vi * 3 + j];
        triCenter[t * 3 + j] += m.rest[vi * 3 + j] / 3;
        triNormal[t * 3 + j] += m.normal[vi * 3 + j] / 3;
      }
      for (let j = 0; j < 4; j++) {
        skI[o * 4 + j] = m.skinIndex[vi * 4 + j];
        skW[o * 4 + j] = m.skinWeight[vi * 4 + j];
      }
    });
    const [b0, b1, b2] = tri.map((vi) => m.bone[vi]);
    triBone.push(b1 === b2 ? b1 : b0);
  }
  const flat = new THREE.BufferGeometry();
  flat.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  flat.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  flat.setAttribute('skinIndex', new THREE.BufferAttribute(skI, 4));
  flat.setAttribute('skinWeight', new THREE.BufferAttribute(skW, 4));
  const b: Base = { flat, triBone, triCenter, triNormal, bones };
  bases.set(scene, b);
  return b;
}
