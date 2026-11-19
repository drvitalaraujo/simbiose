import * as THREE from 'three';
import { PALETTE as C } from '../toon';
import type { PartList } from './parts';
import { band, barrel, rail, screw, vents } from './details';
import { GRIP } from './hands';
import type { WeaponLayout } from './model';

const Z_AXIS: [number, number, number] = [Math.PI / 2, 0, 0];

/**
 * Linha Morta: sniper de chassi cor de cal, cano longo canelado, freio de boca com portas,
 * luneta comprida com lente frontal acesa, ferrolho manual do lado ESQUERDO (o jogador vê a
 * alavanca subir e recuar a cada tiro), bipé dobrado e coronha esqueletada.
 */
export function sniperBody(p: PartList): WeaponLayout {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: number = C.cal, bevel = 0.3) =>
    p.box(w, h, d, { at: [x, y, z], color, bone: 0, bevel });
  // Ação de aço e chassi cor de cal com guarda-mão vazado
  p.profile([[-13, 2], [-13, 7], [-11, 8], [7, 8], [9, 6], [8, 2]], 5.8, { color: C.steel, bone: 0, bevel: 0.45 });
  p.profile([[-12.5, -0.4], [-12.5, 2.4], [9, 2.4], [8, -0.4]], 6.2, { color: C.cal, bone: 0, bevel: 0.35 });
  p.profile([[-34, 1.2], [-34, 5.2], [-31, 6.6], [-12, 6.6], [-12, 0.6], [-28, 0.6]], 6,
    { color: C.cal, bone: 0, bevel: 0.45, holes: [[[-31, 2.4], [-26.5, 2.4], [-26.5, 4.8], [-30, 4.8]], [[-24.5, 2.4], [-19.5, 2.4], [-19.5, 4.8], [-24.5, 4.8]]] });
  vents(p, 3.05, 1.6, [-16, -29], 0.5, 2.6);
  for (const s of [-1, 1]) {
    box(0.2, 1.2, 14, s * 3.15, 5.5, -21, C.clothTeal, 0.08);
    for (const z of [-15, -27]) screw(p, s * 3.05, 3.5, z, 0.32);
  }
  screw(p, -2.95, 3.4, -7, 0.36);
  screw(p, -2.95, 3.4, 4, 0.36);
  // Cano canelado, freio de boca com três portas por lado
  barrel(p, 5.3, -34, -58, 1.4, C.steel, 0, 10);
  for (const [x, y] of [[0, 1.36], [-1.36, 0], [1.36, 0]]) box(x ? 0.12 : 0.5, x ? 0.5 : 0.12, 18, x, 5.3 + y, -47, C.ink, 0.04);
  band(p, 5.3, -34.4, 1.85, 1, C.steelLight);
  p.profile([[-64.5, 3.6], [-64.5, 7], [-58, 7], [-58, 3.6]], 3.6, { color: C.steel, bone: 0, bevel: 0.4 });
  for (const z of [-59.6, -61.4, -63.2]) for (const s of [-1, 1]) box(0.3, 2.2, 1, s * 1.72, 5.3, z, C.ink, 0.06);
  // Luneta: corpo, sino da objetiva, ocular, torres e lente frontal acesa (centro y = 15)
  rail(p, -12, 6.6, 8.6, 2.6);
  barrel(p, 15, -14, 8, 1.75, C.polymer, 0, 12);
  p.cyl(2.7, 1.8, 3.4, 12, { at: [0, 15, -16.2], rot: [-Math.PI / 2, 0, 0], color: C.polymer, bone: 0 });
  barrel(p, 15, -21.4, -17.9, 2.7, C.polymer, 0, 12);
  band(p, 15, -21.5, 2.82, 0.5, C.cal, 0, false, 12);
  p.cyl(2.35, 2.35, 0.1, 14, { at: [0, 15, -21.7], rot: Z_AXIS, color: C.cyan, bone: 0, lens: true });
  band(p, 15, -21.62, 2.42, 0.18, C.cyan, 0, true, 14);
  p.cyl(1.8, 2.35, 3.6, 12, { at: [0, 15, 10], rot: [-Math.PI / 2, 0, 0], color: C.polymer, bone: 0 });
  band(p, 15, 11.6, 2.45, 0.8, C.ink, 0, false, 12);
  p.cyl(1.95, 1.95, 0.1, 14, { at: [0, 15, 12.05], rot: Z_AXIS, color: C.cyan, bone: 0, lens: true });
  for (const z of [-8, 2.5]) {
    band(p, 15, z, 2.05, 1.3, C.steel);
    box(1.5, 4.6, 1.3, 0, 11.4, z, C.steel, 0.2);
    box(2.7, 0.9, 1.6, 0, 9.3, z, C.steel, 0.2);
  }
  p.cyl(1.25, 1.25, 2.2, 10, { at: [0, 17.6, -2.8], color: C.steel, bone: 0 });
  p.cyl(1.35, 1.35, 0.5, 10, { at: [0, 18.6, -2.8], color: C.cal, bone: 0 });
  p.cyl(1.15, 1.15, 2, 10, { at: [-2.4, 15, -2.8], rot: [0, 0, Math.PI / 2], color: C.steel, bone: 0 });
  p.cyl(1.25, 1.25, 0.45, 10, { at: [-3.45, 15, -2.8], rot: [0, 0, Math.PI / 2], color: C.clothTeal, bone: 0 });
  p.cyl(1, 1, 1.6, 10, { at: [2.1, 15, -2.8], rot: [0, 0, Math.PI / 2], color: C.steel, bone: 0 });
  // Ferrolho manual (osso 1): alavanca com bola teal saindo pela esquerda
  p.span([-1.2, 5.6, 5.6], [-4.5, 3.4, 6.4], 0.45, 0.4, 7, { color: C.steelLight, bone: 1 });
  p.span([0, 5.6, 2.8], [0, 5.6, 8.6], 0.95, 0.95, 8, { color: C.steelLight, bone: 1 });
  p.cyl(1, 1, 1.4, 8, { at: [-5, 3.1, 6.4], rot: [0, 0, Math.PI / 2], color: C.clothTeal, bone: 1 });
  box(0.12, 1.4, 6, -2.95, 6, 1.5, C.ink, 0.04); // janela do ferrolho
  // Bipé dobrado sob o guarda-mão
  for (const s of [-1, 1]) {
    p.span([s * 1.6, 0.2, -31.5], [s * 1.4, 0.1, -19], 0.42, 0.42, 6, { color: C.steel, bone: 0 });
    p.add(new THREE.SphereGeometry(0.6, 6, 4), { at: [s * 1.4, 0.1, -18.6], color: C.ink, bone: 0 });
  }
  box(3.6, 1, 2, 0, 0.3, -32.4, C.steel, 0.2);
  // Empunhadura, gatilho e guarda-mato
  p.profile(GRIP, 4, { color: C.polymer, bone: 0, bevel: 0.45 });
  box(1.1, 0.7, 5.6, 0, -2.6, -0.4, C.polymer);
  box(1.1, 2.4, 0.6, 0, -1.4, -3, C.polymer);
  box(0.6, 2, 0.7, 0, -1.2, 0, C.steelLight, 0.15);
  // Coronha esqueletada cor de cal, apoio de bochecha teal ajustável e soleira
  p.profile([[8, 6.4], [26.5, 6.4], [28.5, 3], [28.5, -4.4], [23, -4.4], [19, 0.4], [11, 0.4], [8, 2]], 4.6,
    { color: C.cal, bone: 0, bevel: 0.4, holes: [[[12, 1.8], [19.6, 1.8], [23.4, -2.6], [26.6, -2.6], [26.6, 4.8], [12, 4.8]]] });
  box(4.4, 1.6, 11, 0, 7.7, 19.5, C.clothTeal, 0.35);
  for (const z of [16, 23]) p.cyl(0.35, 0.35, 1.4, 6, { at: [0, 6.7, z], color: C.steelLight, bone: 0 });
  p.cyl(0.8, 0.8, 0.8, 8, { at: [-2.7, 7.4, 19.5], rot: [0, 0, Math.PI / 2], color: C.yellow, bone: 0 });
  box(5, 12, 1.5, 0, 1, 29.2, C.ink, 0.4);
  // Carregador curto (osso 2) com janela da célula
  box(5.4, 2.6, 8, 0, 1, -8.2, C.cal);
  p.box(4.6, 6, 7, { at: [0, -3, -8.2], color: C.polymer, bone: 2, bevel: 0.25 });
  for (const y of [-2, -4]) p.box(0.12, 0.14, 6.2, { at: [-2.36, y, -8.2], color: C.steel, bone: 2, bevel: 0.03 });
  p.box(4.8, 0.8, 7.2, { at: [0, -5.8, -8.2], color: C.steel, bone: 2, bevel: 0.15 });
  p.box(0.12, 0.6, 4, { at: [-2.34, -3, -8.2], color: C.cyan, bone: 2, glow: true });

  return {
    handguard: { z: -23, bottom: 0.6, top: 6.6, half: 3 },
    muzzle: [0, 5.3, -64.8],
    sight: [0, 15, 5.2],
    ejectPort: [-3.4, 6, 1.5],
    bolt: [0, 5.6, 5.6],
    mag: [0, -0.5, -8.2],
    boltTravel: 5,
    boltLift: -1.05,
    aimDistance: 0.34,
  };
}
