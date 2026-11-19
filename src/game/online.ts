// Modo online (`?online`): cliente do multiplayer FFA. Conecta na sala (src/net/client.ts),
// manda só comandos, desenha o jogador local pela predição (resposta imediata, inclusive o
// tiro) e os outros pela interpolação (~100 ms no passado). Acerto, dano, morte e placar
// vêm do servidor (mensagens `shot`/`kill` e o estado). Treino com drones fica em game.ts.
import * as THREE from 'three';
import { GrenadeHud, GrenadeVisuals, grenadeEffect } from './grenades';
import { emptyCommand } from '../sim/command';
import { EYE_HEIGHT, MAX_HP, PLAYER_HALF } from '../sim/player';
import { CROUCH, eyeOffset } from '../sim/crouch';
import { connectOnline, inviteLink, type OnlineParams, type OnlineSession, parseOnlineParams, SpectatorSeat, withRoom } from '../net/client';
import type { Room } from '@colyseus/sdk';
import type { ArenaState } from '../net/schema';
import { type DroneEventMsg, type KillFeedEvent, MSG, type ScoreRow, scoreboard, type ShotMsg } from '../net/feed';
import type { NetMap } from '../net/maps';
import { writeWire } from '../net/protocol';
import type { NetPlayer } from '../net/schema';
import { roleOf } from '../net/role';
import { type BenchedMsg, SPECTATE_MSG } from '../net/spectate';
import { Input } from './input';
import { damageAngle } from './hud/index';
import { Sfx } from './juice';
import { buildMap } from './maps/build';
import { OnlineEvents } from './online/events';
import { OnlineFx } from './online/fx';
import { SlipperVisuals } from './online/slippers';
import { OnlineObjectives } from './online/objectives';
import type { OtimizaDroneDeps } from './online/otimiza-drone';
import { OnlineReplays } from './online/replays';
import { type AvatarFactory, createAvatar, type RemoteAvatar } from './online-avatar';
import { OnlineHud } from './online-hud';
import { type BlobTarget, BlobShadows } from './render/blobs';
import { createPipeline, type Pipeline } from './render/pipeline';
import { initialQuality, type QualityState, stepQuality } from './render/quality';
import { PALETTE } from './toon';
import { Builder } from './world/builder';
import { buildSky } from './world/sky';
import { AimPresentation } from './aim';
import { ArsenalPanel } from './arsenal';
import { ARSENAL } from '../sim/weapons';
import { soundLineOfSight } from './audio/spatial';
import { type CameraMotion, MovementCamera, placeEye } from './movement-camera';
import { MovementFx } from './movement-fx';

const BASE_FOV = 80;
const STATS_EVERY = 0.25;
const PING_EVERY = 2;

export class OnlineGame {
  private readonly renderer: THREE.WebGLRenderer;
  readonly pipeline: Pipeline;
  /** Mesma política do treino: `?low` força o nível 2 e o quadro lento baixa sozinho. */
  quality: QualityState = initialQuality(location.search);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 300);
  private readonly input: Input;
  private readonly aim = new AimPresentation();
  private readonly movementCamera = new MovementCamera();
  private readonly arsenal: ArsenalPanel;
  readonly sfx = new Sfx();
  readonly clock = new THREE.Clock();
  /** Eventos para o HUD (killfeed, acerto, dano, morte, partida): ver online/events.ts. */
  readonly events = new OnlineEvents();
  private readonly hud = new OnlineHud();
  private readonly fx: OnlineFx;
  private readonly movementFx: MovementFx;
  private motion: CameraMotion | null = null;
  private readonly slippers: SlipperVisuals;
  private readonly grenades = new GrenadeVisuals(this.scene);
  private readonly grenadeHud = new GrenadeHud();
  private readonly objectives: OnlineObjectives;
  /** Killcam e Jogada da Partida (online/replays.ts). */
  readonly replays: OnlineReplays;
  private readonly avatarTeams = new Map<string, string>();
  private readonly avatars = new Map<string, RemoteAvatar>();
  private world: ((dt: number, time: number) => void) | null = null;
  /** Sombra-bolha dos bonecos (a sombra do sol é estática, só do cenário). */
  private blobs: BlobShadows | null = null;
  private readonly blobTargets: BlobTarget[] = [];
  session: OnlineSession | null = null;
  private time = 0;
  private statsTimer = 0;
  private pingTimer = 0;
  private lastReconcile = -1;
  private life = -1;
  private wasDead = false;
  private deadFor = 0;
  private death: KillFeedEvent | null = null;
  private phase = '';
  private disposed = false;
  private readonly onResize = () => this.resize();
  private readonly onPageHide = () => this.dispose();
  /** Abates feitos por este cliente nesta sessão (conferência rápida em teste). */
  kills = 0;
  /** Última correção da reconciliação e o pico recente (cm). */
  errorCm = 0;
  peakCm = 0;
  /** Sala cheia de gente: o servidor te pôs para assistir (Modo Live cuida daí). */
  onSpectate: ((room: Room<unknown, ArenaState>) => void) | null = null;
  /** Rodízio "quem perde sai": você saiu da partida e assiste na fila (mesma conexão). */
  onBench: ((room: Room<unknown, ArenaState>, msg: BenchedMsg) => void) | null = null;
  /** Voltou à partida noutra participação (ex.: banco e vaga de novo enquanto estava fora). */
  onReseat: ((room: Room<unknown, ArenaState>) => void) | null = null;
  /** Ouvintes da sala, retirados no dispose (a sala pode continuar viva no espectador). */
  private readonly roomOffs: (() => void)[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    readonly params: OnlineParams = parseOnlineParams(location.search, location),
    private readonly avatarFactory: AvatarFactory = createAvatar,
    /** Sala já aberta (espectador que ganhou vaga). */
    private readonly existingRoom?: Room<unknown, ArenaState>,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.pipeline = createPipeline(this.renderer, this.scene, this.camera);
    this.input = new Input(canvas);
    this.arsenal = new ArsenalPanel(this.input, true, index => { this.input.weaponSlot = index + 1; });
    this.scene.add(this.camera);
    this.fx = new OnlineFx(this.scene, this.camera, this.sfx);
    this.movementFx = new MovementFx(this.scene, canvas);
    this.slippers = new SlipperVisuals(this.scene, this.camera);
    const droneDeps: OtimizaDroneDeps = { camera: this.camera, sfx: this.sfx, juice: this.fx.juice, particles: this.fx.particles, announce: (...a) => this.hud.competitive.announce(...a) };
    this.objectives = new OnlineObjectives(this.scene, droneDeps);
    this.replays = new OnlineReplays(this.scene, this.camera, this.fx, this.avatarFactory, canvas, droneDeps);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pagehide', this.onPageHide);
    this.resize();
    if (this.quality.level > 0) this.applyQuality(); // ?low na URL
    // O HUD do index.html é do treino: esconde ondas, placar de drones, hack e chefe
    for (const id of ['wave', 'score', 'allies', 'boss', 'hack-ring', 'hack-label']) {
      document.getElementById(id)?.style.setProperty('display', 'none');
    }
    void this.connect();
  }

  get inputRef() {
    return this.input;
  }

  start() {
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  private async connect() {
    const p = this.params;
    this.hud.setStatus(`conectando em ${p.endpoint}...`);
    try {
      const s = await connectOnline(p, {
        onLocalShot: (shot) => this.fx.localShot(shot),
        onLocalSlipper: action => { this.slippers.play(action); this.sfx.slipper(action); },
      }, this.existingRoom);
      if (this.disposed) { void s.leave(); return; }
      this.session = s;
      this.buildMap(s.map);
      const onLeave = () => this.hud.setStatus('desconectado do servidor (recarregue a página)');
      this.roomOffs.push(
        s.room.onMessage(MSG.shot, (m: ShotMsg) => this.onShot(s, m)),
        s.room.onMessage(MSG.kill, (e: KillFeedEvent) => this.onKill(s, e)),
        s.room.onMessage(MSG.drone, (e: DroneEventMsg) => { if (!this.disposed) this.objectives.arena?.onEvent(e, s.room.sessionId); }),
        // Papel autoritativo (reenviado na reconexão): banco ou outra participação = troca de tela
        roleOf(s.room).on(() => this.checkRole(s)),
        s.room.onMessage(SPECTATE_MSG.audience, () => {}), // plateia: chega só depois do banco
        () => s.room.onLeave.remove(onLeave),
      );
      s.room.onLeave(onLeave);
      const id = s.room.roomId;
      history.replaceState(null, '', withRoom(location.href, id));
      this.hud.setLink(inviteLink(location.href, id));
      this.hud.setStatus(`sala ${id} · mapa ${s.map.id} · você: ${p.name}`);
      this.checkRole(s); // o papel pode ter mudado durante a conexão
    } catch (e) {
      if (e instanceof SpectatorSeat && !this.disposed && this.onSpectate) {
        // Rebaixado durante a conexão (banco): a tela da fila mostra o aviso do rodízio
        const role = roleOf(e.room).role;
        if (role.kind === 'bench' && this.onBench) this.onBench(e.room, role.msg);
        else this.onSpectate(e.room);
        return;
      }
      if (e instanceof SpectatorSeat) void e.room.leave();
      if (this.disposed) return;
      console.error('[SIMBIOSE] online:', e);
      this.hud.setStatus(`sem conexão com ${p.endpoint}: rode "npm run server" (${(e as Error).message ?? e})`);
    }
  }

  /** Este jogo ficou para trás (banco ou nova participação): quem criou troca a tela. */
  private checkRole(s: OnlineSession) {
    const role = roleOf(s.room);
    if (this.disposed || !role.stale(s.self.seat)) return;
    if (role.role.kind === 'bench') this.onBench?.(s.room, role.role.msg);
    else this.onReseat?.(s.room);
  }

  /** Pelourinho (e outros mapas competitivos) com o visual de maps/build.ts; arena = caixas. */
  private buildMap(map: NetMap) {
    this.sfx.mixer.setOcclusion((from, to) => soundLineOfSight(from, to, map.shotBlockers));
    this.fx.setShotBlockers(map.shotBlockers);
    this.replays.setBlockers(map.shotBlockers, map.solids);
    this.hud.setMap(map.data?.solids ?? map.solids.map((box) => ({ box })));
    if (map.data) {
      const world = buildMap(this.scene, map.data);
      this.fx.setImpactSurfaces(world.impactSurfaces ?? []);
      this.world = (dt, time) => world.update(dt, time);
    } else {
      const b = new Builder(this.scene);
      const sky = buildSky(this.scene, b);
      for (const k of map.blocks) {
        b.block(k.min.x, k.min.y, k.min.z, k.max.x, k.max.y, k.max.z, PALETTE[k.paint], { cast: k.min.y > -0.5 });
      }
      b.finish();
      this.fx.setImpactSurfaces(b.impactSurfaces);
      this.world = sky;
    }
    this.blobs = new BlobShadows(this.scene);
    // O céu já foi desenhado antes da conexão: refaz a sombra estática com o mapa montado
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

  private applyQuality() {
    this.pipeline.setQuality(this.quality.level);
    this.resize();
    console.info(`[SIMBIOSE] qualidade ajustada para o nível ${this.quality.level}`);
  }

  frame(now = performance.now()) {
    if (this.disposed) return;
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    if (this.input.locked) {
      const before = this.quality.level;
      this.quality = stepQuality(this.quality, rawDt * 1000, dt);
      if (this.quality.level !== before) this.applyQuality();
    }
    this.time += dt;
    const s = this.session;
    if (s) {
      s.pumpLag();
      // Quantos ticks de 1/60 s couberam desde o último quadro: um comando por tick.
      // A predição (Reconciler) aplica cada um na hora em que é enviado.
      const steps = s.predict.tick(now);
      for (let i = 0; i < steps; i++) {
        writeWire(s.input.data, this.command(s));
        s.input.send();
      }
      this.updateLife(s, dt);
      this.placeCamera(s, rawDt);
      const me0 = s.me.state;
      if (this.motion) this.movementFx.update(dt, { feet: { x: me0.x, y: me0.y - PLAYER_HALF.y, z: me0.z }, vel: { x: me0.vx, y: me0.vy, z: me0.vz }, yaw: this.input.yaw, sliding: me0.sliding, onGround: me0.onGround, alive: s.self.hp > 0 && !this.replays.playing }, this.motion, this.quality.level);
      this.updateAvatars(s, dt);
      this.camera.updateMatrixWorld();
      this.sfx.mixer.updateListener(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()), this.camera.up, this.quality.level);
      const me = s.me.state;
      this.sfx.movement('local', { position: me, grounded: me.onGround, sliding: me.sliding, walking: me.walking, crouch: me.crouchAmount, alive: s.self.hp > 0 && s.room.state.phase === 'playing', vy: me.vy });
      this.sfx.health(s.self.hp);
      this.updateHud(s, dt);
      this.objectives.arena?.suspend(this.replays.playing); // replay desenha o drone gravado
      this.objectives.sync(s.room.state.drones, this.time, s.self.team, { me: s.room.sessionId, players: s.room.state.players, dt, feet: id => id === s.room.sessionId ? { x: s.me.value('x'), y: s.me.value('y') - PLAYER_HALF.y, z: s.me.value('z') } : this.avatars.get(id)?.object.position ?? null });
    } else {
      this.camera.position.set(0, 6, 22);
      this.camera.lookAt(0, 1, 0);
    }
    // O viewmodel lê a câmera já posicionada (rastro e cápsula saem da boca certa)
    this.camera.updateMatrixWorld();
    const aimAmount = s ? this.aim.update(dt, s.me.state, this.camera, this.input, BASE_FOV + (this.motion?.fov ?? 0), s.self.hp > 0, s.me.state.onGround, Math.hypot(s.me.state.vx, s.me.state.vz)) : 0;
    this.fx.update(dt, this.input.yaw, this.input.pitch, s?.me.state, aimAmount);
    if (s) {
      this.grenades.update(s.room.state.grenades, !this.replays.playing);
      this.grenadeHud.update(s.me.state.grenadeReady, s.self.hp > 0);
      const swinging = this.slippers.update(dt, s.room.state.slippers, s.self.hp > 0);
      this.fx.setArmed(s.self.hp > 0 && !swinging && !(s.me.state.weaponIndex === 2 && aimAmount > 0.96) && !this.replays.playing);
      this.arsenal.sync(s.me.state.weaponIndex, s.me.state.weaponIndex);
    }
    this.replays.present(BASE_FOV);
    this.camera.updateMatrixWorld();
    this.world?.(dt, this.time);
    this.pipeline.render();
  }

  private command(s: OnlineSession) {
    const input = this.input;
    if (input.locked && s.self.hp > 0 && s.room.state.phase === 'playing') return input.command();
    input.consumeJump(); // pulo apertado fora do jogo (ou morto) não vale depois
    return { ...emptyCommand(), yaw: input.yaw, pitch: input.pitch };
  }

  /** Nasceu (vida nova: mira para onde o servidor sugeriu) ou morreu (câmera tomba). */
  private updateLife(s: OnlineSession, dt: number) {
    const self = s.self;
    if (self.life !== this.life) {
      const first = this.life < 0;
      this.life = self.life;
      this.input.yaw = self.spawnYaw;
      this.input.pitch = 0;
      this.input.lookEnabled = true;
      this.fx.respawn();
      this.sfx.reset();
      this.movementCamera.reset();
      this.movementFx.reset();
      this.fx.juice.reset();
      this.death = null;
      if (!first) this.events.emit('respawn', { life: self.life });
    }
    const dead = self.hp <= 0;
    if (dead && !this.wasDead) {
      this.deadFor = 0;
      this.input.lookEnabled = false;
    }
    this.wasDead = dead;
    this.deadFor = dead ? this.deadFor + dt : 0;
    this.fx.setArmed(!dead);
  }

  /** Câmera no olho do jogador PREVISTO (sem esperar o servidor); mira direto da entrada + coice. */
  private placeCamera(s: OnlineSession, dt: number) {
    const me = s.me;
    const fall = Math.min(1, this.deadFor * 1.5);
    const x = me.value('x'), y = me.value('y'), z = me.value('z');
    const crouch = me.value('crouchAmount');
    const motion = this.movementCamera.update({
      x, y, z, onGround: me.state.onGround, alive: s.self.hp > 0,
      sliding: me.state.sliding, crouch, aim: me.state.aimAmount, yaw: this.input.yaw,
    }, dt);
    this.motion = motion;
    const pitch = this.input.pitch + me.value('recoil') - fall * 0.6;
    placeEye(this.camera, x, z, motion.y + EYE_HEIGHT - fall * 1.1 - motion.crouch * CROUCH.eyeDrop, motion, this.input.yaw, pitch, fall * 0.5);
  }

  private updateAvatars(s: OnlineSession, dt: number) {
    const players = s.room.state.players;
    this.blobTargets.length = 0;
    for (const [id, avatar] of this.avatars) {
      if (!players.has(id)) {
        avatar.dispose();
        this.avatars.delete(id);
        this.avatarTeams.delete(id);
        this.sfx.feet.forget(id);
      }
    }
    for (const [id, p] of players) {
      if (id === s.room.sessionId) continue;
      let avatar = this.avatars.get(id);
      const team = p.team && p.team === s.self.team ? 'ally' : 'enemy';
      if (avatar && this.avatarTeams.get(id) !== team) {
        avatar.dispose();
        avatar = undefined;
      }
      if (!avatar) {
        avatar = this.avatarFactory(p.bot ? `BOT ${p.name}` : p.name, { team });
        this.avatars.set(id, avatar);
        this.avatarTeams.set(id, team);
        this.scene.add(avatar.object);
      }
      const v = (f: 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz' | 'yaw' | 'pitch') => s.predict.value(p as NetPlayer, f);
      this.sfx.movement(id, { position: { x: v('x'), y: v('y'), z: v('z') }, grounded: p.onGround, sliding: p.sliding, walking: p.walking, crouch: s.predict.value(p as NetPlayer, 'crouchAmount'), alive: p.hp > 0 && s.room.state.phase === 'playing', vy: v('vy'), life: p.life }, true, team === 'ally');
      avatar.update({
        position: { x: v('x'), y: v('y') - PLAYER_HALF.y, z: v('z') },
        yaw: v('yaw'),
        pitch: v('pitch'),
        velocity: { x: v('vx'), y: v('vy'), z: v('vz') },
        crouching: s.predict.value(p as NetPlayer, 'crouchAmount') > 0.5,
        crouchAmount: s.predict.value(p as NetPlayer, 'crouchAmount'),
        jumping: !p.onGround,
        dead: p.hp <= 0,
        weaponIndex: p.weaponIndex,
        reloadRemaining: p.reloadRemaining,
      }, dt);
      this.blobTargets.push({ position: { x: v('x'), y: v('y'), z: v('z') }, radius: 0.5 });
    }
    this.replays.drive(s, dt, this.avatars, this.blobTargets); // replay assume câmera e bonecos
    this.blobs?.update(this.blobTargets, s.map.solids);
  }

  /** Disparo resolvido pelo servidor. */
  private onShot(s: OnlineSession, m: ShotMsg) {
    if (this.disposed) return;
    const me = s.room.sessionId;
    const end = { x: m.e[0], y: m.e[1], z: m.e[2] };
    this.replays.shot(s, m);
    this.fx.worldShot(m);
    if (!this.replays.playing) grenadeEffect(m, this.sfx, this.fx.particles, m.by === me);
    this.objectives.arena?.onShot(m, (from, to, team) => this.fx.remoteShot(from, to, 'mk2', team, false), me);
    if (m.by === me && m.t !== me) {
      // Rastro/clarão já saíram na hora (predição); aqui só o acerto confirmado
      if (m.t && m.part) {
        this.fx.confirmHit(end, m.part, m.dmg ?? 0, !!m.k);
        if ((m.dmg ?? 0) > 0) this.fx.juice.punch(m.k ? (m.part === 'head' ? 'headkill' : 'kill') : m.part === 'head' ? 'head' : 'hit');
        if ((m.dmg ?? 0) > 0) this.hud.hit(m.part === 'head', !!m.k);
        this.events.emit('hit', { target: m.t, part: m.part, damage: m.dmg ?? 0, killed: !!m.k });
      }
    } else {
      const shooter = this.avatars.get(m.by);
      if (!m.continuation && m.weapon !== 'chinelo' && m.weapon !== 'chinelo-arremesso' && m.weapon !== 'drone' && m.weapon !== 'grenade') {
        const index = Math.max(0, ARSENAL.findIndex(w => w.id === m.weapon));
        const from = shooter ? shooter.fire(index) : new THREE.Vector3(...m.o);
        const team = this.avatarTeams.get(m.by) === 'ally' ? 'ally' : 'enemy';
        this.fx.remoteMuzzle(from, end);
        for (const [i, e] of (m.pellets ?? [m.e]).entries()) this.fx.remoteShot(from, { x: e[0], y: e[1], z: e[2] }, m.weapon, team, i === 0, m.by);
      } else if (!m.continuation && (m.weapon === 'chinelo' || (m.weapon === 'chinelo-arremesso' && !m.w && !m.t && m.e.every((value, i) => value === m.o[i])))) {
        this.sfx.slipper(m.weapon === 'chinelo' ? 'melee' : 'throw', { x: m.o[0], y: m.o[1], z: m.o[2] }, m.by);
      }
    }
    if (!m.t || !m.part) return;
    if ((m.dmg ?? 0) > 0 && (m.weapon === 'chinelo' || m.weapon === 'chinelo-arremesso')) this.sfx.slap(end);
    if (m.t === me) {
      if ((m.dmg ?? 0) > 0) {
        this.hud.hurt(damageAngle({ x: m.o[0], z: m.o[2] }, s.me.state, this.input.yaw), m.dmg);
        this.fx.hurt();
        this.fx.juice.punch('hurt', { x: m.o[0], y: m.o[1], z: m.o[2] }, s.me.state);
        this.events.emit('hurt', { by: m.by, damage: m.dmg ?? 0, part: m.part, hp: s.self.hp });
      }
    } else {
      this.avatars.get(m.t)?.react(m.part);
    }
  }

  private onKill(s: OnlineSession, e: KillFeedEvent) {
    if (this.disposed) return;
    const me = s.room.sessionId;
    this.hud.kill(e, me);
    this.replays.kill(s, e);
    this.events.emit('kill', e);
    if (e.killerId === me && e.victimId !== me) this.kills += 1;
    if (e.victimId === me) {
      this.death = e;
      this.fx.died();
      this.events.emit('death', e);
    }
  }

  /** Placar ordenado no formato do HUD: `{id, name, kills, deaths, ping, bot}`. */
  scoreboard(): ScoreRow[] {
    const s = this.session;
    return s ? scoreboard(s.room.state.players) : [];
  }

  private updateHud(s: OnlineSession, dt: number) {
    const st = s.room.state;
    if (st.phase !== this.phase) {
      this.phase = st.phase;
      if (st.phase === 'ended') this.sfx.match(st.winnerId === s.room.sessionId || (!!st.winnerTeam && st.winnerTeam === s.self.team));
      this.events.emit('match', { phase: st.phase, winnerId: st.winnerId, winnerName: st.winnerName, match: st.match });
    }
    this.hud.setHp(s.self.hp, MAX_HP);
    this.hud.setAmmo(s.me.state);
    this.hud.setSlipper(s.self.slipperReady);
    const d = this.death;
    this.hud.setMatch({ phase: st.phase, timeLeft: st.timeLeft, killLimit: st.killLimit, winnerId: st.winnerId, winnerName: st.winnerName, match: st.match, rows: this.scoreboard(), me: s.room.sessionId, mode: st.mode, scoreA: st.scoreA, scoreB: st.scoreB, winnerTeam: st.winnerTeam, drawn: st.drawn }, dt);
    const drones = [...st.drones.values()];
    const channel = drones.find(d => d.hackerId === s.room.sessionId);
    this.hud.setHackStatus(st.mode !== 'hack' ? this.objectives.arena?.hudStatus ?? '' : channel ? `HACKEANDO · ${Math.round(channel.progress * 100)}%` : `E: mire num drone a até 4 m · segure por 2 s · ${drones.filter(d => d.team === s.self.team).length}/${drones.length} drones aliados${drones.some(d => d.contested) ? ' · objetivo disputado' : ''}`);
    this.hud.setDeath(st.phase === 'playing' && s.self.hp <= 0 ? { event: d, respawnIn: s.self.respawnIn, killerHp: d ? st.players.get(d.killerId)?.hp : undefined } : null);
    this.hud.setPosition({ x: s.me.value('x'), z: s.me.value('z'), yaw: this.input.yaw }, this.objectives.arena?.minimapDots);

    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.pingTimer = PING_EVERY;
      s.room.send(MSG.ping, Math.round(s.room.clock.smoothedRtt()));
    }
    this.updateStats(s, dt);
  }

  private updateStats(s: OnlineSession, dt: number) {
    const me = s.me;
    if (me.reconcileSeq !== this.lastReconcile) {
      this.lastReconcile = me.reconcileSeq;
      const c = me.lastCorrection;
      this.errorCm = Math.hypot(c.x ?? 0, c.y ?? 0, c.z ?? 0) * 100;
      this.peakCm = Math.max(this.peakCm, this.errorCm);
    }
    this.peakCm *= Math.exp(-dt / 2);
    this.statsTimer -= dt;
    if (this.statsTimer > 0) return;
    this.statsTimer = STATS_EVERY;
    const lag = this.params.lag;
    this.hud.setStats({
      ping: s.room.clock.smoothedRtt(),
      errorCm: this.errorCm,
      peakCm: this.peakCm,
      players: s.room.state.players.size,
      pending: s.input.pendingCount,
      lag: lag ? `${lag.lag}±${lag.jitter} ms, perda ${Math.round(lag.loss * 100)}%` : '',
    });
  }

  /**
   * Teste no navegador: mira no peito de onde VOCÊ vê o jogador `id` (interpolado), ou no
   * inimigo vivo mais perto. Devolve o id mirado. Atire com `__game.inputRef.fireHeld = true`.
   */
  debugAimAt(id?: string): string | null {
    const s = this.session;
    if (!s) return null;
    const me = s.me.state;
    let best: { id: string; d: number } | null = null;
    for (const [pid, p] of s.room.state.players) {
      if (pid === s.room.sessionId || p.hp <= 0 || (p.team && p.team === s.self.team) || (id && pid !== id)) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (!best || d < best.d) best = { id: pid, d };
    }
    if (!best) return null;
    const p = s.room.state.players.get(best.id)!;
    const x = s.predict.value(p, 'x') - me.x;
    const y = s.predict.value(p, 'y') + 0.3 - s.predict.value(p, 'crouchAmount') * 0.4 - (me.y + eyeOffset(me));
    const z = s.predict.value(p, 'z') - me.z;
    this.input.yaw = Math.atan2(-x, -z);
    this.input.pitch = Math.atan2(y, Math.hypot(x, z));
    return best.id;
  }

  /** Teste: pede ao servidor (só com SIMBIOSE_DEBUG=1) para nascer perto de `id`, de frente. */
  debugNear(id: string) {
    this.session?.room.send('debug-perto', id);
  }

  /**
   * Solta o HUD, a GPU e os ouvintes; callbacks tardios não recriam o jogo. `leave = false`:
   * a sala continua aberta (rodízio/fila: a mesma conexão passa para o espectador).
   */
  dispose(leave = true) {
    if (this.disposed) return;
    this.disposed = true;
    this.sfx.dispose();
    this.renderer.setAnimationLoop(null);
    this.input.dispose();
    for (const off of this.roomOffs) off();
    this.roomOffs.length = 0;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pagehide', this.onPageHide);
    this.hud.destroy();
    this.arsenal.destroy();
    this.aim.destroy();
    this.events.clear();
    this.slippers.dispose();
    this.grenades.dispose(); this.grenadeHud.dispose();
    this.movementFx.dispose();
    this.objectives.dispose();
    this.replays.dispose();
    this.fx.dispose();
    if (leave) void this.session?.leave();
    else this.session?.release();
    this.session = null;
    for (const avatar of this.avatars.values()) avatar.dispose();
    this.avatars.clear();
    this.avatarTeams.clear();
    this.pipeline.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // o canvas é trocado: o contexto antigo não fica vivo
  }

  /** Para testes no navegador (`?debug&online`): onde estão todos, sem desenhar nada. */
  debugInfo() {
    const s = this.session;
    if (!s) return null;
    const pos = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y, z: p.z });
    const st = s.room.state;
    return {
      room: s.room.roomId,
      map: st.mapId,
      me: s.room.sessionId,
      hp: s.self.hp,
      phase: st.phase,
      timeLeft: st.timeLeft,
      predicted: pos(s.me.state),
      confirmed: pos(s.self),
      players: [...st.players].map(([id, p]) => ({ id, name: p.name, bot: p.bot, hp: p.hp, kills: p.kills, deaths: p.deaths, ...pos(p) })),
      remotes: [...this.avatars].map(([id, a]) => ({ id, ...pos(a.object.position) })),
      scoreboard: this.scoreboard(),
      errorCm: this.errorCm,
      peakCm: this.peakCm,
      ping: s.room.clock.smoothedRtt(),
      pending: s.input.pendingCount,
    };
  }
}
