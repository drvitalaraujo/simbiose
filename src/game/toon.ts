import * as THREE from 'three';

// Paleta fechada do jogo (ver docs/GDD.md, seção Estética).
export const PALETTE = {
  beachSand: 0xf2e5c6,
  wood: 0x987451,
  seaShallow: 0xa5e4d4,
  seaTurquoise: 0x51c7c6,
  seaDeep: 0x278fae,
  seaFoam: 0xdaf5e8,
  ink: 0x1a1026,
  concrete: 0xb8a9d9,
  concreteDark: 0x7d6ea8,
  pink: 0xff3d7f,
  cyan: 0x2de2e6,
  yellow: 0xffd23f,
  sky: 0xffb3c7,
  paper: 0xf4ecff,
  // Bairro da Neo-São Paulo (pôr do sol anime)
  asphalt: 0x4b3f6b,
  lilac: 0x9d7fe0,
  orange: 0xff8a5b,
  skyTop: 0x7a5cc7,
  horizon: 0xffc38a,
  sun: 0xfff3c4,
  glass: 0x3a3f78,
  wine: 0xb84a7a,
  // Salto visual (céu Shinkai, névoa, árvores toon)
  skyDeep: 0x3d2a8a,
  dusk: 0x6a4f9e,
  magenta: 0xd95ba8,
  leaf: 0x3f9e7e,
  leafLight: 0x8fd17a,
  ipe: 0xff7ab8,
  ipeYellow: 0xffc93c,
  bark: 0x5a3d55,
  tank: 0x3b7fd0,
  // Pelourinho: casarões coloniais e telhado de barro
  colonialYellow: 0xf5c451,
  colonialBlue: 0x5b9bd5,
  colonialPink: 0xf08fb0,
  colonialGreen: 0x6cc4a1,
  telha: 0xc0593e,
  /** Rejunte do calçamento de pedra. */
  stoneJoint: 0x8a849c,
  // Pelourinho real (docs/concept/referencias-pelourinho): cores de fachada abaixo da
  // saturação dos personagens. Rosa neon e ciano ficam só em neon, telão e pichação pequena.
  /** Azul-celeste da igreja e de casarões. */
  colonialSky: 0x8fb6e6,
  /** Terracota: telhado de barro visto de perto e casarão avermelhado. */
  terracotta: 0xc0714f,
  /** Areia: casarão creme e cantaria clara. */
  sand: 0xd9b98a,
  /** Amarelo-ocre de fachada (mais baixo que o amarelo de UI/fita da Resistência). */
  ochre: 0xd9ae68,
  /** Rosa colonial suave, puxado para o salmão (nunca o rosa neon do inimigo). */
  colonialRose: 0xd99a84,
  /** Verde colonial de fachada. */
  colonialMoss: 0x6fa36a,
  /** Vermelho-tijolo colonial. */
  colonialRed: 0xc65a48,
  /** Cal: molduras, cunhais e cimalhas (branco quente). */
  cal: 0xf2e8da,
  /** Arenito ocre da cantaria da igreja. */
  cantaria: 0xc9a274,
  /** Pedra do calçamento: cinza-lilás claro e quente das pinturas. */
  cobbleStone: 0xdcd8e6,
  /** Mar da baía no pôr do sol. */
  bay: 0x6a74c4,
  // Skins de personagem (docs/concept/personagens/)
  pantsWine: 0x8c3360, // calça cargo da Lia: vinho mais fundo que a pele (wine)
  /**
   * Tinta "aberta" para volumes escuros grandes que precisam mostrar as faixas do
   * cel-shading (luvas, punho, guarda-mão e coronha da MK-2). A tinta pura vira borrão.
   */
  inkSoft: 0x382d52,
  // Acabamento físico: metal fosco, polímero e tecido; acentos neon ficam menores.
  steel: 0x56616e,
  steelLight: 0x9aa6ad,
  polymer: 0x30323e,
  clothTeal: 0x408b90,
  skinDeep: 0x98634f,
  skinWarm: 0xc18a68,
  skinLight: 0xd6ac8f,
} as const;

/** Multiplicador de luz para emissivos que devem "estourar" no bloom (neon, telões, lâmpadas). */
export const GLOW = 2.2;

/** Cor da paleta como string CSS (`#rrggbb`), para desenhar em canvas. */
export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

// Três patamares de anime com transições curtas: volumes arredondados ganham forma
// sem virar plástico liso. A textura filtrada evita cintilar ao atravessar uma faixa.
const gradient = (() => {
  const data = new Uint8Array(256);
  const ramp = (x: number, a: number, b: number) => {
    const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < data.length; i++) {
    const t = i / (data.length - 1);
    data[i] = Math.round(255 * (0.28 + 0.32 * ramp(t, 0.28, 0.38) + 0.4 * ramp(t, 0.64, 0.76)));
  }
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
})();

const cache = new Map<number, THREE.MeshToonMaterial>();
const plain = new WeakSet<THREE.Material>();

export function toon(color: number): THREE.MeshToonMaterial {
  let m = cache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    cache.set(color, m);
    plain.add(m);
  }
  return m;
}

/** A cor de um material vindo de `toon(cor)` (sem textura nem extras), ou null. */
export function plainToonColor(material: THREE.Material): THREE.Color | null {
  return plain.has(material) ? (material as THREE.MeshToonMaterial).color : null;
}

let vertexToon: THREE.MeshToonMaterial | null = null;

/**
 * Um material toon só, com a cor em cada vértice: o cenário junta as peças de `toon(cor)`
 * de todas as cores num lote só (bem menos draw calls). Mesmo visual de `toon(cor)`.
 */
export function toonVertexColors(): THREE.MeshToonMaterial {
  vertexToon ??= new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradient });
  return vertexToon;
}

let sceneToon: THREE.MeshToonMaterial | null = null;

/**
 * Como `toonVertexColors`, mas só do cenário: o Builder liga nele a luz pintada do mundo
 * (`render/scene-light.ts`). Personagens e viewmodel seguem com `toonVertexColors`.
 */
export function toonScene(): THREE.MeshToonMaterial {
  sceneToon ??= new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradient });
  return sceneToon;
}

/** Material toon com parâmetros extras (textura, cor por vértice...), na mesma rampa de 3 faixas. */
export function toonWith(params: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ gradientMap: gradient, ...params });
}

const outlineCache = new Map<number, THREE.MeshBasicMaterial>();

export function outlineMaterial(color: number): THREE.MeshBasicMaterial {
  let mat = outlineCache.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    outlineCache.set(color, mat);
  }
  return mat;
}

/** Contorno de nanquim pelo método da casca invertida (cópia maior, só faces de trás). */
export function addOutline(mesh: THREE.Mesh, thickness = 0.04, color: number = PALETTE.ink): THREE.Mesh {
  const shell = new THREE.Mesh(mesh.geometry, outlineMaterial(color));
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
  shell.scale.set(1 + (2 * thickness) / size.x, 1 + (2 * thickness) / size.y, 1 + (2 * thickness) / size.z);
  shell.raycast = () => {}; // o contorno não pode receber tiro
  mesh.add(shell);
  return shell;
}
