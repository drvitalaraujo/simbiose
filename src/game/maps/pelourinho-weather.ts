import { PALETTE, toonWith } from '../toon';
import { mix, rgba } from '../world/colonial-art';
import { place } from '../world/builder';
import { facePos, faceRot } from '../world/props';
import { rng } from '../world/shapes';
import { Atlas, planeGeo, type G } from '../world/textures';
import type { Dress } from './colonial';
import { floorAt } from './facades';

// Desgaste pintado, sem novos sólidos: um atlas próprio evita lotar o atlas de grafites.
// O desgaste fica atrás de portas, molduras e tinta de spray. Cal e cor da casa ainda
// dominam a fachada; nem toda casa tem o mesmo grau de abandono.

function patch(g: G, x: number, y: number, rx: number, ry: number, r: () => number) {
  g.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2;
    const k = 0.72 + r() * 0.28;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}

function plaster(g: G, w: number, h: number, seed: number, age: number) {
  const r = rng(seed);
  // Grão pequeno e discreto: acabamento mineral, sem ruído de alto contraste.
  for (let i = 0; i < 2800; i++) {
    g.fillStyle = rgba(i % 3 ? PALETTE.cal : PALETTE.bark, 0.025 + r() * 0.06);
    g.fillRect(r() * w, r() * h, 0.6 + r() * 1.8, 0.6 + r() * 1.8);
  }
  // Escorridos sob o beiral, em comprimentos e intensidades diferentes.
  for (let i = 0; i < 22; i++) {
    const x = r() * w;
    const len = h * (0.06 + r() * 0.26);
    const grad = g.createLinearGradient(0, 0, 0, len);
    grad.addColorStop(0, rgba(PALETTE.bark, 0.1 + age * 0.16));
    grad.addColorStop(1, rgba(PALETTE.bark, 0));
    g.fillStyle = grad;
    g.fillRect(x, 0, 3 + r() * 12, len);
  }
  // Umidade cresce junto ao chão; conserva a leitura do barrado da zona.
  const damp = g.createLinearGradient(0, h * 0.76, 0, h);
  damp.addColorStop(0, rgba(PALETTE.bark, 0));
  damp.addColorStop(1, rgba(PALETTE.bark, 0.12 + age * 0.2));
  g.fillStyle = damp;
  g.fillRect(0, h * 0.76, w, h * 0.24);
  for (let i = 0; i < (age > 0.2 ? 2 + Math.floor(age * 2) : 0); i++) {
    // Descascado ligado à base e às laterais: evita bolinhas isoladas de tinta perdida.
    const side = i === 0;
    const x = side ? (r() < 0.5 ? 0 : w) : w * (0.16 + r() * 0.68);
    const y = side ? h * (0.62 + r() * 0.18) : h + 4;
    const rx = 26 + r() * 52 * age;
    const ry = side ? 26 + r() * 56 * age : 22 + r() * 30 * age;
    g.save();
    patch(g, x, y, rx, ry, r);
    g.fillStyle = mix(PALETTE.sand, PALETTE.cal, 0.35);
    g.fill();
    g.strokeStyle = rgba(PALETTE.bark, 0.35);
    g.lineWidth = 1.6;
    g.stroke();
    g.clip();
    // A mesma borda serve ao miolo: não cria um halo escuro de contorno duplicado.
    for (let k = 0; k < 60; k++) {
      g.fillStyle = rgba(k % 2 ? PALETTE.cal : PALETTE.cantaria, 0.16);
      g.fillRect(x - rx + r() * rx * 2, y - ry + r() * ry * 2, 1 + r() * 4, 1 + r() * 3);
    }
    if (age > 0.7 && i % 3 === 0) {
      g.fillStyle = rgba(PALETTE.terracotta, 0.75);
      g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
      g.strokeStyle = rgba(PALETTE.sand, 0.8);
      g.lineWidth = 2;
      for (let yy = y - ry; yy < y + ry; yy += 12) {
        g.beginPath(); g.moveTo(x - rx, yy); g.lineTo(x + rx, yy); g.stroke();
        for (let xx = x - rx + ((Math.floor(yy / 12) & 1) * 13); xx < x + rx; xx += 26) {
          g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 12); g.stroke();
        }
      }
    }
    g.restore();
  }
  // Fissuras finas, sem desenhar falsas linhas de colisão no piso.
  for (let i = 0; i < (age > 0.4 ? 2 : 0); i++) {
    let x = w * (0.15 + r() * 0.7);
    let y = h * (0.15 + r() * 0.45);
    g.strokeStyle = rgba(PALETTE.bark, 0.32);
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 16; y += 6 + r() * 10; g.lineTo(x, y); }
    g.stroke();
  }
}

export function dressWeather(d: Dress) {
  const atlas = new Atlas(1024, true);
  const arts = [0.15, 0.45, 0.7, 1].map((age, i) => atlas.draw(480, 480, (g, w, h) => plaster(g, w, h, 184 + i * 71, age)));
  const mat = toonWith({ map: atlas.texture, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  d.lots.forEach((l, i) => {
    const t = (l.t0 + l.t1) / 2;
    const f = l.face;
    const base = f.axis === 'x' ? floorAt(d.map, f.at + f.n * 0.6, t) : floorAt(d.map, t, f.at + f.n * 0.6);
    const w = l.t1 - l.t0 - 0.64;
    const h = l.top - base - 0.34;
    if (w < 0.6 || h < 0.6) return;
    const uv = arts[(i * 7 + Math.floor(Math.abs(f.at))) % arts.length];
    const add = (y0: number, y1: number, off: number) => {
      if (y1 <= y0) return;
      const part = { ...uv, v0: uv.v0 + (uv.v1 - uv.v0) * (y0 - base) / h,
        v1: uv.v0 + (uv.v1 - uv.v0) * (y1 - base) / h };
      const p = facePos(f, t, (y0 + y1) / 2, off);
      d.b.add(place(planeGeo(w, y1 - y0, part), p.x, p.y, p.z, faceRot(f)), mat, { cast: false });
    };
    // Janela superior fica a 0,04: reboco a 0,03 < desgaste a 0,035 < janela.
    // Só o trecho abaixo do filete do barrado (y=1,2) precisa passar à frente de 0,04.
    add(base, Math.min(1.2, base + h), 0.045);
    add(Math.max(base, 1.2), base + h, 0.035);
  });
  console.info(`mapa: atlas reboco ${atlas.used}`);
}
