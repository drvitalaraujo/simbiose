// Replays do modo online: alimenta o gravador com o que o cliente desenha, mostra a killcam
// quando você morre (pelos olhos de quem te matou) e, no fim da partida, a "Jogada da
// Partida" em tela cheia, gravada em vídeo para o botão "SALVAR CLIPE". O online.ts só chama
// `shot`, `kill` e `drive` (no ponto em que os bonecos ao vivo são atualizados).
import type * as THREE from 'three';
import { DRONE_ID, DRONE_KIND } from '../../net/arena-drone';
import type { KillFeedEvent, ShotMsg } from '../../net/feed';
import type { Box } from '../../sim/physics';
import { INTERP_DELAY_MS } from '../../net/protocol';
import type { NetPlayer } from '../../net/schema';
import type { OnlineSession } from '../../net/client';
import type { AvatarFactory, RemoteAvatar } from '../online-avatar';
import type { BlobTarget } from '../render/blobs';
import { ClipCapture, clipFileName } from './clip-capture';
import type { OnlineFx } from './fx';
import { OtimizaDroneView, type OtimizaDroneDeps } from './otimiza-drone';
import { emptyDroneSample, killcamFromDrone } from './replay-drone';
import { HighlightTracker, type CaptureRequest, type Play } from './highlight';
import { weaponLabel } from './hud-data';
import { ReplayOverlay } from './replay-overlay';
import { ReplayPlayer } from './replay-player';
import { emptySample, type ReplayClip, type ReplayEvent, ReplayRecorder } from './replay-recorder';
import { fitStart, highlightSpeed, isSlowMotion, KILLCAM, killcamGate, killcamSpeed } from './replay-timing';

/** Abertura da Jogada enquanto o último lance termina de gravar (s). */
const INTRO = 1.2;
/** A Jogada cabe neste tempo real (a tela de fim dura `endScreen`, em src/net/match.ts). */
const HIGHLIGHT_REAL = 5.2;
/** Fica parado no último quadro antes de mostrar o placar (s). */
const HOLD = 0.5;

interface PendingDeath {
  at: number;
  tk: number;
  killerId: string;
  killer: string;
  bot: boolean;
  weapon: string;
  life: number;
}

type Mode = 'none' | 'killcam' | 'intro' | 'highlight';

export class OnlineReplays {
  readonly recorder = new ReplayRecorder();
  private readonly tracker = new HighlightTracker();
  private readonly player: ReplayPlayer;
  private readonly overlay = new ReplayOverlay();
  private readonly scope = document.createElement('div');
  private readonly reflex = document.createElement('div');
  private readonly capture: ClipCapture;
  private readonly sample = emptySample();
  private readonly droneSample = emptyDroneSample();
  private readonly event: ReplayEvent = {
    t: 0, kind: 'shot', by: '', target: '', weapon: '', o: [0, 0, 0], e: [0, 0, 0], pellets: null,
    part: '', damage: 0, killed: false, headshot: false, continuation: false,
  };
  private clock = 0;
  private phase = '';
  private match = -1;
  private mode: Mode = 'none';
  private death: PendingDeath | null = null;
  private killcamLife = -1;
  private highlightAt = 0;
  private hold = 0;
  private best: { clip: ReplayClip; play: Play } | null = null;
  private shown: Play | null = null;
  private authorKills = 0;
  private liveHidden = false;
  private swallowSpace = false;
  private me = '';
  private readonly selfInfo = { name: '', team: '' };
  /** Teste no navegador: quantas killcams e Jogadas já tocaram. */
  readonly stats = { killcams: 0, droneKillcams: 0, highlights: 0, fallbacks: 0 };

  /** `drone`: dependências do visual do drone da OTIMIZA (o replay desenha o drone gravado). */
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, fx: OnlineFx, factory: AvatarFactory, canvas: HTMLCanvasElement, drone?: OtimizaDroneDeps) {
    this.player = new ReplayPlayer(scene, camera, fx, factory, drone ? new OtimizaDroneView(scene, drone, { hud: false }) : null);
    this.capture = new ClipCapture(canvas);
    this.scope.className = 'weapon-scope replay-scope';
    this.scope.hidden = true;
    this.scope.innerHTML = '<div class="scope-glass"><i></i><b>LINHA MORTA · 4×</b></div>';
    document.body.append(this.scope);
    this.reflex.className = 'weapon-reflex replay-reflex';
    this.reflex.hidden = true;
    document.body.append(this.reflex);
    this.overlay.save.addEventListener('click', () => {
      if (this.shown) this.capture.download(clipFileName(this.shown.killerName));
    });
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
  }

  /** Um replay está no controle da câmera e dos bonecos. */
  get playing() { return this.player.active; }
  get state() { return this.mode; }
  /** A Jogada guardada até agora (teste). */
  get bestPlay() { return this.best?.play ?? null; }

  /** Depois dos efeitos ao vivo: o replay é o último dono da câmera e dos uniforms da arma. */
  present(baseFov: number) {
    this.player.present(baseFov);
    this.scope.hidden = !this.player.scoped;
    this.reflex.hidden = !this.player.reflex;
  }

  /** Paredes do mapa (a câmera da killcam por drone não as atravessa). */
  setBlockers(blockers: readonly Box[], solids: readonly Box[] = []) { this.player.blockers = blockers; this.player.grenadeSolids = solids; }

  /** Disparo resolvido pelo servidor (mesma mensagem que o online.ts recebe). */
  shot(s: OnlineSession, m: ShotMsg) {
    const e = this.event;
    e.t = this.eventTime(s);
    e.kind = 'shot';
    e.by = m.by;
    e.target = m.t ?? '';
    e.weapon = m.weapon ?? 'mk2';
    e.o[0] = m.o[0]; e.o[1] = m.o[1]; e.o[2] = m.o[2];
    e.e[0] = m.e[0]; e.e[1] = m.e[1]; e.e[2] = m.e[2];
    e.pellets = m.pellets ?? null;
    e.part = m.part ?? '';
    e.damage = m.dmg ?? 0;
    e.killed = !!m.k;
    e.headshot = m.part === 'head';
    e.continuation = !!m.continuation;
    e.grenadePhase = m.grenadePhase;
    e.grenadeVelocity = m.grenadeVelocity;
    this.recorder.event(e);
  }

  /** Abate (killfeed): grava, conta para a Jogada e, se foi você, prepara a killcam. */
  kill(s: OnlineSession, k: KillFeedEvent) {
    const t = this.eventTime(s);
    const e = this.event;
    e.grenadePhase = undefined; e.grenadeVelocity = undefined;
    e.t = t; e.kind = 'kill'; e.by = k.killerId; e.target = k.victimId; e.weapon = k.weapon;
    e.pellets = null; e.part = k.headshot ? 'head' : ''; e.damage = 0; e.killed = true; e.headshot = k.headshot; e.continuation = false;
    this.recorder.event(e);
    const st = s.room.state;
    if (st.phase !== 'playing') return;
    const a = st.players.get(k.killerId);
    const b = st.players.get(k.victimId);
    const distance = a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : 0;
    this.tracker.kill(
      { t, killerId: k.killerId, killerName: k.killer, victimId: k.victimId, weapon: k.weapon, headshot: k.headshot, distance, killerTeam: k.killerTeam || '' },
      { timeLeft: st.timeLeft, killLimit: st.mode === 'hack' ? 0 : st.killLimit },
    );
    if (k.victimId === s.room.sessionId && k.killerId && k.killerId !== k.victimId) {
      this.death = { at: this.clock, tk: t, killerId: k.killerId, killer: k.killer, bot: k.killerIsBot, weapon: k.weapon, life: s.self.life };
    }
  }

  /**
   * Uma vez por quadro, depois de o online.ts posicionar câmera e bonecos ao vivo. Durante um
   * replay assume a câmera, esconde os bonecos ao vivo e troca as sombras-bolha. Devolve true
   * enquanto um replay está no controle.
   */
  drive(s: OnlineSession, dt: number, live: ReadonlyMap<string, RemoteAvatar>, blobs: BlobTarget[]): boolean {
    this.clock += dt;
    this.me = s.room.sessionId;
    this.record(s);
    this.watchPhase(s);
    if (s.room.state.phase === 'playing') {
      const req = this.tracker.due(this.clock);
      if (req) this.freeze(req);
    }
    if (this.mode === 'none' && this.death) this.tryKillcam(s);
    if (this.mode === 'killcam') this.stepKillcam(s, dt);
    if (this.mode === 'intro' && this.clock >= this.highlightAt) this.startHighlight();
    else if (this.mode === 'highlight') this.stepHighlight(dt);

    const hide = this.player.active;
    if (hide || this.liveHidden) for (const avatar of live.values()) avatar.object.visible = !hide;
    this.liveHidden = hide;
    if (hide) this.player.blobTargets(blobs);
    return hide;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    this.capture.cancel();
    this.player.dispose();
    this.overlay.destroy();
    this.scope.remove();
    this.reflex.remove();
  }

  /**
   * Tempo do evento na linha do gravador. Os outros aparecem ~100 ms no passado e a
   * mensagem levou meio ping para chegar: o disparo "aparece" na tela em agora + 100 ms − ping/2.
   */
  private eventTime(s: OnlineSession) {
    return this.clock + INTERP_DELAY_MS / 1000 - this.halfRtt(s);
  }

  private halfRtt(s: OnlineSession) {
    const rtt = s.room.clock.smoothedRtt();
    return Number.isFinite(rtt) ? Math.min(0.3, Math.max(0, rtt / 2000)) : 0;
  }

  private record(s: OnlineSession) {
    const r = this.recorder;
    const x = this.sample;
    const me = s.me;
    // Você: previsto (no presente); entra no quadro atrasado para alinhar com os outros
    r.localDelay = INTERP_DELAY_MS / 1000 + this.halfRtt(s);
    x.x = me.value('x'); x.y = me.value('y'); x.z = me.value('z');
    x.vx = me.state.vx; x.vy = me.state.vy; x.vz = me.state.vz;
    x.yaw = me.state.yaw; x.pitch = me.state.pitch; x.crouch = me.value('crouchAmount');
    x.weapon = me.state.weaponIndex; x.alive = s.self.hp > 0; x.sliding = me.state.sliding; x.onGround = me.state.onGround;
    x.aim = me.state.aimAmount; x.reload = me.state.reloadRemaining;
    r.pushLocal(this.clock, s.room.sessionId, x);
    // Drone da OTIMIZA: o estado chega sem interpolação, então entra no tempo dos eventos
    const drone = s.room.state.drones.get(DRONE_ID);
    r.drone(this.eventTime(s), drone && drone.kind === DRONE_KIND ? drone : null);
    if (!r.begin(this.clock)) return;
    const predict = s.predict;
    for (const [id, p] of s.room.state.players) {
      if (id === s.room.sessionId) continue;
      const n = p as NetPlayer;
      x.x = predict.value(n, 'x'); x.y = predict.value(n, 'y'); x.z = predict.value(n, 'z');
      x.vx = predict.value(n, 'vx'); x.vy = predict.value(n, 'vy'); x.vz = predict.value(n, 'vz');
      x.yaw = predict.value(n, 'yaw'); x.pitch = predict.value(n, 'pitch'); x.crouch = predict.value(n, 'crouchAmount');
      x.weapon = p.weaponIndex; x.alive = p.hp > 0; x.sliding = p.sliding; x.onGround = p.onGround;
      x.aim = predict.value(n, 'aimAmount'); x.reload = p.reloadRemaining;
      r.player(id, p.name, p.team, p.bot, x);
    }
    this.selfInfo.name = s.self.name;
    this.selfInfo.team = s.self.team;
    r.end(this.selfInfo);
  }

  private watchPhase(s: OnlineSession) {
    const st = s.room.state;
    if (st.match !== this.match) {
      // Partida nova (revanche): zera a Jogada e some com o botão
      this.match = st.match;
      this.stopAll();
      this.tracker.reset();
      this.best = null;
      this.shown = null;
      this.overlay.showSave(false);
      this.capture.cancel();
    }
    if (st.phase === this.phase) return;
    const was = this.phase;
    this.phase = st.phase;
    if (st.phase === 'ended' && was === 'playing') {
      this.stopAll();
      this.mode = 'intro';
      this.highlightAt = this.clock + INTRO;
      this.overlay.intro();
    } else if (st.phase !== 'ended') {
      this.stopAll();
      this.overlay.showSave(false);
    }
  }

  /** Congela o trecho do lance (o buffer só guarda os últimos segundos). */
  private freeze(req: CaptureRequest) {
    const clip = this.recorder.clip(req.from, req.to);
    if (!clip || clip.slotOf(req.play.killerId) < 0 || !clip.present(clip.slotOf(req.play.killerId))) return;
    this.best = { clip, play: req.play };
    this.tracker.commit(req.play);
  }

  // --- Killcam ----------------------------------------------------------------------

  private tryKillcam(s: OnlineSession) {
    const d = this.death!;
    // O abate chega como mensagem, antes do patch que zera a vida (que pode atrasar além da
    // espera mínima): pendente até o estado mostrar a morte desta vida, ou renascer/acabar
    const gate = killcamGate(this.clock - d.at, d.life, { phase: s.room.state.phase, life: s.self.life, hp: s.self.hp });
    if (gate === 'wait') return;
    this.death = null;
    if (gate === 'drop') return;
    const clip = this.recorder.clip(d.tk - KILLCAM.before - 0.1, d.tk + KILLCAM.after + 0.1);
    const slot = clip ? clip.slotOf(d.killerId) : -1;
    // Morte por drone com o drone gravado no instante: câmera dele (o dono pode estar longe)
    const byDrone = !!clip && killcamFromDrone(d.weapon) && !!clip.drone?.sample(d.tk, this.droneSample);
    const seen = !!clip && (byDrone || (slot >= 0 && clip.sample(slot, d.tk, this.sample)));
    // Sem o matador gravado no instante do tiro: fica a tela de morte de sempre
    if (!clip || !seen || clip.end < d.tk) { this.stats.fallbacks++; return; }
    const tk = d.tk;
    this.player.start({
      clip,
      pov: d.killerId,
      // Morte por drone: câmera atrás do drone gravado, olhando você
      ...(byDrone ? { droneCam: this.me } : {}),
      from: Math.max(clip.start, tk - KILLCAM.before),
      to: Math.min(clip.end, tk + KILLCAM.after),
      speed: t => killcamSpeed(t - tk),
      onEvent: e => {
        if (e.kind === 'kill' && e.target === this.me) this.overlay.burst(e.weapon, e.headshot);
      },
    });
    this.mode = 'killcam';
    this.killcamLife = d.life;
    this.stats.killcams++;
    if (byDrone) this.stats.droneKillcams++;
    this.overlay.showKillcam({ killer: d.killer, bot: d.bot, weapon: d.weapon, label: weaponLabel(d.weapon) });
  }

  private stepKillcam(s: OnlineSession, dt: number) {
    // Acaba sozinha ao renascer (ou se a partida acabou)
    if (s.self.life !== this.killcamLife || s.self.hp > 0 || s.room.state.phase !== 'playing') { this.stopAll(); return; }
    this.player.update(dt); // no fim fica parada no último quadro até renascer
    this.overlay.setSlow(isSlowMotion(this.player.speed), this.player.speed);
  }

  // --- Jogada da Partida --------------------------------------------------------------

  private startHighlight() {
    const req = this.tracker.due(this.clock, true);
    if (req) this.freeze(req);
    const best = this.best;
    if (!best) { this.stopAll(); return; }
    const { clip, play } = best;
    const marks = play.kills.map(k => k.t);
    const speed = (t: number) => highlightSpeed(t, marks, play.peak);
    const to = clip.end;
    const from = fitStart(clip.start, to, Math.max(clip.start, marks[0] - 0.8), HIGHLIGHT_REAL, speed);
    this.player.start({
      clip, pov: play.killerId, from, to, speed,
      onEvent: e => {
        if (e.kind !== 'kill' || e.by !== play.killerId || e.target === e.by) return;
        this.authorKills += 1;
        this.overlay.killCount(this.authorKills);
        this.overlay.burst(e.weapon, e.headshot);
      },
    });
    this.authorKills = 0;
    this.hold = HOLD;
    this.mode = 'highlight';
    this.shown = play;
    this.stats.highlights++;
    this.overlay.showHighlight(play.killerName, play.label, play.reasons);
    this.overlay.showSave(false);
    if (this.capture.supported) this.capture.start();
  }

  private stepHighlight(dt: number) {
    const done = this.player.update(dt);
    this.overlay.setSlow(isSlowMotion(this.player.speed), this.player.speed);
    if (!done) return;
    this.hold -= dt;
    if (this.hold <= 0) this.finishHighlight();
  }

  private finishHighlight() {
    this.mode = 'none'; // terminou inteira: o vídeo vale (stopAll só descarta Jogada pulada)
    this.stopAll();
    if (!this.capture.recording) return;
    void this.capture.stop().then(blob => {
      if (blob && this.phase === 'ended') this.overlay.showSave(true);
    });
  }

  private stopAll() {
    if (this.mode === 'highlight' && this.capture.recording) {
      // Pulou a Jogada: o vídeo fica incompleto, então não oferece salvar
      this.capture.cancel();
    }
    this.player.stop();
    this.scope.hidden = true;
    this.reflex.hidden = true;
    this.overlay.hide();
    this.mode = 'none';
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.repeat || this.mode === 'none') return;
    if (this.mode === 'killcam') { this.stopAll(); return; }
    // Na Jogada, Espaço pula para o placar (e não aperta "Jogar de novo" junto)
    e.preventDefault();
    e.stopPropagation();
    this.swallowSpace = true;
    this.stopAll();
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !this.swallowSpace) return;
    this.swallowSpace = false;
    e.preventDefault();
    e.stopPropagation();
  };
}
