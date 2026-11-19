// Ponto de entrada do mundo: o bairro da Neo-São Paulo (ver `world/bairro.ts`) ou, com
// `?map=<id>` na URL, um mapa competitivo de `maps/` (ex.: `?map=arena1`).
import type * as THREE from 'three';
import { buildMap, MAPS } from './maps/build';
import { buildBairro, type World } from './world/bairro';

export type { World };

export function buildWorld(scene: THREE.Scene): World {
  const id = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('map');
  const map = id && Object.hasOwn(MAPS, id) ? MAPS[id] : undefined;
  if (id && !map) console.warn(`mapa "${id}" não existe; carregando o bairro`);
  return map ? buildMap(scene, map) : buildBairro(scene);
}
