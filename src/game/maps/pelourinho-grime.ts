import type { Builder } from '../world/builder';
import { type Face, faceRot } from '../world/props';
import { rng } from '../world/shapes';
import { floorDecal, grimeKit, type GrimeKit, wallDecal, wallStrip } from '../world/grime';
import { type Dress, isReserved } from './colonial';
import { coverAt, exposedFaces, facePoint, floorAt } from './facades';
import type { MapData, MapSolid } from './types';

// Terceira passada do Pelourinho: a cidade envelhecida. Umidade e musgo no pé das paredes,
// sujeira escorrendo das cornijas e dos peitoris, quinas lascadas, fissuras, reboco caído
// mostrando tijolo; no chão, sujeira acumulada junto às paredes e coberturas, bueiros,
// ralos, poças rasas e folhas. Tudo plano e colado (sem colisão nem tiro).

/** Sólidos onde o piso tem os microdegraus da ladeira (decalque de chão não assenta). */
const ramp = (s: MapSolid) => s.kind === 'terrace' && s.box.max.z - s.box.min.z <= 1.001;
const inside = (s: MapSolid, x: number, z: number, m = 0) =>
  x > s.box.min.x - m && x < s.box.max.x + m && z > s.box.min.z - m && z < s.box.max.z + m;

export function dressGrime(d: Dress) {
  const k = grimeKit();
  walls(d, k);
  church(d, k);
  floorGrime(d.b, d.map, k, 5151);
  console.info(`mapa: atlas ${k.used}`);
}

function walls(d: Dress, k: GrimeKit) {
  const { b, map } = d;
  const r = rng(3131);
  d.lots.forEach((l, i) => {
    const f = l.face;
    const mid = (l.t0 + l.t1) / 2;
    const p = facePoint(f, mid, 0.6);
    const base = floorAt(map, p.x, p.z);
    const W = l.t1 - l.t0;
    if (W < 1) return;
    // Pé da parede: umidade sobe mais nas casas velhas
    wallStrip(b, k.mul, f, k.base, l.t0, l.t1, base, 1 + r() * 0.7, 3.2, i * 13 + 1);
    // Sob a cornija do topo: sombra pintada e fios de sujeira
    const eh = 1.4 + r() * 1.6;
    wallStrip(b, k.mul, f, k.eave, l.t0, l.t1, l.top - 0.32 - eh, eh, 3.6, i * 13 + 2);
    // Quinas dos cunhais (face do cunhal fica a 0,1 da parede)
    if (r() < 0.7) {
      // A arte tem a aresta à esquerda; espelha conforme o lado do lote e o giro da face
      const plus = f.axis === 'z' ? f.n === 1 : f.n === -1;
      const flip = { ...k.corner, u0: k.corner.u1, u1: k.corner.u0 };
      wallDecal(b, k.mul, f, plus ? k.corner : flip, l.t0 + 0.12, base, 0.22, 1.8 + r() * 1.2, 0.115);
      wallDecal(b, k.mul, f, plus ? flip : k.corner, l.t1 - 0.12, base, 0.22, 1.8 + r() * 1.2, 0.115);
    }
    // Fissuras e reboco caído, fora de letreiro e de janela
    const free = (t: number, y: number, w: number, h: number) =>
      !isReserved(d, f, t - w / 2, t + w / 2, y, y + h) &&
      !d.sills.some((s) => s.face.axis === f.axis && Math.abs(s.face.at - f.at) < 0.01 && s.face.n === f.n &&
        Math.abs(s.t - t) < (s.w + w) / 2 + 0.15 && y < s.y + 2.7 && y + h > s.y - 0.3);
    for (let c = 0; c < (W > 5 ? 2 : 1); c++) {
      if (r() > 0.55) continue;
      const t = l.t0 + 0.6 + r() * (W - 1.2);
      const y = base + 1.4 + r() * Math.max(0.2, l.top - base - 3.6);
      if (free(t, y, 0.9, 0.9)) wallDecal(b, k.mul, f, k.cracks[Math.floor(r() * 2)], t, y, 0.9, 0.9);
    }
    if (r() < 0.45 && W > 2.5) {
      const w = 1 + r() * 0.8;
      const h = w * 0.75;
      const t = l.t0 + 0.5 + w / 2 + r() * (W - 1 - w);
      const y = r() < 0.5 ? base + 0.25 + r() * 0.5 : base + 2.2 + r() * Math.max(0.2, l.top - base - 4.5);
      // Tijolo à mostra: na frente do reboco (0,03), do desgaste (até 0,045) e da sujeira
      if (free(t, y, w, h)) wallDecal(b, k.paint, f, k.brick[Math.floor(r() * 3)], t, y, w, h, 0.062);
    }
  });
  // Escorrido sob as janelas e sob as sacadas
  for (const s of d.sills) {
    if (r() > 0.65) continue;
    const h = 1.1 + r() * 1.3;
    wallDecal(b, k.mul, s.face, k.drips[Math.floor(r() * 3)], s.t + (r() - 0.5) * 0.2, s.y - h - 0.1, s.w * (0.6 + r() * 0.3), h);
  }
  for (const bal of d.balconies) {
    const y = bal.y - 0.44;
    for (let t = bal.t0 + 0.4; t < bal.t1 - 0.3; t += 0.9 + r() * 0.8) {
      const h = 1.2 + r() * 1.4;
      wallDecal(b, k.mul, bal.face, k.drips[Math.floor(r() * 3)], t, y - h, 0.5 + r() * 0.3, h);
    }
  }
}

/** A igreja também envelhece: pé da fachada e lateral, e a cimalha escorrendo. */
function church(d: Dress, k: GrimeKit) {
  const s = d.map.solids.find((x) => x.kind === 'wall' && x.tint === 'B' && x.box.min.y < 0.1);
  if (!s) return;
  const { min, max } = s.box;
  const front: Face = { axis: 'z', at: max.z, n: 1 };
  const side: Face = { axis: 'x', at: min.x, n: -1 };
  // Fachada: o adro (2 m) cobre quase tudo; o canto oeste fica no chão da rua
  wallStrip(d.b, k.mul, front, k.base, min.x + 2.2, max.x, 2, 1.1, 3, 77, 0.21);
  wallStrip(d.b, k.mul, front, k.eave, min.x, max.x, 7.4 - 1.6, 1.6, 3.6, 78, 0.21);
  wallStrip(d.b, k.mul, side, k.base, min.z, max.z, 0, 1.6, 3, 79, 0.19);
  wallStrip(d.b, k.mul, side, k.eave, min.z, max.z, 7.4 - 2, 2, 3.6, 80, 0.19);
}

// ---------------------------------------------------------------- piso

/** Sujeira no pé das paredes e peças soltas no piso livre (também usado na Lapa). */
export function floorGrime(b: Builder, map: MapData, k: GrimeKit, seed: number, density = 1) {
  const ramps = map.solids.filter(ramp);
  const covers = map.solids.filter((s) => s.kind === 'low' || s.kind === 'tall' || s.kind === 'stairs');
  const onRamp = (x: number, z: number) => ramps.some((s) => inside(s, x, z, 0.4));
  const r = rng(seed);
  // Sujeira no canto entre o piso e a parede (todas as paredes e coberturas que tocam o chão)
  const spans = exposedFaces(map, (s) => (s.kind === 'wall' || s.kind === 'edge' || s.kind === 'low' || s.kind === 'tall') && s.box.min.y < 0.1);
  for (const sp of spans) {
    if (sp.base > 0) continue;
    const f: Face = { axis: sp.axis, at: sp.at, n: sp.n };
    const D = sp.solid.kind === 'low' || sp.solid.kind === 'tall' ? 0.45 : 0.75;
    let start = sp.t0;
    let cur: number | null = null;
    const flush = (end: number) => {
      if (cur === null || end - start < 0.3) return;
      const c = facePoint(f, (start + end) / 2, D / 2);
      // Decalque deitado: com o giro da face, a borda "de cima" da arte fica colada na parede
      floorDecal(b, k.mul, k.curb, c.x, cur + 0.03, c.z, end - start, D, faceRot(f));
    };
    for (let t = sp.t0; t < sp.t1 - 1e-6; t += 0.5) {
      const m = Math.min(t + 0.25, sp.t1);
      const p = facePoint(f, m, 0.3);
      const y = onRamp(p.x, p.z) || covers.some((s) => s !== sp.solid && inside(s, p.x, p.z)) ? null : floorAt(map, p.x, p.z);
      if (y !== cur) {
        flush(t);
        start = t;
        cur = y;
      }
    }
    flush(sp.t1);
  }
  // Peças soltas no chão: só em piso livre, fora de degrau, cobertura e ladeira
  const { x0, z0, x1, z1 } = map.bounds;
  const free = (x: number, z: number, m: number) => {
    if (onRamp(x, z)) return null;
    for (const [dx, dz] of [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]]) if (coverAt(map, x + dx, z + dz) !== 0) return null;
    if (covers.some((s) => inside(s, x, z, m))) return null;
    const y = floorAt(map, x, z);
    for (const [dx, dz] of [[m, 0], [-m, 0], [0, m], [0, -m]]) if (Math.abs(floorAt(map, x + dx, z + dz) - y) > 0.01) return null;
    return y;
  };
  const scatter = (n: number, m: number, put: (x: number, y: number, z: number) => void) => {
    for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
      const x = x0 + 1 + r() * (x1 - x0 - 2);
      const z = z0 + 1 + r() * (z1 - z0 - 2);
      const y = free(x, z, m);
      if (y === null) continue;
      put(x, y, z);
      i++;
    }
  };
  scatter(Math.round(14 * density), 0.8, (x, y, z) => floorDecal(b, k.paint, k.manhole, x, y + 0.035, z, 0.9, 0.9, r() * Math.PI));
  scatter(Math.round(18 * density), 1.1, (x, y, z) => floorDecal(b, k.paint, k.puddles[Math.floor(r() * 2)], x, y + 0.033, z, 1.2 + r() * 1.1, 0.6 + r() * 0.5, r() * Math.PI));
  scatter(Math.round(40 * density), 1, (x, y, z) => floorDecal(b, k.mul, k.stains[Math.floor(r() * 2)], x, y + 0.031, z, 1.2 + r() * 1.6, 1 + r() * 1.2, r() * Math.PI));
  scatter(Math.round(30 * density), 0.5, (x, y, z) => floorDecal(b, k.paint, k.leaves, x, y + 0.034, z, 0.8 + r() * 0.5, 0.8 + r() * 0.5, r() * Math.PI));
  // Ralo junto à parede: grelha ao longo da face, a 0,25 m dela
  for (const sp of spans) {
    if (sp.base > 0 || sp.solid.kind !== 'wall' || sp.t1 - sp.t0 < 6 || r() > 0.45) continue;
    const f: Face = { axis: sp.axis, at: sp.at, n: sp.n };
    const t = sp.t0 + 1 + r() * (sp.t1 - sp.t0 - 2);
    const c = facePoint(f, t, 0.3);
    const y = free(c.x + (f.axis === 'x' ? f.n * 0.4 : 0), c.z + (f.axis === 'z' ? f.n * 0.4 : 0), 0.35);
    if (y === null || Math.abs(floorAt(map, c.x, c.z) - y) > 0.01) continue;
    floorDecal(b, k.paint, k.grate, c.x, y + 0.035, c.z, 0.9, 0.45, f.axis === 'z' ? 0 : Math.PI / 2);
  }
}
