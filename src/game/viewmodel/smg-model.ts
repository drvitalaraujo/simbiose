import { PALETTE as C } from '../toon';
import type { PartList } from './parts';
import { band, barrel, glass, rail, screw } from './details';
import { GRIP } from './hands';
import type { WeaponLayout } from './model';

/** Furo sextavado (perfil [z, y]) para recortar chapas. */
function hex(z: number, y: number, r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    return [z + Math.cos(a) * r, y + Math.sin(a) * r] as [number, number];
  });
}

/**
 * Faísca: SMG compacta de polímero com painéis vinho, protetor de cano vazado (o cano e as
 * bobinas aparecem pelos furos), três bobinas rosa acesas, coronha de arame dobrável e
 * carregador longo e reto. Silhueta curta e quadrada, oposta à sniper.
 */
export function smgBody(p: PartList): WeaponLayout {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: number = C.polymer, bevel = 0.3) =>
    p.box(w, h, d, { at: [x, y, z], color, bone: 0, bevel });
  // Receptor angular de polímero, painéis vinho e raio amarelo na lateral
  p.profile([[-13, 2.2], [-13, 6.8], [-10.5, 8.4], [6, 8.4], [8, 6.4], [8, 2.2]], 6.6, { color: C.polymer, bone: 0, bevel: 0.45 });
  p.profile([[-12.5, 0.4], [-12.5, 2.4], [8, 2.4], [7.5, 0.4]], 6, { color: C.steel, bone: 0, bevel: 0.3 });
  for (const s of [-1, 1]) {
    p.profile([[-11, 3], [-11, 6.6], [-9, 7.6], [4.5, 7.6], [5.6, 5.8], [4, 3]], 0.22, { at: [s * 3.4, 0, 0], color: C.wine, bone: 0, bevel: 0.08 });
    for (const [y, z] of [[3.6, -10], [3.6, 3.2], [7, -8]]) screw(p, s * 3.52, y, z, 0.32);
  }
  for (const [y, z, r] of [[6.6, -6.5, 0.5], [5.4, -4.6, -0.6], [4.2, -2.7, 0.5]] as const) {
    p.box(0.12, 0.45, 2.6, { at: [-3.58, y, z], rot: [r, 0, 0], color: C.yellow, bone: 0, bevel: 0.04 });
  }
  // Protetor de cano vazado (furos sextavados atravessam a chapa)
  p.profile([[-24, 1.8], [-24, 6.6], [-22, 7.6], [-12.5, 7.6], [-12.5, 1.2], [-20, 1.2]], 7,
    { color: C.wine, bone: 0, bevel: 0.4, holes: [hex(-21.2, 4.6, 1.1), hex(-18, 4.6, 1.1), hex(-14.8, 4.6, 1.1)] });
  barrel(p, 5.3, -12, -27, 1.1);
  for (const z of [-21.2, -18, -14.8]) band(p, 5.3, z, 1.75, 0.7, C.pink, 0, true, 8);
  // Compensador com fendas no topo e bobinas acesas na boca
  barrel(p, 5.3, -27, -32.2, 1.75, C.steel, 0, 8);
  for (const z of [-28.4, -30, -31.5]) box(1.6, 0.4, 0.55, 0, 7.05, z, C.ink, 0.06);
  band(p, 5.3, -25.5, 2.05, 0.5, C.pink, 0, true, 10);
  band(p, 5.3, -32.15, 1.1, 0.12, C.ink, 0, false, 8);
  // Trilho e mira reflex compacta com vidro rosa; centro óptico em y = 11
  rail(p, -22.5, 5, 8.9, 2.4);
  box(4.2, 0.8, 5.6, 0, 9.4, -4, C.steel, 0.2);
  for (const x of [-1.95, 1.95]) box(0.5, 3.8, 1.4, x, 11.1, -5.9, C.polymer, 0.18);
  box(4.4, 0.6, 1.6, 0, 13.2, -5.9, C.polymer, 0.18);
  box(0.9, 0.6, 1.2, 1.4, 10.1, -2.4, C.wine, 0.15);
  glass(p, [0, 11.3, -5.9], 3.5, 3.4, C.pink);
  // Manejo à esquerda (osso do ferrolho)
  p.box(1.1, 1.1, 2.2, { at: [-3.9, 6.4, -9], color: C.yellow, bone: 1, bevel: 0.2 });
  p.cyl(0.6, 0.6, 1.4, 8, { at: [-4.8, 6.4, -9], rot: [0, 0, Math.PI / 2], color: C.polymer, bone: 1 });
  // Empunhadura, gatilho, guarda-mato
  p.profile(GRIP, 4, { color: C.polymer, bone: 0, bevel: 0.45 });
  box(4.15, 2.6, 0.4, 0, -6, 4.5 + 1.5, C.wine, 0.08);
  box(1.1, 0.7, 5.6, 0, -2.6, -0.4);
  box(1.1, 2.4, 0.6, 0, -1.4, -3);
  box(0.6, 2, 0.7, 0, -1.2, 0, C.steelLight, 0.15);
  // Coronha de arame dobrável: dois tubos e soleira
  for (const y of [6.2, 1.4]) barrel(p, y, 8, 20.6, 0.55, C.steel, 0, 6);
  p.cyl(0.55, 0.55, 5, 6, { at: [0, 3.8, 20.6], color: C.steel, bone: 0 });
  box(4.4, 7.4, 1.2, 0, 3.8, 21.4, C.ink, 0.35);
  box(3, 1.6, 2.4, 0, 4, 8.6, C.steel, 0.25);
  // Carregador reto (osso 2) com nervuras, base e janela ciano da célula
  box(4.4, 2.6, 5, 0, 0.9, -7.8);
  p.box(3.4, 14, 4, { at: [0, -6.4, -7.4], rot: [0.08, 0, 0], color: C.polymer, bone: 2, bevel: 0.25 });
  for (const y of [-4, -7, -10]) p.box(0.12, 0.16, 3.2, { at: [-1.76, y, -7.4 + y * 0.08], color: C.steel, bone: 2, bevel: 0.03 });
  p.box(3.8, 0.9, 4.4, { at: [0, -13.5, -6.85], rot: [0.08, 0, 0], color: C.steel, bone: 2, bevel: 0.2 });
  p.box(0.12, 3.6, 0.9, { at: [-1.73, -7.6, -8.6], rot: [0.08, 0, 0], color: C.cyan, bone: 2, glow: true });
  p.box(0.12, 0.5, 1.8, { at: [-3.5, 6, -3], color: C.cyan, bone: 0, glow: true });

  return {
    handguard: { z: -18.4, bottom: 1.2, top: 7.6, half: 3.5 },
    muzzle: [0, 5.3, -32.4],
    sight: [0, 11.3, -4],
    ejectPort: [4.2, 6, -3],
    bolt: [-4.2, 6.4, -9],
    mag: [0, -0.5, -7.8],
    boltTravel: 1.4,
    boltLift: 0,
    aimDistance: 0.33,
  };
}
