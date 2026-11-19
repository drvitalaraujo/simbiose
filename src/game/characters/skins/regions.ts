// Regiões do corpo do manequim (Quaternius UAL), para pintar a skin por triângulo.
// Lógica pura: recebe o osso de maior peso e a posição/normal na pose de descanso
// (T-pose, em metros, boneco olhando para +Z, esquerda do personagem em +X).
// As medidas abaixo vêm do próprio `mannequin.glb` (topo da cabeça em ~1,83 m).
// O osso só decide a PARTE do corpo (cabeça, tronco, braço, mão, perna, pé); dentro da
// parte, quem decide é a posição, e a malha é cortada nos mesmos planos (`CUT_PLANES`)
// para as bordas das cores saírem retas em vez de serrilhadas.

export const REGIONS = [
  'face',
  'hair',
  'brow', // faixa da testa (bandana do Caio)
  'neck',
  'chest', // tronco (jaqueta)
  'chestCenter', // abertura da frente da jaqueta (camiseta)
  'shoulder', // topo dos ombros
  'belly', // barriga, abaixo da jaqueta curta
  'waist', // cinto / faixa da cintura
  'pelvis',
  'sleeve', // braço até perto do cotovelo
  'elbow',
  'forearm',
  'hand', // dorso da mão / luva
  'palm',
  'knuckle', // primeira falange (nós dos dedos)
  'finger', // falanges da ponta
  'thigh',
  'knee',
  'shin',
  'boot', // cano e peito do pé
  'toe', // bico
  'sole',
] as const;

export type Region = (typeof REGIONS)[number];

export interface V3 {
  x: number;
  y: number;
  z: number;
}

/** Cortes (m). Altura = y; "|x|" = distância do meio do corpo; z = frente(+)/trás(−). */
export const CUT = {
  browTop: 1.745, // topo da bandana
  brow: 1.705, // linha da testa
  hairBack: -0.035, // nuca: z abaixo disso é cabelo
  hairSide: 0.07, // |x| das laterais do cabelo
  neck: 1.5,
  chestCenterTop: 1.47,
  chestCenterHalf: 0.055,
  chestFront: 0.06,
  shoulderY: 1.43,
  shoulderX: 0.09,
  jacketHem: 1.18, // fim da jaqueta curta
  waistTop: 1.1,
  waistBottom: 1.035,
  sleeveEnd: 0.4, // |x| onde a manga termina
  elbowEnd: 0.53, // |x| onde o cotovelo vira antebraço
  kneeTop: 0.6,
  kneeBottom: 0.44,
  bootTop: 0.22,
  sole: 0.028,
} as const;

export type Part = 'head' | 'torso' | 'arm' | 'hand' | 'leg' | 'foot';

/** Parte do corpo pelo nome do osso (já sanitizado: `DEF-spine001`, `DEF-f_index01R`...). */
export function partOf(bone: string): Part {
  const b = bone.replace(/^DEF-/, '');
  if (b === 'head') return 'head';
  if (/^(thumb|f_|hand)/.test(b)) return 'hand';
  if (/^(upper_arm|forearm)/.test(b)) return 'arm';
  if (/^(foot|toe)/.test(b)) return 'foot';
  if (/^(thigh|shin)/.test(b)) return 'leg';
  return 'torso'; // hips, spine, shoulder, neck, root
}

/** Plano de corte: `axis` = valor, valendo só dentro da caixa `box` (por eixo, [min, max]). */
export interface CutPlane {
  axis: 'x' | 'y' | 'z';
  value: number;
  box?: Partial<Record<'x' | 'y' | 'z', [number, number]>>;
}

const HEAD: CutPlane['box'] = { y: [1.55, 2] };
const TORSO: CutPlane['box'] = { y: [0.8, 1.6], x: [-0.2, 0.2] };
const ARMS = (s: number): CutPlane['box'] => ({ y: [1.3, 1.6], x: s > 0 ? [0.2, 0.8] : [-0.8, -0.2] });
const LEGS: CutPlane['box'] = { y: [-0.1, 0.8] };

export const CUT_PLANES: CutPlane[] = [
  { axis: 'y', value: CUT.browTop, box: HEAD },
  { axis: 'y', value: CUT.brow, box: HEAD },
  { axis: 'z', value: -0.02, box: { y: [CUT.brow, CUT.browTop] } },
  { axis: 'z', value: CUT.hairBack, box: { y: [1.6, 1.9] } },
  { axis: 'y', value: 1.6, box: { ...HEAD, z: [-0.2, CUT.hairBack + 0.02] } },
  { axis: 'x', value: CUT.hairSide, box: { y: [1.64, 1.9] } },
  { axis: 'x', value: -CUT.hairSide, box: { y: [1.64, 1.9] } },
  { axis: 'z', value: 0.02, box: { y: [1.64, 1.9], x: [-0.2, 0.2] } },
  { axis: 'y', value: 1.64, box: HEAD },
  { axis: 'y', value: CUT.neck, box: { y: [1.4, 1.6], x: [-0.1, 0.1] } },
  { axis: 'y', value: CUT.shoulderY, box: TORSO },
  { axis: 'x', value: CUT.shoulderX, box: { y: [1.38, 1.6] } },
  { axis: 'x', value: -CUT.shoulderX, box: { y: [1.38, 1.6] } },
  { axis: 'y', value: CUT.chestCenterTop, box: { y: [1.4, 1.55], x: [-0.08, 0.08] } },
  { axis: 'x', value: CUT.chestCenterHalf, box: { y: [1.15, 1.5], z: [0, 0.3] } },
  { axis: 'x', value: -CUT.chestCenterHalf, box: { y: [1.15, 1.5], z: [0, 0.3] } },
  { axis: 'z', value: CUT.chestFront, box: { y: [1.15, 1.5], x: [-0.08, 0.08] } },
  { axis: 'y', value: CUT.jacketHem, box: TORSO },
  { axis: 'y', value: CUT.waistTop, box: TORSO },
  { axis: 'y', value: CUT.waistBottom, box: TORSO },
  { axis: 'x', value: CUT.sleeveEnd, box: ARMS(1) },
  { axis: 'x', value: -CUT.sleeveEnd, box: ARMS(-1) },
  { axis: 'x', value: CUT.elbowEnd, box: ARMS(1) },
  { axis: 'x', value: -CUT.elbowEnd, box: ARMS(-1) },
  { axis: 'y', value: CUT.kneeTop, box: LEGS },
  { axis: 'y', value: CUT.kneeBottom, box: LEGS },
  { axis: 'y', value: CUT.bootTop, box: LEGS },
  { axis: 'y', value: CUT.sole, box: LEGS },
];

/**
 * Região de um triângulo (use o centro dele): `bone` é o osso de maior peso, já
 * sanitizado pelo GLTFLoader; `n` é a normal (só para separar palma de dorso).
 */
export function regionOf(bone: string, p: V3, n: V3): Region {
  const b = bone.replace(/^DEF-/, '');
  const ax = Math.abs(p.x);
  switch (partOf(bone)) {
    case 'head':
      if (p.y > CUT.browTop) return 'hair';
      if (p.y > CUT.brow) return p.z > -0.02 ? 'brow' : 'hair';
      if (p.z < CUT.hairBack && p.y > 1.6) return 'hair';
      if (ax > CUT.hairSide && p.z < 0.02 && p.y > 1.64) return 'hair';
      return 'face';
    case 'hand':
      if (n.y < -0.55) return 'palm';
      if (b.startsWith('hand')) return 'hand';
      return /01/.test(b) ? 'knuckle' : 'finger';
    case 'arm':
      if (ax < CUT.sleeveEnd) return 'sleeve';
      return ax < CUT.elbowEnd ? 'elbow' : 'forearm';
    case 'foot':
      if (p.y < CUT.sole) return 'sole';
      return b.startsWith('toe') ? 'toe' : 'boot';
    case 'leg':
      if (p.y < CUT.sole) return 'sole';
      if (p.y < CUT.bootTop) return 'boot';
      if (p.y < CUT.kneeBottom) return 'shin';
      return p.y < CUT.kneeTop ? 'knee' : 'thigh';
    default:
      if (p.y > CUT.neck && ax < 0.1) return 'neck';
      if (p.y > CUT.shoulderY && ax > CUT.shoulderX) return 'shoulder';
      if (p.y > CUT.jacketHem) {
        return p.z > CUT.chestFront && ax < CUT.chestCenterHalf && p.y < CUT.chestCenterTop ? 'chestCenter' : 'chest';
      }
      if (p.y > CUT.waistTop) return 'belly';
      return p.y > CUT.waistBottom ? 'waist' : 'pelvis';
  }
}
