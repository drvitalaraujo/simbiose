import { PALETTE } from '../../toon';
import { beltPouches, bootCuffs, glovePlates, sleeveBadge, soles } from './common';
import { animeFace } from './face';
import { bobHair } from './hair';
import type { SkinDef } from './types';

// Lia Estalo (Resistência) — docs/concept/personagens/resistencia-lia-estalo-folha.png
// Jaqueta ciano curta com faixas amarelas na manga esquerda, camiseta preta, calça cargo
// vinho, botas lilás com bico amarelo, luvas pretas com nós amarelos, chanel preto com
// presilha ciano, alça amarela em diagonal, rádio no quadril direito e placa lilás nas costas.

const { ink, cyan, yellow, wine, concrete, pantsWine } = PALETTE;

export const LIA: SkinDef = {
  id: 'lia',
  name: 'Lia Estalo',
  faction: 'resistencia',
  colors: {
    face: PALETTE.skinDeep,
    hair: PALETTE.inkSoft,
    brow: PALETTE.skinDeep,
    neck: PALETTE.skinDeep,
    chest: PALETTE.clothTeal,
    chestCenter: ink,
    shoulder: cyan,
    belly: ink,
    waist: ink,
    pelvis: pantsWine,
    sleeve: PALETTE.clothTeal,
    elbow: PALETTE.clothTeal,
    forearm: PALETTE.skinDeep,
    hand: PALETTE.polymer,
    palm: PALETTE.polymer,
    knuckle: yellow,
    finger: PALETTE.polymer,
    thigh: pantsWine,
    knee: pantsWine,
    shin: pantsWine,
    boot: concrete,
    toe: yellow,
    sole: ink,
  },
  pieces(k) {
    animeFace(k, { skin: PALETTE.skinDeep, iris: PALETTE.bark, irisLight: PALETTE.ochre, browTilt: 7, mouth: 'smirk' });
    bobHair(k);
    // Gola alta em duas cunhas + nuca
    for (const s of [1, -1]) {
      k.bevel('DEF-spine003', [0.025, 0.105, 0.125], [s * 0.078, 1.535, -0.02], PALETTE.clothTeal, { rot: [0, 0, -s * 14], outline: 0.25 });
      k.panel('DEF-spine003', [[-0.014, 0.045], [0.02, 0.053], [0.027, -0.036], [-0.014, -0.049]], 0.015,
        [s * 0.071, 1.534, 0.041], cyan, { rot: [0, 0, -s * 14], outline: 0.12 });
    }
    k.box('DEF-spine003', [0.17, 0.1, 0.03], [0, 1.535, -0.1], cyan, { rot: [-14, 0, 0] });
    // Ombreiras retangulares lilás
    for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
      k.bevel(`DEF-shoulder${side}`, [0.13, 0.04, 0.15], [s * 0.175, 1.505, -0.062], concrete, { rot: [0, 0, -s * 8], outline: 0.3 });
    }
    // Três fitas amarelas na manga esquerda
    for (const [x, r] of [[0.22, 0.077], [0.27, 0.074], [0.32, 0.071]] as const) {
      k.cyl('DEF-upper_armL', r, 0.028, [x, 1.445, -0.065], yellow, { axis: 'x', outline: 0.4 });
    }
    // Alça diagonal: ombro esquerdo → quadril direito, na frente e nas costas
    for (const back of [false, true]) k.ribbon([
      { at: [-0.105, 1.06, back ? -0.079 : 0.08], bone: 'DEF-hips' },
      { at: [-0.065, 1.19, back ? -0.089 : 0.116], bone: 'DEF-spine001', bone2: 'DEF-spine002', mix: 0.4 },
      { at: [0.005, 1.33, back ? -0.155 : 0.133], bone: 'DEF-spine002', bone2: 'DEF-spine003', mix: 0.5 },
      { at: [0.106, 1.485, back ? -0.137 : 0.055], bone: 'DEF-spine003' },
    ], 0.033, yellow);
    // Rádio no quadril direito: caixa preta, tela ciano, cantos amarelos, antena
    const radio = { rot: [0, -30, 0] as const };
    k.bevel('DEF-hips', [0.09, 0.17, 0.065], [-0.16, 0.97, 0.05], PALETTE.polymer, radio);
    k.box('DEF-hips', [0.094, 0.025, 0.07], [-0.16, 1.055, 0.05], yellow, { ...radio, outline: 0.3 });
    k.box('DEF-hips', [0.094, 0.025, 0.07], [-0.16, 0.885, 0.05], yellow, { ...radio, outline: 0.3 });
    k.bevel('DEF-hips', [0.063, 0.09, 0.013], [-0.144, 0.97, 0.081], PALETTE.steel, { ...radio, outline: 0 });
    k.box('DEF-hips', [0.045, 0.055, 0.007], [-0.14, 0.98, 0.09], cyan, { ...radio, glow: 1.4, outline: 0 });
    k.box('DEF-hips', [0.016, 0.1, 0.016], [-0.18, 1.11, 0.04], ink, { outline: 0.4 });
    // Placa dorsal lilás sob a gola (a "mochila")
    k.bevel('DEF-spine003', [0.18, 0.22, 0.06], [0, 1.36, -0.175], concrete, { rot: [6, 0, 0], outline: 0.35 });
    k.box('DEF-spine003', [0.08, 0.06, 0.012], [0, 1.39, -0.208], ink, { rot: [6, 0, 0], outline: 0 });
    // Bracelete hacker no antebraço direito, com tela
    k.cyl('DEF-forearmR', 0.064, 0.12, [-0.62, 1.43, -0.07], ink, { axis: 'x' });
    k.box('DEF-forearmR', [0.09, 0.012, 0.055], [-0.62, 1.495, -0.07], cyan, { glow: 1.6, outline: 0 });
    // Luvas: placa amarela no dorso (os nós amarelos vêm da região "knuckle")
    glovePlates(k, yellow);
    // Bolsos de carga nas coxas
    for (const s of [1, -1]) k.bevel(s > 0 ? 'DEF-thighL' : 'DEF-thighR', [0.04, 0.13, 0.13], [s * 0.172, 0.72, 0.0], wine, { outline: 0.25 });
    // Botas: cano lilás, bico amarelo, sola preta
    bootCuffs(k, concrete);
    for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
      k.bevel(`DEF-toe${side}`, [0.128, 0.06, 0.07], [s * 0.1, 0.04, 0.18], yellow, { outline: 0.2 });
    }
    soles(k, ink, 0.03);
    // Identidade: emblema da facção e equipamento de cintura/coxa
    sleeveBadge(k, 'resistencia');
    beltPouches(k, PALETTE.polymer, yellow);
  },
};
