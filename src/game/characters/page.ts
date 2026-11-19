import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createPipeline } from '../render/pipeline';
import { PALETTE, toon } from '../toon';
import { gunSpec } from '../../sim/weapons';
import { Avatar } from './avatar';
import { buildHitboxes } from './hitbox';
import { type CharacterAsset, loadCharacter, type Team } from './model';
import { buildPanel, capsuleMesh, placeCapsule, saveShot } from './page-ui';
import { isSkinId, SKIN_IDS, SKINS, type SkinId } from './skins';

// Protótipo isolado (?characters, só em dev): bonecos humanos animados + hitboxes.
// Não toca no jogo: cena, renderer e laço próprios; reaproveita só o pipeline de pós.

const GRAVITY = 26;
const JUMP = 9;

type Brain = (a: Actor, t: number, dt: number) => void;

interface Actor {
  avatar: Avatar;
  /** Time e skin "naturais" do boneco (os seletores do painel podem sobrepor). */
  team: Team;
  skin: SkinId;
  /** Boneco da vitrine (as 3 skins lado a lado para comparar com as folhas). */
  showcase: boolean;
  label: string;
  brain: Brain;
  /** Agachar suavizado (0..1), o mesmo valor que o servidor usaria na hitbox. */
  crouchK: number;
  hit: THREE.Group;
}

/** Estados escolhidos pelos botões/teclas do boneco controlado. */
const MANUAL = [
  { key: '1', name: 'Parado', vx: 0, vz: 0 },
  { key: '2', name: 'Frente', vx: 0, vz: -4.2 },
  { key: '3', name: 'Trás', vx: 0, vz: 4.2 },
  { key: '4', name: 'Esquerda', vx: -4.2, vz: 0 },
  { key: '5', name: 'Direita', vx: 4.2, vz: 0 },
  { key: '6', name: 'Correr', vx: 0, vz: -7 },
  { key: '7', name: 'Agachar', vx: 0, vz: 0, crouch: true },
  { key: '8', name: 'Agachado andando', vx: 1.5, vz: -1.5, crouch: true },
  { key: '9', name: 'Pular', vx: 0, vz: 0, jump: true },
  { key: '0', name: 'Morrer', vx: 0, vz: 0, dead: true },
] as const;
type Manual = (typeof MANUAL)[number];

export async function startCharacterPage(canvas: HTMLCanvasElement): Promise<void> {
  document.getElementById('menu')?.classList.add('hidden');
  document.getElementById('hud')?.remove();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyTop).lerp(new THREE.Color(PALETTE.horizon), 0.35);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 4.5, 13);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  const pipeline = createPipeline(renderer, scene, camera);

  scene.add(new THREE.HemisphereLight(new THREE.Color(PALETTE.cal).lerp(new THREE.Color(PALETTE.colonialSky), 0.3), PALETTE.concreteDark, 1.1));
  const sun = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun).lerp(new THREE.Color(PALETTE.orange), 0.16), 2.35);
  sun.position.set(-12, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(new THREE.Color(PALETTE.colonialSky).lerp(new THREE.Color(PALETTE.magenta), 0.25), 0.45);
  rim.position.set(10, 6, -8);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), toon(PALETTE.asphalt));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Blocos de referência de escala (1 m e 2 m)
  for (const [x, z, h] of [[-8, -6, 1], [8, -6, 2], [-9, 4, 1.4]] as const) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), toon(PALETTE.concreteDark));
    box.position.set(x, h / 2, z);
    box.castShadow = box.receiveShadow = true;
    scene.add(box);
  }

  const ui = buildPanel();
  // `?characters&skin=ivo`: veste os bonecos de demonstração com uma skin só (só nesta página)
  const urlSkin = new URLSearchParams(location.search).get('skin');
  if (isSkinId(urlSkin)) ui.skin.value = urlSkin;
  ui.status.textContent = 'carregando boneco…';
  let asset: CharacterAsset;
  try {
    asset = await loadCharacter();
  } catch (err) {
    ui.status.textContent = `falhou ao carregar: ${String(err)}`;
    throw err;
  }

  const actors: Actor[] = [];
  const hitRoot = new THREE.Group();
  scene.add(hitRoot);
  let manual: Manual = MANUAL[0];

  const pickTeam = (a: { team: Team }) => (ui.team.value === 'auto' ? a.team : (ui.team.value as Team));
  const pickSkin = (a: { skin: SkinId; showcase: boolean }) =>
    a.showcase || ui.skin.value === 'mix' ? a.skin : (ui.skin.value as SkinId);
  const dress = (a: Pick<Actor, 'team' | 'skin' | 'showcase'>) => {
    const avatar = new Avatar(asset, pickTeam(a), pickSkin(a));
    avatar.root.traverse((o) => {
      // só o corpo e as peças fazem sombra (as cascas do contorno são MeshBasic)
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !(mesh.material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial) mesh.castShadow = true;
    });
    scene.add(avatar.root);
    return avatar;
  };
  const add = (team: Team, label: string, x: number, z: number, brain: Brain, skin?: SkinId, showcase = false) => {
    const base = { team, skin: skin ?? SKIN_IDS[actors.length % SKIN_IDS.length], showcase };
    const avatar = dress(base);
    avatar.state.x = x;
    avatar.state.z = z;
    const hit = new THREE.Group();
    hitRoot.add(hit);
    const actor: Actor = { ...base, avatar, label, brain, crouchK: 0, hit };
    actors.push(actor);
    return actor;
  };
  /** Troca skin/time de todos (seletores do painel), mantendo o estado de cada um. */
  const redress = () => {
    for (const a of actors) {
      const state = { ...a.avatar.state };
      a.avatar.dispose();
      a.avatar = dress(a);
      Object.assign(a.avatar.state, state);
    }
  };

  // 0. Vitrine: as 3 skins paradas, lado a lado, longe do resto (z = 15)
  const SHOW_Z = 15;
  let showYaw = Math.PI; // π = de frente para a câmera da vitrine
  SKIN_IDS.forEach((id, i) => {
    const team: Team = SKINS[id].faction === 'resistencia' ? 'ally' : 'enemy';
    add(team, `vitrine ${SKINS[id].name}`, (i - 1) * 1.3, SHOW_Z, (a) => {
      const s = a.avatar.state;
      s.vx = s.vz = 0;
      s.yaw = showYaw;
    }, id, true);
  });
  const view = (v: string) => {
    for (const b of ui.views) b.classList.toggle('on', b.dataset.view === v);
    if (v === 'free') {
      camera.position.set(0, 4.5, 13);
      controls.target.set(0, 1, 0);
      return;
    }
    // Câmera fixa na frente da vitrine; quem gira são os bonecos (lado = lado esquerdo, como nas folhas)
    showYaw = v === 'front' ? Math.PI : v === 'side' ? Math.PI / 2 : 0;
    camera.position.set(0, 1.05, SHOW_Z + 4.6);
    controls.target.set(0, 0.92, SHOW_Z);
  };
  for (const b of ui.views) b.onclick = () => view(b.dataset.view!);
  ui.skin.onchange = ui.team.onchange = redress;

  // 1. Roteiro: passa por todas as poses, uma a cada 2,5 s (anda "na esteira", sem sair do lugar)
  const script = [MANUAL[0], MANUAL[1], MANUAL[2], MANUAL[3], MANUAL[4], MANUAL[5], MANUAL[6], MANUAL[7], MANUAL[8], MANUAL[9]];
  add('enemy', 'roteiro', -4, 0, (a, t) => {
    const step = script[Math.floor(t / 2.5) % script.length];
    applyManual(a, step, 0, false);
  });
  // 2. Círculo com a mira fixa: mostra frente, lados e costas em mistura contínua
  add('ally', 'círculo (mira fixa)', 0, 0, (a, t) => {
    const s = a.avatar.state;
    const w = 4.2 / 3.5;
    s.x = Math.cos(t * w) * 3.5;
    s.z = Math.sin(t * w) * 3.5 - 1;
    s.vx = -Math.sin(t * w) * 4.2;
    s.vz = Math.cos(t * w) * 4.2;
    s.yaw = 0; // sempre olhando para -Z (de costas para a câmera)
  });
  // 3. Correndo em círculo olhando para onde vai, pulando de vez em quando
  add('enemy', 'corrida + pulo', 0, 0, (a, t, dt) => {
    const s = a.avatar.state;
    const r = 7;
    const w = 7 / r;
    s.x = Math.cos(-t * w) * r;
    s.z = Math.sin(-t * w) * r - 1;
    s.vx = Math.sin(-t * w) * 7;
    s.vz = -Math.cos(-t * w) * 7;
    s.yaw = Math.atan2(-s.vx, -s.vz);
    if (s.grounded && t % 3 < dt) jump(a);
    gravity(a, dt);
  });
  // 4. Mira para cima e para baixo; agacha a cada 4 s
  add('ally', 'mira (pitch)', 4, 0, (a, t) => {
    const s = a.avatar.state;
    s.yaw = Math.PI * 0.85;
    s.pitch = Math.sin(t * 1.3) * 1.2;
    s.crouch = Math.floor(t / 4) % 2 === 1;
  });
  // 5. Controlado pelos botões / teclas 1–0
  const controlled = add('enemy', 'controlado (1–0)', 0, 3.5, (a, _t, dt) => {
    applyManual(a, manual, Number(ui.pitch.value) / 100, true);
    gravity(a, dt);
  });

  for (const m of MANUAL) {
    const b = document.createElement('button');
    b.textContent = `${m.key} ${m.name}`;
    b.onclick = () => pick(m);
    ui.buttons.append(b);
  }
  const pick = (m: Manual) => {
    manual = m;
    const a = controlled;
    if ('jump' in m && m.jump && a.avatar.state.grounded) jump(a);
    for (const b of ui.buttons.querySelectorAll('button')) b.classList.toggle('on', b.textContent?.startsWith(m.key + ' ') ?? false);
  };
  pick(MANUAL[0]);

  let showHitboxes = true;
  const toggleHit = () => {
    showHitboxes = !showHitboxes;
    hitRoot.visible = showHitboxes;
    ui.hit.classList.toggle('on', showHitboxes);
  };
  ui.hit.classList.add('on');
  ui.hit.onclick = toggleHit;
  ui.post.classList.add('on');
  ui.post.onclick = () => {
    pipeline.enabled = !pipeline.enabled;
    ui.post.classList.toggle('on', pipeline.enabled);
  };
  ui.bench.onclick = () => {
    // completa até 10 bonecos correndo em círculos e mede
    let i = actors.length;
    while (actors.length < 10) {
      const r = 9 + (i % 3) * 1.5;
      const phase = i * 1.3;
      add(i % 2 ? 'ally' : 'enemy', `extra ${i}`, 0, 0, (a, t) => {
        const s = a.avatar.state;
        const w = 4.2 / r;
        s.x = Math.cos(t * w + phase) * r;
        s.z = Math.sin(t * w + phase) * r;
        s.vx = -Math.sin(t * w + phase) * 4.2;
        s.vz = Math.cos(t * w + phase) * 4.2;
        s.yaw = phase;
      });
      i++;
    }
    measuring = { frames: 0, update: 0, total: 0, calls: 0, tris: 0 };
  };
  window.addEventListener('keydown', (e) => {
    const m = MANUAL.find((x) => x.key === e.key);
    if (m) pick(m);
    if (e.key === 'h' || e.key === 'H') toggleHit();
  });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pipeline.setSize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  let t = 0;
  let measuring: { frames: number; update: number; total: number; calls: number; tris: number } | null = null;
  let last = performance.now();
  let fpsAcc = 0;
  let fpsFrames = 0;
  let lastReport = '';

  const frame = (dt: number) => {
    const t0 = performance.now();
    t += dt;
    for (const a of actors) {
      a.brain(a, t, dt);
      const s = a.avatar.state;
      a.crouchK += ((s.crouch ? 1 : 0) - a.crouchK) * Math.min(1, dt * 8);
      a.avatar.update(dt);
      if (showHitboxes) drawHitboxes(a);
    }
    const t1 = performance.now();
    controls.update();
    pipeline.render();
    const t2 = performance.now();
    if (measuring) {
      measuring.frames++;
      measuring.update += t1 - t0;
      measuring.total += t2 - t0;
      measuring.calls += renderer.info.render.calls;
      measuring.tris += renderer.info.render.triangles;
      if (measuring.frames === 180) {
        const n = measuring.frames;
        lastReport =
          `${actors.length} bonecos · animação ${(measuring.update / n).toFixed(2)} ms · ` +
          `CPU do quadro ${(measuring.total / n).toFixed(2)} ms · ${Math.round(measuring.calls / n)} draw calls · ` +
          `${Math.round(measuring.tris / n / 1000)} mil triângulos`;
        console.log(`[characters] ${lastReport}`);
        measuring = null;
      }
    }
    return { update: t1 - t0, total: t2 - t0 };
  };

  const loop = (now: number) => {
    // O timestamp do primeiro rAF pode anteceder a inicialização desta página.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const m = frame(dt);
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc > 0.5) {
      ui.status.innerHTML =
        `${actors.length} bonecos · ${(fpsFrames / fpsAcc).toFixed(0)} fps · anim ${m.update.toFixed(2)} ms · ` +
        `${renderer.info.render.calls} draw calls<br>${lastReport || 'clique em “10 bonecos” para medir'}`;
      fpsAcc = 0;
      fpsFrames = 0;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Gancho para automação (aba em 2º plano pausa o rAF: avance na mão com frame(1/60))
  (window as unknown as { __chars: unknown }).__chars = {
    frame,
    actors,
    renderer,
    pipeline,
    camera,
    controls,
    pick: (key: string) => pick(MANUAL.find((m) => m.key === key) ?? MANUAL[0]),
    bench: () => ui.bench.click(),
    report: () => lastReport,
    view,
    /**
     * Enquadramentos fixos para comparar antes/depois: vitrine de perto ('front' | 'side' |
     * 'back') ou o boneco controlado de perto ('run' | 'aim' | 'fire' | 'reload' | 'crouch').
     */
    frameShot: (kind: string) => {
      if (kind === 'front' || kind === 'side' || kind === 'back') {
        view(kind);
        for (let i = 0; i < 40; i++) frame(1 / 60);
        camera.position.set(0, 1.1, SHOW_Z + 3.4);
        controls.target.set(0, 0.95, SHOW_Z);
        frame(1 / 60);
        return;
      }
      const s = controlled.avatar.state;
      pick(MANUAL.find((m) => m.key === (kind === 'run' ? '6' : kind === 'crouch' ? '8' : '1'))!);
      const yaw = kind === 'run' ? -Math.PI / 2 : -Math.PI * 0.75;
      for (let i = 0; i < 90; i++) {
        s.yaw = yaw;
        if (kind === 'reload') s.reloadRemaining = i < 50 ? 0 : gunSpec(s.weaponIndex ?? 0).reloadTime * (1 - (i - 50) / 90);
        if (kind === 'fire' && i === 88) controlled.avatar.fire(s.weaponIndex ?? 0);
        frame(1 / 60);
      }
      s.reloadRemaining = kind === 'reload' ? s.reloadRemaining : 0;
      controls.target.set(s.x, 1.0, s.z);
      camera.position.set(s.x + (kind === 'run' ? 0 : 1.8), 1.35, s.z + (kind === 'run' ? 3.6 : 2.6));
      frame(1 / 60);
    },
    /** Desenha um quadro e baixa o JPEG (vai para a pasta de downloads do navegador). */
    shot: (name: string) => {
      frame(1 / 60);
      saveShot(canvas, name);
    },
  };

  function drawHitboxes(a: Actor) {
    const s = a.avatar.state;
    const caps = s.dead ? [] : buildHitboxes({ pos: s, yaw: s.yaw, crouch: a.crouchK, pitch: s.pitch, speed: Math.hypot(s.vx, s.vz) });
    while (a.hit.children.length < caps.length) a.hit.add(capsuleMesh());
    a.hit.children.forEach((m, i) => {
      m.visible = i < caps.length;
      if (m.visible) placeCapsule(m as THREE.Mesh, caps[i]);
    });
  }
}

function applyManual(a: Actor, m: Manual, pitch: number, keepYaw: boolean) {
  const s = a.avatar.state;
  if (!keepYaw) s.yaw = Math.PI; // de frente para a câmera
  // velocidade definida relativa à mira (como WASD)
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  s.vx = m.vx * c + m.vz * sn;
  s.vz = -m.vx * sn + m.vz * c;
  s.crouch = 'crouch' in m && m.crouch === true;
  s.dead = 'dead' in m && m.dead === true;
  s.pitch = pitch;
  if (!keepYaw && 'jump' in m && m.jump && s.grounded && s.y === 0) jump(a);
  if (!keepYaw) gravity(a, 1 / 60);
}

function jump(a: Actor) {
  const s = a.avatar.state;
  s.vy = JUMP;
  s.grounded = false;
  s.y = Math.max(s.y, 0.001);
}

function gravity(a: Actor, dt: number) {
  const s = a.avatar.state;
  if (s.grounded) return;
  s.vy -= GRAVITY * dt;
  s.y += s.vy * dt;
  if (s.y <= 0) {
    s.y = 0;
    s.vy = 0;
    s.grounded = true;
  }
}
