import * as THREE from 'three';
import { GLOW, PALETTE as C, toon } from '../toon';
import { type Builder, paint, place } from '../world/builder';
import { grimeKit, type GrimeKit, subUV, wallDecal, wallStrip } from '../world/grime';
import type { Face } from '../world/props';
import { box, rng } from '../world/shapes';
import { clearOfBody, exposedFaces, facePoint, floorAt } from './facades';
import { LAPA_ARCADE, LAPA_BUILDINGS, LAPA_STAIRS, LAPA_TERRACE } from './lapa';
import { floorGrime } from './pelourinho-grime';
import type { MapData } from './types';

// Lapa envelhecida: cantaria e manchas de umidade nos Arcos (pilares com fiadas de pedra,
// limo escorrendo das cimalhas, pé escuro), desgaste no casario (umidade, escorridos sob
// janelas e platibandas, quinas), sujeira e peças soltas no piso, a escadaria do Terraço do
// Choro com espelhos de cacos coloridos (homenagem ao estilo da Selarón, desenho próprio) e
// luminárias coloniais acesas nas fachadas. Tudo plano, colado e sem colisão.

const deco = { solid: false, shoot: false, cast: false, outline: 0 };

export function lapaGrime(b: Builder, map: MapData) {
  const k = grimeKit();
  arcade(b, k);
  buildings(b, map, k);
  selaron(b, k);
  lanterns(b, map);
  floorGrime(b, map, k, 7272, 0.9);
}

/** Pilares dos Arcos: fiadas de pedra, pé úmido e limo escorrendo de cada cimalha. */
function arcade(b: Builder, k: GrimeKit) {
  const a = LAPA_ARCADE;
  const r = rng(808);
  const Z = a.depth / 2;
  for (let i = 0; i <= a.bays; i++) {
    const x = a.start + i * a.pitch;
    for (const n of [-1, 1] as const) {
      const f: Face = { axis: 'z', at: n * Z, n };
      // Fiadas de cantaria: tiras de 1,3 m (uma arte por bloco de altura)
      for (let y = 0; y < a.top - 0.2; y += 1.3) wallDecal(b, k.mul, f, k.ashlar, x, y, 1.26, Math.min(1.3, a.top - 0.16 - y), 0.04);
      wallDecal(b, k.mul, f, k.base[i % 2], x, 0, 1.3, 1.5 + r() * 0.6, 0.045);
      for (const top of [a.tier, a.top]) wallDecal(b, k.mul, f, k.drips[Math.floor(r() * 3)], x + (r() - 0.5) * 0.3, top - 0.16 - 2.4, 0.9, 2.4, 0.05);
    }
    // Laterais dos pilares, vistas pelos vãos
    for (const s of [-1, 1] as const) {
      const f: Face = { axis: 'x', at: x + s * 0.65, n: s };
      if ((s < 0 && i === 0) || (s > 0 && i === a.bays)) continue;
      wallDecal(b, k.mul, f, k.base[(i + 1) % 2], 0, 0, a.depth, 1.4 + r() * 0.5, 0.02);
      wallDecal(b, k.mul, f, k.ashlar, 0, 0.2, a.depth, a.spring - 0.2, 0.025);
    }
  }
  // Faixa sobre o fecho de cada arco: sombra da cimalha e limo (só a parte maciça acima da volta)
  for (let i = 0; i < a.bays; i++) {
    const cx = a.start + (i + 0.5) * a.pitch;
    for (const n of [-1, 1] as const) {
      const f: Face = { axis: 'z', at: n * Z, n };
      for (let tier = 0; tier < 2; tier++) {
        const crown = tier * a.tier + a.spring + a.radius + 0.05;
        const top = tier * a.tier + a.tier - 0.16;
        wallDecal(b, k.mul, f, k.eave[(i + tier) % 2], cx, crown, a.pitch - 1.3, top - crown, 0.04);
      }
    }
  }
}

/** Casario e bilheterias: umidade, platibanda escorrendo, quinas e escorrido sob as janelas. */
function buildings(b: Builder, map: MapData, k: GrimeKit) {
  const r = rng(909);
  const solids = new Set(LAPA_BUILDINGS.filter((x) => x.name !== 'circo').map((x) => x.solid));
  const spans = exposedFaces(map, (s) => solids.has(s));
  spans.forEach((sp, i) => {
    if (sp.base > 0) return;
    const f: Face = { axis: sp.axis, at: sp.at, n: sp.n };
    // As fachadas de frente já têm molduras a 0,07–0,115 da parede: o desgaste vem por cima
    const off = 0.12;
    const p = facePoint(f, (sp.t0 + sp.t1) / 2, 0.6);
    const base = floorAt(map, p.x, p.z);
    wallStrip(b, k.mul, f, k.base, sp.t0, sp.t1, base, 0.9 + r() * 0.6, 3.2, i * 17 + 3, off);
    const eh = 1.2 + r() * 1.2;
    wallStrip(b, k.mul, f, k.eave, sp.t0, sp.t1, sp.top - eh, eh, 3.4, i * 17 + 4, off);
    if (r() < 0.6) wallDecal(b, k.mul, f, k.cracks[i % 2], sp.t0 + (sp.t1 - sp.t0) * (0.2 + r() * 0.6), base + 3.5 + r() * 2, 0.8, 0.8, off);
  });
  // Fundição: escorrido sob as janelas dos dois andares (mesmo ritmo de lapa-dress.ts)
  const fund = LAPA_BUILDINGS.find((x) => x.name === 'fundicao');
  if (fund) {
    const { min: p, max: q } = fund.solid.box;
    const bays = Math.round((q.x - p.x) / 4.7);
    const f: Face = { axis: 'z', at: q.z, n: 1 };
    for (let i = 0; i < bays; i++) {
      const cx = p.x + ((i + 0.5) * (q.x - p.x)) / bays;
      for (const y of [3.7, 6.5]) if (r() < 0.75) wallDecal(b, k.mul, f, k.drips[i % 3], cx + (r() - 0.5) * 0.6, y - 1.6, 1.3, 1.6, 0.12);
    }
  }
  // Escorrido sob as janelas do casario (mesmas posições de lapa-facades.ts)
  for (const building of LAPA_BUILDINGS) {
    if (building.name !== 'casario') continue;
    const { min: p, max: q } = building.solid.box;
    const count = Math.round((q.x - p.x) / 6);
    const span = (q.x - p.x) / count;
    const f: Face = { axis: 'z', at: p.z, n: -1 };
    for (let i = 0; i < count; i++) {
      const cx = p.x + (i + 0.5) * span;
      for (let y = 4.05; y + 1.8 < q.y; y += 2.9) for (const dx of [-span * 0.24, span * 0.24]) {
        if (r() > 0.6) continue;
        const h = 1 + r() * 1.2;
        wallDecal(b, k.mul, f, k.drips[Math.floor(r() * 3)], cx + dx, y - 0.2 - h, 1.1, h, 0.12);
      }
    }
  }
}

/** Espelhos dos degraus do Terraço do Choro e a mureta de trás em mosaico de cacos. */
function selaron(b: Builder, k: GrimeKit) {
  for (const s of LAPA_STAIRS) {
    const { min, max } = s.box;
    const alongX = Math.abs(max.z - min.z) > Math.abs(max.x - min.x);
    // Escada em x sobe para +x (espelho na face min.x); em z, para +z (face min.z)
    const f: Face = alongX ? { axis: 'x', at: min.x, n: -1 } : { axis: 'z', at: min.z, n: -1 };
    const [t0, t1] = alongX ? [min.z, max.z] : [min.x, max.x];
    const rise = Math.min(0.4, max.y);
    const tiles = Math.round(t1 - t0);
    for (let i = 0; i < tiles; i++) {
      const uv = subUV(k.selaron[(i + Math.round(max.y * 10)) % 2], 0, 1, 0.5, 0.5 + rise / 2);
      wallDecal(b, k.paint, f, uv, t0 + (t1 - t0) * (i + 0.5) / tiles, max.y - rise, (t1 - t0) / tiles, rise, 0.01);
    }
  }
  // Mureta do terraço (lado de dentro): painel de cacos sob o corrimão
  const f: Face = { axis: 'z', at: 38.4, n: -1 };
  for (let x = 16.5; x < 23.6; x += 1.4) wallDecal(b, k.paint, f, k.selaron[Math.round(x) % 2], x + 0.7, LAPA_TERRACE.box.max.y + 0.15, 1.36, 1.36, 0.01);
}

/** Luminária colonial de braço nas fachadas do casario, acima dos letreiros das lojas. */
function lanterns(b: Builder, map: MapData) {
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(GLOW, GLOW, GLOW) });
  const r = rng(1111);
  for (const building of LAPA_BUILDINGS) {
    if (building.name !== 'casario') continue;
    const { min: p, max: q } = building.solid.box;
    const count = Math.round((q.x - p.x) / 6);
    const span = (q.x - p.x) / count;
    for (let i = 0; i <= count; i++) {
      if (r() > 0.6) continue;
      const x = p.x + i * span + (i === 0 ? 0.6 : i === count ? -0.6 : 0);
      const z = p.z;
      const y = 3.75;
      const bounds = box(x - 0.2, y - 0.32, z - 0.62, x + 0.2, y + 0.42, z);
      if (!clearOfBody(map, bounds)) continue;
      // Braço de ferro com voluta, lanterna de quatro vidros acesos e chapéu
      b.block(x - 0.025, y + 0.32, z - 0.5, x + 0.025, y + 0.37, z, C.ink, deco);
      b.block(x - 0.02, y + 0.05, z - 0.06, x + 0.02, y + 0.37, z - 0.02, C.ink, deco);
      const lamp = new THREE.BoxGeometry(0.2, 0.3, 0.2);
      lamp.translate(x, y + 0.02, z - 0.42);
      b.add(paint(lamp, C.ipeYellow), glow, { cast: false, receive: false });
      for (const dy of [-0.15, 0.17]) b.block(x - 0.13, y + dy, z - 0.55, x + 0.13, y + dy + 0.04, z - 0.29, C.ink, deco);
      const cap = new THREE.ConeGeometry(0.2, 0.18, 4);
      cap.rotateY(Math.PI / 4);
      b.add(place(cap, x, y + 0.3, z - 0.42), toon(C.ink), { cast: false });
    }
  }
}
