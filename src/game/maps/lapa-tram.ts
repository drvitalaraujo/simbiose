import * as THREE from 'three';
import { GLOW, PALETTE as C, toon } from '../toon';
import { type Builder, paint, place } from '../world/builder';
import type { LapaArt } from './lapa-art';

// Bondinho de Santa Teresa sobre os Arcos (fora do alcance do corpo, ~14 m de altura):
// caixa amarela aberta dos lados, bancos de madeira atravessados, colunas, teto abaulado
// com lanternim, plataformas nas pontas com farol, letreiro de destino, rodas nos truques
// e a vara do trole encostada no fio. Desenho próprio, sem modelo externo.

const deco = { solid: false, shoot: false, cast: false, outline: 0 };

export function lapaTram(b: Builder, art: LapaArt) {
  const x = 12;
  const y = 13.7;
  const L = 8;
  const Wd = 1.8;
  const part = (w: number, h: number, d: number, dx: number, dy: number, dz: number, c: number) =>
    b.block(x + dx - w / 2, y + dy - h / 2, dz - d / 2, x + dx + w / 2, y + dy + h / 2, dz + d / 2, c, deco);
  // Truques e rodas (dois eixos em cada ponta)
  for (const dx of [-2.4, 2.4]) {
    part(1.7, 0.28, 1.2, dx, 0.2, 0, C.inkSoft);
    for (const ax of [-0.45, 0.45]) for (const side of [-1, 1]) {
      const wheel = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12);
      wheel.rotateX(Math.PI / 2);
      b.add(place(wheel, x + dx + ax, y + 0.24, side * 0.42), toon(C.steel), { cast: false });
      const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8);
      hub.rotateX(Math.PI / 2);
      b.add(place(hub, x + dx + ax, y + 0.24, side * 0.47), toon(C.steelLight), { cast: false });
    }
  }
  // Estrado, saia amarela com friso e o número
  part(L, 0.14, Wd, 0, 0.46, 0, C.bark);
  for (const side of [-1, 1]) {
    part(L - 0.2, 0.62, 0.06, 0, 0.84, side * (Wd / 2 - 0.03), C.yellow);
    part(L - 0.2, 0.06, 0.07, 0, 1.12, side * (Wd / 2 - 0.03), C.colonialMoss);
    part(L - 0.2, 0.05, 0.07, 0, 0.58, side * (Wd / 2 - 0.03), C.ink);
    // Estribo corrido para subir
    part(L - 1.2, 0.05, 0.3, 0, 0.32, side * (Wd / 2 + 0.12), C.bark);
  }
  // Bancos atravessados (encosto de ripas) e colunas que seguram o teto
  for (let i = 0; i < 6; i++) {
    const dx = -2.6 + i * 1.04;
    part(0.42, 0.08, Wd - 0.3, dx, 0.92, 0, C.bark);
    part(0.06, 0.45, Wd - 0.3, dx - 0.2, 1.18, 0, C.terracotta);
  }
  for (let i = 0; i <= 7; i++) for (const side of [-1, 1]) part(0.07, 1.75, 0.07, -3.6 + i * (7.2 / 7), 1.95, side * (Wd / 2 - 0.05), C.yellow);
  // Teto abaulado e lanternim
  // Após girar Z, o x radial vira altura: seno positivo (0..PI) forma a meia abóbada.
  const roof = new THREE.CylinderGeometry(1, 1, L + 0.3, 16, 1, false, 0, Math.PI);
  roof.rotateZ(Math.PI / 2);
  roof.scale(1, 0.32, Wd * 0.62);
  b.add(place(roof, x, y + 2.62, 0), toon(C.cal), { cast: false });
  part(L - 1.6, 0.18, 0.7, 0, 3.0, 0, C.cal);
  part(L - 1.6, 0.05, 0.75, 0, 3.1, 0, C.colonialMoss);
  part(L + 0.3, 0.08, Wd + 0.1, 0, 2.82, 0, C.yellow);
  // Pontas: painel do motorneiro, farol aceso e letreiro de destino
  const lamp = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(GLOW, GLOW, GLOW) });
  const sign = art.sign('SANTA TERESA', 'BONDE 10 • LARGO DOS GUIMARÃES', C.inkSoft, C.yellow);
  for (const s of [-1, 1]) {
    part(0.08, 0.85, Wd - 0.1, s * (L / 2 - 0.04), 0.9, 0, C.yellow);
    part(0.09, 0.08, Wd - 0.1, s * (L / 2 - 0.04), 1.32, 0, C.colonialMoss);
    const head = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10);
    head.rotateZ(Math.PI / 2);
    b.add(paint(place(head, x + s * (L / 2 + 0.02), y + 1.0, 0), C.sun), lamp, { cast: false, receive: false });
    const g = new THREE.PlaneGeometry(1.5, 0.36);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) < 0.5 ? sign.u0 : sign.u1, uv.getY(i) < 0.5 ? sign.v0 : sign.v1);
    b.add(place(g, x + s * (L / 2 + 0.12), y + 2.62, 0, s * Math.PI / 2), art.material, { cast: false });
  }
  // Vara do trole com a roldana no fio
  const rod = new THREE.CylinderGeometry(0.035, 0.035, 2.3, 6);
  rod.rotateZ(-0.55);
  b.add(place(rod, x - 0.55, y + 4.05, 0), toon(C.steel), { cast: false });
  b.add(place(new THREE.TorusGeometry(0.07, 0.025, 4, 8), x - 1.15, y + 4.95, 0), toon(C.ink), { cast: false });
  b.block(-43, y + 4.98, -0.015, 43, y + 5.01, 0.015, C.steel, deco);
  for (const px of [-36, -18, 0, 18, 36]) {
    b.block(px - 0.05, y, 1.0, px + 0.05, y + 5.4, 1.1, C.steel, deco);
    b.block(px - 0.03, y + 5.0, -0.05, px + 0.03, y + 5.06, 1.05, C.steel, deco);
  }
}
