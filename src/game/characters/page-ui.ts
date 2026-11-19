import * as THREE from 'three';
import { hex, PALETTE } from '../toon';
import type { Capsule, HitPart } from './hitbox';
import { SKINS, SKIN_IDS } from './skins';

// Painel e desenhos de apoio da página ?characters (só em dev).

export function buildPanel() {
  const panel = document.createElement('div');
  const skinOptions = SKIN_IDS.map((id) => `<option value="${id}">${SKINS[id].name}</option>`).join('');
  panel.innerHTML = `
    <style>
      #chars-panel { position: fixed; left: 12px; top: 12px; max-width: min(560px, calc(100vw - 24px));
        padding: 12px 14px; background: ${hex(PALETTE.ink)}d9; color: ${hex(PALETTE.paper)};
        font: 13px/1.4 system-ui, sans-serif; border: 2px solid ${hex(PALETTE.pink)}; border-radius: 10px; }
      #chars-panel h1 { font: italic 900 18px 'Arial Black', sans-serif; margin: 0 0 6px; color: ${hex(PALETTE.yellow)}; }
      #chars-panel button, #chars-panel select { margin: 2px; padding: 4px 8px; border: 1px solid ${hex(PALETTE.lilac)};
        background: transparent; color: inherit; border-radius: 6px; cursor: pointer; font: inherit; }
      #chars-panel option { background: ${hex(PALETTE.ink)}; }
      #chars-panel button.on { background: ${hex(PALETTE.pink)}; border-color: ${hex(PALETTE.pink)}; color: ${hex(PALETTE.ink)}; }
      #chars-panel .row { margin-top: 6px; }
      #chars-panel .legend span { display: inline-block; margin-right: 10px; }
      #chars-panel.min .full { display: none; }
    </style>
    <div id="chars-panel">
      <h1>SIMBIOSE · bonecos</h1>
      <div class="full">
      <div class="legend">hitbox: <span style="color:${hex(PALETTE.yellow)}">■ cabeça</span><span style="color:${hex(PALETTE.cyan)}">■ tronco</span><span style="color:${hex(PALETTE.pink)}">■ pernas</span></div>
      <div class="row" id="chars-buttons"></div>
      <div class="row">pitch da mira <input id="chars-pitch" type="range" min="-120" max="120" value="0"></div>
      </div>
      <div class="row">skin <select id="chars-skin"><option value="mix">misturadas</option>${skinOptions}</select>
        time <select id="chars-team"><option value="auto">por facção / roteiro</option><option value="ally">aliado (ciano)</option><option value="enemy">inimigo (rosa)</option></select></div>
      <div class="row">vitrine <button data-view="front">frente</button><button data-view="side">lado</button><button data-view="back">costas</button><button data-view="free">livre</button></div>
      <div class="row"><button id="chars-hit">H hitboxes</button><button id="chars-post">pós</button><button id="chars-bench">10 bonecos (medir)</button><button id="chars-min">painel</button></div>
      <div class="row" id="chars-status"></div>
    </div>`;
  document.body.append(panel);
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const root = $('chars-panel');
  $('chars-min').onclick = () => root.classList.toggle('min');
  return {
    root,
    buttons: $('chars-buttons'),
    pitch: $<HTMLInputElement>('chars-pitch'),
    skin: $<HTMLSelectElement>('chars-skin'),
    team: $<HTMLSelectElement>('chars-team'),
    views: [...root.querySelectorAll<HTMLButtonElement>('button[data-view]')],
    hit: $('chars-hit'),
    post: $('chars-post'),
    bench: $('chars-bench'),
    status: $('chars-status'),
  };
}

export type Panel = ReturnType<typeof buildPanel>;

const PART_COLOR: Record<HitPart, number> = { head: PALETTE.yellow, torso: PALETTE.cyan, legs: PALETTE.pink };
const hitMats = new Map<HitPart, THREE.MeshBasicMaterial>();
const unitCapsules = new Map<string, THREE.CapsuleGeometry>();

export function capsuleMesh(): THREE.Mesh {
  const m = new THREE.Mesh();
  m.raycast = () => {};
  m.renderOrder = 10;
  return m;
}

export function placeCapsule(m: THREE.Mesh, c: Capsule) {
  let mat = hitMats.get(c.part);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color: PART_COLOR[c.part], wireframe: true, depthWrite: false, transparent: true, opacity: 0.8 });
    hitMats.set(c.part, mat);
  }
  const a = new THREE.Vector3(c.a.x, c.a.y, c.a.z);
  const b = new THREE.Vector3(c.b.x, c.b.y, c.b.z);
  // comprimento arredondado a 5 cm: poucas geometrias em cache (pitch/corrida mudam o tronco)
  const len = Math.round(a.distanceTo(b) * 20) / 20;
  const key = `${c.radius.toFixed(3)}:${len.toFixed(2)}`;
  let geo = unitCapsules.get(key);
  if (!geo) {
    geo = new THREE.CapsuleGeometry(c.radius, len, 3, 10);
    unitCapsules.set(key, geo);
  }
  m.geometry = geo;
  m.material = mat;
  m.position.copy(a).add(b).multiplyScalar(0.5);
  if (len > 1e-4) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  else m.quaternion.identity();
}

/** Baixa um JPEG pequeno do canvas (chame logo depois de desenhar o quadro). */
export function saveShot(canvas: HTMLCanvasElement, name: string, width = 960): void {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round((canvas.height / canvas.width) * width);
  c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/jpeg', 0.82);
  a.download = `${name}.jpg`;
  a.click();
}
