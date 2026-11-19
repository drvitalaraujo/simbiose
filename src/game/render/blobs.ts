import * as THREE from 'three';
import type { Box, Vec3 } from '../physics';
import { PALETTE } from '../toon';
import { blobScale, FloorIndex } from './ground';

// Sombra-bolha para o que se mexe (drones, jogadores, orbes): um disco escuro em dois tons
// no chão embaixo de cada um, todos num único draw call (InstancedMesh). O mapa de sombra do
// sol é estático (render/pipeline.ts) e só tem o cenário; isto aqui é a sombra barata do resto.
//
// Uso (uma vez por quadro, antes do render):
//   blobs.update([{ position: drone.position, radius: 0.8 }, ...], world.solids)

export interface BlobTarget {
  position: Vec3;
  /** Raio da bolha no chão (m). */
  radius: number;
}

const MAX = 64;
const LIFT = 0.03; // acima do chão, contra z-fighting

function blobTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  // Núcleo de contato e penumbra curta; a transparência é lida pelo map (canal alpha).
  const penumbra = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  penumbra.addColorStop(0, 'rgba(255,255,255,1)');
  penumbra.addColorStop(0.42, 'rgba(255,255,255,0.85)');
  penumbra.addColorStop(0.7, 'rgba(255,255,255,0.4)');
  penumbra.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = penumbra;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export class BlobShadows {
  readonly mesh: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private floorSolids: readonly Box[] | null = null;
  private floorCount = 0;
  private floors: FloorIndex | null = null;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.ink,
      map: blobTexture(),
      transparent: true,
      opacity: 0.36,
      // Decalque transparente: sem escrever profundidade (senão o nanquim contorna o recorte)
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false; // as bolhas andam pelo mapa todo; é 1 draw call só
    this.mesh.raycast = () => {};
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  update(targets: readonly BlobTarget[], solids: readonly Box[]) {
    // Os sólidos do mapa são estáticos. Refaz o índice ao trocar/reconstruir o cenário.
    if (solids !== this.floorSolids || solids.length !== this.floorCount) {
      this.floorSolids = solids;
      this.floorCount = solids.length;
      this.floors = new FloorIndex(solids);
    }
    let n = 0;
    for (const t of targets) {
      if (n >= MAX) break;
      const floor = this.floors!.below(t.position, -Infinity);
      if (floor === -Infinity) continue;
      const k = blobScale(t.position.y - floor, t.radius);
      if (k <= 0) continue;
      this.p.set(t.position.x, floor + LIFT, t.position.z);
      this.m.compose(this.p, this.q, this.s.set(k, k, k));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    // Só envia as matrizes desenhadas; quadros sem sombra não precisam atualizar a GPU.
    this.mesh.instanceMatrix.clearUpdateRanges();
    if (n > 0) {
      this.mesh.instanceMatrix.addUpdateRange(0, n * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
