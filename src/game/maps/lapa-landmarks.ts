import * as THREE from 'three';
import { PALETTE as C } from '../toon';
import { backdropMaterial, COASTAL_VEIL, hazed as paint } from '../world/backdrop';
import { Builder, place } from '../world/builder';
import { rng } from '../world/shapes';

// Corcovado e Cristo Redentor no horizonte da Lapa. Na cidade real o morro fica a
// sudoeste dos Arcos: aqui, além de Santa Teresa (−x) e do lado do Circo (−z). Escala de
// cenário de anime: o Cristo é maior que o real para ser lido de dentro da arena.
// A altura (~20° acima do olho no largo) o põe nos vãos de cima vistos de quase todo o
// largo e acima do aqueduto visto do Terraço do Choro e do Beco do Sebo.
// `skyline()` deixa essa direção sem prédios. Sem colisão nem sombra.

/** Pico do Corcovado (base da estátua) e o rumo em que ele aparece do largo. */
export const CORCOVADO = { x: -96, z: -142, peak: 46 };
// Dentro do anel de nuvens (~200 m), senão os cúmulos do horizonte cobrem o morro.
const hazed = (geo: THREE.BufferGeometry, color: number, haze: number, glow = 1) => paint(geo, color, haze, glow, COASTAL_VEIL);
const far = { cast: false, receive: false } as const;

export function lapaLandmarks(b: Builder) {
  corcovado(b);
  cristo(b, CORCOVADO.x, CORCOVADO.peak, CORCOVADO.z);
}

/** Maciço da Tijuca: o pão de pedra do Corcovado sobre um espinhaço largo de mata. */
function corcovado(b: Builder) {
  const mat = backdropMaterial();
  const { x, z, peak } = CORCOVADO;
  // Pão de granito: cúpula alta e estreita, com a parede íngreme virada para a cidade.
  const rock = new THREE.IcosahedronGeometry(1, 2);
  rock.scale(15, peak * 0.62, 13);
  bend(rock, -0.1, 0.06);
  b.add(hazed(place(rock, x, peak * 0.38, z), C.stoneJoint, 0.22), mat, far);
  // Mata no alto da cúpula, onde fica o mirante.
  const cap = new THREE.IcosahedronGeometry(1, 1);
  cap.scale(7, 3.2, 6);
  b.add(hazed(place(cap, x, peak - 1.6, z), C.leaf, 0.26), mat, far);
  // Espinhaço verde: corre de sudeste para noroeste e mais baixo a cada passo.
  const r = rng(1931);
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    const step = Math.floor(i / 2);
    const h = peak * (0.66 - step * 0.11) + r() * 5;
    const hill = new THREE.IcosahedronGeometry(1, 1);
    hill.scale(30 + r() * 12, h, 24 + r() * 8);
    const along = side * (step * 26 + 14);
    b.add(hazed(place(hill, x + along * 0.82, -4, z - along * 0.57 + 12), i % 3 ? C.leaf : C.colonialMoss, 0.3 + step * 0.07), mat, far);
  }
}

/** Entorta o cone: a ponta pende para (dx, dz) por unidade de altura. */
function bend(geo: THREE.BufferGeometry, dx: number, dz: number) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setXYZ(i, p.getX(i) + y * dx, y, p.getZ(i) + y * dz);
  }
}

/** Silhueta do Cristo de braços abertos, extrudada e virada para a Lapa. */
function cristo(b: Builder, x: number, y: number, z: number) {
  const s = 2.2;
  const half: [number, number][] = [
    [0.95, 0], [0.78, 3.6], [0.92, 5.2], [4.4, 6.05], [4.95, 6.2],
    [4.95, 6.72], [1.05, 6.86], [0.42, 7.05], [0.5, 7.45], [0.38, 7.85], [0, 8],
  ];
  const outline = [...half, ...half.slice(0, -1).reverse().map(([px, py]) => [-px, py] as [number, number])];
  const shape = new THREE.Shape(outline.map(([px, py]) => new THREE.Vector2(px * s, py * s)));
  const body = new THREE.ExtrudeGeometry(shape, { depth: 1.3 * s, bevelEnabled: false });
  body.translate(0, 0, -0.65 * s);
  // De frente para o centro da arena, ligeiramente de três quartos como visto da Lapa.
  const face = Math.atan2(-x, -z) + 0.35;
  const mat = backdropMaterial();
  b.add(hazed(place(body, x, y + 2.6 * s, z, face), C.paper, 0.12, 1.12), mat, far);
  const pedestal = new THREE.BoxGeometry(2.6 * s, 2.6 * s, 2.6 * s);
  b.add(hazed(place(pedestal, x, y + 1.3 * s, z, face), C.cal, 0.18), mat, far);
  // Mirante sob a estátua: plataforma clara que recorta o topo do morro.
  const deck = new THREE.CylinderGeometry(4.5, 5.5, 2, 10);
  b.add(hazed(place(deck, x, y - 0.6, z), C.cal, 0.22), mat, far);
}
