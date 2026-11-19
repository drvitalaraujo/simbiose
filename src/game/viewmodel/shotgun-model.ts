import * as THREE from 'three';
import { PALETTE as C } from '../toon';
import type { PartList } from './parts';
import { band, barrel, screw } from './details';
import { GRIP } from './hands';
import type { WeaponLayout } from './model';

/**
 * Quebra-Beco: escopeta de bombeamento pesada. Receptor alto de aço com chapas ocre,
 * escudo térmico vazado sobre o cano, depósito tubular, telha de terracota com frisos
 * (osso 4: corre no bombeamento), porta-cartuchos no lado esquerdo, alça fantasma e conta
 * luminosa, boca de arrombamento dentada. A silhueta mais grossa do arsenal.
 */
export function shotgunBody(p: PartList): WeaponLayout {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: number = C.polymer, bevel = 0.3) =>
    p.box(w, h, d, { at: [x, y, z], color, bone: 0, bevel });
  // Receptor alto com chapas ocre aparafusadas
  p.profile([[-14, 0], [-14, 7.4], [-12, 8.4], [7, 8.4], [9, 6.2], [8, 0]], 6.6, { color: C.steel, bone: 0, bevel: 0.45 });
  for (const s of [-1, 1]) {
    p.profile([[-12.5, 1.2], [-12.5, 6.8], [-11, 7.6], [5, 7.6], [6.5, 5.6], [6, 1.2]], 0.22, { at: [s * 3.4, 0, 0], color: C.ochre, bone: 0, bevel: 0.08 });
    for (const [y, z] of [[2, -11.5], [6.8, -10], [2, 5], [6.6, 4]]) screw(p, s * 3.52, y, z, 0.36);
  }
  // Porta-cartuchos na esquerda: quatro cartuchos vinho com base de latão
  box(0.5, 4.4, 15, -3.75, 3.8, -3.5, C.polymer, 0.15);
  for (const z of [-9, -5.4, -1.8, 1.8]) {
    p.cyl(1.05, 1.05, 3.8, 8, { at: [-4.75, 3.6, z], color: C.wine, bone: 0 });
    p.cyl(1.12, 1.12, 0.8, 8, { at: [-4.75, 5.8, z], color: C.ochre, bone: 0 });
    box(0.3, 0.6, 1.5, -5.85, 3, z, C.polymer, 0.08);
  }
  // Cano grosso e escudo térmico vazado (os furos mostram o cano)
  barrel(p, 5.3, -14, -47, 1.9, C.steel, 0, 10);
  p.profile([[-42, 5], [-42, 7.8], [-41, 8.8], [-17, 8.8], [-16, 7.8], [-16, 5]], 4.6,
    { color: C.polymer, bone: 0, bevel: 0.3, holes: [-38.5, -34, -29.5, -25, -20.5].map(z => [[z, 6.4], [z + 2.6, 6.4], [z + 2.6, 7.7], [z, 7.7]] as [number, number][]) });
  // Boca de arrombamento: anel ocre e dentes
  barrel(p, 5.3, -46.5, -50.5, 2.35, C.steel, 0, 8);
  band(p, 5.3, -47.3, 2.5, 1.1, C.ochre, 0, false, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    p.box(1.1, 1.1, 1.4, { at: [Math.cos(a) * 1.75, 5.3 + Math.sin(a) * 1.75, -51], rot: [0, 0, a], color: C.steel, bone: 0, bevel: 0.15 });
  }
  band(p, 5.3, -50.55, 1.4, 0.12, C.ink, 0, false, 8);
  // Depósito tubular e presilha do cano
  barrel(p, 1, -14, -44, 1.5, C.steel, 0, 10);
  band(p, 1, -44.2, 1.65, 0.8, C.ochre, 0, false, 10);
  box(3.2, 6.2, 1.6, 0, 3.2, -42.6, C.steel, 0.25);
  // Telha de terracota (osso 4) com frisos e anéis de aço
  p.profile([[-29, -1.2], [-29, 2.6], [-27.5, 3.6], [-16.5, 3.6], [-15, 2.6], [-15, -1.2]], 7, { color: C.terracotta, bone: 4, bevel: 0.5, edge: C.sand });
  for (const z of [-26.5, -24.5, -22.5, -20.5, -18.5]) {
    p.box(7.25, 0.35, 0.6, { at: [0, 3.55, z], color: C.bark, bone: 4, bevel: 0.08, wear: 0 });
    for (const s of [-1, 1]) p.box(0.3, 3.4, 0.6, { at: [s * 3.55, 1.2, z], color: C.bark, bone: 4, bevel: 0.08, wear: 0 });
  }
  for (const z of [-29.3, -14.7]) p.box(7.4, 5.2, 0.6, { at: [0, 1.2, z], color: C.steel, bone: 4, bevel: 0.15 });
  for (const s of [-1, 1]) p.box(0.3, 0.6, 14, { at: [s * 1.6, 1.4, -8], color: C.steelLight, bone: 4, bevel: 0.06 }); // barras de ação
  // Mira: alça fantasma (anel) atrás e conta luminosa na frente; linha de visada em y = 9
  for (const x of [-1.9, 1.9]) box(0.7, 2.6, 1.6, x, 9.4, 3, C.steel, 0.2);
  p.add(new THREE.TorusGeometry(1.25, 0.32, 4, 12), { at: [0, 9, 3], color: C.steel, bone: 0 });
  box(1.6, 1.3, 2.2, 0, 8.6, 3, C.steel, 0.2);
  box(0.6, 1.4, 1.4, 0, 8, -44, C.steel, 0.12);
  p.add(new THREE.SphereGeometry(0.42, 8, 6), { at: [0, 9, -44], color: C.yellow, bone: 0, glow: true });
  // Empunhadura, gatilho, guarda-mato
  p.profile(GRIP, 4, { color: C.polymer, bone: 0, bevel: 0.45 });
  for (const y of [-3.2, -5.3, -7.4]) box(4.15, 0.22, 0.5, 0, y, 2.6 - y * 0.24, C.ochre, 0.06);
  box(1.1, 0.7, 5.6, 0, -2.6, -0.4);
  box(1.1, 2.4, 0.6, 0, -1.4, -3);
  box(0.6, 2, 0.7, 0, -1.2, 0, C.steelLight, 0.15);
  // Coronha cheia com faixa ocre e soleira grossa
  p.profile([[8, 6.8], [24.5, 6], [26.5, 3], [26.5, -3.8], [21.5, -3.8], [16, 0.6], [8, 1.2]], 5, { color: C.polymer, bone: 0, bevel: 0.45 });
  box(5.1, 1.4, 8, 0, 5.6, 17, C.ochre, 0.3);
  box(5.4, 11, 1.8, 0, 1.2, 27.4, C.ink, 0.45);
  p.box(0.25, 0.7, 4, { at: [-3.42, 6.8, 4], color: C.yellow, bone: 0, glow: true });

  return {
    handguard: { z: -22, bottom: -1.2, top: 3.6, half: 3.5 },
    muzzle: [0, 5.3, -51.6],
    sight: [0, 9, 3],
    ejectPort: [4.2, 5, -6],
    bolt: [0, 5, -6],
    mag: [0, -0.5, -8.2],
    boltTravel: 0,
    boltLift: 0,
    aimDistance: 0.36,
  };
}
