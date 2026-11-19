// Planta baixa (vista de cima) de um mapa em SVG, gerada dos dados: para o dono e para revisão.
// Regerar: `npx vitest run src/game/maps -u` (o teste compara com docs/maps/<id>.svg).
import { hex, PALETTE } from '../toon';
import { FLOOR, KIND, solidColor } from './colors';
import type { MapData, MapSolid } from './types';

const PX = 8; // pixels por metro
const PAD = 24;
const LEGEND = 150;

const r1 = (n: number) => Math.round(n * 10) / 10;

export function mapToSvg(map: MapData): string {
  const { x0, z0, x1, z1 } = map.bounds;
  const w = (x1 - x0) * PX + PAD * 2;
  const h = (z1 - z0) * PX + PAD * 2 + LEGEND;
  const X = (x: number) => r1((x - x0) * PX + PAD);
  const Z = (z: number) => r1((z - z0) * PX + PAD);
  const out: string[] = [];
  const rect = (ax: number, az: number, bx: number, bz: number, fill: number, extra = '') =>
    out.push(`<rect x="${X(ax)}" y="${Z(az)}" width="${r1((bx - ax) * PX)}" height="${r1((bz - az) * PX)}" fill="${hex(fill)}"${extra}/>`);
  const text = (x: number, y: number, s: string, size: number, fill: number, extra = '') =>
    out.push(`<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" fill="${hex(fill)}" text-anchor="middle" dominant-baseline="central"${extra}>${s}</text>`);

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Arial Black, Arial, sans-serif" font-weight="900">`);
  out.push(`<rect width="${w}" height="${h}" fill="${hex(PALETTE.ink)}"/>`);
  rect(x0, z0, x1, z1, PALETTE.asphalt);

  // Pisos das zonas
  for (const z of map.zones) rect(z.rect.x0, z.rect.z0, z.rect.x1, z.rect.z1, FLOOR[z.tint], ' fill-opacity="0.55"');

  // Grade de 10 m
  for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) {
    out.push(`<line x1="${X(x)}" y1="${Z(z0)}" x2="${X(x)}" y2="${Z(z1)}" stroke="${hex(PALETTE.ink)}" stroke-opacity="0.18"/>`);
  }
  for (let z = Math.ceil(z0 / 10) * 10; z <= z1; z += 10) {
    out.push(`<line x1="${X(x0)}" y1="${Z(z)}" x2="${X(x1)}" y2="${Z(z)}" stroke="${hex(PALETTE.ink)}" stroke-opacity="0.18"/>`);
  }

  // Sólidos, do mais baixo para o mais alto (o que fica por cima aparece)
  const drawn = map.solids.filter((s) => s.kind !== 'ground' && s.kind !== 'bound');
  drawn.sort((a, b) => a.box.max.y - b.box.max.y);
  for (const s of drawn) {
    const b = s.box;
    rect(b.min.x, b.min.z, b.max.x, b.max.z, solidColor(s), ` stroke="${hex(PALETTE.ink)}" stroke-width="1"`);
  }
  // Altura das plataformas e coberturas altas
  for (const s of drawn.filter((s: MapSolid) => s.kind === 'platform' || s.kind === 'terrace' || (s.kind === 'tall' && s.box.max.y > 2.5))) {
    const b = s.box;
    // Terraço é largo: a altura vai no canto oeste para não cair em cima do que está no meio
    const tx = s.kind === 'terrace' ? Math.min(b.min.x + 3, (b.min.x + b.max.x) / 2) : (b.min.x + b.max.x) / 2;
    text(X(tx), Z(b.max.z) - 7, `${r1(b.max.y)} m`, 10, PALETTE.ink);
  }

  // Nomes das zonas (a letra do site vai onde está pintada no chão; times longe dos spawns)
  const halo = ` stroke="${hex(PALETTE.ink)}" stroke-width="3" paint-order="stroke"`;
  for (const z of map.zones) {
    let cx = X((z.rect.x0 + z.rect.x1) / 2);
    let cz = Z((z.rect.z0 + z.rect.z1) / 2);
    if (z.site) {
      const [letter, ...rest] = z.name.replace('SITE ', '').split(' ');
      const floor = map.labels.find((l) => l.axis === 'floor' && l.text === letter);
      if (floor) [cx, cz] = [X(floor.at.x), Z(floor.at.z)];
      text(cx, cz, letter, 64, PALETTE.ink, ' fill-opacity="0.45"');
      if (rest.length > 0) text(cx, cz + 40, rest.join(' '), 12, PALETTE.paper, halo);
      continue;
    }
    if (z.id === 'def') cz = Z(z.rect.z1) - 12;
    if (z.id === 'atk') cz = Z(z.rect.z0) + 12;
    text(cx, cz, z.name, 12, PALETTE.paper, halo);
  }

  // Spawns
  const dot = (x: number, z: number, fill: number, label: string, r = 7) => {
    out.push(`<circle cx="${X(x)}" cy="${Z(z)}" r="${r}" fill="${hex(fill)}" stroke="${hex(PALETTE.paper)}" stroke-width="2"/>`);
    text(X(x), Z(z), label, 9, PALETTE.paper);
  };
  for (const p of map.spawns.attack) dot(p.x, p.z, PALETTE.wine, 'T');
  for (const p of map.spawns.defend) dot(p.x, p.z, PALETTE.tank, 'D');
  map.spawns.ffa.forEach((p, i) => dot(p.x, p.z, PALETTE.ink, String(i + 1)));
  for (const [x, , z] of map.droneSpawns) {
    out.push(`<path d="M${X(x)} ${Z(z) - 7} L${X(x) + 6} ${Z(z) + 5} L${X(x) - 6} ${Z(z) + 5} Z" fill="${hex(PALETTE.magenta)}" stroke="${hex(PALETTE.ink)}"/>`);
  }

  // Legenda
  const ly = Z(z1) + 22;
  text(w / 2, ly, `${map.name} — ${x1 - x0} x ${z1 - z0} m (grade de 10 m) · norte = defesa, sul = ataque · "0.4 m" = altura do piso (terraços)`, 13, PALETTE.paper);
  const items: [number, string][] = [
    [KIND.wall, `casarões (até ${map.wallHeight} m)`], [KIND.tall, 'cobertura alta (2–3 m)'], [KIND.low, 'cobertura baixa (1 m)'],
    [KIND.platform, 'plataforma / sacada'], [KIND.stairs, 'escada (degrau 0.4)'],
  ];
  items.forEach(([c, s], i) => {
    const lx = PAD + i * ((w - PAD * 2) / items.length);
    out.push(`<rect x="${r1(lx)}" y="${ly + 22}" width="16" height="16" fill="${hex(c)}" stroke="${hex(PALETTE.paper)}"/>`);
    out.push(`<text x="${r1(lx + 22)}" y="${ly + 35}" font-size="12" fill="${hex(PALETTE.paper)}">${s}</text>`);
  });
  const spawnItems: [number, string][] = [
    [PALETTE.wine, 'T = spawn do ataque (5)'], [PALETTE.tank, 'D = spawn da defesa (5)'],
    [PALETTE.ink, `1–${map.spawns.ffa.length} = spawns de FFA`], [PALETTE.magenta, 'triângulo = spawn de drone (no alto)'],
  ];
  spawnItems.forEach(([c, s], i) => {
    const lx = PAD + i * ((w - PAD * 2) / spawnItems.length);
    out.push(`<circle cx="${r1(lx + 8)}" cy="${ly + 68}" r="7" fill="${hex(c)}" stroke="${hex(PALETTE.paper)}" stroke-width="2"/>`);
    out.push(`<text x="${r1(lx + 22)}" y="${ly + 72}" font-size="12" fill="${hex(PALETTE.paper)}">${s}</text>`);
  });
  // Barra de escala de 10 m
  out.push(`<line x1="${PAD}" y1="${ly + 105}" x2="${PAD + 10 * PX}" y2="${ly + 105}" stroke="${hex(PALETTE.paper)}" stroke-width="3"/>`);
  out.push(`<text x="${PAD + 10 * PX + 8}" y="${ly + 109}" font-size="12" fill="${hex(PALETTE.paper)}">10 m</text>`);
  out.push('</svg>');
  // Uma linha só, sem quebra: o git com autocrlf não troca \n por \r\n e o teste não quebra
  return out.join('');
}
