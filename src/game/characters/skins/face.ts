import * as THREE from 'three';
import { PALETTE as C } from '../../toon';
import { SURFACE } from '../shading';
import type { Kit, Vec } from './kit';

// Rosto anime em placas finas presas à cabeça (pose de descanso: frente do rosto em z ≈ 0,111).
// Olho = esclera em amêndoa, íris em duas cores, pupila, dois brilhos e cílio superior com
// "flick" no canto de fora. Todas as peças do olho carregam o centro dele (`eye`) para o
// shader achatá-las ao piscar. Leitura de perto, custo zero de draw call.

export interface FaceStyle {
  skin: number;
  iris: number;
  /** Tom claro da metade de baixo da íris. */
  irisLight: number;
  /** Sobrancelha: inclinação (graus, + = brava/descendo para o meio) e altura extra. */
  browTilt: number;
  browLift?: number;
  /** Olho "sorrindo" (pálpebra de baixo sobe): o sorriso fixo dos Sorridentes. */
  smileEyes?: boolean;
  /** Íris que brilha (implante). */
  glowIris?: boolean;
  mouth: 'smirk' | 'grin' | 'none';
}

const EYE_X = 0.039;
const EYE_Y = 1.688;
const EYE_Z = 0.109;
const TURN = 13; // graus: o olho acompanha a curva do rosto

const _p = new THREE.Vector3();
const _e = new THREE.Euler();

export function animeFace(k: Kit, f: FaceStyle): void {
  for (const s of [1, -1]) {
    const center: Vec = [s * EYE_X, EYE_Y, EYE_Z];
    // posição de mundo de um ponto do olho (dx para fora do rosto, dy para cima, dz para frente)
    const at = (dx: number, dy: number, dz: number): Vec => {
      _p.set(s * dx, dy, dz).applyEuler(_e.set(0, (s * TURN * Math.PI) / 180, 0));
      return [center[0] + _p.x, center[1] + _p.y, center[2] + _p.z];
    };
    const rot = (z = 0): Vec => [0, s * TURN, s * z];
    const mirror = (pts: [number, number][]) => pts.map(([x, y]) => [s * x, y] as [number, number]);
    const eye = { eye: center, outline: 0 } as const;

    // Esclera: amêndoa com o canto de fora mais alto
    const lower = f.smileEyes ? 0.004 : -0.011;
    k.panel('DEF-head', mirror([[-0.021, -0.002], [-0.013, 0.01], [0.004, 0.014], [0.021, 0.009], [0.025, 0.002],
      [0.015, lower], [-0.006, lower - 0.002]]), 0.004, at(0, 0, 0), C.paper, { ...eye, rot: rot(), surface: SURFACE.blink });
    // Íris em duas cores, pupila e brilhos
    const irisR = f.smileEyes ? 0.0095 : 0.0112;
    const irisY = f.smileEyes ? 0.006 : 0.0005;
    const irisOpt = { ...eye, axis: 'z' as const, segs: 10, rot: rot(), scale: [1, 1.18, 1] as Vec };
    k.cyl('DEF-head', irisR, 0.002, at(0.001, irisY, 0.003), f.iris, { ...irisOpt, glow: f.glowIris ? 1.5 : undefined });
    k.cyl('DEF-head', irisR * 0.72, 0.002, at(0.001, irisY - irisR * 0.35, 0.0034), f.irisLight,
      { ...irisOpt, glow: f.glowIris ? 1.7 : undefined });
    k.cyl('DEF-head', irisR * 0.48, 0.002, at(0.001, irisY + 0.001, 0.0042), C.ink, irisOpt);
    k.cyl('DEF-head', 0.0036, 0.002, at(0.005, irisY + 0.0055, 0.005), C.paper, { ...irisOpt, scale: [1, 1, 1], glow: 1.25 });
    k.cyl('DEF-head', 0.0018, 0.002, at(-0.004, irisY - 0.006, 0.005), C.paper, { ...irisOpt, scale: [1, 1, 1], glow: 1.25 });
    // Cílio de cima grosso com flick para fora; risco curto embaixo, no canto de fora
    k.panel('DEF-head', mirror([[-0.023, -0.001], [-0.013, 0.012], [0.005, 0.0165], [0.022, 0.012], [0.032, 0.016],
      [0.026, 0.005], [0.02, 0.0075], [0.004, 0.0115], [-0.012, 0.0075]]), 0.005, at(0, 0, 0.0012), C.ink,
    { ...eye, rot: rot(), surface: SURFACE.blink });
    if (f.smileEyes) {
      k.arc('DEF-head', 0.018, 0.0018, Math.PI * 0.8, at(0.002, -0.009, 0.004), C.ink, { ...eye, rot: rot(18), surface: SURFACE.blink });
    } else {
      k.panel('DEF-head', mirror([[0.008, -0.012], [0.02, -0.007], [0.022, -0.0085], [0.009, -0.0145]]), 0.003,
        at(0, 0, 0.0008), C.ink, { ...eye, rot: rot(), surface: SURFACE.blink });
    }
    // Sobrancelha: cunha grossa no meio, fina para fora
    const browY = 0.026 + (f.browLift ?? 0);
    k.panel('DEF-head', mirror([[-0.02, -0.003], [-0.019, 0.005], [0.004, 0.006], [0.026, 0.001], [0.024, -0.002], [0.003, 0.0]]),
      0.007, at(0.001, browY, -0.002), C.inkSoft, { outline: 0, rot: rot(f.browTilt), surface: SURFACE.hair });
    // Orelha
    k.ball('DEF-head', 0.02, [s * 0.087, 1.665, 0.014], f.skin, { segs: 8, scale: [0.45, 1.2, 0.7], outline: 0.1 });
  }
  // Nariz: ponta e sombra lateral (toon pinta o lado do nariz como mancha)
  k.ball('DEF-head', 0.012, [0, 1.652, 0.115], f.skin, { segs: 8, scale: [0.6, 1.0, 0.9], outline: 0 });
  k.panel('DEF-head', [[-0.004, 0.012], [0.003, 0.012], [0.005, -0.008], [-0.002, -0.006]], 0.002,
    [0.009, 1.656, 0.116], C.bark, { outline: 0, rot: [0, 25, 0] });
  if (f.mouth === 'smirk') {
    // Canto de boca levantado de um lado: confiança
    k.panel('DEF-head', [[-0.016, 0.0005], [0.006, -0.0015], [0.018, 0.005], [0.019, 0.0025], [0.006, -0.0045], [-0.016, -0.0022]],
      0.003, [0.001, 1.622, 0.113], C.bark, { outline: 0 });
  } else if (f.mouth === 'grin') {
    // Sorriso aberto: boca escura, dentes e canto subindo
    k.panel('DEF-head', [[-0.02, 0.004], [0.02, 0.004], [0.014, -0.008], [0, -0.012], [-0.014, -0.008]], 0.003,
      [0, 1.622, 0.112], C.ink, { outline: 0 });
    k.panel('DEF-head', [[-0.017, 0.003], [0.017, 0.003], [0.014, -0.001], [-0.014, -0.001]], 0.002,
      [0, 1.622, 0.1138], C.paper, { outline: 0 });
    k.box('DEF-head', [0.012, 0.0025, 0.003], [-0.008, 1.611, 0.112], C.bark, { outline: 0, rot: [0, 0, -8] });
  }
}
