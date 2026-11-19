// Quem assiste uma sala online (Modo Live): mesmo mapa, bonecos, rastros, impactos e som
// da partida, sem jogador próprio. Câmeras: livre, 3ª pessoa, 1ª pessoa e diretor
// automático. O anfitrião da live ganha a sobreposição de transmissão (live-overlay.ts);
// quem caiu na fila de espera vira jogador sozinho quando o servidor abre a vaga.
import * as THREE from 'three';
import { GrenadeVisuals, grenadeEffect } from '../grenades';
import { Predict, type Room } from '@colyseus/sdk';
import { type DroneEventMsg, type KillFeedEvent, MSG, scoreboard, type ShotMsg } from '../../net/feed';
import { attachPlayers } from '../../net/client';
import type { NetMap } from '../../net/maps';
import { getMap } from '../../net/maps';
import { INTERP_DELAY_MS, type FlatPlayer } from '../../net/protocol';
import type { ArenaState, NetPlayer } from '../../net/schema';
import { roleOf } from '../../net/role';
import { type AudienceMsg, type BenchedMsg, SPECTATE_MSG } from '../../net/spectate';
import { eyeOffset } from '../../sim/crouch';
import { ARSENAL } from '../../sim/weapons';
import { soundLineOfSight } from '../audio/spatial';
import { Sfx } from '../juice';
import { buildMap } from '../maps/build';
import { OnlineFx } from '../online/fx';
import { OnlineObjectives } from '../online/objectives';
import { SlipperVisuals } from '../online/slippers';
import { createPipeline, type Pipeline } from '../render/pipeline';
import { initialQuality, type QualityState, stepQuality } from '../render/quality';
import { PALETTE } from '../toon';
import { Builder } from '../world/builder';
import { buildSky } from '../world/sky';
import { SpectatorCast } from './avatars';
import { type CameraMode, type CamPose, chasePose, poseDistance, smoothPose, stepFree, turn } from './cameras';
import { SpectatorControls } from './controls';
import { AutoDirector } from './director';
import { SpectatorHud } from './hud';
import { LiveOverlay } from './live-overlay';

const FOV = 75;
/** Corte seco (troca de jogador) quando a câmera pularia mais que isto (m). */
const CUT_DISTANCE = 6;

export interface SpectatorOptions {
  /** Tela da live do anfitrião (QR, placar da sessão, pódio). */
  host: boolean;
  /** Entrou pela fila (sala cheia): avisa e passa a jogador quando abrir vaga. */
  waiting: boolean;
  /** Link de convite de JOGADOR (vai no QR). */
  inviteLink?: string;
  /** O servidor deu a vaga: quem criou isto troca para o jogo (sem sair da sala). */
  onSeat?: () => void;
  /** Saiu da partida pelo rodízio "quem perde sai" (aviso com a posição na fila). */
  benched?: BenchedMsg;
}

export class SpectatorView {
  private readonly renderer: THREE.WebGLRenderer;
  readonly pipeline: Pipeline;
  quality: QualityState = initialQuality(location.search);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 300);
  readonly sfx = new Sfx();
  readonly clock = new THREE.Clock();
  private readonly predict: Predict;
  private readonly fx: OnlineFx;
  private readonly slippers: SlipperVisuals;
  private readonly grenades = new GrenadeVisuals(this.scene);
  private readonly objectives: OnlineObjectives;
  private readonly cast: SpectatorCast;
  private readonly hud: SpectatorHud;
  private readonly overlay: LiveOverlay | null;
  private readonly controls: SpectatorControls;
  readonly director = new AutoDirector();
  private readonly map: NetMap;
  private world: ((dt: number, time: number) => void) | null = null;
  private readonly unsubscribe: (() => void)[] = [];
  /** Câmera escolhida e quem ela segue (2ª/3ª pessoa). */
  mode: CameraMode = 'director';
  followed: string | null = null;
  private pose: CamPose = { x: 0, y: 14, z: 26, yaw: 0, pitch: -0.4 };
  private shown: string | null = null;
  private shownMode: CameraMode = 'director';
  /** Quem estava no plano do quadro anterior (mudou = corte seco). */
  private shotId: string | null = null;
  private audience: AudienceMsg | null = null;
  private time = 0;
  private seated = false;
  /** Desfaz os attachAll (o `predict.dispose()` do SDK não remove os callbacks da coleção). */
  private readonly detachPlayers: () => void;
  private disposed = false;
  private readonly onResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement, readonly room: Room<unknown, ArenaState>, private readonly opts: SpectatorOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.pipeline = createPipeline(this.renderer, this.scene, this.camera);
    this.hud = new SpectatorHud(opts.host);
    this.scene.add(this.camera);
    this.fx = new OnlineFx(this.scene, this.camera, this.sfx);
    this.fx.setArmed(false);
    this.slippers = new SlipperVisuals(this.scene, this.camera);
    // Drone da OTIMIZA: o mesmo visual da partida, com anúncios neutros de quem assiste
    this.objectives = new OnlineObjectives(this.scene, { camera: this.camera, sfx: this.sfx, juice: this.fx.juice, particles: this.fx.particles, announce: (...a) => this.hud.competitive.announce(...a), observer: true });
    this.predict = Predict.get(room, { mode: 'lerp', delay: INTERP_DELAY_MS }) as unknown as Predict;
    // Todos os jogadores desenhados ~100 ms no passado, entre dois estados (como os remotos)
    this.detachPlayers = attachPlayers(this.predict, room, [
      { mode: 'lerp', fields: ['x', 'y', 'z', 'vx', 'vy', 'vz', 'crouchAmount'], snap: 5 },
      { mode: 'lerp', fields: ['yaw', 'pitch'], angle: true },
    ]);
    this.cast = new SpectatorCast(this.scene, this.predict, this.sfx);
    this.map = getMap(room.state.mapId);
    this.buildWorld(this.map);
    this.overlay = opts.host && opts.inviteLink ? new LiveOverlay(room.roomId, opts.inviteLink) : null;
    this.controls = new SpectatorControls(canvas, {
      mode: (m) => this.setMode(m),
      cycle: (step) => this.cycle(step),
      toggleInvite: () => this.overlay?.toggleInvite(),
      gesture: () => this.sfx.unlock(),
    }, () => this.mode === 'free');
    this.unsubscribe.push(
      room.onMessage(MSG.shot, (m: ShotMsg) => this.onShot(m)),
      room.onMessage(MSG.kill, (e: KillFeedEvent) => this.onKill(e)),
      room.onMessage(MSG.drone, (e: DroneEventMsg) => { if (!this.disposed) this.objectives.arena?.onEvent(e, room.sessionId); }),
      room.onMessage(SPECTATE_MSG.audience, (a: AudienceMsg) => { this.audience = a; }),
      // Promovido, o servidor já mede o ping antes de o jogo assumir: responde igual ao jogo
      room.onMessage(MSG.sync, (n: unknown) => room.send(MSG.syncAck, n)),
    );
    if (opts.waiting) {
      // Vaga pelo papel do servidor + estado (aba em segundo plano não roda quadros). A vaga
      // pode ter chegado antes desta tela existir (import): confere também logo de saída.
      const onState = () => queueMicrotask(() => this.checkSeat());
      room.onStateChange(onState);
      this.unsubscribe.push(() => room.onStateChange.remove(onState), roleOf(room).on(onState));
      onState();
    }
    const onLeave = () => this.hud.setStatus('Desconectado do servidor · recarregue a página');
    room.onLeave(onLeave);
    this.unsubscribe.push(() => room.onLeave.remove(onLeave));
    for (const id of ['wave', 'score', 'allies', 'boss', 'hack-ring', 'hack-label']) document.getElementById(id)?.style.setProperty('display', 'none');
    window.addEventListener('resize', this.onResize);
    this.resize();
    if (this.quality.level > 0) this.pipeline.setQuality(this.quality.level);
  }

  start() {
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  private buildWorld(map: NetMap) {
    this.sfx.mixer.setOcclusion((from, to) => soundLineOfSight(from, to, map.shotBlockers));
    this.fx.setShotBlockers(map.shotBlockers);
    if (map.data) {
      const world = buildMap(this.scene, map.data);
      this.fx.setImpactSurfaces(world.impactSurfaces ?? []);
      this.world = (dt, time) => world.update(dt, time);
    } else {
      const b = new Builder(this.scene);
      const sky = buildSky(this.scene, b);
      for (const k of map.blocks) b.block(k.min.x, k.min.y, k.min.z, k.max.x, k.max.y, k.max.z, PALETTE[k.paint], { cast: k.min.y > -0.5 });
      b.finish();
      this.fx.setImpactSurfaces(b.impactSurfaces);
      this.world = sky;
    }
    // Começa vendo o mapa do alto, de um ponto de nascimento
    const s = map.spawns[0];
    if (s) this.pose = { x: s.x, y: s.y + 12, z: s.z + 14, yaw: 0, pitch: -0.55 };
    this.pipeline.refreshShadows();
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.pipeline.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Troca de câmera; seguir sem ninguém escolhido pega quem o diretor mostra. */
  setMode(mode: CameraMode) {
    if (mode !== 'free' && mode !== 'director' && !this.followed) this.followed = this.shown ?? this.director.target;
    this.mode = mode;
  }

  /** Próximo/anterior jogador (sai do diretor e da câmera livre para a 3ª pessoa). */
  cycle(step: 1 | -1) {
    const ids = [...this.room.state.players.keys()];
    if (ids.length === 0) return;
    const from = this.mode === 'chase' || this.mode === 'eyes' ? this.followed : this.shown;
    const i = from ? ids.indexOf(from) : -1;
    this.followed = ids[(i + step + ids.length) % ids.length];
    if (this.mode === 'free' || this.mode === 'director') this.mode = 'chase';
  }

  frame(now = performance.now()) {
    if (this.disposed) return;
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    this.time += dt;
    const before = this.quality.level;
    this.quality = stepQuality(this.quality, rawDt * 1000, dt);
    if (this.quality.level !== before) {
      this.pipeline.setQuality(this.quality.level);
      this.resize();
    }
    const st = this.room.state;
    this.predict.tick(now);
    if (this.checkSeat()) return;
    const players = [...st.players];
    const target = this.director.update(dt, players.map(([id, p]) => ({ id, alive: p.hp > 0 })));
    if (this.followed && !st.players.has(this.followed)) this.followed = null;
    const mode = this.mode !== 'director' && this.mode !== 'free' && !this.followed ? 'director' : this.mode;
    const shown = mode === 'director' ? target : mode === 'free' ? null : this.followed;
    this.placeCamera(mode, shown, shown ? st.players.get(shown) ?? null : null, dt);
    this.shown = shown ?? this.shown;
    const eyes = mode === 'eyes' && shown ? shown : null;
    this.cast.update(st.players, this.map, st.phase === 'playing', eyes, dt);
    this.camera.updateMatrixWorld();
    this.sfx.mixer.updateListener(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()), this.camera.up, this.quality.level);
    const eyesPlayer = eyes ? st.players.get(eyes) : undefined;
    this.fx.setArmed(!!eyesPlayer && eyesPlayer.hp > 0);
    this.fx.update(dt, this.pose.yaw, this.pose.pitch, eyesPlayer as unknown as FlatPlayer | undefined, eyesPlayer?.aimAmount ?? 0);
    this.grenades.update(st.grenades);
    this.slippers.update(dt, st.slippers, false);
    const focus = shown ? st.players.get(shown) : undefined;
    this.objectives.sync(st.drones, this.time, focus?.team || 'a', { me: this.room.sessionId, players: st.players, dt, feet: id => this.cast.get(id)?.object.position ?? null });
    this.updateHud(dt, mode, shown);
    this.camera.updateMatrixWorld();
    this.world?.(dt, this.time);
    this.pipeline.render();
  }

  /**
   * A vaga abriu: o jogo assume a mesma conexão (uma vez só). Vale o papel do servidor
   * (`vaga {seat}`) com o NetPlayer daquela geração já no estado — o boneco antigo de quem
   * acabou de ir para o banco não conta.
   */
  private checkSeat(): boolean {
    if (this.disposed || !this.opts.waiting || this.seated) return this.seated;
    if (!roleOf(this.room).seated(this.room.state.players, this.room.sessionId)) return false;
    this.seated = true;
    this.opts.onSeat?.();
    return true;
  }

  private placeCamera(mode: CameraMode, id: string | null, p: NetPlayer | null, dt: number) {
    const turned = this.controls.takeTurn();
    let want: CamPose;
    let rate = 0;
    if (mode === 'free' || !p) {
      want = stepFree(turn(this.pose, turned.yaw, turned.pitch), this.controls.fly(), dt);
    } else {
      const v = (f: 'x' | 'y' | 'z' | 'yaw' | 'pitch' | 'crouchAmount') => this.cast.value(p, f);
      const eye = { x: v('x'), y: v('y') + eyeOffset({ crouchAmount: v('crouchAmount') }), z: v('z') };
      if (mode === 'eyes') {
        want = { ...eye, yaw: v('yaw'), pitch: v('pitch') + p.recoil };
        rate = 40;
      } else {
        // Morto: a câmera sobe um pouco e olha o corpo (sem girar com a mira dele)
        const dead = p.hp <= 0;
        want = chasePose(eye, dead ? this.pose.yaw : v('yaw'), dead ? -0.5 : v('pitch'), this.map.solids);
        rate = mode === 'director' ? 7 : 12;
      }
    }
    const changed = mode !== this.shownMode || id !== this.shotId;
    this.shownMode = mode;
    this.shotId = id;
    // Troca de plano (outro jogador ou outra câmera longe): corte seco, como numa transmissão
    this.pose = rate === 0 || changed || poseDistance(this.pose, want) > CUT_DISTANCE ? want : smoothPose(this.pose, want, dt, rate);
    this.camera.position.set(this.pose.x, this.pose.y, this.pose.z);
    this.camera.rotation.set(this.pose.pitch, this.pose.yaw, 0, 'YXZ');
  }

  private updateHud(dt: number, mode: CameraMode, shown: string | null) {
    const st = this.room.state;
    const rows = scoreboard(st.players);
    const focus = shown ? st.players.get(shown) : undefined;
    this.hud.setCamera(mode, focus ? { name: focus.name, bot: focus.bot, hp: focus.hp } : null);
    this.hud.setMatch({
      phase: st.phase, timeLeft: st.timeLeft, killLimit: st.killLimit, match: st.match, mode: st.mode, scoreA: st.scoreA, scoreB: st.scoreB,
      winnerName: st.winnerName, winnerTeam: st.winnerTeam, drawn: st.drawn, rows,
    }, shown ?? '', dt);
    this.hud.setWaiting(this.opts.waiting && !this.seated ? { place: this.audience?.place ?? this.opts.benched?.place ?? Math.max(1, this.audience?.waiting ?? 1), benched: !!this.opts.benched } : null);
    if (!this.overlay) return;
    const teams = st.mode === 'tdm' || st.mode === 'hack';
    const winner = st.drawn ? 'empate' : teams ? (st.winnerTeam === 'a' ? 'Equipe A' : st.winnerTeam === 'b' ? 'Equipe B' : '') : st.winnerName;
    this.overlay.setAudience(this.audience, st.players.size);
    this.overlay.update(dt, {
      match: st.match,
      rows: rows.map(r => ({ name: r.name, kills: r.kills, deaths: r.deaths, bot: r.bot, ...(r.team ? { team: r.team } : {}) })),
      winnerName: st.winnerName, winnerTeam: st.winnerTeam, drawn: st.drawn,
    }, st.phase, st.timeLeft, winner);
  }

  private onShot(m: ShotMsg) {
    if (this.disposed) return;
    this.director.note({ type: 'shot', by: m.by, target: m.t, damage: m.dmg });
    this.fx.worldShot(m);
    grenadeEffect(m, this.sfx, this.fx.particles);
    // Tiro do drone sai do drone, com o som dele (a arma do dono não se mexe); acerto no drone pisca
    this.objectives.arena?.onShot(m, (from, to, team) => this.fx.remoteShot(from, to, 'mk2', team, false), this.room.sessionId);
    const end = { x: m.e[0], y: m.e[1], z: m.e[2] };
    const slipper = m.weapon === 'chinelo' || m.weapon === 'chinelo-arremesso';
    if (!m.continuation && !slipper && m.weapon !== 'drone' && m.weapon !== 'grenade') {
      const index = Math.max(0, ARSENAL.findIndex(w => w.id === m.weapon));
      const shooter = this.cast.get(m.by);
      const from = shooter ? shooter.fire(index) : new THREE.Vector3(...m.o);
      this.fx.remoteMuzzle(from, end);
      for (const [i, e] of (m.pellets ?? [m.e]).entries()) this.fx.remoteShot(from, { x: e[0], y: e[1], z: e[2] }, m.weapon, this.cast.teamOf(m.by), i === 0, m.by);
    } else if (!m.continuation && slipper) {
      this.sfx.slipper(m.weapon === 'chinelo' ? 'melee' : 'throw', { x: m.o[0], y: m.o[1], z: m.o[2] }, m.by);
    }
    if (!m.t || !m.part) return;
    if ((m.dmg ?? 0) > 0 && slipper) this.sfx.slap(end);
    this.cast.get(m.t)?.react(m.part);
    // Acerto em quem está em cena: mesmo retorno visual de quem atira (sem o som de "seu acerto")
    if (m.by === this.shown && (m.dmg ?? 0) > 0) this.fx.particles.burst(new THREE.Vector3(end.x, end.y, end.z), m.k ? PALETTE.paper : PALETTE.pink, m.k ? 14 : 5, m.k ? 9 : 5, m.k ? 0.18 : 0.09);
  }

  private onKill(e: KillFeedEvent) {
    if (this.disposed) return;
    this.director.note({ type: 'kill', killerId: e.killerId, victimId: e.victimId });
    this.hud.kill(e, this.shown ?? '');
  }

  /** Para testes no navegador (`?debug`): estado da câmera e da sala. */
  debugInfo() {
    const st = this.room.state;
    return {
      room: this.room.roomId,
      me: this.room.sessionId,
      mode: this.mode,
      shown: this.shown,
      followed: this.followed,
      director: this.director.target,
      camera: { ...this.pose },
      players: [...st.players].map(([id, p]) => ({ id, name: p.name, bot: p.bot, hp: p.hp, kills: p.kills })),
      phase: st.phase,
      match: st.match,
      audience: this.audience,
      session: this.overlay?.session.view() ?? null,
      inviteShown: this.overlay?.inviteShown ?? null,
    };
  }

  /** Larga a tela (a sala só é deixada se `leave`: o espectador promovido continua nela). */
  dispose(leave = false) {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    for (const off of this.unsubscribe) off();
    this.detachPlayers();
    this.predict.dispose();
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.hud.destroy();
    this.overlay?.destroy();
    this.cast.dispose();
    this.slippers.dispose();
    this.grenades.dispose();
    this.objectives.dispose();
    this.fx.dispose();
    this.sfx.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // o canvas é trocado: o contexto antigo não fica vivo
    if (leave) void this.room.leave();
  }
}
