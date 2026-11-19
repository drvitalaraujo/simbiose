import { PALETTE } from '../../toon';
import { beltPouches, bootCuffs, kneePads, sleeveBadge, soles } from './common';
import { animeFace } from './face';
import { croppedHair } from './hair';
import type { SkinDef } from './types';

// Ivo Riso (Os Sorridentes) — docs/concept/personagens/sorridentes-ivo-riso-folha.png
// Macacão branco (papel) com ombreiras redondas, faixa da cintura e faixas das canelas
// rosa; cotovelos e joelheiras pretos; máscara branca com sorriso rosa rígido; implantes
// rosa nas têmporas; unidade dorsal branca com faixa rosa. Sem ciano nem amarelo.

const { ink, pink, paper } = PALETTE;

export const IVO: SkinDef = {
  id: 'ivo',
  name: 'Ivo Riso',
  faction: 'sorridentes',
  colors: {
    face: PALETTE.skinLight,
    hair: PALETTE.inkSoft,
    brow: PALETTE.skinLight,
    neck: ink,
    chest: PALETTE.cal,
    chestCenter: PALETTE.cal,
    shoulder: pink,
    belly: PALETTE.cal,
    waist: pink,
    pelvis: PALETTE.cal,
    sleeve: PALETTE.cal,
    elbow: PALETTE.polymer,
    forearm: PALETTE.cal,
    hand: paper,
    palm: ink,
    knuckle: pink,
    finger: paper,
    thigh: PALETTE.cal,
    knee: PALETTE.polymer,
    shin: PALETTE.cal,
    boot: paper,
    toe: paper,
    sole: pink,
  },
  pieces(k) {
    animeFace(k, { skin: PALETTE.skinLight, iris: PALETTE.pink, irisLight: PALETTE.ipe, browTilt: -8, browLift: 0.004, smileEyes: true, glowIris: true, mouth: 'none' });
    croppedHair(k);
    // Máscara em meia-lua: frente + duas bordas chanfradas, cobrindo nariz, boca e queixo
    k.panel('DEF-head', [[-0.058, 0.044], [-0.025, 0.03], [0.025, 0.03], [0.058, 0.044], [0.055, -0.013], [0.026, -0.041], [-0.026, -0.041], [-0.055, -0.013]],
      0.02, [0, 1.602, 0.119], paper, { rot: [-8, 0, 0], outline: 0.15 });
    for (const s of [1, -1]) {
      k.bevel('DEF-head', [0.021, 0.063, 0.07], [s * 0.064, 1.606, 0.076], paper, { rot: [0, s * 40, 0], outline: 0.15 });
    }
    // Sorriso rosa: arco de toro achatado, de ponta a ponta da máscara
    k.arc('DEF-head', 0.047, 0.006, Math.PI, [0, 1.625, 0.133], pink, { rot: [0, 0, 180], scale: [1, 0.75, 0.5], glow: 1.2, outline: 0 });
    // Implantes nas têmporas (discos de 8 lados)
    for (const s of [1, -1]) {
      k.cyl('DEF-head', 0.028, 0.013, [s * 0.094, 1.7, 0.005], PALETTE.polymer, { axis: 'x', outline: 0.15 });
      k.cyl('DEF-head', 0.022, 0.006, [s * 0.103, 1.7, 0.005], pink, { axis: 'x', glow: 1.2, outline: 0 });
      k.cyl('DEF-head', 0.01, 0.002, [s * 0.107, 1.7, 0.005], paper, { axis: 'x', outline: 0 });
    }
    // Gola alta rígida
    k.cyl('DEF-spine003', 0.082, 0.08, [0, 1.525, -0.03], paper, { open: true, segs: 8, scale: [1, 1, 0.92] });
    // Ombreiras redondas rosa
    for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
      k.ball(`DEF-shoulder${side}`, 0.085, [s * 0.185, 1.465, -0.065], pink, { half: true, segs: 10, scale: [1, 0.85, 1], outline: 0.3 });
    }
    // Faixas rosa nas canelas, joelheiras pretas
    for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
      k.panel(`DEF-shin${side}`, [[-0.025, 0.09], [-0.014, 0.106], [0.022, 0.084], [0.016, -0.093], [-0.014, -0.093]],
        0.019, [s * 0.095, 0.33, 0.033], pink, { outline: 0.2 });
    }
    kneePads(k, ink);
    // Botas brancas pesadas de sola rosa
    bootCuffs(k, paper);
    soles(k, pink, 0.04);
    // Unidade dorsal branca com faixa rosa central
    k.bevel('DEF-spine003', [0.18, 0.24, 0.055], [0, 1.34, -0.19], paper, { outline: 0.3 });
    k.bevel('DEF-spine003', [0.045, 0.2, 0.014], [0, 1.34, -0.22], pink, { outline: 0 });
    // Identidade: emblema da facção e equipamento de cintura/coxa
    sleeveBadge(k, 'sorridentes');
    beltPouches(k, paper, pink);
  },
};
