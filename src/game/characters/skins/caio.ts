import { PALETTE } from '../../toon';
import { glovePlates, kneePads, sleeveBadge, soles, thighHolster } from './common';
import { animeFace } from './face';
import { tousledHair } from './hair';
import type { SkinDef } from './types';

// Caio Remendo (Resistência) — docs/concept/personagens/resistencia-caio-remendo-folha.png
// Jaqueta lilás curta de manga curta com ombros ciano, camiseta vinho, calça preta com
// joelheiras ciano e duas fitas amarelas na coxa esquerda, tênis lilás de sola amarela,
// luvas sem dedos com placa ciano, bandana amarela, cabelo em três tufos, bateria nas
// costas com cabo até o bracelete do antebraço esquerdo.

const { ink, cyan, yellow, wine, concrete } = PALETTE;

export const CAIO: SkinDef = {
  id: 'caio',
  name: 'Caio Remendo',
  faction: 'resistencia',
  colors: {
    face: PALETTE.skinWarm,
    hair: PALETTE.inkSoft,
    brow: yellow,
    neck: PALETTE.skinWarm,
    chest: concrete,
    chestCenter: wine,
    shoulder: cyan,
    belly: wine,
    waist: ink,
    pelvis: PALETTE.inkSoft,
    sleeve: concrete,
    elbow: PALETTE.skinWarm,
    forearm: PALETTE.skinWarm,
    hand: PALETTE.polymer,
    palm: PALETTE.polymer,
    knuckle: PALETTE.polymer,
    finger: PALETTE.skinWarm,
    thigh: PALETTE.inkSoft,
    knee: PALETTE.inkSoft,
    shin: PALETTE.inkSoft,
    boot: concrete,
    toe: concrete,
    sole: yellow,
  },
  pieces(k) {
    animeFace(k, { skin: PALETTE.skinWarm, iris: PALETTE.tank, irisLight: PALETTE.colonialSky, browTilt: -5, browLift: 0.003, mouth: 'grin' });
    tousledHair(k);
    // Bandana: faixa (região "brow") com volume + duas pontas atrás, à direita
    k.cyl('DEF-head', 0.095, 0.04, [0, 1.725, 0.003], yellow, { segs: 10, scale: [1, 1, 1.22] });
    k.panel('DEF-head', [[-0.013, 0.015], [0.01, 0.02], [0.015, -0.025], [-0.004, -0.04], [-0.014, -0.025]],
      0.008, [-0.054, 1.706, -0.155], yellow, { rot: [25, 35, 0], outline: 0.15 });
    k.panel('DEF-head', [[-0.011, 0.015], [0.01, 0.017], [0.014, -0.028], [0.002, -0.04], [-0.012, -0.027]],
      0.008, [-0.081, 1.72, -0.148], yellow, { rot: [-15, 55, 0], outline: 0.15 });
    // Gola levantada da jaqueta
    for (const s of [1, -1]) {
      k.bevel('DEF-spine003', [0.028, 0.09, 0.12], [s * 0.08, 1.525, -0.02], concrete, { rot: [0, 0, -s * 18], outline: 0.25 });
    }
    k.box('DEF-spine003', [0.17, 0.085, 0.028], [0, 1.525, -0.105], concrete, { rot: [-18, 0, 0] });
    // Placas de ombro ciano; remendo amarelo no ombro direito
    for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
      k.bevel(`DEF-shoulder${side}`, [0.13, 0.05, 0.155], [s * 0.18, 1.5, -0.062], cyan, { rot: [0, 0, -s * 10], outline: 0.3 });
    }
    k.box('DEF-shoulderR', [0.035, 0.055, 0.16], [-0.2, 1.502, -0.062], yellow, { rot: [0, 0, 10], outline: 0.3 });
    // Barra das mangas curtas
    for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
      k.cyl(`DEF-upper_arm${side}`, 0.073, 0.04, [s * 0.38, 1.445, -0.065], concrete, { axis: 'x' });
    }
    // Joelheiras ciano e duas fitas amarelas na coxa esquerda
    kneePads(k, cyan);
    k.box('DEF-thighL', [0.15, 0.035, 0.04], [0.1, 0.8, 0.085], yellow, { rot: [0, 0, 25], outline: 0.4 });
    k.box('DEF-thighL', [0.15, 0.035, 0.04], [0.1, 0.72, 0.088], yellow, { rot: [0, 0, 25], outline: 0.4 });
    // Luvas sem dedos com placa ciano
    glovePlates(k, cyan);
    // Tênis: sola amarela grossa e faixa ciano no peito do pé
    soles(k, yellow, 0.04);
    for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
      k.bevel(`DEF-foot${side}`, [0.13, 0.03, 0.06], [s * 0.1, 0.1, 0.06], cyan, { rot: [35, 0, 0], outline: 0.15 });
    }
    // Bateria nas costas: caixa escura, tela ciano, faixa amarela
    k.bevel('DEF-spine003', [0.2, 0.26, 0.08], [0, 1.33, -0.2], PALETTE.polymer, { outline: 0.35 });
    k.bevel('DEF-spine003', [0.115, 0.19, 0.014], [0, 1.325, -0.242], PALETTE.steel, { outline: 0 });
    k.box('DEF-spine003', [0.065, 0.09, 0.012], [0, 1.32, -0.253], cyan, { glow: 1.4, outline: 0 });
    for (const x of [-0.07, 0.07]) k.box('DEF-spine003', [0.014, 0.16, 0.008], [x, 1.32, -0.244], ink, { outline: 0 });
    k.box('DEF-spine003', [0.05, 0.07, 0.086], [0, 1.44, -0.2], yellow, { outline: 0.3 });
    // Cabo grosso da bateria até o bracelete esquerdo (dobra com braço e tronco)
    k.cable(
      [
        { at: [0.09, 1.27, -0.22], bone: 'DEF-spine003' },
        { at: [0.17, 1.25, -0.18], bone: 'DEF-spine003' },
        { at: [0.24, 1.3, -0.13], bone: 'DEF-spine003', bone2: 'DEF-upper_armL', mix: 0.5 },
        { at: [0.33, 1.365, -0.1], bone: 'DEF-upper_armL' },
        { at: [0.46, 1.37, -0.09], bone: 'DEF-upper_armL', bone2: 'DEF-forearmL', mix: 0.5 },
        { at: [0.57, 1.38, -0.08], bone: 'DEF-forearmL' },
      ],
      0.01,
      PALETTE.polymer,
    );
    // Bracelete hacker no antebraço esquerdo: cilindro lilás, tela ciano, trava amarela
    k.cyl('DEF-forearmL', 0.066, 0.12, [0.62, 1.43, -0.07], concrete, { axis: 'x' });
    k.bevel('DEF-forearmL', [0.098, 0.016, 0.065], [0.62, 1.493, -0.07], PALETTE.polymer, { outline: 0.1 });
    k.box('DEF-forearmL', [0.071, 0.006, 0.041], [0.62, 1.503, -0.07], cyan, { glow: 1.4, outline: 0 });
    k.box('DEF-forearmL', [0.03, 0.04, 0.02], [0.66, 1.43, 0.0], yellow, { outline: 0.3 });
    // Identidade: emblema da facção e equipamento de cintura/coxa
    sleeveBadge(k, 'resistencia');
    thighHolster(k, yellow);
  },
};
