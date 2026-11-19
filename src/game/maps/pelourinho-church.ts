import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE, toon } from '../toon';
import { place } from '../world/builder';
import { type Face, facePos, faceRot } from '../world/props';
import { grimeKit, wallDecal } from '../world/grime';
import { type Dress, faceArt, faceSlab, overhang } from './colonial';
import type { MapSolid } from './types';

// Igreja barroca do adro (site B), inspirada na do Rosário dos Pretos sem copiar: corpo
// azul-celeste, pilastras de arenito ocre, cimalhas caiadas, frontão de volutas e duas
// torres que sobem a ~31 m (marco de orientação visto de quase todo o mapa). A colisão é a
// dos dados (corpo de 14 m e torres até 18 m); campanário e coruchéu são decoração.

const STONE = PALETTE.cal;
const OCRE = PALETTE.cantaria;
const SKY = PALETTE.colonialSky;
const deco = { solid: false, cast: false, outline: 0 } as const;

// ---------------------------------------------------------------- igreja do adro

export function church(d: Dress, s: MapSolid) {
  const { min, max } = s.box;
  if (min.y > 0.1) return tower(d, s.box);
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, SKY);
  const H = max.y;
  // Fachada (face sul, para o adro) e lateral oeste
  const front: Face = { axis: 'z', at: max.z, n: 1 };
  const side: Face = { axis: 'x', at: min.x, n: -1 };
  const x0 = min.x;
  const x1 = max.x;
  const cx = (x0 + x1) / 2;
  for (const [a, c] of [[x0, x0 + 0.7], [x0 + 3.6, x0 + 4.3], [x1 - 4.3, x1 - 3.6], [x1 - 0.7, x1]]) faceSlab(d, front, a, c, 0, H, 0.03, 0.2, OCRE);
  faceSlab(d, front, x0, x1, 2, 2.4, 0.03, 0.12, STONE);
  faceSlab(d, front, x0 - 0.1, x1 + 0.1, 7.4, 7.9, 0, 0.26, STONE, true);
  faceSlab(d, front, x0 - 0.1, x1 + 0.1, H - 0.4, H, 0, 0.34, STONE, true);
  // Portada: porta grande de madeira, ombreiras e verga de pedra
  const door = d.kit.doors[0];
  faceArt(d, front, door, cx, 2, 0.1, 2.4, 4.6);
  faceSlab(d, front, cx - 1.6, cx - 1.25, 2, 6.6, 0.03, 0.2, OCRE);
  faceSlab(d, front, cx + 1.25, cx + 1.6, 2, 6.6, 0.03, 0.2, OCRE);
  faceSlab(d, front, cx - 1.8, cx + 1.8, 6.6, 6.9, 0.03, 0.3, OCRE, true);
  for (const t of [cx - 2.6, cx + 2.6]) faceArt(d, front, d.kit.glass, t, 3.6, 0.05, 0.9, 1.8);
  // Cinco vãos altos, alinhados ao ritmo de cantaria visto nas fotos do Rosário.
  for (const t of [x0 + 2.15, cx - 3.5, cx, cx + 3.5, x1 - 2.15]) {
    faceArt(d, front, d.kit.glass, t, H - 4.5, 0.05, 1.45, 3.3);
    faceSlab(d, front, t - 0.85, t + 0.85, H - 4.7, H - 4.5, 0.03, 0.12, OCRE);
  }
  for (const t of [x0 + 2.15, x1 - 2.15]) {
    faceArt(d, front, d.kit.shutters[1], t, 3.2, 0.05, 1.0, 2.0);
  }
  const zs0 = min.z;
  const zs1 = max.z;
  faceSlab(d, side, zs0, zs0 + 0.6, 0, H, 0.03, 0.18, OCRE);
  faceSlab(d, side, zs1 - 0.7, zs1, 0, H, 0.03, 0.18, OCRE);
  faceSlab(d, side, zs0, zs1, 7.4, 7.9, 0, 0.24, STONE, true);
  faceSlab(d, side, zs0, zs1, H - 0.4, H, 0, 0.3, STONE, true);
  for (const y of [3.4, 8.25]) faceArt(d, side, d.kit.shutters[1], (zs0 + zs1) / 2, y, 0.05, 1.0, 2.0);
  // Telhado da nave (atrás do frontão) e frontão barroco com óculo e cruz
  const roof = new THREE.Shape();
  const rw = x1 - x0 - 8.6;
  roof.moveTo(-rw / 2 - 0.4, 0);
  roof.lineTo(0, 2.6);
  roof.lineTo(rw / 2 + 0.4, 0);
  roof.closePath();
  const rg = new THREE.ExtrudeGeometry(roof, { depth: max.z - min.z - 0.6, bevelEnabled: false });
  place(rg, cx, H, min.z + 0.1);
  d.b.add(rg, toon(PALETTE.telha), { cast: true });
  const W = x1 - x0 - 8.2;
  const h = 3.8;
  const gable = (k: number) => {
    const sh = new THREE.Shape();
    const w = W * k;
    sh.moveTo(-w / 2, 0);
    sh.lineTo(-w / 2, h * 0.28 * k);
    sh.bezierCurveTo(-w * 0.5, h * 0.62 * k, -w * 0.22, h * 0.5 * k, -w * 0.18, h * 0.78 * k);
    sh.quadraticCurveTo(0, h * 1.12 * k, w * 0.18, h * 0.78 * k);
    sh.bezierCurveTo(w * 0.22, h * 0.5 * k, w * 0.5, h * 0.62 * k, w / 2, h * 0.28 * k);
    sh.lineTo(w / 2, 0);
    sh.closePath();
    return sh;
  };
  const back = new THREE.ExtrudeGeometry(gable(1), { depth: 0.36, bevelEnabled: false, curveSegments: 8 });
  place(back, cx, H, max.z - 0.02);
  d.b.add(back, toon(STONE), { cast: true });
  const plate = new THREE.ExtrudeGeometry(gable(0.86), { depth: 0.06, bevelEnabled: false, curveSegments: 8 });
  place(plate, cx, H, max.z + 0.34);
  d.b.add(plate, toon(SKY), { cast: false });
  const oy = H + h * 0.5;
  const oculo = new THREE.CircleGeometry(0.62, 20);
  place(oculo, cx, oy, max.z + 0.41);
  d.b.add(oculo, toon(PALETTE.glass), { cast: false });
  const rim = new THREE.TorusGeometry(0.7, 0.1, 6, 24);
  place(rim, cx, oy, max.z + 0.42);
  d.b.add(rim, toon(STONE), { cast: false });
  cross(d, cx, H + h * 1.0, max.z + 0.15);
  for (const t of [x0 + 0.35, x1 - 0.35, x0 + 3.95, x1 - 3.95]) pinnacle(d, t, H, max.z - 0.2);
  ornaments(d, front, x0, x1, H, W, h, oy);
}

/**
 * Barroco com mais relevo: capitéis e bases nas pilastras, volutas aos pés do frontão,
 * medalhão sobre a portada, molduras nas janelas do coro e as fitas do Bonfim amarradas
 * na portada e na mureta do adro (lembrança de Salvador, desenho próprio).
 */
function ornaments(d: Dress, front: Face, x0: number, x1: number, H: number, W: number, h: number, oy: number) {
  const cx = (x0 + x1) / 2;
  const z = front.at;
  for (const [a, c] of [[x0, x0 + 0.7], [x0 + 3.6, x0 + 4.3], [x1 - 4.3, x1 - 3.6], [x1 - 0.7, x1]]) {
    // Capitel em duas fiadas (sai mais em cima) e anel acima da cimalha do coro
    faceSlab(d, front, a - 0.08, c + 0.08, H - 1.0, H - 0.75, 0.2, 0.3, STONE, true);
    faceSlab(d, front, a - 0.14, c + 0.14, H - 0.75, H - 0.55, 0.2, 0.36, OCRE, true);
    faceSlab(d, front, a - 0.04, c + 0.04, 7.9, 8.3, 0.2, 0.28, OCRE);
  }
  // Volutas: espirais de cantaria nos pés do frontão
  for (const k of [-1, 1]) {
    const v = new THREE.TorusGeometry(0.42, 0.11, 6, 18, Math.PI * 1.6);
    v.rotateZ(k > 0 ? Math.PI * 0.9 : -Math.PI * 0.5);
    if (k > 0) v.rotateY(Math.PI); // espelha a voluta sem inverter o winding dos triângulos
    place(v, cx + k * (W / 2 + 0.25), H + 0.55, z + 0.3);
    d.b.add(v, toon(STONE), { cast: false });
    const curl = new THREE.SphereGeometry(0.16, 8, 6);
    place(curl, cx + k * (W / 2 + 0.25), H + 0.55, z + 0.3);
    d.b.add(curl, toon(OCRE), { cast: false });
  }
  // Medalhão com cruz sobre a portada e friso do frontão
  const m = new THREE.CircleGeometry(0.42, 18);
  place(m, cx, 7.15, z + 0.32);
  d.b.add(m, toon(OCRE), { cast: false });
  const mr = new THREE.TorusGeometry(0.45, 0.06, 4, 18);
  place(mr, cx, 7.15, z + 0.33);
  d.b.add(mr, toon(STONE), { cast: false });
  d.b.block(cx - 0.035, 6.95, z + 0.33, cx + 0.035, 7.35, z + 0.36, STONE, deco);
  d.b.block(cx - 0.15, 7.15, z + 0.33, cx + 0.15, 7.22, z + 0.36, STONE, deco);
  d.b.block(cx - W * 0.4, H + h * 0.28, z + 0.36, cx + W * 0.4, H + h * 0.28 + 0.12, z + 0.44, OCRE, deco);
  const halo = new THREE.TorusGeometry(0.86, 0.05, 4, 24);
  place(halo, cx, oy, z + 0.43);
  d.b.add(halo, toon(OCRE), { cast: false });
  // Molduras de cantaria nas janelas altas do coro
  for (const t of [x0 + 2.15, cx - 3.5, cx, cx + 3.5, x1 - 2.15]) {
    for (const k of [-1, 1]) faceSlab(d, front, t + k * 0.8 - 0.08, t + k * 0.8 + 0.08, H - 4.5, H - 1.4, 0.03, 0.14, STONE);
    faceSlab(d, front, t - 0.95, t + 0.95, H - 1.35, H - 1.15, 0.03, 0.22, STONE, true);
  }
  // Fitas do Bonfim: nas ombreiras da portada e na mureta do adro
  const k = grimeKit();
  for (const t of [cx - 1.42, cx + 1.42]) wallDecal(d.b, k.paint, front, k.ribbons, t, 3.2, 0.42, 1.5, 0.125);
  const mureta = d.map.solids.find((s) => s.kind === 'low' && s.tint === 'B' && s.box.min.y > 1.9 && s.box.max.z - s.box.min.z < 0.5);
  if (mureta) {
    const f: Face = { axis: 'z', at: mureta.box.max.z, n: 1 };
    for (let t = mureta.box.min.x + 0.3; t < mureta.box.max.x - 0.2; t += 0.62) wallDecal(d.b, k.paint, f, k.ribbons, t, mureta.box.min.y + 0.1, 0.5, 0.9, 0.012);
  }
}

function cross(d: Dress, x: number, y: number, z: number) {
  d.b.block(x - 0.11, y, z - 0.11, x + 0.11, y + 1.5, z + 0.11, STONE, { ...deco, cast: true });
  d.b.block(x - 0.5, y + 0.9, z - 0.1, x + 0.5, y + 1.1, z + 0.1, STONE, { ...deco, cast: true });
}

function pinnacle(d: Dress, x: number, y: number, z: number) {
  d.b.block(x - 0.3, y, z - 0.3, x + 0.3, y + 0.5, z + 0.3, STONE, { ...deco, cast: true });
  const g = new THREE.ConeGeometry(0.3, 1.1, 4);
  g.rotateY(Math.PI / 4);
  g.translate(x, y + 1.05, z);
  d.b.add(g, toon(STONE), { cast: true });
}

/**
 * Torre sineira: o sólido (14–18 m) é o andar de baixo, com óculo; por cima, só decoração,
 * o campanário e o coruchéu sobem até ~31 m, mantendo a igreja acima dos casarões.
 */
function tower(d: Dress, b: Box) {
  const { min, max } = b;
  d.b.block(min.x, min.y, min.z, max.x, max.y, max.z, SKY);
  const faces: Face[] = [
    { axis: 'z', at: max.z, n: 1 },
    { axis: 'x', at: min.x, n: -1 },
    { axis: 'x', at: max.x, n: 1 },
  ];
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  const w = max.x - min.x;
  const i = 0.2; // recuo do campanário
  const y0 = max.y;
  const y1 = y0 + 7;
  const upper = { min: { x: min.x + i, y: y0, z: min.z + i }, max: { x: max.x - i, y: y1, z: max.z - i } };
  overhang(d, upper);
  d.b.block(upper.min.x, y0, upper.min.z, upper.max.x, y1, upper.max.z, SKY, { ...deco, cast: true });
  for (const f of faces) {
    const [t0, t1] = f.axis === 'z' ? [min.x, max.x] : [min.z, max.z];
    // Andar de baixo (sólido): cunhais de arenito e óculo
    faceSlab(d, f, t0, t0 + 0.4, min.y, max.y, 0, 0.12, OCRE);
    faceSlab(d, f, t1 - 0.4, t1, min.y, max.y, 0, 0.12, OCRE);
    const o = facePos(f, (t0 + t1) / 2, min.y + 2.2, 0.03);
    const oc = new THREE.CircleGeometry(0.55, 16);
    d.b.add(place(oc, o.x, o.y, o.z, faceRot(f)), toon(PALETTE.ink), { cast: false });
    const rim = new THREE.TorusGeometry(0.62, 0.1, 4, 16);
    d.b.add(place(rim, o.x, o.y, o.z, faceRot(f)), toon(STONE), { cast: false });
    // Cornija entre os andares e campanário com o sino
    faceSlab(d, f, t0 - 0.1, t1 + 0.1, max.y - 0.3, max.y + 0.15, 0, 0.26, STONE, true);
    const uf: Face = { axis: f.axis, at: f.at - f.n * i, n: f.n };
    const [u0, u1] = [t0 + i, t1 - i];
    faceSlab(d, uf, u0, u0 + 0.4, y0, y1, 0, 0.12, OCRE);
    faceSlab(d, uf, u1 - 0.4, u1, y0, y1, 0, 0.12, OCRE);
    faceArt(d, uf, d.kit.belfry, (u0 + u1) / 2, y0 + 1.4, 0.03, 1.7, 3.0);
    faceSlab(d, uf, u0 - 0.15, u1 + 0.15, y1 - 0.4, y1, 0, 0.3, STONE, true);
  }
  // Ático e coruchéu (pirâmide caiada), pináculos nos cantos, bola e cruz
  const a = w / 2 - i - 0.25;
  d.b.block(cx - a, y1, cz - a, cx + a, y1 + 0.9, cz + a, STONE, { ...deco, cast: true });
  const cap = new THREE.ConeGeometry(a * Math.SQRT2, 3.6, 4);
  cap.rotateY(Math.PI / 4);
  cap.translate(cx, y1 + 0.9 + 1.8, cz);
  d.b.add(cap, toon(STONE), { cast: true });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) pinnacle(d, cx + sx * (w / 2 - i - 0.05), y1, cz + sz * (w / 2 - i - 0.05));
  const ball = new THREE.SphereGeometry(0.3, 10, 8);
  ball.translate(cx, y1 + 4.75, cz);
  d.b.add(ball, toon(PALETTE.ipeYellow), { cast: false });
  cross(d, cx, y1 + 4.95, cz);
}
