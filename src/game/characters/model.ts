import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PALETTE, toonVertexColors } from '../toon';
import { skinGeometry } from './skins/build';
import type { SkinId } from './skins/types';
import type { CharacterShading } from './shading';

// Carrega o boneco (Quaternius UAL, CC0 — ver docs/assets.md) e veste no visual toon.
// O GLB vem com malha + esqueleto + clipes; cada jogador é um clone com esqueleto próprio.
// Os clipes já vêm "no lugar" (osso root constante): quem move o boneco é o jogo.

export const CHARACTER_URL = `${import.meta.env.BASE_URL}assets/characters/mannequin.glb`;

export type Team = 'ally' | 'enemy';

/** Regra do GDD: inimigo rosa, aliado ciano. */
export const TEAM_COLOR: Record<Team, number> = { ally: PALETTE.cyan, enemy: PALETTE.pink };

export interface CharacterAsset {
  scene: THREE.Group;
  clips: Map<string, THREE.AnimationClip>;
}

let pending: Promise<CharacterAsset> | null = null;

/** Baixa o GLB uma vez só; chamadas seguintes reaproveitam. */
export function loadCharacter(url = CHARACTER_URL): Promise<CharacterAsset> {
  if (!pending) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    pending = loader.loadAsync(url).then((gltf) => ({
      scene: gltf.scene,
      clips: new Map(gltf.animations.map((c) => [c.name, c])),
    }));
  }
  return pending;
}

/**
 * Clona o boneco vestido com a skin (cor por vértice + peças presas aos ossos) e com o
 * contorno na cor do time por cima — a regra de legibilidade vale para qualquer skin:
 * um Sorridente aliado tem contorno ciano. Custo: 4 draw calls (corpo, peças e as duas
 * cascas), como o manequim cinza. Corpo e peças usam índices com cor/normal/pesos
 * preservados, para evitar skinning repetido dos vértices idênticos de cada triângulo.
 */
export function instantiate(asset: CharacterAsset, team: Team, skin: SkinId = 'lia', shading?: CharacterShading): THREE.Object3D {
  const root = cloneSkinned(asset.scene);
  const geo = skinGeometry(asset.scene, skin);
  const teamColor = TEAM_COLOR[team];
  const originals: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) originals.push(o as THREE.SkinnedMesh);
  });
  const first = originals[0];
  const parent = first.parent!;
  // As geometrias da skin usam a ordem de ossos da 1ª malha do GLB: a 1ª malha do clone
  // tem o mesmo esqueleto (clonado), então serve direto.
  const skeleton = first.skeleton;
  for (const m of originals) m.removeFromParent();

  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, decorative: boolean) => {
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.position.copy(first.position);
    mesh.quaternion.copy(first.quaternion);
    mesh.scale.copy(first.scale);
    parent.add(mesh);
    mesh.bind(skeleton, first.bindMatrix);
    mesh.frustumCulled = false; // a caixa de bind não acompanha a animação (pulo/morte)
    if (decorative) mesh.raycast = () => {}; // não pode bloquear tiro (o acerto vem de hitbox.ts)
    return mesh;
  };
  // Corpo e peças usam o sombreamento de personagem (material do boneco, programa comum).
  const material = shading?.material ?? toonVertexColors();
  for (const [g, name, decorative] of [[geo.body, 'skin-body', false], [geo.pieces, 'skin-pieces', true]] as const) {
    const mesh = add(g, material, decorative);
    mesh.name = name;
    if (shading) mesh.onBeforeRender = (_r, scene, camera) => shading.sync(scene, camera);
  }
  for (const g of [geo.body, geo.piecesShell]) {
    const shell = add(g, teamOutline(teamColor), true);
    shell.renderOrder = -1;
  }
  return root;
}

const OUTLINE_WIDTH = 0.018; // perto: identificação externa sem encobrir rosto e mãos
const outlineCache = new Map<number, THREE.MeshBasicMaterial>();

/**
 * Contorno de casca invertida que funciona com esqueleto: empurra cada vértice pela normal
 * ANTES do skinning, então a casca acompanha a animação (o `addOutline` do toon.ts escala a
 * geometria e não serve para malha animada). Sem `normalize`: a "normal" do corpo já é
 * unitária e a da casca das peças vem suavizada e escalada pela espessura (`skins/kit.ts`).
 */
function teamOutline(color: number): THREE.MeshBasicMaterial {
  let m = outlineCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    const height = { value: 900 };
    const size = new THREE.Vector2();
    m.onBeforeRender = renderer => {
      height.value = renderer.getDrawingBufferSize(size).y;
    };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.teamHeight = height;
      shader.vertexShader = 'uniform float teamHeight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Compensa distância e resolução: a cor do time não some em um subpixel.
        // O teto em metros impede que alvos muito distantes ganhem uma casca enorme.
        float teamDepth = max(0.0, -(modelViewMatrix * vec4(position, 1.0)).z);
        float pixelWidth = 2.6 * teamDepth / max(teamHeight * projectionMatrix[1][1], 1.0);
        transformed += normal * clamp(pixelWidth, ${OUTLINE_WIDTH.toFixed(4)}, 0.12);`,
      );
    };
    m.customProgramCacheKey = () => 'team-outline-distance-v1';
    outlineCache.set(color, m);
  }
  return m;
}
