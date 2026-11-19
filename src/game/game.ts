import * as THREE from 'three';
import { GrenadeHud, GrenadeVisuals, grenadeEffect } from './grenades';
import { TrainingGrenade } from './training-grenade';
import { FixedStep, TICK } from '../sim/clock';
import { EventBus, type HurtEvent, type SimEvent } from '../sim/events';
import { eyePosition, hurtPlayer } from '../sim/player';
import { lineOfSight } from '../sim/ray';
import { soundLineOfSight } from './audio/spatial';
import { createRng } from '../sim/rng';
import { forward, type Vec3 } from '../sim/vec';
import { switchWeapon } from '../sim/inventory';
import { createWeapon, stepWeapon } from '../sim/weapon';
import { overloadedAllies } from './brain';
import { Director, otimizaLine } from './director';
import { BOSS_HP, type Drone, type DroneContext } from './drones';
import { Hacker } from './hack';
import { Hud } from './hud';
import { Input } from './input';
import { Juice, Sfx } from './juice';
import { BIT, INTRO } from './lines';
import { Particles } from './particles';
import { MAX_HP, Player } from './player';
import { Projectiles } from './projectiles';
import { DroneShotTargets, toV3 } from './shot-targets';
import { createPipeline, type Pipeline } from './render/pipeline';
import { initialQuality, type QualityState, stepQuality } from './render/quality';
import { PALETTE } from './toon';
import { Weapon } from './weapon';
import { TrainingSlipper } from './training-slipper';
import { emptyCommand } from '../sim/command';
import { buildWorld, type World } from './world';
import { AimPresentation } from './aim';
import { ArsenalPanel } from './arsenal';
import { Tutorial } from './tutorial';
import { MovementFx } from './movement-fx';
import type { CameraMotion } from './movement-camera';

const ORB_DAMAGE = 10;
const RESTART_DELAY = 1.2;
const BASE_FOV = 80;
const OVERLOAD_RADIUS = 7;
const OVERLOAD_DAMAGE = 2;
const EXPLOSION_RADIUS = 4.5;
const EXPLOSION_DAMAGE = 3;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly pipeline: Pipeline;
  private quality: QualityState = initialQuality(location.search);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 300);
  /** FOV base em graus (Configurações do menu via `getFov()`; o padrão vale no ?debug). */
  baseFov = BASE_FOV;
  private hipFov = BASE_FOV;
  private readonly input: Input;
  private readonly aim = new AimPresentation();
  private readonly arsenal: ArsenalPanel;
  private readonly player = new Player();
  private readonly juice = new Juice();
  readonly sfx = new Sfx();
  private readonly hud = new Hud();
  private readonly hacker = new Hacker(this.scene);
  private readonly particles: Particles;
  private readonly projectiles: Projectiles;
  private readonly world: World;
  private readonly director: Director;
  private readonly weapon: Weapon;
  private readonly slipper: TrainingSlipper;
  private readonly grenadeHud = new GrenadeHud();
  private readonly grenadeVisuals = new GrenadeVisuals(this.scene);
  private readonly grenade = new TrainingGrenade(m => grenadeEffect(m, this.sfx, this.particles, true), (d, damage, dir) => {
    if (d.damage(dir, damage)) this.onEnemyKilledByAllies(d);
    else this.weapon.onDroneHit(d, d.position, false);
  }, damage => this.onPlayerHit(damage));
  private readonly movementFx: MovementFx;
  private readonly clock = new THREE.Clock();
  /** Simulação em passo fixo de 60 Hz (src/sim/clock.ts); o desenho interpola entre ticks. */
  private readonly fixed = new FixedStep();
  private readonly events = new EventBus();
  private readonly gun = createWeapon();
  private readonly rng = createRng(0x51b105e);
  private readonly shotTargets: DroneShotTargets;
  /**
   * Hit-stop: por padrão é só visual (congela efeitos e tremor; a simulação segue, como
   * vai ser no multiplayer). `?hitstop=sim` volta ao jeito antigo, pausando a simulação
   * inteira durante o congelamento (só faz sentido no treino solo), para comparar.
   */
  private readonly hitStopPausesSim = new URLSearchParams(location.search).get('hitstop') === 'sim';
  private fxTime = 0;
  private time = 0;
  private kills = 0;
  private hacks = 0;
  private deadFor = -1; // >= 0 enquanto o jogador está morto
  private hackTickTimer = 0;
  private hackBoost = 0; // pico de linhas de velocidade logo após um hack
  private introPlayed = false;
  private running = false;
  /** "Teste de Admissão" em andamento (tutorial.ts), ou null. */
  private tutorial: Tutorial | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.pipeline = createPipeline(this.renderer, this.scene, this.camera);
    this.input = new Input(canvas);
    this.arsenal = new ArsenalPanel(this.input, false, index => { this.input.weaponSlot = index + 1; });
    this.scene.add(this.camera);
    this.world = buildWorld(this.scene);
    this.sfx.mixer.setOcclusion((from, to) => soundLineOfSight(from, to, this.world.shotBlockers));
    this.player.spawn = this.world.playerSpawn;
    this.player.reset();
    this.particles = new Particles(this.scene);
    this.movementFx = new MovementFx(this.scene, canvas);
    this.projectiles = new Projectiles(this.scene, this.particles);
    this.director = new Director(
      this.scene,
      this.world.droneSpawns,
      (wave) => {
        this.hud.showWave(wave, otimizaLine(wave));
        this.sfx.wave();
      },
      (at) => {
        this.particles.burst(at, PALETTE.pink, 8, 5, 0.12);
        this.sfx.spawn(at);
      },
    );
    this.shotTargets = new DroneShotTargets(this.director.drones, this.projectiles);
    this.weapon = new Weapon({
      camera: this.camera,
      scene: this.scene,
      player: this.player,
      juice: this.juice,
      sfx: this.sfx,
      particles: this.particles,
      shotBlockers: this.world.shotBlockers,
      impactSurfaces: this.world.impactSurfaces,
    });
    this.slipper = new TrainingSlipper(this.scene, this.camera, (d, at, damage, dir) => {
      const killed = d.damage(dir, damage);
      this.sfx.slap(at);
      this.weapon.onDroneHit(d, at, killed);
      if (killed) { this.addKill(); this.onDestroyed(d); }
      this.tutorial?.onSlipperHit(d);
    }, action => { this.sfx.slipper(action); this.tutorial?.onSlipperAction(action); });

    window.addEventListener('resize', () => this.resize());
    this.resize();
    if (this.quality.level > 0) this.applyQuality(); // ?low na URL
  }

  get inputRef() {
    return this.input;
  }

  start() {
    this.running = true;
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Começa (ou recomeça) o Teste de Admissão do zero; `onArena` leva à Arena no fim. */
  startTutorial(onArena: () => void) {
    this.tutorial?.end();
    this.restart();
    this.introPlayed = true; // as falas do teste substituem a abertura
    const t: Tutorial = new Tutorial({
      scene: this.scene,
      drones: this.director.drones,
      blockers: this.world.shotBlockers,
      player: this.player.state,
      gun: this.gun,
      slipper: this.slipper.state,
      yaw: () => this.input.yaw,
      holdWaves: () => this.director.holdFor(3),
      burst: (at, color) => this.particles.burst(at, color, 16, 8, 0.14),
      cheer: () => this.sfx.match(true),
      release: () => document.exitPointerLock?.(),
      resume: () => this.input.lock(),
    }, onArena, () => { if (this.tutorial === t) this.tutorial = null; });
    this.tutorial = t;
    return t;
  }

  /** O benchmark avança quadros manualmente sem disputar o loop automático. */
  pauseForBenchmark() {
    const running = this.running;
    this.renderer.setAnimationLoop(null);
    this.running = false;
    return () => { if (running) this.start(); };
  }

  restart() {
    this.juice.reset();
    this.movementFx.reset();
    this.hipFov = this.baseFov;
    this.sfx.reset();
    this.player.reset();
    this.weapon.reset();
    this.weapon.impacts.clear();
    Object.assign(this.gun, createWeapon(this.gun.weaponIndex));
    this.slipper.reset();
    this.grenade.reset();
    this.input.resetLook();
    this.input.lookEnabled = true;
    this.director.reset();
    this.projectiles.clear();
    this.kills = 0;
    this.hacks = 0;
    this.deadFor = -1;
    this.hacker.progress = 0;
    this.hud.setScore(0);
    this.hud.setHp(MAX_HP, MAX_HP);
    this.hud.setAllies(0);
    this.hud.showDeath(false);
  }

  /** Baixa a qualidade sozinho se o quadro ficar lento (ver render/quality.ts). */
  private adaptQuality(rawDt: number) {
    const before = this.quality.level;
    this.quality = stepQuality(this.quality, rawDt * 1000, Math.min(rawDt, 0.1));
    if (this.quality.level !== before) this.applyQuality();
  }

  private applyQuality() {
    const level = this.quality.level;
    this.pipeline.setQuality(level);
    this.resize();
    console.info(`[SIMBIOSE] qualidade ajustada para o nível ${level}`);
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.pipeline.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame() {
    const rawDt = this.clock.getDelta();
    const frameDt = Math.min(rawDt, 0.1); // relógio dos efeitos visuais
    if (this.input.locked) this.adaptQuality(rawDt);
    const fxDt = this.juice.tick(frameDt); // 0 durante o hit-stop
    const ticks = this.fixed.advance(this.hitStopPausesSim && fxDt === 0 ? 0 : rawDt);
    for (let i = 0; i < ticks; i++) this.tick(TICK);
    if (this.deadFor >= 0) this.updateDead(frameDt);

    this.particles.update(fxDt);
    this.hud.setHp(this.player.hp, MAX_HP);
    this.hud.setAllies(this.allies().length);
    this.hud.setAmmo(this.gun);
    this.arsenal.sync(this.gun.weaponIndex, this.gun.weaponIndex);
    this.updateBossBar();
    this.hud.update(frameDt);

    const motion = this.player.applyToCamera(this.camera, this.fixed.alpha, this.input.yaw, this.input.pitch, rawDt, this.gun.aimAmount);
    this.applyAnimeCamera(frameDt, motion);
    const st = this.player.state;
    this.movementFx.update(frameDt, { feet: { x: st.pos.x, y: st.pos.y - 0.85, z: st.pos.z }, vel: st.vel, yaw: this.input.yaw, sliding: st.sliding, onGround: st.onGround, alive: this.player.alive }, motion, this.quality.level);
    const aimAmount = this.aim.update(frameDt, this.gun, this.camera, this.input, this.hipFov, this.player.alive, st.onGround, Math.hypot(st.vel.x, st.vel.z));
    this.fxTime += fxDt; // o tremor congela junto no hit-stop
    this.juice.shakeCamera(this.camera, this.fxTime);
    this.camera.updateMatrixWorld();
    this.sfx.mixer.updateListener(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()), this.camera.up, this.quality.level);
    this.sfx.movement('local', { position: st.pos, grounded: st.onGround, sliding: st.sliding, walking: st.walking, crouch: st.crouchAmount, alive: this.player.alive, vy: st.vel.y });
    this.sfx.health(this.player.hp);
    this.weapon.syncAmmo(this.gun);
    this.weapon.update(fxDt, this.input.yaw, this.input.pitch, undefined, this.gun.reloadRemaining, aimAmount); // depois da câmera
    this.weapon.viewmodel.model.root.visible = this.player.alive && !(this.gun.weaponIndex === 2 && aimAmount > 0.96);
    this.slipper.update(fxDt, this.player.alive);
    this.grenadeVisuals.update(this.grenade.combat.projectiles);
    this.grenadeHud.update(this.grenade.state.grenadeReady, this.player.alive);
    this.tutorial?.update(frameDt);
    this.hacker.drawBeam(this.weapon.muzzle);
    this.world.update(fxDt, this.time);
    this.pipeline.render();
  }

  /** Um tick da simulação (1/60 s): comando do jogador, movimento, arma e o treino. */
  private tick(dt: number) {
    this.time += dt;
    const playing = this.input.locked && this.deadFor < 0;
    if (playing && !this.introPlayed) {
      this.introPlayed = true; // só na primeira partida da sessão; reinícios vão direto à ação
      this.director.holdFor(this.hud.sayAll(INTRO) - 2.5);
    }
    if (!playing) this.input.consumeJump(); // pulo apertado no menu/morto não vale depois
    const cmd = playing ? this.input.command() : null;
    if (cmd) {
      if (cmd.weaponSlot) switchWeapon(this.gun, cmd.weaponSlot - 1);
      this.player.step(cmd, dt, this.world.solids);
      this.director.update(dt);
      const ctx = this.droneContext();
      for (const d of this.director.drones) d.update(dt, this.time, ctx);
      const p = this.player.center;
      this.projectiles.update(dt, this.world.shotBlockers, p, this.player.radius, this.director.drones, {
        onHitPlayer: () => this.onPlayerHit(),
        onHitDrone: (d, dir) => this.onDroneHit(d, dir),
      });
      this.updateHack(dt, cmd.alt);
    }
    const thrown = this.grenade.tick(cmd ?? emptyCommand(), dt, this.player.state, this.director.drones, this.world.shotBlockers, this.world.solids);
    this.slipper.tick(thrown ? emptyCommand() : cmd ?? emptyCommand(), dt, this.player.state, this.director.drones, this.world.shotBlockers);
    this.tutorial?.tick(dt, playing);
    stepWeapon(this.gun, this.player.state, !!cmd?.fire, dt, {
      solids: this.world.shotBlockers,
      rng: this.rng,
      events: this.events,
      targets: this.shotTargets,
    }, !!cmd?.reload, !thrown && this.deadFor < 0 && this.slipper.state.slipperCooldown === 0, !!cmd?.aim);
    for (const e of this.events.drain()) this.onSimEvent(e);
  }

  /** Reação do cliente ao que a simulação anunciou. */
  private onSimEvent(e: SimEvent) {
    if (e.type === 'shot') this.weapon.onShot(e);
    else if (e.type === 'hurt') this.onHurt(e);
    else {
      const target = this.shotTargets.resolve(e.target);
      if (target?.kind === 'orb') this.weapon.onOrbHit();
      if (target?.kind !== 'drone') return;
      this.weapon.onDroneHit(target.drone, e.point, e.type === 'kill');
      this.juice.punch(e.type === 'kill' ? 'kill' : 'hit');
      if (e.type === 'kill') {
        this.addKill();
        this.onDestroyed(target.drone);
      }
    }
  }

  private canSee = (from: Vec3, to: Vec3) => lineOfSight(from, to, this.world.shotBlockers);

  private get eye(): THREE.Vector3 {
    return toV3(eyePosition(this.player.state));
  }

  private droneContext(): DroneContext {
    const st = this.player.state;
    return {
      player: this.eye,
      playerYaw: st.yaw,
      playerForward: toV3(forward(st.yaw, st.pitch)),
      solids: this.world.solids,
      drones: this.director.drones,
      fireInterval: this.director.fireInterval,
      canSee: this.canSee,
      shoot: (from, dir, team) => { this.projectiles.spawn(from, dir, team); this.sfx.droneShot(from); },
      onCharge: (at) => this.sfx.charge(at),
      explode: (at, team) => this.explode(at, team),
      summon: (at) => this.director.spawnExtra(at, 'hugger'),
      spark: (at) => this.particles.burst(at, Math.random() < 0.5 ? PALETTE.cyan : PALETTE.yellow, 2, 3, 0.06),
    };
  }

  /** Aliados do esquadrão (o chefe hackeado não conta no limite). */
  private allies(): Drone[] {
    return this.director.drones.filter((d) => d.alive && d.team === 'ally' && d.kind !== 'boss');
  }

  private addKill() {
    this.kills += 1;
    this.hud.setScore(this.kills);
  }

  private updateHack(dt: number, holding: boolean) {
    const hacked = this.hacker.update(dt, holding, this.camera, this.director.drones, this.canSee);
    if (holding && this.hacker.progress > 0) {
      this.hackTickTimer -= dt;
      if (this.hackTickTimer <= 0) {
        this.hackTickTimer = 0.08;
        this.sfx.hackTick(this.hacker.progress);
      }
    }
    if (hacked) this.onHack(hacked);
  }

  private onHack(d: Drone) {
    d.convert(this.time);
    this.hacks += 1;
    this.hackBoost = 1;
    this.juice.freeze(0.1);
    this.juice.impactFrame(0.08);
    this.juice.addTrauma(0.3);
    this.juice.onomatopoeia(d.position, this.camera, true, 'HACKEADO!', 'hack');
    this.particles.burst(d.position, PALETTE.cyan, 18, 8, 0.14);
    this.particles.burst(d.position, PALETTE.yellow, 8, 6, 0.1);
    this.sfx.hack();
    if (d.kind === 'boss') {
      this.juice.freeze(0.3);
      this.juice.impactFrame(0.2);
      this.juice.addTrauma(0.8);
      this.hud.say('BIT', BIT.bossHacked, 6);
      return; // chefe não entra na conta de sobrecarga
    }
    if (this.hacks === 1) this.hud.say('BIT', BIT.firstHack, 5);

    // Sobrecarga: passou do limite, o aliado mais antigo explode e leva inimigos junto
    const allies = this.allies().sort((a, b) => a.hackedAt - b.hackedAt);
    for (const old of allies.slice(0, overloadedAllies(allies.length))) this.overload(old);
  }

  private overload(ally: Drone) {
    const at = ally.position.clone();
    ally.damage(new THREE.Vector3(), 99);
    this.sfx.overload(at);
    this.juice.addTrauma(0.5);
    this.juice.onomatopoeia(at, this.camera, true, 'SOBRECARGA!');
    this.particles.burst(at, PALETTE.cyan, 24, 12, 0.18);
    this.particles.burst(at, PALETTE.yellow, 16, 10, 0.14);
    for (const e of this.director.drones) {
      if (!e.alive || e.team !== 'enemy' || e.position.distanceTo(at) > OVERLOAD_RADIUS) continue;
      const dir = e.position.clone().sub(at).normalize();
      if (e.damage(dir, OVERLOAD_DAMAGE)) this.onEnemyKilledByAllies(e);
    }
    this.hud.say('BIT', BIT.overload, 4);
  }

  private onDroneHit(d: Drone, dir: THREE.Vector3) {
    const wasAlly = d.team === 'ally';
    if (!d.damage(dir)) return;
    if (wasAlly) {
      this.onDestroyed(d);
      this.particles.burst(d.position, PALETTE.cyan, 14, 8, 0.16);
      this.sfx.impact(d.position, true);
      this.hud.say('BIT', BIT.allyDown, 3);
    } else {
      this.onEnemyKilledByAllies(d);
    }
  }

  private onEnemyKilledByAllies(d: Drone) {
    this.addKill();
    this.onDestroyed(d);
    this.sfx.impact(d.position, true);
    this.juice.onomatopoeia(d.position, this.camera, true);
    this.particles.burst(d.position, PALETTE.paper, 12, 8, 0.18);
    this.particles.burst(d.position, PALETTE.pink, 8, 6, 0.14);
  }

  private bossWasInPane = false;

  private updateBossBar() {
    const boss = this.director.drones.find((d) => d.alive && d.kind === 'boss' && d.team === 'enemy');
    this.hud.setBoss(boss ? boss.hp / BOSS_HP : null, !!boss?.glitched, boss?.paneLeft ?? 0);
    const inPane = !!boss?.glitched;
    if (inPane && !this.bossWasInPane) this.hud.say('BIT', BIT.bossPane, 4);
    this.bossWasInPane = inPane;
  }

  /** Drone destruído: o Abraço Grátis explode mesmo quando é derrubado (reação em cadeia). */
  private onDestroyed(d: Drone) {
    if (d.kind === 'boss') {
      this.juice.freeze(0.25);
      this.juice.impactFrame(0.15);
      this.particles.burst(d.position, PALETTE.yellow, 40, 16, 0.3);
      this.particles.burst(d.position, PALETTE.pink, 30, 14, 0.25);
      if (d.team === 'enemy') this.hud.say('BIT', BIT.bossDown, 4);
    }
    if (d.kind === 'hugger') this.explode(d.position.clone(), d.team);
  }

  private explode(at: THREE.Vector3, team: 'enemy' | 'ally') {
    this.sfx.overload(at);
    const toPlayer = this.eye.distanceTo(at);
    this.juice.addTrauma(THREE.MathUtils.clamp(1.2 - toPlayer / 15, 0.15, 0.8));
    this.juice.onomatopoeia(at, this.camera, true, team === 'enemy' ? 'ABRAÇO!' : 'BUUM!');
    this.particles.burst(at, PALETTE.yellow, 22, 11, 0.18);
    this.particles.burst(at, team === 'enemy' ? PALETTE.pink : PALETTE.cyan, 14, 9, 0.14);
    if (team === 'enemy' && toPlayer < EXPLOSION_RADIUS) {
      this.onPlayerHit(Math.round(10 + 30 * (1 - toPlayer / EXPLOSION_RADIUS)));
    }
    for (const d of [...this.director.drones]) {
      if (!d.alive || (team === 'ally' && d.team === 'ally')) continue;
      if (d.position.distanceTo(at) > EXPLOSION_RADIUS) continue;
      const wasAlly = d.team === 'ally';
      if (!d.damage(d.position.clone().sub(at).normalize(), EXPLOSION_DAMAGE)) continue;
      if (wasAlly) this.onDroneHitKilledAlly(d);
      else this.onEnemyKilledByAllies(d);
    }
  }

  private onDroneHitKilledAlly(d: Drone) {
    this.onDestroyed(d);
    this.particles.burst(d.position, PALETTE.cyan, 14, 8, 0.16);
    this.hud.say('BIT', BIT.allyDown, 3);
  }

  /** FOV dinâmico (movement-camera.ts) e linhas de velocidade do hack; as do movimento são do MovementFx. */
  private applyAnimeCamera(realDt: number, motion: CameraMotion) {
    this.hackBoost = Math.max(0, this.hackBoost - realDt * 1.8);
    this.hud.setSpeedlines(this.hackBoost);
    const fov = this.baseFov + motion.fov + this.hackBoost * 6 * (1 - this.gun.aimAmount);
    this.hipFov += (fov - this.hipFov) * Math.min(1, realDt * 10);
  }

  private onPlayerHit(amount = ORB_DAMAGE) {
    hurtPlayer(this.player.state, amount, this.events);
  }

  private onHurt(e: HurtEvent) {
    this.juice.addTrauma(0.35);
    this.juice.punch('hurt');
    this.hud.hurt();
    this.sfx.hurt();
    if (e.fatal) {
      this.deadFor = 0;
      this.input.lookEnabled = false;
      this.juice.freeze(0.25);
      this.juice.impactFrame(0.15);
      this.sfx.death();
      this.hud.showDeath(true, this.director.wave, this.kills);
    }
  }

  private updateDead(realDt: number) {
    this.deadFor += realDt;
    // Câmera tomba devagar enquanto a tela de "otimizado" aparece
    this.input.pitch = Math.max(-1.2, this.input.pitch - realDt * 0.8);
    if (this.deadFor > RESTART_DELAY && this.input.fireHeld) {
      this.input.fireHeld = false;
      this.restart();
    }
  }
}
