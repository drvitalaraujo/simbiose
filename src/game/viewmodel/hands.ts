import * as THREE from 'three';
import { PALETTE } from '../toon';
import type { PartList, Vec } from './parts';

// Mãos e braços em primeira pessoa (centímetros, espaço da arma: +y acima, -z para o cano).
// Luva sem dedos (couro vinho-escuro, contrasta com o polímero da arma) com falanges que contornam a empunhadura e o guarda-mão, protetor de
// nós dos dedos, punho da luva com velcro e manga de jaqueta com dobra e vincos.
// O antebraço esquerdo desce quase reto para a base da tela (estilo VALORANT/Overwatch):
// curto e fino, não atravessa a tela como o tubo antigo.

const GLOVE = PALETTE.bark;
const SKIN = PALETTE.skinWarm;
const PAD = PALETTE.clothTeal;
const STRAP = PALETTE.yellow;
const SLEEVE = PALETTE.inkSoft;
const LINING = PALETTE.clothTeal;
const CREASE = PALETTE.ink;

/** Guarda-mão onde a mão esquerda segura (cm): centro em z, base, topo e meia largura. */
export interface Handguard {
  z: number;
  bottom: number;
  top: number;
  half: number;
}

/** Empunhadura comum às quatro armas: perfil [z, y], inclinada para trás ao descer. */
export const GRIP: [number, number][] = [[2.2, 0], [7.2, 0], [10, -8.4], [4.4, -9.2]];
const GRIP_TILT = -0.24; // rad em x: o eixo da empunhadura aponta para trás ao descer

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: Vec) => Math.hypot(...a);
const lerp3 = (a: Vec, b: Vec, t: number): Vec => add(a, scale(sub(b, a), t));

/** Euler que leva o eixo +z para `dir` (peças alinhadas a mangas). */
function along(dir: Vec): Vec {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...dir).normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

/**
 * Dedo em falanges afuniladas com juntas arredondadas (pontos da base à ponta). A luva é
 * sem dedos: a última falange mostra a pele e a borda da luva marca a junta.
 */
function finger(p: PartList, bone: number, joints: Vec[], radii: number[]) {
  const last = joints.length - 2;
  for (let i = 0; i + 1 < joints.length; i++) {
    const color = i === last ? SKIN : GLOVE;
    p.span(joints[i], joints[i + 1], radii[i], radii[i + 1], 7, { color, bone, wear: 0 });
  }
  for (let i = 1; i < joints.length; i++) {
    const color = i === joints.length - 1 ? SKIN : GLOVE;
    p.add(new THREE.SphereGeometry(radii[i] * (i === last ? 1.08 : 1), 7, 4), { color, bone, wear: 0, at: joints[i] });
  }
}

/**
 * Punho da luva + jaqueta: velcro amarelo, boca da manga com a dobra do forro aparecendo,
 * manga afunilada com costura, vincos de tecido e reforço no antebraço.
 */
function arm(p: PartList, bone: number, wrist: Vec, elbow: Vec, r: number) {
  const dir = sub(elbow, wrist);
  const L = len(dir);
  const at = (d: number) => lerp3(wrist, elbow, d / L);
  const rot = along(dir);
  const fabric = { bone, wear: 0 } as const;
  // Punho da luva com aba de velcro
  p.span(wrist, at(3.2), r * 0.82, r * 0.86, 9, { ...fabric, color: GLOVE });
  p.span(at(0.9), at(2.3), r * 0.9, r * 0.9, 9, { ...fabric, color: PALETTE.ink });
  const tab = at(1.6);
  p.box(1.4, 0.5, 2.4, { ...fabric, at: add(tab, [r * 0.45, r * 0.75, 0]), rot, color: STRAP, bevel: 0.15 });
  // Boca da manga: forro teal dobrado para fora e a barra da jaqueta por cima
  p.span(at(2.6), at(3.6), r * 1.05, r * 1.12, 10, { ...fabric, color: LINING });
  p.span(at(3.5), at(5.6), r * 1.16, r * 1.1, 10, { ...fabric, color: SLEEVE });
  p.span(at(5.5), at(6), r * 1.13, r * 1.13, 10, { ...fabric, color: CREASE });
  // Manga até o cotovelo, com vincos (anéis finos escuros) que quebram o tubo
  p.span(at(5.9), elbow, r * 1.08, r * 1.42, 10, { ...fabric, color: SLEEVE });
  for (const [d, k] of [[10, 1.16], [13.5, 1.22], [18, 1.3]] as const) {
    p.span(at(d), at(d + 0.45), r * k, r * k, 10, { ...fabric, color: CREASE });
  }
  // Costura e painel de reforço por cima (lado de fora do braço)
  const mid = at(Math.min(15, L * 0.55));
  const rMid = r * 1.22;
  p.box(2.2, 0.4, Math.min(12, L * 0.45), { ...fabric, at: add(mid, [0, rMid * 0.97, 0]), rot, color: LINING, bevel: 0.12 });
  p.box(0.16, 0.45, Math.min(12, L * 0.45), { ...fabric, at: add(mid, [-1.25, rMid * 0.96, 0]), rot, color: STRAP, bevel: 0.04 });
}

/** Mão direita na empunhadura: dorso à direita, dedos em volta da frente, indicador no gatilho. */
export function rightHand(p: PartList, bone: number) {
  const glove = { color: GLOVE, bone, wear: 0 } as const;
  const tilt: Vec = [GRIP_TILT, 0, 0];
  const front = (y: number) => 2.2 - y * 0.24; // z da face da frente da empunhadura
  // Dorso, palma atrás da empunhadura e eminência do polegar à esquerda
  p.box(2.3, 8.6, 6.6, { ...glove, at: [3.15, -4.7, 8], rot: tilt, bevel: 0.9 });
  p.box(4.6, 7.8, 3, { ...glove, at: [0.6, -4.9, 10.9], rot: tilt, bevel: 1 });
  p.box(1.7, 4.4, 4.4, { ...glove, at: [-2.1, -3.4, 8.6], rot: tilt, bevel: 0.7 });
  // Protetor dos nós (acolchoado teal) e remendo amarelo no dorso
  p.box(0.7, 6.8, 2, { at: [4.2, -4.6, front(-4.6) + 2.6], rot: tilt, color: PAD, bone, bevel: 0.25, wear: 0 });
  p.box(0.4, 2.6, 2.2, { at: [4.35, -5.2, 9.2], rot: tilt, color: STRAP, bone, bevel: 0.1, wear: 0 });
  // Médio, anelar e mínimo: nó à direita, contornam a frente e terminam no lado esquerdo
  for (const [i, y] of [-2.7, -4.8, -6.9].entries()) {
    const zf = front(y);
    const k = i === 2 ? 0.86 : 1;
    finger(p, bone, [[2.9, y, zf + 2.3], [2.2, y - 0.15, zf - 0.75], [-1.5, y - 0.3, zf - 0.85], [-2.75, y - 0.3, zf + 1.1]],
      [1 * k, 0.94 * k, 0.86 * k, 0.72 * k]);
  }
  // Indicador no gatilho
  finger(p, bone, [[2.9, -0.9, 4.7], [2.4, -1.15, 1.6], [1.15, -1.55, -0.3], [0.3, -2.35, -0.35]], [1, 0.9, 0.8, 0.68]);
  // Polegar apoiado no lado esquerdo do receptor
  finger(p, bone, [[-1.7, -3.3, 9.6], [-2.9, -1.2, 7.4], [-3.7, 0.4, 5], [-3.75, 1, 3]], [1.3, 1.15, 1, 0.82]);
  arm(p, bone, [2.3, -9.2, 12.2], [12, -27, 40], 3.6);
}

/** Mão esquerda por baixo do guarda-mão: dedos sobem pela direita, polegar pela esquerda. */
export function leftHand(p: PartList, bone: number, g: Handguard) {
  const glove = { color: GLOVE, bone, wear: 0 } as const;
  const { z, bottom: yb, top, half: hw } = g;
  const reach = Math.min(top - yb, 6.2);
  // Palma sob o guarda-mão, levemente para a direita, e eminência do polegar
  p.box(5.6, 2.3, 7.6, { ...glove, at: [0.5, yb - 1.3, z + 0.2], bevel: 0.9 });
  p.box(2.6, 2.6, 4.4, { ...glove, at: [-2.3, yb - 0.9, z + 2.2], rot: [0, 0, 0.35], bevel: 0.8 });
  // Quatro dedos (indicador na frente): sobem pela lateral direita e curvam por cima
  for (let i = 0; i < 4; i++) {
    const fz = z - 2.9 + i * 1.95;
    const k = i === 3 ? 0.85 : 1;
    const up = reach * (i === 0 ? 0.8 : i === 3 ? 0.62 : 0.74);
    finger(p, bone, [[2.7, yb - 1.1, fz], [hw + 1, yb + up * 0.32, fz], [hw + 0.85, yb + up * 0.72, fz - 0.15], [hw + 0.15, yb + up, fz - 0.3]],
      [0.96 * k, 0.9 * k, 0.8 * k, 0.66 * k]);
    p.box(0.35, 1.2, 1.4, { at: [hw + 1.95, yb + up * 0.32, fz], color: PAD, bone, bevel: 0.12, wear: 0 });
  }
  // Polegar ao longo do lado esquerdo, apontando para o cano
  finger(p, bone, [[-2.4, yb - 1.4, z + 3], [-hw - 0.95, yb + 0.5, z + 1.4], [-hw - 0.95, yb + 1.9, z - 1.3], [-hw - 0.6, yb + 2.4, z - 3.4]],
    [1.25, 1.1, 0.95, 0.8]);
  const wrist: Vec = [-1, yb - 2.6, z + 4.2];
  p.span([0, yb - 1.6, z + 2.6], wrist, 2.9, 3, 9, glove);
  arm(p, bone, wrist, add(wrist, [-17, -20, 13]), 3.4);
}
