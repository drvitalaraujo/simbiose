import * as THREE from 'three';
import { GLOW, hex, PALETTE as P, toonWith } from '../toon';
import { rng } from '../world/shapes';
import { canvas, texture } from '../world/textures';

export { PatachoArt } from './patacho-art';

export interface PatachoMaterials {
  sand: THREE.MeshToonMaterial;
  wood: THREE.MeshToonMaterial;
  thatch: THREE.MeshToonMaterial;
  glow: THREE.MeshBasicMaterial;
}

export function patachoMaterials(): PatachoMaterials {
  // Areia de praia sem costura (1024²): marolas suaves de vento, conchas miúdas e variação curta.
  const [sc, sg] = canvas(1024, 1024);
  const sr = rng(7101);
  sg.fillStyle = hex(P.beachSand);
  sg.fillRect(0, 0, 1024, 1024);
  for (let band = 0; band < 28; band++) {
    const y0 = (band / 28) * 1024;
    const phase = sr() * Math.PI * 2;
    const amp = 10 + sr() * 14;
    sg.beginPath();
    for (let x = 0; x <= 1024; x += 16) {
      const u = (x / 1024) * Math.PI * 2;
      const y = y0 + Math.sin(u * 2 + phase) * amp + Math.cos(u * 3 - phase * 0.7) * (amp * 0.4);
      if (x === 0) sg.moveTo(x, y);
      else sg.lineTo(x, y);
    }
    sg.lineWidth = 10 + sr() * 12;
    sg.strokeStyle = hex(band % 2 ? P.cal : P.sand);
    sg.globalAlpha = band % 2 ? 0.16 : 0.11;
    sg.stroke();
  }
  for (let i = 0; i < 9500; i++) {
    sg.globalAlpha = 0.04 + sr() * 0.08;
    sg.fillStyle = hex(i % 5 === 0 ? P.colonialRose : i % 2 ? P.cal : P.sand);
    const sz = i % 19 === 0 ? 2.4 : 1 + sr() * 1.6;
    sg.fillRect(sr() * 1024, sr() * 1024, sz, sz * 0.8);
  }
  sg.globalAlpha = 1;
  const sandTex = texture(sc, true);
  sandTex.repeat.set(14, 17);
  const sand = toonWith({ map: sandTex, color: 0xffffff });

  // Madeira costeira curada pelo sal (512²): tábuas, veios longos e cavilhas.
  const [wc, wg] = canvas(512, 512);
  const wr = rng(7102);
  wg.fillStyle = hex(P.wood);
  wg.fillRect(0, 0, 512, 512);
  const plankH = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    wg.globalAlpha = 0.16;
    wg.fillStyle = hex(row % 2 ? P.sand : P.cantaria);
    wg.fillRect(0, y + 2, 512, plankH - 4);
    wg.globalAlpha = 0.52;
    wg.fillStyle = hex(P.bark);
    wg.fillRect(0, y, 512, 2.5);
    wg.globalAlpha = 0.22;
    wg.fillStyle = hex(P.cal);
    wg.fillRect(0, y + 3, 512, 1.2);
    for (let k = 0; k < 26; k++) {
      wg.globalAlpha = 0.08 + wr() * 0.12;
      wg.fillStyle = hex(k % 2 ? P.bark : P.sand);
      wg.fillRect(wr() * 512, y + 5 + wr() * (plankH - 10), 24 + wr() * 90, 1.2);
    }
    for (const nx of [18, 254, 494]) {
      wg.globalAlpha = 0.55;
      wg.fillStyle = hex(P.bark);
      wg.beginPath();
      wg.arc(nx, y + 14, 2.5, 0, Math.PI * 2);
      wg.arc(nx, y + plankH - 14, 2.5, 0, Math.PI * 2);
      wg.fill();
    }
  }
  wg.globalAlpha = 1;
  const wood = toonWith({ map: texture(wc, true), color: 0xffffff });

  // Piaçava / palha de coqueiro penteada em fiadas sobrepostas (512²).
  const [tc, tg] = canvas(512, 512);
  const tr = rng(7103);
  tg.fillStyle = hex(P.sand);
  tg.fillRect(0, 0, 512, 512);
  const courses = 6;
  const ch = 512 / courses;
  for (let c = 0; c < courses; c++) {
    const y0 = c * ch;
    const grad = tg.createLinearGradient(0, y0, 0, y0 + ch);
    grad.addColorStop(0, hex(P.bark));
    grad.addColorStop(0.14, hex(P.cantaria));
    grad.addColorStop(0.65, hex(P.sand));
    grad.addColorStop(1, hex(P.ochre));
    tg.globalAlpha = 0.42;
    tg.fillStyle = grad;
    tg.fillRect(0, y0, 512, ch);
    tg.globalAlpha = 0.34;
    tg.fillStyle = hex(P.bark);
    tg.beginPath();
    tg.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 16) {
      const jag = Math.sin((x / 512) * Math.PI * 16 + c * 1.7) * 4 + (tr() - 0.5) * 3;
      tg.lineTo(x, y0 + 7 + jag);
    }
    tg.lineTo(512, y0);
    tg.closePath();
    tg.fill();
  }
  for (let i = 0; i < 1800; i++) {
    const x = tr() * 512,
      y = tr() * 512;
    const len = 18 + tr() * 48,
      sway = (tr() - 0.5) * 6;
    tg.globalAlpha = 0.18 + tr() * 0.32;
    tg.strokeStyle = hex(i % 5 === 0 ? P.bark : i % 3 === 0 ? P.cal : P.ochre);
    tg.lineWidth = 1 + tr() * 1.2;
    tg.beginPath();
    tg.moveTo(x, y);
    tg.lineTo(x + sway, y + len);
    tg.stroke();
  }
  tg.globalAlpha = 1;
  const thatch = toonWith({ map: texture(tc, true), color: 0xffffff });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.sun).multiplyScalar(GLOW * 0.72) });
  return { sand, wood, thatch, glow };
}

export function paintedFaces(
  vertices: number[],
  double = false,
  uvMode: 'tri' | 'world' | 'slope' = 'tri',
  scale = 1.8,
): THREE.BufferGeometry {
  const points = vertices.slice();
  if (double) {
    for (let i = 0; i < vertices.length; i += 9) {
      points.push(...vertices.slice(i, i + 3), ...vertices.slice(i + 6, i + 9), ...vertices.slice(i + 3, i + 6));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const uv: number[] = [];
  if (uvMode === 'world') {
    for (let i = 0; i < points.length; i += 3) uv.push(points[i] / scale, points[i + 2] / scale);
  } else if (uvMode === 'slope') {
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      n = new THREE.Vector3(),
      horiz = new THREE.Vector3(),
      down = new THREE.Vector3();
    for (let i = 0; i < points.length; i += 9) {
      a.set(points[i], points[i + 1], points[i + 2]);
      b.set(points[i + 3], points[i + 4], points[i + 5]);
      c.set(points[i + 6], points[i + 7], points[i + 8]);
      n.subVectors(b, a).cross(down.subVectors(c, a)).normalize();
      if (n.y < 0) n.negate();
      horiz.set(-n.z, 0, n.x);
      if (horiz.lengthSq() < 1e-5) horiz.set(1, 0, 0);
      else horiz.normalize();
      down.crossVectors(n, horiz).normalize();
      if (down.y > 0) down.negate();
      for (const p of [a, b, c]) uv.push(p.dot(horiz) / scale, -p.dot(down) / scale);
    }
  } else {
    for (let i = 0; i < points.length / 9; i++) uv.push(0, 0, 1, 0, 1, 1);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
