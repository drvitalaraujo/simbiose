import * as THREE from 'three';
import { PALETTE, toon } from '../toon';
import { place } from '../world/builder';
import { grimeKit, wallDecal } from '../world/grime';
import { type Face, facePos, faceRot } from '../world/props';
import { rng } from '../world/shapes';
import { type Dress, faceBoxOf, faceSlab, isReserved, overhang, TRIM } from './colonial';
import { acrossStreet, floorAt, facePoint } from './facades';

// Relevo e vida no casario do Pelourinho: molduras com sobreverga nas janelas, pilastras nos
// lotes largos, calhas e tubos de descida, aparelhos de ar com o escorrido embaixo, vasos
// nos peitoris, antenas e parabólicas nos telhados e bandeirolas de festa cruzando as ruas.
// Sorteio próprio (não mexe na sequência que escolhe cores e janelas das fachadas).
// Tudo é decoração: o que sai mais que TRIM da parede passa por `overhang` (alcance do corpo).

const deco = { solid: false, cast: false, outline: 0 } as const;
const STONE = PALETTE.cal;
const WIN_H = 2.3;

export function dressOrnament(d: Dress) {
  const r = rng(6262);
  frames(d, r);
  pilasters(d, r);
  downpipes(d, r);
  airCon(d, r);
  sillPots(d, r);
  antennas(d, r);
  bunting(d, r);
}

const sameFace = (a: Face, b: Face) => a.axis === b.axis && a.n === b.n && Math.abs(a.at - b.at) < 0.01;

/** Ombreiras e sobreverga em volta das janelas de cima: o vão ganha espessura de cantaria. */
function frames(d: Dress, r: () => number) {
  for (const s of d.sills) {
    const { face: f, t, y, w } = s;
    if (isReserved(d, f, t - w / 2 - 0.3, t + w / 2 + 0.3, y, y + WIN_H + 0.4)) continue;
    for (const k of [-1, 1]) faceSlab(d, f, t + k * (w / 2 + 0.02) - 0.09, t + k * (w / 2 + 0.02) + 0.09, y - 0.02, y + WIN_H, 0.03, 0.09, STONE);
    // Sobreverga: cimalha curta acima do vão (sai 0,2 só onde o corpo não alcança); ou toldo
    const roll = r();
    if (roll < 0.55) faceSlab(d, f, t - w / 2 - 0.2, t + w / 2 + 0.2, y + WIN_H + 0.1, y + WIN_H + 0.24, 0.03, 0.2, STONE, true);
    else if (roll < 0.72) awning(d, f, t, y + WIN_H + 0.35, w + 0.3, AWNINGS[Math.floor(r() * AWNINGS.length)]);
  }
}

const AWNINGS: [number, number][] = [[PALETTE.colonialRed, PALETTE.cal], [PALETTE.colonialGreen, PALETTE.cal], [PALETTE.colonialBlue, PALETTE.paper], [PALETTE.ochre, PALETTE.cal]];

/** Toldo listrado de lona sobre a janela, com sanefa recortada (só fora do alcance). */
function awning(d: Dress, f: Face, t: number, top: number, w: number, colors: [number, number]) {
  const depth = 0.75;
  const drop = 0.5;
  if (!overhang(d, faceBoxOf(f, t - w / 2, t + w / 2, top - drop - 0.18, top + 0.05, 0, depth + 0.05))) return;
  const n = Math.max(3, Math.round(w / 0.32));
  const sw = w / n;
  const tilt = Math.atan2(drop, depth);
  const len = Math.hypot(drop, depth);
  for (let i = 0; i < n; i++) {
    const tt = t - w / 2 + sw * (i + 0.5);
    const p = facePos(f, tt, top - drop / 2, depth / 2);
    d.b.add(place(new THREE.BoxGeometry(sw, 0.03, len), p.x, p.y, p.z, faceRot(f), tilt), toon(colors[i % 2]), { cast: false });
    // Sanefa: aba curta pendurada na frente
    const q = facePos(f, tt, top - drop - 0.09, depth);
    d.b.add(place(new THREE.BoxGeometry(sw, 0.18, 0.02), q.x, q.y, q.z, faceRot(f)), toon(colors[i % 2]), { cast: false });
  }
}

/** Pilastras de cantaria entre os vãos dos lotes largos (quebra a parede lisa). */
function pilasters(d: Dress, r: () => number) {
  for (const l of d.lots) {
    const W = l.t1 - l.t0;
    if (W < 6 || r() > 0.55) continue;
    const cols = Math.max(1, Math.floor((W - 0.9) / 2.3));
    if (cols < 2) continue;
    const pil = Math.min(0.32, W * 0.1);
    const p = facePoint(l.face, (l.t0 + l.t1) / 2, 0.6);
    const base = floorAt(d.map, p.x, p.z);
    for (let i = 1; i < cols; i++) {
      const t = l.t0 + pil + ((W - 2 * pil) * i) / cols;
      if (isReserved(d, l.face, t - 0.3, t + 0.3, base, l.top)) continue;
      // Fuste, capitel (no alto) e base de pedra
      faceSlab(d, l.face, t - 0.16, t + 0.16, base, l.top - 0.32, 0.03, 0.08, STONE);
      faceSlab(d, l.face, t - 0.24, t + 0.24, l.top - 0.62, l.top - 0.32, 0.03, 0.16, STONE, true);
      faceSlab(d, l.face, t - 0.22, t + 0.22, base, base + 0.5, 0.03, 0.11, PALETTE.cantaria);
    }
  }
}

/** Tubo de descida de águas pluviais junto ao cunhal, com braçadeiras e boca no chão. */
function downpipes(d: Dress, r: () => number) {
  const k = grimeKit();
  for (const l of d.lots) {
    if (r() > 0.6 || l.t1 - l.t0 < 3) continue;
    const t = r() < 0.5 ? l.t1 - 0.5 : l.t0 + 0.5;
    if (d.sills.some((s) => sameFace(s.face, l.face) && Math.abs(s.t - t) < s.w / 2 + 0.3)) continue;
    const p = facePoint(l.face, t, 0.6);
    const base = floorAt(d.map, p.x, p.z);
    const top = l.top - 0.36;
    if (isReserved(d, l.face, t - 0.2, t + 0.2, base, top)) continue;
    const c = facePos(l.face, t, (base + 0.3 + top) / 2, 0.065);
    d.b.add(place(new THREE.CylinderGeometry(0.05, 0.05, top - base - 0.3, 6, 1, true), c.x, c.y, c.z), toon(PALETTE.steel), { cast: false });
    for (let y = base + 1.2; y < top - 0.4; y += 2.2) faceSlab(d, l.face, t - 0.07, t + 0.07, y, y + 0.06, 0.03, 0.11, PALETTE.inkSoft);
    // Boca: curva rente ao chão, dentro do friso permitido
    faceSlab(d, l.face, t - 0.06, t + 0.06, base + 0.06, base + 0.32, 0.02, TRIM, PALETTE.steel);
    // Funil sob a cornija (sai da parede: só fora do alcance)
    const funnel = faceBoxOf(l.face, t - 0.14, t + 0.14, top - 0.3, top, 0, 0.24);
    if (overhang(d, funnel)) d.b.block(funnel.min.x, funnel.min.y, funnel.min.z, funnel.max.x, funnel.max.y, funnel.max.z, PALETTE.steel, deco);
    // Mancha de água no pé do tubo
    wallDecal(d.b, k.mul, l.face, k.drips[0], t, base, 0.5, 1.2);
  }
}

/** Aparelho de ar ao lado de uma janela de cima, com o escorrido da água embaixo. */
function airCon(d: Dress, r: () => number) {
  const k = grimeKit();
  for (const s of d.sills) {
    if (r() > 0.16) continue;
    const side = r() < 0.5 ? -1 : 1;
    const t = s.t + side * (s.w / 2 + 0.6);
    const y = s.y + 0.15;
    const box = faceBoxOf(s.face, t - 0.38, t + 0.38, y - 0.08, y + 0.52, 0, 0.36);
    if (d.sills.some((o) => o !== s && sameFace(o.face, s.face) && Math.abs(o.t - t) < o.w / 2 + 0.45 && Math.abs(o.y - s.y) < 2)) continue;
    if (isReserved(d, s.face, t - 0.5, t + 0.5, y - 0.2, y + 0.6) || !overhang(d, box)) continue;
    // Suporte, caixa clara, grade escura e a hélice
    faceSlab(d, s.face, t - 0.36, t + 0.36, y - 0.08, y - 0.03, 0, 0.36, PALETTE.inkSoft);
    faceSlab(d, s.face, t - 0.34, t + 0.34, y, y + 0.48, 0, 0.3, r() < 0.5 ? PALETTE.paper : PALETTE.steelLight);
    faceSlab(d, s.face, t - 0.3, t + 0.06, y + 0.06, y + 0.42, 0.3, 0.31, PALETTE.steel);
    const fan = facePos(s.face, t - 0.12, y + 0.24, 0.315);
    d.b.add(place(new THREE.CircleGeometry(0.15, 10), fan.x, fan.y, fan.z, faceRot(s.face)), toon(PALETTE.inkSoft), { cast: false });
    wallDecal(d.b, k.mul, s.face, k.drips[1], t, y - 1.8, 0.4, 1.8);
  }
}

/** Vasos de barro no peitoril das janelas sem sacada. */
function sillPots(d: Dress, r: () => number) {
  for (const s of d.sills) {
    if (r() > 0.3) continue;
    if (d.balconies.some((b) => sameFace(b.face, s.face) && s.t > b.t0 - 0.3 && s.t < b.t1 + 0.3 && Math.abs(b.y - s.y) < 1.2)) continue;
    const box = faceBoxOf(s.face, s.t - s.w / 2, s.t + s.w / 2, s.y - 0.12, s.y + 0.55, 0, 0.36);
    if (!overhang(d, box)) continue;
    faceSlab(d, s.face, s.t - s.w / 2 - 0.05, s.t + s.w / 2 + 0.05, s.y - 0.12, s.y - 0.02, 0, 0.3, STONE);
    const n = s.w > 1.6 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const t = s.t - s.w / 2 + (s.w * (i + 0.5)) / n;
      const p = facePos(s.face, t, s.y + 0.1, 0.17);
      d.b.add(place(new THREE.CylinderGeometry(0.11, 0.08, 0.2, 6), p.x, p.y, p.z), toon(PALETTE.terracotta), { cast: false });
      const leaf = new THREE.IcosahedronGeometry(1, 0);
      leaf.scale(0.17, 0.15 + r() * 0.08, 0.13);
      leaf.translate(p.x, p.y + 0.2, p.z);
      d.b.add(leaf, toon(r() < 0.5 ? PALETTE.leaf : PALETTE.colonialMoss), { cast: false });
      if (r() < 0.45) {
        const fl = new THREE.IcosahedronGeometry(0.06, 0);
        fl.translate(p.x, p.y + 0.34, p.z);
        d.b.add(fl, toon(r() < 0.5 ? PALETTE.colonialPink : PALETTE.colonialYellow), { cast: false });
      }
    }
  }
}

/** Antenas de TV e parabólicas na cumeeira dos quarteirões. */
function antennas(d: Dress, r: () => number) {
  for (const s of d.map.solids) {
    if (s.kind !== 'wall' || s.tint !== 'neutral') continue;
    const { min, max } = s.box;
    const w = max.x - min.x;
    const l = max.z - min.z;
    if (Math.min(w, l) < 1.8) continue;
    const h = Math.min(3.4, Math.min(w, l) * 0.26);
    const y = max.y + 0.3 + h - 0.1;
    const n = Math.max(1, Math.round(Math.max(w, l) / 14));
    for (let i = 0; i < n; i++) {
      if (r() > 0.7) continue;
      const u = (i + 0.3 + r() * 0.4) / n;
      const along = w >= l;
      const x = along ? min.x + l / 2 + (w - l) * u : (min.x + max.x) / 2;
      const z = along ? (min.z + max.z) / 2 : min.z + w / 2 + (l - w) * u;
      if (!overhang(d, { min: { x: x - 0.8, y, z: z - 0.8 }, max: { x: x + 0.8, y: y + 2.6, z: z + 0.8 } })) continue;
      if (r() < 0.35) {
        // Parabólica: prato, braço e o LNB
        const dish = new THREE.SphereGeometry(0.42, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.32);
        dish.rotateX(-Math.PI / 2 - 0.5);
        dish.rotateY(r() * Math.PI * 2);
        dish.translate(x, y + 0.75, z);
        d.b.add(dish, toon(PALETTE.paper), { cast: false });
        d.b.block(x - 0.03, y, z - 0.03, x + 0.03, y + 0.75, z + 0.03, PALETTE.steel, deco);
        continue;
      }
      const H = 1.6 + r() * 0.9;
      d.b.block(x - 0.025, y, z - 0.025, x + 0.025, y + H, z + 0.025, PALETTE.inkSoft, deco);
      const yaw = r() * Math.PI;
      for (let k = 0; k < 4; k++) {
        const len = 1 - k * 0.18;
        const bar = new THREE.BoxGeometry(len, 0.025, 0.025);
        d.b.add(place(bar, x, y + H - 0.1 - k * 0.22, z, yaw), toon(PALETTE.inkSoft), { cast: false });
      }
      // Fio da antena descendo pelo telhado
      d.b.add(place(new THREE.BoxGeometry(0.015, 0.015, 2.2), x, y + 0.2, z + 1.1, yaw * 0.2, -0.35), toon(PALETTE.ink), { cast: false });
    }
  }
}

const FLAGS = [PALETTE.colonialYellow, PALETTE.colonialBlue, PALETTE.colonialRed, PALETTE.leafLight, PALETTE.paper, PALETTE.orange, PALETTE.colonialGreen];

/** Bandeirolas de São João cruzando a rua (cordão com bandeirinhas recortadas). */
function bunting(d: Dress, r: () => number) {
  let strings = 0;
  for (const lot of d.lots) {
    if (strings > 16 || r() > 0.4 || lot.t1 - lot.t0 < 3) continue;
    const t = lot.t0 + 1 + r() * (lot.t1 - lot.t0 - 2);
    const across = acrossStreet(d.map, lot.face, t, 14);
    if (!across || across.d < 4) continue;
    const y = Math.min(lot.top, across.top) - 1.4 - r() * 1.2;
    const a = facePos(lot.face, t, y, 0.1);
    const c = facePos(lot.face, t + (r() - 0.5) * 4, y + (r() - 0.5) * 0.6, across.d - 0.1);
    const sag = 0.5 + r() * 0.4;
    const box = {
      min: { x: Math.min(a.x, c.x) - 0.1, y: Math.min(a.y, c.y) - sag - 0.5, z: Math.min(a.z, c.z) - 0.1 },
      max: { x: Math.max(a.x, c.x) + 0.1, y: Math.max(a.y, c.y) + 0.1, z: Math.max(a.z, c.z) + 0.1 },
    };
    if (!overhang(d, box)) continue;
    strings++;
    const dir = c.clone().sub(a);
    const yaw = Math.atan2(dir.x, dir.z);
    const steps = Math.max(4, Math.round(dir.length() / 0.42));
    const pt = (u: number) => a.clone().lerp(c, u).setY(a.y + (c.y - a.y) * u - sag * 4 * u * (1 - u));
    for (let i = 0; i < steps; i++) {
      const p = pt(i / steps);
      const q = pt((i + 1) / steps);
      const seg = q.clone().sub(p);
      const cord = new THREE.BoxGeometry(0.015, 0.015, seg.length());
      cord.lookAt(seg);
      cord.translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
      d.b.add(cord, toon(PALETTE.ink), { cast: false });
      if (i === 0) continue;
      // Bandeirinha: retângulo com o rabo em "V" recortado, nos dois sentidos
      const s = new THREE.Shape();
      s.moveTo(-0.14, 0); s.lineTo(0.14, 0); s.lineTo(0.14, -0.34); s.lineTo(0, -0.24); s.lineTo(-0.14, -0.34); s.closePath();
      const flag = new THREE.ShapeGeometry(s);
      const back = flag.clone();
      back.rotateY(Math.PI);
      for (const g of [flag, back]) {
        g.rotateY(yaw + Math.PI / 2 + (r() - 0.5) * 0.3);
        g.translate(p.x, p.y, p.z);
        d.b.add(g, toon(FLAGS[(i + strings) % FLAGS.length]), { cast: false, receive: false });
      }
    }
  }
}
