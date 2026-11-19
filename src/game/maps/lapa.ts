// Recorte dos Arcos da Lapa e Praça Cardeal Câmara, consultado no Google Maps.
// Eixos locais: +x segue para o Centro; +z aponta para o lado aberto da praça.
// Fundição e Circo ficam do mesmo lado dos arcos; Mem de Sá cruza a ponta sul.
// Escala comprimida para Arena, sem alterar movimento ou armas. Ver plano de referências.
import { box, stairs } from '../world/shapes';
import type { MapData, MapSolid, SolidKind, Tint } from './types';

const solids: MapSolid[] = [];
function put(kind: SolidKind, tint: Tint, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const s: MapSolid = { kind, tint, box: box(x0, y0, z0, x1, y1, z1) };
  solids.push(s);
  return s;
}

export const LAPA_ARCADE = { start: -42, bays: 14, pitch: 6, radius: 2.35, depth: 2.2, tier: 6.8, spring: 3.55, top: 13.6 };
export const LAPA_ARCH_SOLIDS: MapSolid[] = [];
export const LAPA_SPANDRELS: MapSolid[] = [];
put('ground', 'neutral', -50, -1, -38, 50, 0, 44);

// Pilares iguais no visual e na simulação; as faixas estreitas aproximam a volta
// semicircular em AABBs. Os vãos inferiores continuam abertos para corpo e tiro.
const a = LAPA_ARCADE;
for (let tier = 0; tier < 2; tier++) {
  const base = tier * a.tier;
  for (let i = 0; i <= a.bays; i++) {
    const x = a.start + i * a.pitch;
    LAPA_ARCH_SOLIDS.push(put('wall', 'neutral', x - 0.65, base, -a.depth / 2, x + 0.65, base + a.tier, a.depth / 2));
  }
  for (let i = 0; i < a.bays; i++) {
    const cx = a.start + (i + 0.5) * a.pitch;
    // Fatias por altura: diferença máxima de 7,4 cm da curva visual. Mantém a
    // colisão AABB sem degraus visuais na cantaria ou grandes paredes invisíveis.
    for (let k = 0; k < 32; k++) {
      const lo = a.radius * k / 32, hi = a.radius * (k + 1) / 32;
      const inner = Math.sqrt(Math.max(0, a.radius ** 2 - hi ** 2));
      const outer = Math.sqrt(Math.max(0, a.radius ** 2 - lo ** 2));
      for (const side of [-1, 1]) {
        const s = put('wall', 'neutral', cx + side * inner, base + a.spring + lo, -a.depth / 2,
          cx + side * outer, base + a.tier, a.depth / 2);
        LAPA_ARCH_SOLIDS.push(s); LAPA_SPANDRELS.push(s);
      }
    }
  }
}

export const LAPA_BUILDINGS = [
  { name: 'fundicao', color: 'ochre', solid: put('wall', 'A', 5, 0, -38, 43, 10, -25) },
  { name: 'circo', color: 'colonialRed', solid: put('wall', 'B', -38, 0, -38, -12, 3.4, -25) },
  // O limite jogável acompanha quarteirões recortados. Não há volta retangular
  // pela borda: cada rua desemboca em outro largo, com fachadas como cobertura.
  { name: 'casario', color: 'colonialSky', solid: put('wall', 'routeB', -50, 0, 12, -43, 10, 44) },
  { name: 'casario', color: 'sand', solid: put('wall', 'routeB', -43, 0, 31, -30, 9, 44) },
  { name: 'casario', color: 'colonialRose', solid: put('wall', 'routeB', -30, 0, 39, -14, 11, 44) },
  { name: 'casario', color: 'colonialMoss', solid: put('wall', 'mid', -14, 0, 29, 0, 10, 44) },
  { name: 'casario', color: 'sand', solid: put('wall', 'routeA', 27, 0, 35, 50, 11, 44) },
  { name: 'casario', color: 'colonialSky', solid: put('wall', 'routeA', 44, 0, 9, 50, 12, 35) },
  { name: 'casario', color: 'terracotta', solid: put('wall', 'routeA', 37, 0, 28, 44, 8, 35) },
  // Ilhas de comércio: a frente é um largo; o fundo, um beco de flanco em cotovelo.
  { name: 'casario', color: 'ochre', solid: put('wall', 'B', -35, 0, 15, -23, 6.8, 25) },
  { name: 'casario', color: 'colonialRose', solid: put('wall', 'A', 26, 0, 12, 36, 7.5, 23) },
  { name: 'casario', color: 'colonialMoss', solid: put('wall', 'B', -8, 0, -38, 1, 6, -18) },
  // Bilheterias interrompem a rua dos Arcos e abrigam a saída das casas de shows.
  { name: 'bilheteria', color: 'colonialMoss', solid: put('wall', 'B', -31, 0, -19, -24, 3.3, -12) },
  { name: 'bilheteria', color: 'ochre', solid: put('wall', 'A', 21, 0, -19, 28, 3.8, -11) },
] as const;

export const LAPA_COVERS = [
  { type: 'planter', solid: put('low', 'mid', -27, 0, 7, -21, 1, 10) },
  { type: 'planter', solid: put('low', 'mid', 15, 0, 8, 20, 1, 11) },
  { type: 'planter', solid: put('low', 'routeB', -26, 0, 32, -19, 1, 35) },
  { type: 'planter', solid: put('low', 'routeA', 10, 1.6, 35, 15, 2.6, 38) },
  { type: 'kiosk', solid: put('tall', 'mid', -7, 0, 10, 1, 3, 15) },
  { type: 'kiosk', solid: put('tall', 'routeA', 34, 0, -9, 39, 2.8, -5) },
  // Equipamentos de rua junto a pilares: cortam a mira paralela ao aqueduto,
  // preservando o enquadramento e a travessia de cada vão individual.
  { type: 'memory', solid: put('tall', 'B', -14, 0, -8, -10, 2.9, -2) },
  { type: 'memory', solid: put('tall', 'A', 10, 0, 2, 14, 2.9, 8) },
  { type: 'barricade', solid: put('tall', 'routeB', -44, 0, -13, -39, 2.2, -10) },
  { type: 'barricade', solid: put('tall', 'routeA', 39, 0, -25, 43, 2.2, -20) },
  { type: 'barricade', solid: put('tall', 'mid', 3, 0, -12, 10, 2.2, -9) },
] as const;

// Terraço do Choro: vantagem de altura pequena, sem dominar a arena inteira.
// Dois acessos largos e separados; o lado norte tem a volta de flanco pelo térreo.
export const LAPA_TERRACE = put('terrace', 'routeA', 9, 0, 27, 24, 1.6, 39);
export const LAPA_STAIRS = [
  ...stairs({ axis: 'x', start: 5, dir: 1, across: [29, 34], base: 0, top: 1.6, depth: 1 }),
  ...stairs({ axis: 'z', start: 23, dir: 1, across: [18, 23], base: 0, top: 1.6, depth: 1 }),
].map(b => { const s: MapSolid = { box: b, kind: 'stairs', tint: 'routeA' }; solids.push(s); return s; });
// Mureta maciça atrás do terraço protege a cabeça sem fechar as duas escadas.
put('tall', 'routeA', 16, 1.6, 38.4, 24, 3.7, 39);
export const LAPA_PALMS = [[-24, 8.5], [17.5, 9.5], [-22.5, 33.5], [-45, -19], [45, -16]] as const;
for (const [x, z] of LAPA_PALMS) put('wall', 'neutral', x - 0.22, 0, z - 0.22, x + 0.22, 7.4, z + 0.22);

// Bordas legíveis: muretas, com limite invisível alto impedindo sair do recorte.
put('edge', 'neutral', -50.4, 0, -38, -50, 2.2, 44);
put('edge', 'neutral', 50, 0, -38, 50.4, 2.2, 44);
put('edge', 'neutral', -50, 0, -38.4, 50, 2.2, -38);
put('edge', 'neutral', -50, 0, 44, 50, 2.2, 44.4);
for (const b of [box(-51, 0, -39, -50, 32, 45), box(50, 0, -39, 51, 32, 45),
  box(-50, 0, -39, 50, 32, -38), box(-50, 0, 44, 50, 32, 45), box(-50, 32, -38, 50, 33, 44)]) {
  solids.push({ kind: 'bound', tint: 'neutral', box: b });
}

const feet = (x: number, z: number, y = 0) => ({ x, y, z });
export const LAPA: MapData = {
  id: 'lapa', name: 'Arcos da Lapa · Rio de Janeiro',
  bounds: { x0: -50, z0: -38, x1: 50, z1: 44 }, wallHeight: a.top,
  solids,
  zones: [
    { id: 'mid', name: 'LARGO DOS ARCOS', tint: 'mid', rect: { x0: -20, z0: 3, x1: 23, z1: 22 } },
    { id: 'arcos', name: 'ARCOS', tint: 'neutral', rect: { x0: -43, z0: -3, x1: 43, z1: 3 } },
    { id: 'fundicao', name: 'FUNDIÇÃO', tint: 'A', rect: { x0: 4, z0: -25, x1: 43, z1: -5 } },
    { id: 'circo', name: 'CIRCO VOADOR', tint: 'B', rect: { x0: -38, z0: -25, x1: -5, z1: -5 } },
    { id: 'memsa', name: 'MEM DE SÁ', tint: 'routeB', rect: { x0: -50, z0: -25, x1: -39, z1: 10 } },
    { id: 'beco', name: 'BECO DO SEBO', tint: 'routeB', rect: { x0: -42, z0: 26, x1: -15, z1: 38 } },
    { id: 'choro', name: 'TERRAÇO DO CHORO', tint: 'routeA', rect: { x0: 9, z0: 27, x1: 24, z1: 39 } },
    { id: 'centro', name: 'REP. DO PARAGUAI', tint: 'routeA', rect: { x0: 37, z0: -20, x1: 49, z1: 8 } },
  ],
  spawns: {
    attack: [feet(-46, -29), feet(-46, -25), feet(-46, -8), feet(-39, 20), feet(-39, 28)],
    defend: [feet(46, -29), feet(46, -24), feet(46, -10), feet(40, 18), feet(32, 30)],
    ffa: [feet(-46, -29), feet(46, -29), feet(-39, 20), feet(40, 18),
      feet(-20, -21), feet(32, -21), feet(-19, 36), feet(4, 39), feet(17, 36, 1.6), feet(5, 19)],
  },
  playerSpawn: feet(9, 19),
  droneSpawns: [[-35, 21, 18], [35, 21, 18], [-24, 22, -16], [24, 22, -16], [0, 24, 0]],
  labels: [
    // Nomes das casas de shows entram no atlas autoral do vestido, em faixas próprias.
    { text: 'BECO DO SEBO', tint: 'routeB', at: { x: -21, y: 3.72, z: 38.98 }, axis: 'z', n: -1, width: 4 },
  ],
};
