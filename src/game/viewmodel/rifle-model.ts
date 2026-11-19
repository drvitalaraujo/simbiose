import { PALETTE as C } from '../toon';
import type { PartList } from './parts';
import { band, barrel, glass, rail, screw, tape, vents } from './details';
import { GRIP } from './hands';
import type { WeaponLayout } from './model';

/**
 * Gambiarra MK-2: fuzil remendado da Resistência. Receptor de aço com chapas teal
 * aparafusadas, guarda-mão de polímero com fitas, holográfica vazada com vidro ciano,
 * freio de boca com portas, fios ligando a célula do carregador ao guarda-mão.
 * O jogador vê o lado ESQUERDO e o topo: é lá que mora o detalhe.
 */
export function rifleBody(p: PartList): WeaponLayout {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: number = C.polymer, bevel = 0.25) =>
    p.box(w, h, d, { at: [x, y, z], color, bone: 0, bevel });
  // Receptor superior (aço) e inferior (polímero) com o encaixe do carregador
  p.profile([[-17, 1], [-17, 7], [-14.5, 8.7], [6, 8.7], [8, 6.2], [7, 0], [-12, 0]], 6.4, { color: C.steel, bone: 0, bevel: 0.45 });
  box(5.7, 2.2, 22, 0, -0.1, -4);
  p.profile([[-13.2, 0.6], [-12.6, -2.4], [-3.8, -2.4], [-3.4, 0.6]], 5.6, { color: C.polymer, bone: 0, bevel: 0.35 });
  // Chapas teal aparafusadas nas duas laterais
  for (const s of [-1, 1]) {
    p.profile([[-14, 3], [-14, 6.8], [-12, 7.8], [3, 7.8], [5, 6], [4, 3]], 0.25, { at: [s * 3.35, 0, 0], color: C.clothTeal, bone: 0, bevel: 0.08 });
    for (const [y, z] of [[3.8, -13], [7, -11.5], [3.8, 3], [6.4, 4]]) screw(p, s * 3.48, y, z, 0.36);
    box(0.16, 0.25, 12, s * 3.5, 7.4, -5, C.steelLight, 0.05);
  }
  // Guarda-mão de polímero com respiros, fitas amarelas e trilho no topo
  p.profile([[-37, 2.4], [-36, 6.4], [-33.5, 7.6], [-16, 7.6], [-16, 1.4], [-32, 1.4]], 5.6, { color: C.polymer, bone: 0, bevel: 0.32 });
  vents(p, 2.86, 5.1, [-21.5, -25, -28.5, -32], 1.3, 2.4);
  tape(p, -34.4, 1.6, 7.4, 2.8, C.yellow, 1.2);
  tape(p, -17.8, 1.4, 7.6, 2.8, C.yellow, 1);
  rail(p, -35, -16.5, 8.3, 2.2);
  rail(p, -14, 5.5, 9.4, 2.6);
  // Cano, bloco de gás e freio de boca com portas laterais
  barrel(p, 5.3, -37, -46, 1.1);
  band(p, 5.3, -38.2, 1.7, 1.6, C.steelLight);
  p.box(1.4, 3, 1.4, { at: [0, 7.6, -38.2], color: C.steel, bone: 0, bevel: 0.2 });
  barrel(p, 5.3, -45.5, -51, 1.85, C.steel, 0, 8);
  for (const z of [-47, -48.6]) for (const s of [-1, 1]) box(0.3, 1, 1, s * 1.75, 5.3, z, C.ink, 0.08);
  band(p, 5.3, -50.9, 1.95, 0.25, C.steelLight, 0, false, 8);
  band(p, 5.3, -51.05, 0.85, 0.1, C.ink, 0, false, 8);
  // Holográfica: base, moldura vazada, vidro com reflexo e LED; centro óptico em y = 12
  box(5.4, 0.8, 7, 0, 9.9, -3, C.steel, 0.2);
  for (const x of [-2.5, 2.5]) box(0.6, 4.8, 6.4, x, 12.1, -3.2, C.polymer, 0.22);
  box(5.6, 0.7, 6.6, 0, 14.6, -3.2, C.polymer, 0.22);
  box(4.4, 0.5, 0.5, 0, 10.4, -6.2, C.polymer, 0.12);
  box(0.6, 0.6, 3.4, 2.95, 13.2, -2, C.yellow, 0.12); // botões de brilho
  p.cyl(0.9, 0.9, 1.1, 8, { at: [3.35, 11.1, -3.5], rot: [0, 0, Math.PI / 2], color: C.steelLight, bone: 0 });
  glass(p, [0, 12.4, -6], 4.4, 3.8);
  p.box(1.2, 0.35, 0.5, { at: [0, 10.55, -0.4], color: C.cyan, bone: 0, glow: true });
  // Alavanca de manejo (osso do ferrolho) e trava amarela no lado esquerdo
  p.box(1, 1.4, 3.4, { at: [-3.95, 6.6, 2.2], color: C.yellow, bone: 1, bevel: 0.2 });
  p.box(1.4, 1, 1, { at: [-4.6, 6.6, 3.4], color: C.polymer, bone: 1, bevel: 0.25 });
  box(0.4, 0.8, 1.6, -3.55, 2.6, 3, C.yellow, 0.1);
  // Empunhadura com fita, gatilho e guarda-mato
  p.profile(GRIP, 4, { color: C.polymer, bone: 0, bevel: 0.45 });
  for (const y of [-3.2, -5.3, -7.4]) box(4.15, 0.22, 0.5, 0, y, 2.6 - y * 0.24, C.ink, 0.06);
  box(1.1, 0.7, 6, 0, -2.9, -0.6);
  box(1.1, 2.6, 0.7, 0, -1.6, -3.4);
  box(0.6, 2, 0.7, 0, -1.2, 0, C.steelLight, 0.15);
  // Tubo da coronha, coronha vazada, apoio de bochecha teal e soleira de borracha
  barrel(p, 5, 7, 12, 1.55, C.steel);
  p.profile([[11, 6.8], [24, 6.8], [26.4, 3], [26.4, -3.4], [21.6, -3.4], [18, 2], [11, 2]], 4.8,
    { color: C.polymer, bone: 0, bevel: 0.35, holes: [[[14, 3.2], [18.4, 3.2], [21.8, 5.3], [14, 5.3]]] });
  box(5, 1.6, 8.4, 0, 7.1, 17.6, C.clothTeal, 0.3);
  for (const z of [15, 20]) screw(p, -2.5, 7.1, z, 0.3);
  box(5.2, 10.6, 1.4, 0, 1.7, 26.9, C.ink, 0.35);
  for (const y of [-2, 0.5, 3, 5.5]) box(5.3, 0.2, 0.2, 0, y, 27.62, C.inkSoft, 0.04);
  // Carregador curvo (osso 2) com nervuras, base de aço e janela da célula de energia
  p.profile([[-12, -1], [-5, -1], [-5, -7], [-2, -15], [-8, -16], [-12, -8]], 4.5, { color: C.polymer, bone: 2, bevel: 0.3 });
  for (const y of [-5, -8, -11]) p.box(0.3, 0.45, 4.8, { at: [-2.4, y, -8 + y * 0.2], color: C.steel, bone: 2, bevel: 0.08 });
  p.box(4.9, 1.1, 6.2, { at: [0, -15.2, -5.1], rot: [-0.16, 0, 0], color: C.steel, bone: 2, bevel: 0.25 });
  p.box(0.14, 4.6, 1.2, { at: [-2.33, -6.5, -9.6], rot: [0.2, 0, 0], color: C.cyan, bone: 2, glow: true });
  // Fios da gambiarra: célula → guarda-mão (um aceso) e marcador ciano no receptor
  p.tube([[-2.6, -1.5, -11.5], [-3.4, 1, -14], [-3.3, 3, -17.5], [-2.95, 3.4, -21]], 0.24, { color: C.pink, bone: 0, glow: true });
  p.tube([[-2.5, -1.6, -10.8], [-3.6, 0.5, -13.6], [-3.6, 2.4, -16.6], [-2.95, 2.4, -20]], 0.28, { color: C.yellow, bone: 0 });
  p.box(0.14, 0.7, 2.4, { at: [-3.56, 6.7, -3], color: C.cyan, bone: 0, glow: true });
  // Janela de ejeção (lado direito) com lâmina do ferrolho
  box(0.1, 1.8, 6, 3.32, 6, -3, C.ink, 0.06);
  box(0.13, 0.5, 4.7, 3.4, 6.3, -3, C.steelLight, 0.06);

  return {
    handguard: { z: -26, bottom: 1.4, top: 7.6, half: 2.8 },
    muzzle: [0, 5.3, -51.2],
    sight: [0, 12, -3],
    ejectPort: [4.2, 6, -3],
    bolt: [-4.2, 6.6, 2.6],
    mag: [0, -0.5, -8.2],
    boltTravel: 1.8,
    boltLift: 0,
    aimDistance: 0.36,
  };
}
