import * as THREE from 'three';
import { hex, PALETTE } from '../toon';
import type { World } from '../world/bairro';
import { Builder, place } from '../world/builder';
import { buildSky } from '../world/sky';
import { Atlas, fit, planeGeo, type UVRect } from '../world/textures';
import { ARENA1 } from './arena1';
import { LAPA } from './lapa';
import { FAVELA } from './favela';
import { PATACHO } from './patacho';
import { dressPatacho, patachoLight } from './patacho-dress';
import { dressFavela } from './favela-dress';
import { dressLapa, lapaLight } from './lapa-dress';
import { CORCOVADO } from './lapa-landmarks';
import type { Dress } from './colonial';
import { FLOOR, solidColor } from './colors';
import { createDress, dressDetails, dressFacades, reserveTeloes } from './pelourinho-dress';
import { cobbleSolid, cobbleTint, dressSolid } from './pelourinho-landmarks';
import { pelourinhoLight } from './pelourinho-scenery';
import type { MapData, MapLabel, Tint } from './types';
import { mapShotBlockers, mapSolids } from './types';

// Monta um mapa competitivo (dados de `maps/*.ts`) em malhas. Pelourinho e Lapa têm arte
// própria (pelourinho-*.ts / lapa-dress.ts); `?greybox` mostra os
// blocos lisos de antes. Nos dois: piso colorido por zona, faixa da cor da zona no pé das
// paredes e letreiros A/B/MEIO. A colisão é a mesma (as caixas de `map.solids`).

/** Mapas por id da URL (`?map=`). `pelourinho` é o nome temático do arena1. */
export const MAPS: Record<string, MapData> = { arena1: ARENA1, pelourinho: ARENA1, lapa: LAPA, favela: FAVELA, patacho: PATACHO };

const PLAYER_CENTER = 0.86; // pés -> centro do jogador
const BAND = 1.2; // altura da faixa colorida no pé das paredes
const DARK = new Set<Tint>(['def', 'atk', 'routeB', 'neutral']);

const greybox = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('greybox');

export function buildMap(scene: THREE.Scene, map: MapData): World {
  const b = new Builder(scene);
  const patacho = map.id === 'patacho';
  const lapa = map.id === 'lapa';
  // Céu limpo atrás do Cristo: contra os cúmulos claros a estátua sumia.
  const clear = patacho ? [-.6,-.3,0,.3,.6] : lapa && !greybox() ? [Math.atan2(CORCOVADO.z, CORCOVADO.x)] : [];
  const sky = buildSky(scene, b, patacho || map.id === 'arena1' || lapa || map.id === 'favela', clear, patacho);
  const favela = map.id === 'favela';
  const d = greybox() || patacho || lapa || favela ? null : createDress(scene, b, map);
  if (d) pelourinhoLight(scene);
  if (patacho && !greybox()) patachoLight(scene);
  else if ((lapa || favela) && !greybox()) lapaLight(scene);

  let details: ((dt: number, time: number) => void) | null = null;
  if (patacho) details = dressPatacho(scene, b, map, !greybox());
  else if (favela) dressFavela(b, map, !greybox());
  else if (lapa) dressLapa(b, map, !greybox());
  else {
    for (const s of map.solids) {
      const { min, max } = s.box;
      if (s.kind === 'bound') {
        b.invisible(min.x, min.y, min.z, max.x, max.y, max.z);
        continue;
      }
      if (d && dressSolid(d, s)) continue;
      if (d && s.kind === 'ground') {
        cobbleSolid(d, s.box, cobbleTint('neutral'));
        continue;
      }
      const flat = s.kind === 'ground' || s.kind === 'stairs' || s.kind === 'terrace';
      // Vestido: a parede é o telhado visto de cima; as faces ganham fachada de casarão
      const color = d && (s.kind === 'wall' || s.kind === 'edge') ? PALETTE.telha : solidColor(s);
      b.block(min.x, min.y, min.z, max.x, max.y, max.z, color, { cast: !flat, outline: flat ? 0 : 0.05 });
    }
    zoneFloors(b, map, d);
    wallBands(b, map, !!d);
  }
  if (d) {
    reserveTeloes(d);
    dressFacades(d);
    details = dressDetails(d);
  }
  if (!patacho || greybox()) labels(b, map.labels);
  b.finish();

  const p = map.playerSpawn;
  return {
    solids: mapSolids(map),
    shotBlockers: mapShotBlockers(map),
    impactSurfaces: b.impactSurfaces,
    shootables: b.shootables,
    playerSpawn: { x: p.x, y: p.y + PLAYER_CENTER, z: p.z },
    droneSpawns: map.droneSpawns,
    update(dt, time) {
      sky(dt, time);
      details?.(dt, time);
    },
  };
}

/** Piso de cada zona pintado por cima do chão (só visual); vestido, vira calçamento tingido. */
function zoneFloors(b: Builder, map: MapData, d: Dress | null) {
  for (const z of map.zones) {
    const { x0, z0, x1, z1 } = z.rect;
    if (d) cobbleSolid(d, { min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: 0.02, z: z1 } }, cobbleTint(z.tint), false);
    else b.block(x0, 0, z0, x1, 0.02, z1, FLOOR[z.tint], { solid: false, cast: false, outline: 0 });
  }
}

/**
 * Faixa da cor da zona no pé de cada parede que dá para ela: quem olha sabe onde está.
 * Vestido, vira o barrado pintado do casarão, com um filete de cantaria em cima.
 */
function wallBands(b: Builder, map: MapData, dressed: boolean) {
  const T = 0.04;
  const opts = { solid: false, cast: false, outline: 0 };
  const band = (x0: number, z0: number, x1: number, z1: number, color: number) => {
    b.block(x0, 0, z0, x1, BAND, z1, color, opts);
    if (!dressed) return;
    // Filete: 2 cm além da faixa (as faces da faixa ficam a T da parede)
    const grow = (a: number, c: number) => (c - a < T + 1e-6 ? [a - 0.02, c + 0.02] : [a, c]);
    const [gx0, gx1] = grow(x0, x1);
    const [gz0, gz1] = grow(z0, z1);
    b.block(gx0, BAND, gz0, gx1, BAND + 0.1, gz1, PALETTE.paper, opts);
  };
  for (const s of map.solids) {
    if (s.kind !== 'wall' && s.kind !== 'edge') continue;
    const w = s.box;
    for (const z of map.zones) {
      const r = z.rect;
      // Vestido: barrado no tom da zona, puxado um pouco para a pedra (menos lilás chapado)
      const color = dressed ? new THREE.Color(FLOOR[z.tint]).lerp(new THREE.Color(PALETTE.cobbleStone), 0.3).getHex() : FLOOR[z.tint];
      // Faces leste/oeste (normal em x) e norte/sul (normal em z)
      const zA = Math.max(w.min.z, r.z0);
      const zB = Math.min(w.max.z, r.z1);
      if (zB - zA > 0.1) {
        if (w.max.x >= r.x0 && w.max.x < r.x1) band(w.max.x, zA, w.max.x + T, zB, color);
        if (w.min.x > r.x0 && w.min.x <= r.x1) band(w.min.x - T, zA, w.min.x, zB, color);
      }
      const xA = Math.max(w.min.x, r.x0);
      const xB = Math.min(w.max.x, r.x1);
      if (xB - xA > 0.1) {
        if (w.max.z >= r.z0 && w.max.z < r.z1) band(xA, w.max.z, xB, w.max.z + T, color);
        if (w.min.z > r.z0 && w.min.z <= r.z1) band(xA, w.min.z - T, xB, w.min.z, color);
      }
    }
  }
}

/** Letreiros num atlas próprio do mapa (não disputa espaço com os atlas do bairro). */
function labels(b: Builder, list: MapLabel[]) {
  if (list.length === 0) return;
  const atlas = new Atlas(1024, false);
  const arts = new Map<string, { uv: UVRect; aspect: number }>();
  for (const l of list) {
    const key = `${l.text}|${l.tint}`;
    if (arts.has(key)) continue;
    const w = l.text.length <= 1 ? 256 : 512;
    const h = l.text.length <= 1 ? 256 : 160;
    const bg = FLOOR[l.tint];
    const fg = DARK.has(l.tint) ? PALETTE.paper : PALETTE.ink;
    const uv = atlas.draw(w, h, (g, cw, ch) => {
      g.fillStyle = hex(PALETTE.ink);
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = hex(bg);
      g.fillRect(10, 10, cw - 20, ch - 20);
      fit(g, l.text, ch * 0.72, cw - 48);
      g.fillStyle = hex(fg);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(l.text, cw / 2, ch / 2 + ch * 0.04);
    });
    arts.set(key, { uv, aspect: h / w });
  }
  const mat = new THREE.MeshBasicMaterial({ map: atlas.texture });
  console.info(`mapa: atlas letreiros ${atlas.used}`);
  for (const l of list) {
    const art = arts.get(`${l.text}|${l.tint}`)!;
    const geo = planeGeo(l.width, l.width * art.aspect, art.uv);
    const { x, y, z } = l.at;
    if (l.axis === 'floor') place(geo, x, y, z, 0, -Math.PI / 2);
    else if (l.axis === 'z') place(geo, x, y, z + l.n * 0.06, l.n === 1 ? 0 : Math.PI);
    else place(geo, x + l.n * 0.06, y, z, l.n === 1 ? Math.PI / 2 : -Math.PI / 2);
    b.add(geo, mat, { cast: false, receive: false });
  }
}
