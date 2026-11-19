// Drone da OTIMIZA na Arena: só visual e som. Regras, vida, dono e tiros chegam do servidor
// (src/net/arena-drone.ts). Neutro amarelo (cor da OTIMIZA), pane ao ser hackeado, ciano
// quando é seu e rosa quando é de outro; laser de mira, tiro, explosão e inimigos marcados.
import * as THREE from 'three';
import { ARENA_DRONE, DRONE_ID, markedEnemies } from '../../net/arena-drone';
import type { DroneEventMsg, ShotMsg } from '../../net/feed';
import type { HackDrone } from '../../net/hack-objectives';
import { HACK_RULES } from '../../net/hack-objectives';
import type { Vec3 } from '../../sim/vec';
import { faceMaterial } from '../drones';
import type { MinimapDot } from '../hud/types';
import type { AnnounceStyle } from '../hud/announcer';
import type { Juice, Sfx } from '../juice';
import type { Particles } from '../particles';
import { addOutline, GLOW, hex, outlineMaterial, PALETTE, toon } from '../toon';

export interface OtimizaDroneDeps {
  camera: THREE.Camera;
  sfx: Sfx;
  juice: Juice;
  particles: Particles;
  announce: (title: string, line: string, style: AnnounceStyle, seconds: number) => void;
  /** Quem assiste (Modo Live): anúncios neutros, em 3ª pessoa, sem "você". */
  observer?: boolean;
}

/** Quem está onde (pés), para laser e marcadores; `null` = não desenhado. */
export type FeetLookup = (id: string) => Vec3 | null;

const SEGMENTS = 16;
const MARKERS = 7;
const glow = (c: number) => new THREE.Color(c).multiplyScalar(GLOW);
const overlay = (c: number, opacity = 1) => new THREE.MeshBasicMaterial({ color: glow(c), transparent: true, opacity, depthWrite: false, depthTest: false });

export class OtimizaDroneView {
  private readonly root = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly outline: THREE.Mesh;
  private readonly face: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly segments: THREE.Mesh[] = [];
  private readonly laser: THREE.Mesh;
  private readonly markers: THREE.Mesh[] = [];
  private readonly bar = document.createElement('div');
  private readonly barFill = document.createElement('i');
  private readonly barText = document.createElement('b');
  private shown = false;
  private flash = 0;
  private glitch = 0;
  private status = '';
  private dots: MinimapDot[] = [];
  private suspended = false;
  private readonly hud: boolean;

  /** `hud: false` = só o drone (replay): sem barra de canalização nem marcadores. */
  constructor(scene: THREE.Scene, private readonly deps: OtimizaDroneDeps, opts: { hud?: boolean } = {}) {
    this.hud = opts.hud ?? true;
    this.body = new THREE.Mesh(new THREE.SphereGeometry(ARENA_DRONE.half, 18, 12), toon(PALETTE.paper));
    this.outline = addOutline(this.body, 0.05, PALETTE.yellow);
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.33), faceMaterial('enemy'));
    this.face.position.set(0, 0.03, ARENA_DRONE.half - 0.01);
    this.body.add(this.face);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 24), toon(PALETTE.yellow));
    this.ring.rotation.x = Math.PI / 2;
    this.root.add(this.body, this.ring);
    // Barra de canalização em volta do drone: um gomo aceso por 1/16 do progresso
    const seg = new THREE.BoxGeometry(0.16, 0.05, 0.05);
    for (let i = 0; i < SEGMENTS; i++) {
      const m = new THREE.Mesh(seg, overlay(PALETTE.cyan));
      const a = (i / SEGMENTS) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.85, 0.75, Math.sin(a) * 0.85);
      m.rotation.y = -a;
      m.renderOrder = 10;
      this.segments.push(m);
      this.root.add(m);
    }
    const beam = new THREE.CylinderGeometry(0.018, 0.018, 1, 6, 1, true);
    beam.rotateX(Math.PI / 2);
    beam.translate(0, 0, 0.5);
    this.laser = new THREE.Mesh(beam, new THREE.MeshBasicMaterial({ color: glow(PALETTE.pink), transparent: true, opacity: 0.6, depthWrite: false }));
    // Marcador de inimigo visto pelo drone: losango que aparece através das paredes
    const diamond = new THREE.OctahedronGeometry(0.2);
    diamond.scale(1, 1.5, 0.35);
    for (let i = 0; i < MARKERS; i++) {
      const m = new THREE.Mesh(diamond, overlay(PALETTE.pink, 0.9));
      m.renderOrder = 11;
      this.markers.push(m);
    }
    for (const o of [this.root, this.laser, ...this.markers]) o.traverse(n => { n.raycast = () => {}; });
    this.root.visible = this.laser.visible = false;
    for (const m of this.markers) m.visible = false;
    scene.add(this.root, this.laser, ...this.markers);
    this.bar.style.cssText = `position:fixed;left:50%;top:calc(50% + 54px);transform:translateX(-50%);z-index:8;width:180px;padding:4px 8px 6px;font:800 12px system-ui;letter-spacing:.08em;text-align:center;color:${hex(PALETTE.cyan)};background:${hex(PALETTE.ink)}d9;border:2px solid ${hex(PALETTE.cyan)};border-radius:4px;pointer-events:none`;
    this.barFill.style.cssText = `display:block;height:6px;margin-top:4px;width:0;background:${hex(PALETTE.cyan)};box-shadow:0 0 8px ${hex(PALETTE.cyan)}`;
    this.bar.append(this.barText, this.barFill);
    this.bar.hidden = true;
    if (this.hud) document.body.append(this.bar);
  }

  /** Replay no controle: esconde o drone ao vivo (e cala os tiros dele) até voltar. */
  suspend(on: boolean) {
    if (on && !this.suspended) this.hide();
    this.suspended = on;
  }

  /** Linha de objetivo do HUD (canto). */
  get hudStatus(): string { return this.status; }
  /** Pontos do minimapa: o drone e, se for seu, os inimigos marcados. */
  get minimapDots(): MinimapDot[] { return this.dots; }

  /** Por quadro, com o estado sincronizado do drone (ou nada, se não há drone). */
  sync(d: HackDrone | undefined, me: string, players: Iterable<[string, { x: number; y: number; z: number; hp: number }]>, feet: FeetLookup, dt: number, time: number) {
    this.flash = Math.max(0, this.flash - dt);
    this.glitch = Math.max(0, this.glitch - dt);
    if (!d || this.suspended) { this.hide(); return; }
    const mine = d.owner === me;
    const color = d.phase === 'ally' || (d.phase === 'leaving' && d.owner) ? (mine ? PALETTE.cyan : PALETTE.pink) : PALETTE.yellow;
    const target = new THREE.Vector3(d.x, d.y + (d.phase === 'free' ? Math.sin(time * 2.2) * 0.12 : 0), d.z);
    if (!this.shown) { this.root.position.copy(target); this.root.scale.setScalar(0.01); }
    this.shown = this.root.visible = true;
    this.root.position.lerp(target, Math.min(1, dt * 14));
    this.root.scale.setScalar(Math.min(1, this.root.scale.x + dt * 3));
    const hacking = !!d.hackerId && d.phase === 'free';
    // Pane: treme e pisca a estática enquanto alguém canaliza
    if (hacking || this.glitch > 0) this.root.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08));
    // Livre: gira devagar; aliado: vira o visor para quem está mirando
    if (d.phase !== 'ally') this.root.rotation.y = time * 0.8;
    else if (d.target) this.root.rotation.y = this.aimYaw(d.target, feet) ?? this.root.rotation.y;
    this.body.material = toon(this.flash > 0 || color === PALETTE.yellow ? PALETTE.paper : color);
    this.outline.material = outlineMaterial(this.flash > 0 ? PALETTE.paper : color);
    this.ring.material = toon(color);
    this.ring.rotation.z = time * (d.contested ? 9 : 3);
    this.ring.scale.setScalar(d.contested ? 1.25 + Math.sin(time * 20) * 0.08 : 1);
    this.face.material = faceMaterial((hacking || this.glitch > 0) && Math.sin(time * 40) > -0.3 ? 'glitch' : mine ? 'ally' : 'enemy');
    const lit = hacking ? Math.round(d.progress * SEGMENTS) : 0;
    for (const [i, s] of this.segments.entries()) s.visible = i < lit;
    this.updateLaser(d, feet);
    this.updateMarkers(d, mine, players, feet, time);
    this.updateHud(d, me, players);
  }

  /** Tiro do drone (rastro saindo dele) ou tiro que acertou o drone. */
  onShot(m: ShotMsg, remoteShot: (from: THREE.Vector3, end: Vec3, team: 'ally' | 'enemy') => void, me: string) {
    if (this.suspended) return;
    if (m.weapon === 'drone') {
      const from = this.shown ? this.root.position.clone() : new THREE.Vector3(...m.o);
      remoteShot(from, { x: m.e[0], y: m.e[1], z: m.e[2] }, m.by === me ? 'ally' : 'enemy');
      this.deps.sfx.droneShot({ x: from.x, y: from.y, z: from.z });
      // O seu fica colado na câmera: faísca só no dos outros (senão vira cubo gigante na tela)
      if (m.by !== me) this.deps.particles.burst(from, PALETTE.pink, 3, 3, 0.06);
    }
    if (m.t === DRONE_ID && (m.dmg ?? 0) > 0) {
      this.flash = 0.07;
      this.deps.particles.burst(new THREE.Vector3(...m.e), PALETTE.yellow, 5, 5, 0.08);
    }
  }

  /** Um passo do ciclo: anúncio, som e efeito. */
  onEvent(e: DroneEventMsg, me: string) {
    const { sfx, juice, particles, camera, announce } = this.deps;
    const at = new THREE.Vector3(e.x, e.y, e.z);
    if (e.kind === 'spawn') {
      sfx.charge();
      announce('DRONE DE VIGILÂNCIA', `OTIMIZA: drone de vigilância no ${e.zone}! Hackeie primeiro.`, 'otimiza', 3.6);
    } else if (e.kind === 'hacked') {
      this.glitch = 0.5;
      particles.burst(at, PALETTE.cyan, 14, 7, 0.12);
      particles.burst(at, PALETTE.pink, 8, 6, 0.1);
      juice.onomatopoeia(at, camera, false, 'HACK!', 'hack');
      sfx.hack();
      if (this.deps.observer) announce('DRONE HACKEADO', `${e.ownerName ?? 'Alguém'} ganhou um drone aliado por ${ARENA_DRONE.allyLife} s`, 'neutral', 2.6);
      else if (e.owner === me) announce('HACKEADO!', `Drone aliado por ${ARENA_DRONE.allyLife} s · inimigos perto dele ficam marcados`, 'ally', 2.6);
      else announce('DRONE HACKEADO', `${e.ownerName ?? 'Alguém'} ganhou um drone aliado. Derrube!`, 'enemy', 2.6);
    } else if (e.kind === 'down') {
      const pos = this.shown ? this.root.position.clone() : at;
      particles.burst(pos, PALETTE.yellow, 18, 10, 0.16);
      particles.burst(pos, PALETTE.ink, 12, 7, 0.14);
      particles.burst(pos, PALETTE.pink, 10, 8, 0.12);
      juice.onomatopoeia(pos, camera, true, 'KABUM!');
      sfx.overload({ x: pos.x, y: pos.y, z: pos.z });
      this.hide();
      if (this.deps.observer) announce('DRONE ABATIDO', `${e.byName ?? 'Alguém'} derrubou o drone${e.ownerName ? ` de ${e.ownerName}` : ''}`, 'neutral', 2.4);
      else if (e.by === me) { juice.impactFrame(); announce('DRONE ABATIDO', 'A OTIMIZA vai mandar outro…', 'ally', 2.4); }
      else if (e.owner === me) announce('SEU DRONE CAIU', `${e.byName ?? 'Alguém'} derrubou seu aliado`, 'enemy', 2.4);
    } else if (e.kind === 'leave' && e.owner === me && !this.deps.observer) {
      announce('', 'Drone voltou para a OTIMIZA', 'neutral', 2);
    }
  }

  private aimYaw(id: string, feet: FeetLookup): number | null {
    const t = feet(id);
    return t ? Math.atan2(t.x - this.root.position.x, t.z - this.root.position.z) : null;
  }

  private updateLaser(d: HackDrone, feet: FeetLookup) {
    const t = d.phase === 'ally' && d.target ? feet(d.target) : null;
    this.laser.visible = !!t;
    if (!t) return;
    const to = new THREE.Vector3(t.x, t.y + 1.15, t.z);
    this.laser.position.copy(this.root.position);
    this.laser.lookAt(to);
    this.laser.scale.set(1, 1, this.root.position.distanceTo(to));
  }

  private updateMarkers(d: HackDrone, mine: boolean, players: Iterable<[string, { x: number; y: number; z: number; hp: number }]>, feet: FeetLookup, time: number) {
    const marked = mine && this.hud ? markedEnemies(d, players) : [];
    // 'self' = amarelo (neutro); indo embora não aparece mais
    this.dots = d.phase === 'leaving' ? [] : [{ x: d.x, z: d.z, rel: d.phase === 'ally' ? (mine ? 'ally' : 'enemy') : 'self', kind: 'drone' }];
    let used = 0;
    for (const id of marked) {
      const f = feet(id);
      if (!f || used >= MARKERS) continue;
      const m = this.markers[used++];
      m.visible = true;
      m.position.set(f.x, f.y + 2.25 + Math.sin(time * 5 + used) * 0.06, f.z);
      m.rotation.y = time * 3;
      this.dots.push({ x: f.x, z: f.z, rel: 'enemy' });
    }
    for (let i = used; i < MARKERS; i++) this.markers[i].visible = false;
  }

  private updateHud(d: HackDrone, me: string, players: Iterable<[string, { hp: number }]>) {
    if (!this.hud) return;
    const channeling = d.phase === 'free' && d.hackerId === me;
    this.bar.hidden = !channeling;
    if (channeling) {
      this.barText.textContent = d.contested ? 'DISPUTADO!' : `HACKEANDO ${Math.round(d.progress * 100)}%`;
      this.barFill.style.width = `${Math.round(d.progress * 100)}%`;
    }
    let alive = true;
    for (const [id, p] of players) if (id === me) alive = p.hp > 0;
    if (d.phase === 'free') this.status = channeling ? (d.contested ? 'Drone disputado: tire o rival da frente!' : `Hackeando o drone · ${Math.round(d.progress * 100)}%`)
      : alive ? `Drone da OTIMIZA no ${d.zone}: segure E mirando nele a até ${HACK_RULES.range} m por ${HACK_RULES.channel} s` : '';
    else if (d.phase === 'ally') this.status = d.owner === me ? `Drone aliado · ${Math.ceil(d.timer ?? 0)} s · ${Math.round(d.hp ?? 0)} de vida` : 'Drone inimigo no ar: derrube!';
    else this.status = '';
  }

  private hide() {
    this.shown = this.root.visible = this.laser.visible = false;
    for (const m of this.markers) m.visible = false;
    for (const s of this.segments) s.visible = false;
    this.bar.hidden = true;
    this.status = '';
    this.dots = [];
  }

  dispose() {
    this.root.removeFromParent();
    this.laser.removeFromParent();
    for (const m of this.markers) m.removeFromParent();
    this.bar.remove();
    this.body.geometry.dispose();
    this.ring.geometry.dispose();
    this.face.geometry.dispose();
    this.segments[0]?.geometry.dispose();
    this.laser.geometry.dispose();
    this.markers[0]?.geometry.dispose();
  }
}
