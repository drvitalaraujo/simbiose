import * as THREE from 'three';
import type { Box } from '../physics';
import { GLOW, hex, PALETTE, toon } from '../toon';
import { paint, paintColor } from '../world/builder';
import { COBBLE_TILE, cobbleMaterial, worldUVBox } from '../world/cobble';
import { type Face, neonBox } from '../world/props';
import { rgba } from '../world/colonial-art';
import { canvas, texture } from '../world/textures';
import { type Dress, faceSlab, HOUSE_COLORS } from './colonial';
import { FLOOR } from './colors';
import { church } from './pelourinho-church';
import { floreira } from './pelourinho-scenery';
import type { MapSolid, Tint } from './types';

// Peças marcantes do Pelourinho reimaginado: a igreja barroca do adro (site B, em
// pelourinho-church.ts), o chafariz
// do largo com o holograma da IA, o palco do site A, e as coberturas vestidas de caixote,
// mureta de pedra ou ruína de casarão. A caixa de colisão de cada peça é a mesma do greybox:
// só muda a pintura e o que fica colado nela (sem passar de ~0.1 m na altura do corpo).

const STONE = PALETTE.cal;
const PEDRA = PALETTE.cobbleStone;
const deco = { solid: false, cast: false, outline: 0 } as const;

/**
 * Cor do calçamento de uma zona: pedra cinza-lilás quente (como nas pinturas) com um toque
 * do tom da zona, mais forte nos sites. A leitura forte da zona fica no barrado das paredes.
 */
export function cobbleTint(tint: Tint): THREE.Color {
  const stone = new THREE.Color(PALETTE.cobbleStone);
  if (tint === 'neutral') return stone.lerp(new THREE.Color(PALETTE.stoneJoint), 0.3);
  const k = tint === 'A' || tint === 'B' ? 0.12 : tint === 'mid' ? 0.04 : 0.06;
  return stone.lerp(new THREE.Color(FLOOR[tint]), k);
}

/** Sólido com textura de calçamento tingida (chão, terraços, plataformas). */
export function cobbleSolid(d: Dress, b: Box, color: THREE.Color, solid = true) {
  if (solid) d.b.solids.push(b);
  d.b.add(paintColor(worldUVBox(b), color), cobbleMaterial(true), { shoot: solid, cast: solid && b.max.y - b.min.y > 0.5 });
}

/** Superfície de pedra contínua sobre microdegraus; avanço visual máximo de 10,5 cm.
 * As caixas originais continuam cuidando do corpo e do tiro. A película só oculta
 * o recorte de cada espelho no passe de nanquim (a ladeira não vira uma escadaria).
 */
function streetSurface(d: Dress, b: Box, color: THREE.Color) {
  const { min: a, max: c } = b;
  const low = c.y + 0.005, high = low + 0.1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    a.x, low, a.z, a.x, high, c.z, c.x, low, a.z,
    c.x, low, a.z, a.x, high, c.z, c.x, high, c.z,
  ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([
    a.x / COBBLE_TILE, -a.z / COBBLE_TILE, a.x / COBBLE_TILE, -c.z / COBBLE_TILE, c.x / COBBLE_TILE, -a.z / COBBLE_TILE,
    c.x / COBBLE_TILE, -a.z / COBBLE_TILE, a.x / COBBLE_TILE, -c.z / COBBLE_TILE, c.x / COBBLE_TILE, -c.z / COBBLE_TILE,
  ], 2));
  g.computeVertexNormals();
  d.b.add(paintColor(g, color), cobbleMaterial(true), { cast: false });
}

/** Desenha o sólido com o tema; devolve false se o greybox deve cuidar dele. */
export function dressSolid(d: Dress, s: MapSolid): boolean {
  const { min, max } = s.box;
  const w = max.x - min.x;
  const l = max.z - min.z;
  if (s.kind === 'wall' && s.tint === 'B') return church(d, s), true;
  if (s.kind === 'tall' && s.tint === 'mid' && w > 10) return chafariz(d, s.box), true;
  if (s.kind === 'tall' && (s.tint === 'def' || s.tint === 'atk')) return spawnBlock(d, s), true;
  if (s.kind === 'platform') return platform(d, s), true;
  if (s.kind === 'terrace') {
    const color = cobbleTint(s.tint);
    cobbleSolid(d, s.box, color);
    if (s.tint === 'routeB' && max.z - min.z === 1) streetSurface(d, s.box, color);
    return true;
  }
  if (s.kind === 'low' || s.kind === 'tall') {
    if (Math.min(w, l) <= 0.45) balustrade(d, s.box);
    else if (s.kind === 'low' && s.tint === 'mid') floreira(d, s.box);
    else if (s.kind === 'tall' && Math.min(w, l) >= 5) pedestal(d, s.box);
    else if (Math.max(w, l) >= 5) ruin(d, s.box);
    else crates(d, s.box, s.kind === 'tall');
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- coberturas

/** Mureta de pedra (parapeito de sacada e do alto do largo). */
function balustrade(d: Dress, b: Box) {
  const { min, max } = b;
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, STONE);
  d.b.block(min.x - 0.04, max.y - 0.1, min.z - 0.04, max.x + 0.04, max.y, max.z + 0.04, PEDRA, deco);
}

/** Caixotes de feira: um (baixo) ou dois empilhados (alto), com ripas e cantoneiras. */
function crates(d: Dress, b: Box, tall: boolean) {
  const { min, max } = b;
  const r = d.r();
  const body = r < 0.5 ? PALETTE.cantaria : PALETTE.terracotta;
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, body);
  const h = max.y - min.y;
  const rows = tall ? 2 : 1;
  for (let i = 0; i < rows; i++) {
    const y0 = min.y + (h / rows) * i;
    const y1 = y0 + h / rows;
    const e = 0.025;
    // Ripas horizontais e a borda escura de cada caixote
    // Tábuas separadas por juntas e cantoneiras de metal fosco.
    for (let j = 1; j < 4; j++) {
      const yy = y0 + (y1 - y0) * j / 4;
      d.b.block(min.x - e, yy, min.z - e, max.x + e, yy + 0.025, max.z + e, PALETTE.bark, deco);
    }
    for (const x of [min.x + 0.08, max.x - 0.15]) {
      d.b.block(x, y0, min.z - e, x + 0.07, y1, max.z + e, PALETTE.steel, deco);
    }
    d.b.block(min.x - e, y1 - 0.07, min.z - e, max.x + e, y1, max.z + e, PALETTE.bark, deco);
  }
  // Selo da cooperativa na frente (chapado)
  d.b.block(min.x + 0.2, min.y + 0.2, max.z, min.x + 0.55, min.y + 0.55, max.z + 0.03, PALETTE.paper, deco);
}

/** Pedaço de casarão em ruína (cobertura comprida): reboco colorido, tijolo à mostra. */
function ruin(d: Dress, b: Box) {
  const { min, max } = b;
  const color = HOUSE_COLORS[Math.floor(d.r() * HOUSE_COLORS.length)];
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, color);
  d.b.block(min.x - 0.05, max.y - 0.12, min.z - 0.05, max.x + 0.05, max.y, max.z + 0.05, STONE, deco);
  const alongX = max.x - min.x > max.z - min.z;
  const len = alongX ? max.x - min.x : max.z - min.z;
  for (let i = 0; i < 5; i++) {
    const t = 0.4 + d.r() * (len - 1.6);
    const y = min.y + 0.4 + d.r() * (max.y - min.y - 1.1);
    const pw = 0.6 + d.r() * 0.7;
    const ph = 0.3 + d.r() * 0.35;
    for (const side of [0, 1]) {
      if (alongX) {
        const z = side ? max.z : min.z - 0.02;
        d.b.block(min.x + t, y, z, min.x + t + pw, y + ph, z + 0.02, PALETTE.wine, deco);
      } else {
        const x = side ? max.x : min.x - 0.02;
        d.b.block(x, y, min.z + t, x + 0.02, y + ph, min.z + t + pw, PALETTE.wine, deco);
      }
    }
  }
}

/** Pedestal de pedra do adro (o "cruzeiro"): topo calçado, dá para subir pela mureta. */
function pedestal(d: Dress, b: Box) {
  const { min, max } = b;
  // Corpo = a caixa inteira (colisão e tiro iguais ao greybox); o calçamento do topo é só
  // pintura, recuada 1 cm e 4 mm acima para não brigar com as faces do corpo
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, PEDRA);
  const i = 0.01;
  cobbleSolid(d, { min: { x: min.x + i, y: max.y - 0.02, z: min.z + i }, max: { x: max.x - i, y: max.y + 0.004, z: max.z - i } }, cobbleTint('B'), false);
  d.b.block(min.x - 0.06, min.y, min.z - 0.06, max.x + 0.06, min.y + 0.35, max.z + 0.06, STONE, deco);
  d.b.block(min.x - 0.08, max.y - 0.3, min.z - 0.08, max.x + 0.08, max.y - 0.06, max.z + 0.08, STONE, deco);
}

// ---------------------------------------------------------------- plataformas e spawns

function platform(d: Dress, s: MapSolid) {
  const b = s.box;
  cobbleSolid(d, b, cobbleTint(s.tint).lerp(new THREE.Color(PALETTE.paper), 0.25));
  const { min, max } = b;
  // Arremate de cantaria na borda de cima
  d.b.block(min.x - 0.04, max.y - 0.14, min.z - 0.04, max.x + 0.04, max.y - 0.02, max.z + 0.04, STONE, deco);
  if (s.tint === 'A' && min.y === 0 && max.y < 2) {
    // Palco do bloco afro: faixas coloridas na saia do palco
    const bands = [PALETTE.yellow, PALETTE.leaf, PALETTE.pink, PALETTE.ink];
    const bh = (max.y - 0.2) / bands.length;
    bands.forEach((c, i) => d.b.block(min.x - 0.03, i * bh, min.z - 0.03, max.x + 0.03, (i + 1) * bh, max.z + 0.03, c, deco));
  }
}

function spawnBlock(d: Dress, s: MapSolid) {
  const { min, max } = s.box;
  const color = s.tint === 'def' ? PALETTE.tank : PALETTE.wine;
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, color);
  d.b.block(min.x - 0.05, max.y - 0.25, min.z - 0.05, max.x + 0.05, max.y, max.z + 0.05, s.tint === 'def' ? PALETTE.paper : PALETTE.ink, deco);
  if (s.tint === 'def') {
    // Posto de controle da IA: filetes de neon ciano
    const y = max.y - 0.4;
    neonBox(d.ctx, min.x - 0.08, y, min.z - 0.08, max.x + 0.08, y + 0.07, min.z - 0.02, PALETTE.cyan);
    neonBox(d.ctx, min.x - 0.08, y, max.z + 0.02, max.x + 0.08, y + 0.07, max.z + 0.08, PALETTE.cyan);
  } else {
    // Barricada da Resistência: listras de alerta na base
    for (let x = min.x + 0.2; x < max.x - 0.4; x += 1.1) {
      d.b.block(x, 0.15, min.z - 0.03, x + 0.5, 0.65, max.z + 0.03, PALETTE.yellow, deco);
    }
  }
}

// ---------------------------------------------------------------- chafariz + holograma

function chafariz(d: Dress, b: Box) {
  const { min, max } = b;
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, PEDRA);
  const e = 0.08;
  d.b.block(min.x - e, 0, min.z - e, max.x + e, 0.4, max.z + e, STONE, deco);
  d.b.block(min.x - 0.12, max.y - 0.32, min.z - 0.12, max.x + 0.12, max.y, max.z + 0.12, STONE, { ...deco, cast: true });
  for (const x of [min.x, max.x - 0.45]) {
    for (const z of [min.z, max.z - 0.45]) d.b.block(x - 0.05, 0.4, z - 0.05, x + 0.5, max.y - 0.32, z + 0.5, STONE, deco);
  }
  // Almofadas de pedra nas quatro faces (planos rentes, dentro do TRIM): o bloco liso do
  // greybox passa a ler como pedestal de chafariz, com bacia marcada por um friso a 1 m
  const sides: [Face, number, number][] = [
    [{ axis: 'z', at: max.z, n: 1 }, min.x, max.x],
    [{ axis: 'z', at: min.z, n: -1 }, min.x, max.x],
    [{ axis: 'x', at: max.x, n: 1 }, min.z, max.z],
    [{ axis: 'x', at: min.x, n: -1 }, min.z, max.z],
  ];
  for (const [f, t0, t1] of sides) {
    faceSlab(d, f, t0, t1, 0.95, 1.12, 0, 0.1, STONE);
    const n = Math.max(1, Math.round((t1 - t0 - 1) / 2.6));
    const w = (t1 - t0 - 1) / n;
    for (let i = 0; i < n; i++) {
      const a = t0 + 0.5 + i * w + 0.25;
      faceSlab(d, f, a, a + w - 0.5, 1.4, max.y - 0.55, 0, 0.03, PALETTE.stoneJoint);
      faceSlab(d, f, a + 0.08, a + w - 0.58, 1.48, max.y - 0.63, 0.03, 0.05, PEDRA);
    }
  }
  // Bicas: carranca e fio de água (água "otimizada": brilha ciano)
  for (const x of [-4.3, 4.3]) {
    for (const [z, n] of [[max.z, 1], [min.z, -1]] as const) {
      const f: Face = { axis: 'z', at: z, n };
      // Tudo até 0.12 m da pedra: na altura do corpo, nada salta para fora da colisão
      faceSlab(d, f, x - 0.32, x + 0.32, 1.55, 2.15, 0, 0.08, STONE);
      faceSlab(d, f, x - 0.16, x + 0.16, 1.7, 2.0, 0.08, 0.12, PALETTE.concreteDark);
      const zz = z + n * 0.08;
      neonBox(d.ctx, x - 0.06, 0.42, Math.min(zz, zz + n * 0.04), x + 0.06, 1.7, Math.max(zz, zz + n * 0.04), PALETTE.cyan);
    }
  }
  // Bacia no alto, coluna e taça (só vista de longe; ninguém sobe aqui)
  const top = max.y;
  d.b.block(min.x + 0.3, top, min.z + 0.3, max.x - 0.3, top + 0.35, max.z - 0.3, STONE, { ...deco, cast: true });
  const water = new THREE.BoxGeometry(max.x - min.x - 1.0, 0.05, max.z - min.z - 1.0);
  water.translate((min.x + max.x) / 2, top + 0.33, (min.z + max.z) / 2);
  d.b.add(paint(water, PALETTE.cyan), d.ctx.neon, { cast: false, receive: false });
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  d.b.block(cx - 0.45, top, cz - 0.45, cx + 0.45, top + 1.4, cz + 0.45, STONE, { ...deco, cast: true });
  const bowl = new THREE.CylinderGeometry(1.0, 0.5, 0.4, 16);
  bowl.translate(cx, top + 1.6, cz);
  d.b.add(bowl, toon(STONE), { cast: true });
  hologram(d, cx, top + 4.2, cz);
}

/** Selo da IA flutuando sobre o chafariz: anel de neon e carinha sorrindo (gira devagar). */
function hologram(d: Dress, x: number, y: number, z: number) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const pink = new THREE.Color(PALETTE.pink).multiplyScalar(GLOW);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: pink }));
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = hex(PALETTE.pink);
  g.globalAlpha = 0.35;
  g.beginPath();
  g.arc(128, 128, 118, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = hex(PALETTE.yellow);
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(128, 136, 62, 0.25, Math.PI - 0.25);
  g.stroke();
  g.fillStyle = hex(PALETTE.yellow);
  for (const ex of [92, 164]) {
    g.beginPath();
    g.arc(ex, 100, 13, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = rgba(PALETTE.paper, 0.18);
  for (let yy = 0; yy < 256; yy += 8) g.fillRect(0, yy, 256, 3);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({ map: texture(c), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, color: new THREE.Color(1.6, 1.6, 1.6) }),
  );
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.9, 2.6, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.pink).multiplyScalar(0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  beam.position.y = -2.3;
  for (const m of [ring, face, beam]) {
    m.raycast = () => {};
    group.add(m);
  }
  d.ctx.scene.add(group);
  d.ctx.updaters.push((_dt, time) => {
    group.rotation.y = time * 0.5;
    ring.rotation.x = Math.PI / 2 + Math.sin(time * 0.8) * 0.25;
    face.position.y = Math.sin(time * 1.3) * 0.12;
  });
}
