// Reprodução de um `ReplayClip` na cena do jogo: câmera no olho de quem é o ponto de vista
// (yaw/pitch gravados), bonecos próprios do replay para todo mundo (você incluído) e os tiros
// gravados de novo (rastro, som, tranco no alvo). Os bonecos ao vivo ficam escondidos por
// quem chama. O drone da OTIMIZA gravado aparece no lugar do ao vivo e os tiros dele saem
// dele (killcam de morte por drone: câmera atrás do drone). O ritmo (aceleração e câmera lenta) vem de replay-timing.ts.
import * as THREE from 'three';
import { ReplayGrenades } from './replay-grenades';
import { CROUCH } from '../../sim/crouch';
import { EYE_HEIGHT, PLAYER_HALF } from '../../sim/player';
import type { Box } from '../../sim/physics';
import { ARSENAL } from '../../sim/weapons';
import { DRONE_ID, DRONE_KIND } from '../../net/arena-drone';
import type { ShotMsg } from '../../net/feed';
import type { HackDrone } from '../../net/hack-objectives';
import type { AvatarFactory, AvatarPose, RemoteAvatar } from '../online-avatar';
import type { BlobTarget } from '../render/blobs';
import type { OnlineFx } from './fx';
import type { OtimizaDroneView } from './otimiza-drone';
import { type CameraView, droneKillcamView, droneShotOrigin, emptyDroneSample } from './replay-drone';
import { emptySample, type ReplayActor, type ReplayClip, type ReplayEvent } from './replay-recorder';
import { ReplayViewmodel } from './replay-viewmodel';

export interface PlaybackSpec {
  clip: ReplayClip;
  /** Pelos olhos de quem (id). */
  pov: string;
  from: number;
  to: number;
  /** Velocidade do replay no instante t (1 = tempo real). */
  speed: (t: number) => number;
  /** Chamado quando a reprodução passa por um evento gravado. */
  onEvent?: (e: ReplayEvent, at: THREE.Vector3) => void;
  /** Killcam de morte por drone: câmera atrás do drone olhando este jogador (id). */
  droneCam?: string;
}

interface PoolEntry {
  avatar: RemoteAvatar;
  team: 'ally' | 'enemy';
  name: string;
}

const BLOB_POOL = 16;

export class ReplayPlayer {
  private readonly pool = new Map<string, PoolEntry>();
  private spec: PlaybackSpec | null = null;
  private t = 0;
  private nextEvent = 0;
  private readonly sample = emptySample();
  private readonly povSample = emptySample();
  private weapon: ReplayViewmodel | null = null;
  private povPresent = false;
  private pendingStep = 0;
  private readonly cameraPosition = new THREE.Vector3();
  private readonly cameraRotation = new THREE.Quaternion();
  private readonly pose: AvatarPose = {
    position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, velocity: { x: 0, y: 0, z: 0 },
    crouching: false, crouchAmount: 0, jumping: false, dead: false, weaponIndex: 0, reloadRemaining: 0,
  };
  private readonly blobs: BlobTarget[] = Array.from({ length: BLOB_POOL }, () => ({ position: { x: 0, y: 0, z: 0 }, radius: 0.5 }));
  private readonly point = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly look = { yaw: 0, pitch: 0 };
  // Drone gravado (desenhado pelo mesmo visual do ao vivo, sem HUD)
  private readonly droneSample = emptyDroneSample();
  private readonly droneScratch = emptyDroneSample();
  private readonly droneFrom = new THREE.Vector3();
  private readonly droneState: HackDrone = { x: 0, y: 0, z: 0, team: '', hackerId: '', progress: 0, contested: false, kind: DRONE_KIND, phase: 'free', owner: '', target: '' };
  private readonly droneShot: ShotMsg = { by: '', seq: -1, o: [0, 0, 0], e: [0, 0, 0], weapon: 'drone' };
  private readonly droneView: CameraView = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private droneCamReady = false;
  private droneFresh = true;
  private readonly noPlayers: [string, { x: number; y: number; z: number; hp: number }][] = [];
  private readonly feetOf = (id: string) => this.pool.get(id)?.avatar.object.position ?? null;
  private readonly droneTrail = (from: THREE.Vector3, end: { x: number; y: number; z: number }, team: 'ally' | 'enemy') => this.fx.remoteShot(from, end, 'mk2', team, false, 'replay-drone');
  /** Paredes que a câmera do drone não atravessa (`map.shotBlockers`). */
  blockers: readonly Box[] = [];
  grenadeSolids: readonly Box[] = [];
  /** Velocidade atual (para o HUD saber se está em câmera lenta). */
  private readonly grenades: ReplayGrenades;
  speed = 1;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly fx: OnlineFx,
    private readonly factory: AvatarFactory,
    /** Visual do drone da OTIMIZA para o replay (sem ele, o drone não aparece). */
    private readonly drone: OtimizaDroneView | null = null,
  ) { this.grenades = new ReplayGrenades(scene); }

  get active() { return this.spec !== null; }
  /** Tempo atual do replay (linha do tempo do gravador). */
  get time() { return this.t; }
  get scoped() { return this.active && !!this.weapon?.scoped; }
  get reflex() { return this.active && !!this.weapon?.reflex; }

  /** Chamar após os efeitos ao vivo, que compartilham os uniforms do viewmodel. */
  present(baseFov: number) {
    if (!this.spec) return;
    this.camera.position.copy(this.cameraPosition);
    this.camera.quaternion.copy(this.cameraRotation);
    this.camera.updateMatrixWorld();
    if (this.povPresent && !this.spec.droneCam) this.weapon?.present(this.povSample, this.pendingStep, baseFov);
    else {
      this.weapon?.hide();
      this.camera.fov = baseFov;
      this.camera.updateProjectionMatrix();
    }
    this.pendingStep = 0;
  }

  /**
   * Cria antes os bonecos dos atores do trecho (o modelo animado carrega em segundo plano e
   * a cápsula cobre o intervalo). Times contam a partir de quem é o ponto de vista.
   */
  prepare(clip: ReplayClip, pov: string) {
    const povTeam = clip.actors[clip.slotOf(pov)]?.team ?? '';
    const keep = new Set<string>();
    for (const a of clip.actors) {
      keep.add(a.id);
      const team = a.id !== pov && povTeam && a.team === povTeam ? 'ally' : 'enemy';
      const name = label(a);
      let entry = this.pool.get(a.id);
      if (entry && (entry.team !== team || entry.name !== name)) {
        entry.avatar.dispose();
        entry = undefined;
      }
      if (!entry) {
        entry = { avatar: this.factory(name, { team }), team, name };
        entry.avatar.object.visible = false;
        this.scene.add(entry.avatar.object);
        this.pool.set(a.id, entry);
      }
    }
    for (const [id, entry] of this.pool) {
      if (keep.has(id)) continue;
      entry.avatar.dispose();
      this.pool.delete(id);
    }
  }

  start(spec: PlaybackSpec) {
    this.grenades.start(spec.clip.events, this.blockers, this.grenadeSolids);
    this.weapon?.stop();
    this.pendingStep = 0;
    if (!spec.droneCam) {
      this.weapon ??= new ReplayViewmodel(this.camera, this.scene);
      const slot = spec.clip.slotOf(spec.pov);
      if (spec.clip.sample(slot, spec.from, this.povSample)) this.weapon.reset(this.povSample.weapon);
    }
    this.prepare(spec.clip, spec.pov);
    this.spec = spec;
    this.t = spec.from;
    this.nextEvent = spec.clip.events.findIndex(e => e.t >= spec.from);
    if (this.nextEvent < 0) this.nextEvent = spec.clip.events.length;
    this.speed = spec.speed(this.t);
    this.droneCamReady = false;
    this.droneFresh = true;
    this.drive(0);
  }

  /** Avança `dt` segundos reais. Devolve true quando o trecho acabou. */
  update(dt: number): boolean {
    const spec = this.spec;
    if (!spec) return true;
    this.speed = spec.speed(this.t);
    const step = dt * this.speed;
    const before = this.t;
    this.t = Math.min(spec.to, this.t + step);
    this.drive(this.t - before);
    return this.t >= spec.to;
  }

  stop() {
    this.grenades.clear();
    this.spec = null;
    this.weapon?.stop();
    this.pendingStep = 0;
    for (const entry of this.pool.values()) entry.avatar.object.visible = false;
    this.drone?.sync(undefined, '', this.noPlayers, this.feetOf, 0, 0);
  }

  /** Sombras-bolha dos bonecos do replay (substitui as dos bonecos ao vivo). */
  blobTargets(out: BlobTarget[]) {
    out.length = 0;
    const spec = this.spec;
    if (!spec) return;
    for (let i = 0; i < spec.clip.actors.length && out.length < BLOB_POOL; i++) {
      if ((spec.clip.actors[i].id === spec.pov && !spec.droneCam) || !spec.clip.sample(i, this.t, this.sample) || !this.sample.alive) continue;
      const b = this.blobs[out.length];
      b.position.x = this.sample.x; b.position.y = this.sample.y; b.position.z = this.sample.z;
      out.push(b);
    }
  }

  dispose() {
    this.grenades.dispose();
    this.spec = null;
    this.weapon?.dispose();
    this.weapon = null;
    this.drone?.dispose();
    for (const entry of this.pool.values()) entry.avatar.dispose();
    this.pool.clear();
  }

  private drive(step: number) {
    const spec = this.spec!;
    const clip = spec.clip;
    const s = this.sample;
    this.povPresent = false;
    this.pendingStep += step;
    for (let i = 0; i < clip.actors.length; i++) {
      const a = clip.actors[i];
      const entry = this.pool.get(a.id);
      const ok = clip.sample(i, this.t, s);
      if (a.id === spec.pov && ok && !spec.droneCam) {
        this.placeCamera();
        Object.assign(this.povSample, s);
        this.povPresent = true;
        this.weapon?.viewmodel.setWeapon(s.weapon);
      }
      if (!entry) continue;
      const object = entry.avatar.object;
      // Quem é o ponto de vista continua animado (dá a ponta da arma), só invisível; na
      // câmera do drone o dono aparece como os outros
      object.visible = ok && (a.id !== spec.pov || !!spec.droneCam);
      if (!ok) continue;
      const p = this.pose;
      p.position.x = s.x; p.position.y = s.y - PLAYER_HALF.y; p.position.z = s.z;
      p.yaw = s.yaw; p.pitch = s.pitch;
      p.velocity.x = s.vx; p.velocity.y = s.vy; p.velocity.z = s.vz;
      p.crouchAmount = s.crouch; p.crouching = s.crouch > 0.5;
      p.jumping = !s.onGround; p.dead = !s.alive; p.weaponIndex = s.weapon;
      p.reloadRemaining = s.reload;
      entry.avatar.update(p, step);
    }
    this.driveDrone(step);
    this.grenades.update(this.t);
    this.camera.updateMatrixWorld();
    this.cameraPosition.copy(this.camera.position);
    this.cameraRotation.copy(this.camera.quaternion);
    const events = clip.events;
    while (this.nextEvent < events.length && events[this.nextEvent].t <= this.t) this.play(events[this.nextEvent++]);
  }

  /** Drone gravado no instante atual e, na killcam por drone, a câmera atrás dele. */
  private driveDrone(step: number) {
    const spec = this.spec!;
    const ds = this.droneSample;
    const ok = !!spec.clip.drone && spec.clip.drone.sample(this.t, ds);
    if (this.drone) {
      if (ok) {
        const d = this.droneState;
        d.x = ds.x; d.y = ds.y; d.z = ds.z;
        d.phase = ds.phase === 'hacking' ? 'free' : ds.phase;
        d.hackerId = ds.phase === 'hacking' ? ds.hacker : '';
        d.owner = ds.owner; d.target = ds.target; d.progress = ds.progress; d.contested = ds.contested;
        // Primeiro quadro: aparece já no lugar (sem a animação de chegada)
        this.drone.sync(d, spec.pov, this.noPlayers, this.feetOf, this.droneFresh ? 1 : step, this.t);
        this.droneFresh = false;
      } else {
        this.drone.sync(undefined, spec.pov, this.noPlayers, this.feetOf, step, this.t);
        this.droneFresh = true;
      }
    }
    if (!spec.droneCam) return;
    // Sem drone no ar neste instante: fica onde estava (ou nos olhos do dono, no começo)
    if (!ok) { if (!this.droneCamReady) this.eyesFallback(); return; }
    const slot = spec.clip.slotOf(spec.droneCam);
    const target = slot >= 0 && spec.clip.sample(slot, this.t, this.sample) ? this.sample : null;
    droneKillcamView(ds, target, this.droneView, this.blockers);
    this.droneCamReady = true;
    const v = this.droneView;
    this.camera.position.set(v.x, v.y, v.z);
    this.camera.rotation.set(v.pitch, v.yaw, 0, 'YXZ');
  }

  private eyesFallback() {
    const spec = this.spec!;
    const slot = spec.clip.slotOf(spec.pov);
    if (slot >= 0 && spec.clip.sample(slot, this.t, this.sample)) this.placeCamera();
  }

  private placeCamera() {
    const s = this.sample;
    // Mira sem tremida: os 30 Hz gravados já vêm interpolados; só suaviza o resto
    this.look.yaw = s.yaw;
    this.look.pitch = s.pitch;
    this.eye.set(s.x, s.y + EYE_HEIGHT - s.crouch * CROUCH.eyeDrop - (s.alive ? 0 : 1.1), s.z);
    this.camera.position.copy(this.eye);
    this.camera.rotation.set(this.look.pitch, this.look.yaw, s.alive ? 0 : 0.5, 'YXZ');
  }

  private play(e: ReplayEvent) {
    const spec = this.spec!;
    const end = this.point.set(e.e[0], e.e[1], e.e[2]);
    if (e.kind === 'shot') {
      const melee = e.weapon === 'chinelo' || e.weapon === 'chinelo-arremesso';
      if (e.weapon === 'drone' || e.target === DRONE_ID) this.playDroneShot(e);
      if (e.weapon === 'grenade' && e.grenadePhase) this.fx.grenade({ by: e.by, seq: -1, o: e.o, e: e.e, weapon: 'grenade', grenadePhase: e.grenadePhase });
      if (!melee && e.weapon !== 'drone' && e.weapon !== 'grenade' && !e.continuation) {
        const index = Math.max(0, ARSENAL.findIndex(w => w.id === e.weapon));
        const shooter = this.pool.get(e.by);
        const firstPerson = e.by === spec.pov && !spec.droneCam && this.povPresent && !!this.weapon;
        if (firstPerson) {
          this.povSample.weapon = index;
          this.weapon!.viewmodel.setWeapon(index);
          // `e.e` pode ser o pellet que acertou, não o primeiro da salva.
          this.weapon!.viewmodel.shot(e.pellets?.[0] ? new THREE.Vector3(...e.pellets[0]) : end);
          for (const pellet of e.pellets?.slice(1) ?? []) this.weapon!.viewmodel.pellet(new THREE.Vector3(...pellet));
        }
        const from = firstPerson
          ? this.weapon!.viewmodel.muzzleWorld()
          : shooter ? shooter.avatar.fire(index) : new THREE.Vector3(e.o[0], e.o[1], e.o[2]);
        const team = this.pool.get(e.by)?.team ?? 'enemy';
        const ends = e.pellets ?? [e.e];
        for (let i = 0; i < ends.length; i++) {
          const p = ends[i];
          this.fx.remoteShot(from, { x: p[0], y: p[1], z: p[2] }, e.weapon, e.by === spec.pov ? 'ally' : team, i === 0, `replay-${e.by}`, !firstPerson);
        }
      }
      if (e.target && e.damage > 0) {
        const part = e.part === 'head' || e.part === 'legs' ? e.part : 'torso';
        this.pool.get(e.target)?.avatar.react(part);
      }
    }
    spec.onEvent?.(e, end);
  }

  /**
   * Tiro do drone (sai do drone gravado, com o som dele; o dono não anima nem dispara) ou
   * tiro que acertou o drone (pisca). Mesmo caminho do ao vivo (`OtimizaDroneView.onShot`).
   */
  private playDroneShot(e: ReplayEvent) {
    if (e.continuation) return;
    const from = droneShotOrigin(this.spec!.clip.drone, e.t, e.o, this.droneScratch, this.droneFrom);
    if (!this.drone) {
      if (e.weapon === 'drone') this.fx.remoteShot(from.clone(), { x: e.e[0], y: e.e[1], z: e.e[2] }, 'mk2', e.by === this.spec!.pov ? 'ally' : 'enemy', true, 'replay-drone');
      return;
    }
    const m = this.droneShot;
    m.by = e.by; m.weapon = e.weapon as ShotMsg['weapon'];
    m.o[0] = from.x; m.o[1] = from.y; m.o[2] = from.z;
    m.e[0] = e.e[0]; m.e[1] = e.e[1]; m.e[2] = e.e[2];
    m.t = e.target || undefined;
    m.dmg = e.damage;
    this.drone.onShot(m, this.droneTrail, this.spec!.pov);
  }
}

function label(a: ReplayActor) {
  return a.bot ? `BOT ${a.name}` : a.name;
}
