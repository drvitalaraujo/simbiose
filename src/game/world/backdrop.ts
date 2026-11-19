import * as THREE from 'three';
import { PALETTE } from '../toon';
import { fogColor, SUN_DIR } from './sky';

// Silhuetas de cenário além da névoa (Corcovado, morros): pintura de fundo de anime.
// A névoa do jogo apagaria tudo a mais de ~200 m, então estas peças não usam fog: a
// perspectiva atmosférica é assada na cor de cada vértice (3 tons do sol + véu de névoa).
// Um material só para todas: o Builder junta as peças num lote por fatia distante.

let material: THREE.MeshBasicMaterial | null = null;

export function backdropMaterial(): THREE.MeshBasicMaterial {
  material ??= new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  return material;
}

const shadeTint = new THREE.Color(PALETTE.colonialSky).lerp(new THREE.Color(PALETTE.dusk), 0.5);
const sunTint = new THREE.Color(PALETTE.sun).lerp(new THREE.Color(PALETTE.orange), 0.2);

/** Véu do céu litorâneo (Lapa, Pelourinho): azul claro do horizonte, não o rosa da névoa. */
export const COASTAL_VEIL = new THREE.Color(PALETTE.colonialSky).lerp(new THREE.Color(PALETTE.cal), 0.45);

/**
 * Pinta a geometria (já posicionada no mundo) com faces chapadas em 3 tons e véu de névoa:
 * `haze` 0 = cor cheia, 1 = some no horizonte. `glow` > 1 faz o lado aceso passar do bloom.
 */
export function hazed(geo: THREE.BufferGeometry, color: number, haze: number, glow = 1, veil: THREE.Color = fogColor()): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  const fog = veil;
  const base = new THREE.Color(color);
  const lit = base.clone().lerp(sunTint, 0.22).lerp(fog, haze * 0.8).multiplyScalar(glow);
  const mid = base.clone().lerp(fog, haze);
  const shade = base.clone().lerp(shadeTint, 0.42).multiplyScalar(0.82).lerp(fog, haze * 0.9);
  const nor = g.attributes.normal;
  const col = new Float32Array(nor.count * 3);
  const n = new THREE.Vector3();
  for (let v = 0; v < nor.count; v++) {
    n.set(nor.getX(v), nor.getY(v), nor.getZ(v)).normalize();
    const l = n.dot(SUN_DIR) * 0.75 + n.y * 0.35;
    const tone = l > 0.3 ? lit : l > -0.08 ? mid : shade;
    col[v * 3] = tone.r; col[v * 3 + 1] = tone.g; col[v * 3 + 2] = tone.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
