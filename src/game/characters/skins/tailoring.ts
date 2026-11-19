import { PALETTE as C } from '../../toon';
import type { Kit } from './kit';
import type { SkinId } from './types';

/** Costura, ferragens e bolsos em escala humana, presos aos mesmos ossos da roupa. */
export function tailoring(k: Kit, skin: SkinId) {
  const clean = skin === 'ivo';
  const fabric = clean ? C.cal : skin === 'lia' ? C.pantsWine : C.polymer;
  const seam = clean ? C.steel : C.inkSoft;
  const jacket = clean ? C.paper : skin === 'lia' ? C.clothTeal : C.concrete;
  const small = { outline: 0 } as const;
  // Painéis de tecido com espessura rasa; abertura e barra seguem o torso.
  for (const s of [-1, 1]) {
    if (!clean) {
      k.panel('DEF-spine003', [[-0.032, 0.078], [0.03, 0.063], [0.036, -0.06], [-0.026, -0.075]], 0.014,
        [s * 0.099, 1.384, 0.103], jacket, { ...small, rot: [0, s * 13, 0] });
      k.ribbon([
        { at: [s * 0.058, 1.19, 0.113], bone: 'DEF-spine001' },
        { at: [s * 0.058, 1.32, 0.13], bone: 'DEF-spine002' },
        { at: [s * 0.067, 1.438, 0.105], bone: 'DEF-spine003' },
      ], 0.004, seam);
    }
    k.bevel('DEF-spine001', [0.075, 0.014, 0.009], [s * 0.099, 1.19, 0.1], jacket, { ...small, rot: [0, s * 20, 0] });
  }
  if (clean) k.ribbon([
    { at: [0, 1.12, 0.11], bone: 'DEF-spine001' },
    { at: [0, 1.3, 0.134], bone: 'DEF-spine002' },
    { at: [0, 1.48, 0.094], bone: 'DEF-spine003' },
  ], 0.004, C.steel);
  k.bevel('DEF-spine002', [0.012, 0.021, 0.009], [clean ? 0 : 0.065, 1.4, 0.127], C.steelLight, small);
  // Fivela pequena, passantes e bolso de peito com aba.
  k.bevel('DEF-hips', [0.038, 0.027, 0.012], [0, 1.065, 0.107], clean ? C.paper : C.steel, small);
  for (const s of [-1, 1]) k.box('DEF-hips', [0.015, 0.05, 0.009], [s * 0.1, 1.064, 0.09], seam, small);
  k.bevel('DEF-spine003', [0.064, 0.054, 0.01], [-0.097, 1.382, 0.118], jacket, small);
  k.box('DEF-spine003', [0.059, 0.004, 0.008], [-0.097, 1.405, 0.126], seam, small);
  for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
    // Bolso lateral contorna a perna: volume de tecido, aba e botão.
    if (!clean) {
      if (skin !== 'lia') k.bevel(`DEF-thigh${side}`, [0.02, 0.12, 0.095], [s * 0.168, 0.73, 0.005], fabric, { outline: 0.15 });
      const pocketX = skin === 'lia' ? 0.196 : 0.182;
      k.bevel(`DEF-thigh${side}`, [0.012, 0.018, 0.1], [s * pocketX, 0.78, 0.005], seam, small);
      k.box(`DEF-thigh${side}`, [0.016, 0.008, 0.012], [s * (pocketX + 0.006), 0.767, 0.022], C.steel, small);
    }
    // Vincos no joelho e reforço discreto no cotovelo.
    k.box(`DEF-shin${side}`, [0.078, 0.008, 0.009], [s * 0.097, 0.427, 0.048], seam, { ...small, rot: [0, 0, s * 9] });
    k.box(`DEF-forearm${side}`, [0.038, 0.009, 0.08], [s * 0.46, 1.444, -0.065], jacket, small);
    // Cadarços em baixo relevo e reforço da biqueira.
    if (clean) k.bevel(`DEF-foot${side}`, [0.09, 0.014, 0.038], [s * 0.1, 0.1, 0.071], C.paper, { ...small, rot: [20, 0, 0] });
    else for (const z of [0.035, 0.065, 0.095]) k.box(`DEF-foot${side}`, [0.045, 0.005, 0.006], [s * 0.1, 0.098, z], C.sand, small);
  }
}
