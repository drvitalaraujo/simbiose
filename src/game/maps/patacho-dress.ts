import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE as P, toon } from '../toon';
import { Builder } from '../world/builder';
import { solidColor } from './colors';
import { PATACHO_HUTS } from './patacho';
import { dressPatachoCoast } from './patacho-coast';
import { dressPatachoCovers, dressPatachoGround, patachoCoverBase } from './patacho-covers';
import { dressPatachoHuts } from './patacho-huts';
import { PatachoArt, patachoMaterials } from './patacho-materials';
import { dressPatachoNature } from './patacho-nature';
import type { MapData } from './types';

// Vestimenta completa da Praia do Patacho: preserva 100% dos sólidos, bloqueadores de tiro e
// alcances do corpo (modo ?greybox idêntico na física), trocando caixas cruas por arquitetura
// alagoana, coqueiros roliços, piscinas naturais com arrecifes e jangadas animadas.

const HUT_COLORS = [P.cal, P.colonialMoss, P.colonialSky, P.colonialRose, P.ochre] as const;

/** Luz costeira tropical: rebote quente de areia clara por baixo e contraluz turquesa vinda do mar. */
export function patachoLight(scene: THREE.Scene) {
  for (const child of scene.children) {
    if (child instanceof THREE.HemisphereLight) {
      child.color.set(P.cal).lerp(new THREE.Color(P.colonialSky), 0.26);
      child.groundColor.set(P.beachSand).lerp(new THREE.Color(P.sand), 0.3);
      child.intensity = 1.14;
    } else if (child instanceof THREE.DirectionalLight) {
      if (child.castShadow) {
        child.color.set(P.sun).lerp(new THREE.Color(P.cal), 0.16);
        child.intensity = 2.36;
      } else {
        child.color.set(P.seaShallow).lerp(new THREE.Color(P.colonialSky), 0.42);
        child.intensity = 0.46;
      }
    }
  }
}

export function dressPatacho(
  scene: THREE.Scene,
  b: Builder,
  map: MapData,
  dressed = true,
  overhangs: Box[] = [],
): ((dt: number, time: number) => void) | null {
  if (!dressed) {
    for (const s of map.solids) {
      const { min: a, max: c } = s.box;
      if (s.kind === 'bound') {
        b.invisible(a.x, a.y, a.z, c.x, c.y, c.z);
        continue;
      }
      b.block(a.x, a.y, a.z, c.x, c.y, c.z, solidColor(s), {
        cast: s.kind !== 'ground',
        outline: s.kind === 'ground' ? 0 : 0.05,
      });
    }
    return null;
  }

  const materials = patachoMaterials();
  const art = new PatachoArt(b);
  const palmProxy = toon(P.cal).clone();
  palmProxy.visible = false;

  for (const s of map.solids) {
    const { min: a, max: c } = s.box;
    if (s.kind === 'bound') {
      b.invisible(a.x, a.y, a.z, c.x, c.y, c.z);
      continue;
    }
    const hutIdx = PATACHO_HUTS.indexOf(s);
    const isPalmTrunk = s.kind === 'wall' && hutIdx < 0;
    if (isPalmTrunk) {
      // Mantém colisão e bloqueio de tiro idênticos ao servidor; o tronco roliço entra em patachoPalm.
      b.block(a.x, a.y, a.z, c.x, c.y, c.z, palmProxy, { cast: false, outline: 0 });
      continue;
    }
    const mat =
      s.kind === 'ground'
        ? materials.sand
        : hutIdx >= 0
          ? HUT_COLORS[hutIdx % HUT_COLORS.length]
          : patachoCoverBase(s, materials);
    b.block(a.x, a.y, a.z, c.x, c.y, c.z, mat, {
      cast: s.kind !== 'ground',
      outline: s.kind === 'ground' ? 0 : 0.05,
    });
  }

  dressPatachoGround(b, art, materials);
  dressPatachoHuts(b, map, art, materials, overhangs);
  dressPatachoCovers(b, art, materials);
  dressPatachoNature(b, map, materials, overhangs);
  const animateCoast = dressPatachoCoast(b, scene, materials);
  art.finish();
  return animateCoast;
}
