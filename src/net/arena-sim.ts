// Regras da sala FFA, puras (sem Colyseus, sem Three.js): comandos → movimento/tiro,
// acerto com rewind, vida e dano por parte do corpo, morte, renascimento seguro, proteção de
// nascimento, placar, limite de abates/tempo, fim e reinício, bots completando a sala.
// O servidor (server/arena-room.ts) só liga isto ao Colyseus; os testes usam direto.
import { grenadeDamage } from '../sim/grenade';
import { addReserveMagazine } from '../sim/inventory';
import { GrenadeCombat } from './grenade-combat';
import type { PlayerCommand } from '../sim/command';
import { EYE_HEIGHT, MAX_HP } from '../sim/player';
import { eyeOffset } from '../sim/crouch';
import { lineOfSight } from '../sim/ray';
import { createRng, type Rng } from '../sim/rng';
import type { Vec3 } from '../sim/vec';
import { BOT_NAMES, type BotBrain, type BotView, createBot } from './bot';
import { botNavFor } from './bot-nav';
import type { ShotTarget } from './combat';
import { gunMessages } from './gun-combat';
import type { ShotEvent } from '../sim/events';
import { validWeaponIndex } from '../sim/weapons';
import { type ShotMsg, WEAPON_RIFLE } from './feed';
import type { NetMap } from './maps';
import { type MatchRules, pickSpawn, yawTowards } from './match';
import { spawnYaw } from './spawn-view';
import { flatAt, stepNet } from './protocol';
import { SlipperCombat } from './slipper-combat';
import type { SlipperAction } from '../sim/slipper';
import { allies, balanceBotTeams, chooseTeam, individualWinner, MODE_CONFIG, modeFrom, teamMode, teamWinner, type Team } from './modes';
import { HackObjectives, seedHackDrones } from './hack-objectives';
import { ArenaDrone, DRONE_ID } from './arena-drone';

export type { SimPlayer, MatchFields, PlayerStore, PoseLookup, ViewLookup, ArenaEvent, ArenaSimOptions } from './modes-arena-types';
export { ABANDON_WINDOW, liveView } from './modes-arena-types';
import { ABANDON_WINDOW, liveView, type SimPlayer, type ArenaEvent, type ArenaSimOptions, type ViewLookup } from './modes-arena-types';

interface Meta {
  invulnLeft: number;
  /** Quando nasceu desta vez (ms, relógio do servidor). */
  spawnedAt: number;
  brain?: BotBrain;
  /** Espalhamento do tiro: rng SECRETO do servidor (nunca vai para o cliente). */
  spread: Rng;
  /** Quem feriu por último e o placar de "saiu no meio do combate". */
  lastAttacker: string;
  lastHeadshot: boolean;
  sinceEnemyHit: number;
  lastWeapon: string;
}

export class ArenaSim {
  readonly map: NetMap;
  readonly rules: MatchRules;
  private readonly meta = new Map<string, Meta>();
  private readonly listeners: ((e: ArenaEvent) => void)[] = [];
  private remaining: number;
  private restartIn = 0;
  private botTarget = 0;
  private botCount = 0;
  readonly slipperCombat: SlipperCombat;
  readonly grenadeCombat: GrenadeCombat;
  readonly objectives: HackObjectives;
  /** Drone da OTIMIZA (só no FFA): src/net/arena-drone.ts. */
  readonly arenaDrone: ArenaDrone | null;
  readonly mode;

  constructor(private readonly o: ArenaSimOptions) {
    this.map = o.map;
    this.rules = o.rules;
    this.mode = modeFrom(o.rules.mode);
    this.objectives = new HackObjectives(o.drones ?? new Map(), this.map.shotBlockers);
    if (this.mode === 'hack') seedHackDrones(this.map, this.objectives.drones, o.createDrone ?? (d => d));
    this.grenadeCombat = new GrenadeCombat(o.grenades ?? new Map(), o.createGrenade);
    this.slipperCombat = new SlipperCombat(o.slippers ?? new Map(), o.createSlipper);
    this.arenaDrone = this.mode === 'ffa' && o.arenaDrone !== false ? new ArenaDrone(this.map, this.objectives.drones, o.rng, {
      create: o.createDrone, shot: (msg, dmg) => this.slipperHit(msg, dmg), event: msg => this.emit({ type: 'drone', msg }),
    }) : null;
    this.remaining = o.rules.timeLimit;
    Object.assign(o.state, { phase: this.mode === 'duel' ? 'waiting' : 'playing', killLimit: o.rules.killLimit, timeLeft: Math.ceil(this.remaining), winnerId: '', winnerName: '', match: this.mode === 'duel' ? 0 : 1, mode: this.mode, scoreA: 0, scoreB: 0, winnerTeam: '', drawn: false });
  }

  on(fn: (e: ArenaEvent) => void) {
    this.listeners.push(fn);
  }

  private emit(e: ArenaEvent) {
    for (const fn of this.listeners) fn(e);
  }

  get playing(): boolean {
    return this.o.state.phase === 'playing';
  }

  /** Escolha validada; a arma e a munição atuais só mudam no renascimento. */
  selectLoadout(id: string, index: unknown): boolean {
    const p = this.o.players.get(id);
    if (!p || !validWeaponIndex(index)) return false;
    p.selectedWeapon = index;
    return true;
  }

  /** Quando o jogador nasceu desta vez (ms), para o rewind não acertar o "fantasma" antigo. */
  spawnedAt(id: string): number {
    return this.meta.get(id)?.spawnedAt ?? 0;
  }

  /** Entra alguém (gente ou bot): nasce num ponto seguro. */
  join(id: string, name: string, bot = false): SimPlayer {
    if (!bot && [...this.o.players].filter(([, p]) => !p.bot).length >= MODE_CONFIG[this.mode].capacity) throw new Error('Sala cheia');
    // Gente substitui bot da equipe menor antes de decidir o próprio time.
    const victimBot = [...this.o.players].find(([, p]) => p.bot && p.team === chooseTeam(this.mode, [...this.o.players].filter(([, p]) => !p.bot).map(([, p]) => p)));
    if (!bot && victimBot) this.leave(victimBot[0]);
    const s = this.map.spawns[0];
    const p = this.o.create({
      ...flatAt(s), name, spawnX: s.x, spawnY: s.y, spawnZ: s.z, spawnYaw: 0,
      bot, team: chooseTeam(this.mode, [...this.o.players].map(([, p]) => p)), kills: 0, deaths: 0, ping: 0, life: 0, respawnIn: 0, invuln: false,
    });
    this.o.players.set(id, p);
    const meta: Meta = {
      invulnLeft: 0, spawnedAt: 0, spread: createRng(Math.floor(this.o.rng() * 0x100000000) >>> 0), lastAttacker: '', lastHeadshot: false, sinceEnemyHit: Infinity, lastWeapon: WEAPON_RIFLE,
    };
    if (bot) {
      const inUse = [...this.meta.values()].map((m) => m.brain?.persona.id);
      meta.brain = createBot({ solids: this.map.shotBlockers, nav: this.o.botNav === false ? null : botNavFor(this.map), rng: this.o.rng }, this.o.difficulty, inUse);
      p.selectedWeapon = meta.brain.persona.primary; // nasce com a arma do estilo
    }
    this.meta.set(id, meta);
    this.respawn(id, p);
    if (this.mode === 'duel' && this.o.players.size === 2 && this.o.state.phase === 'waiting') this.restart();
    return p;
  }

  /** Põe alguém num ponto (centro do corpo) olhando para `yaw` (testes e depuração). */
  teleport(id: string, at: Vec3, yaw = 0) {
    const p = this.o.players.get(id);
    if (!p) return;
    Object.assign(p, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, yaw, spawnX: at.x, spawnY: at.y, spawnZ: at.z, spawnYaw: yaw });
    this.meta.get(id)?.brain?.reset(yaw);
  }

  /**
   * Põe `id` a ~`dist` m de `targetId`, num ponto livre com linha de visão até ele, olhando
   * para ele (só para teste: o servidor só aceita isso com SIMBIOSE_DEBUG=1).
   */
  placeNear(id: string, targetId: string, dist = 9): boolean {
    const t = this.o.players.get(targetId);
    if (!t || !this.o.players.get(id)) return false;
    const free = (at: Vec3) => {
      const body = { min: { x: at.x - 0.4, y: at.y - 0.84, z: at.z - 0.4 }, max: { x: at.x + 0.4, y: at.y + 0.84, z: at.z + 0.4 } };
      return !this.map.solids.some((b) => b.min.x < body.max.x && b.max.x > body.min.x && b.min.y < body.max.y && b.max.y > body.min.y && b.min.z < body.max.z && b.max.z > body.min.z);
    };
    for (const r of [dist, dist * 0.6, dist * 1.4, dist * 0.35]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        for (const dy of [0, 0.4, 0.8, 1.2, -0.4, -0.8]) {
          const at = { x: t.x + Math.cos(a) * r, y: t.y + dy, z: t.z + Math.sin(a) * r };
          if (!free(at)) continue;
          const eye = { x: at.x, y: at.y + EYE_HEIGHT, z: at.z };
          if (!lineOfSight(eye, { x: t.x, y: t.y + 0.3, z: t.z }, this.map.shotBlockers)) break;
          this.teleport(id, at, yawTowards(at, t));
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Sai da sala. Gente que sai ferida no meio do combate (ferida há menos de ABANDON_WINDOW s)
   * conta como abatida por quem a feriu por último: sair e voltar não salva ninguém.
   */
  leave(id: string) {
    const p = this.o.players.get(id);
    const m = this.meta.get(id);
    if (p && m && !p.bot && p.hp > 0 && p.sinceHurt < ABANDON_WINDOW && this.playing) {
      const killer = this.recentEnemy(id, p);
      if (killer) this.kill(m.lastAttacker, killer, id, p, m.lastHeadshot, m.lastWeapon);
    }
    this.o.players.delete(id);
    this.meta.delete(id);
    this.grenadeCombat.removeOwner(id);
    this.slipperCombat.removeOwner(id);
    this.objectives.leave(id);
    this.arenaDrone?.leave(id);
    if (this.mode === 'duel' && this.o.players.size < 2 && this.playing) this.o.state.phase = 'waiting';
  }

  /** Quantos jogadores no total a sala tenta ter (bots completam o que faltar de gente). */
  setBotTarget(total: number) {
    this.botTarget = Math.min(MODE_CONFIG[this.mode].capacity, Math.max(0, Math.floor(total)));
    this.balanceBots();
  }

  /** Bots entram quando falta gente e saem quando entra gente. */
  balanceBots() {
    let humans = 0;
    const bots: string[] = [];
    for (const [id, p] of this.o.players) {
      if (p.bot) bots.push(id);
      else humans += 1;
    }
    const want = Math.max(0, this.botTarget - humans);
    while (bots.length > want) this.leave(bots.pop()!);
    for (let n = bots.length; n < want; n++) {
      const used = new Set([...this.o.players].map(([, p]) => p.name));
      const free = BOT_NAMES.filter((b) => !used.has(b));
      const name = free.length > 0 ? free[Math.floor(this.o.rng() * free.length)] : `Bot${this.botCount + 1}`;
      this.join(`bot-${++this.botCount}`, name, true);
    }
    if (teamMode(this.mode)) balanceBotTeams([...this.o.players].map(([, p]) => p));
  }

  /** Aplica UM comando de um jogador (um tick dele). `view` dá a pose que ele via no tiro. */
  command(id: string, cmd: PlayerCommand, dt: number, view: ViewLookup = liveView) {
    const p = this.o.players.get(id);
    const m = this.meta.get(id);
    if (!p || !m) return;
    m.sinceEnemyHit += dt;
    this.objectives.input(id, this.playing && p.hp > 0 && cmd.alt);
    this.arenaDrone?.input(id, this.playing && p.hp > 0 && cmd.alt);
    const shot = stepNet(p, cmd, dt, this.map.solids, { x: p.spawnX, y: p.spawnY, z: p.spawnZ }, m.spread, this.map.shotBlockers,
      action => this.useSlipper(id, p, action, cmd.seq), () => {
        if (!this.playing) { p.grenadeReady = true; return; }
        this.endInvuln(id, p);
        this.grenadeCombat.launch(id, p, cmd.seq, msg => this.emit({ type: 'shot', msg }));
      });
    if (p.hp > 0 && cmd.weaponSlot && validWeaponIndex(cmd.weaponSlot - 1)) p.selectedWeapon = p.weaponIndex;
    if (shot) this.fire(id, p, cmd.seq, shot, view);
  }

  private useSlipper(id: string, p: SimPlayer, action: SlipperAction, seq: number) {
    if (!this.playing) return;
    if (p.invuln) this.endInvuln(id, p);
    this.slipperCombat.action(id, p, action, seq, this.map.shotBlockers, this.o.players, (msg, dmg) => this.slipperHit(msg, dmg));
  }

  /** Dano próprio não renova a janela nem apaga o último agressor inimigo. */
  private recentEnemy(id: string, victim: SimPlayer): SimPlayer | undefined {
    const m = this.meta.get(id);
    const enemy = m && m.sinceEnemyHit < ABANDON_WINDOW ? this.o.players.get(m.lastAttacker) : undefined;
    return enemy && m!.lastAttacker !== id && !allies(this.mode, enemy, victim) ? enemy : undefined;
  }

  private slipperHit(msg: ShotMsg, damage: number, finish = true) {
    const shooter = this.o.players.get(msg.by);
    const victim = msg.t ? this.o.players.get(msg.t) : undefined;
    if (!shooter) return;
    msg.dmg = this.playing && victim && !victim.invuln && (msg.by === msg.t || !allies(this.mode, shooter, victim)) ? damage : 0;
    if (victim && msg.dmg > 0) {
      victim.hp = Math.max(0, victim.hp - msg.dmg);
      victim.sinceHurt = 0;
      const m = this.meta.get(msg.t!);
      if (m && msg.by !== msg.t) { m.lastAttacker = msg.by; m.lastHeadshot = msg.part === 'head'; m.sinceEnemyHit = 0; m.lastWeapon = msg.weapon ?? WEAPON_RIFLE; }
      msg.k = victim.hp <= 0;
    }
    this.emit({ type: 'shot', msg });
    if (victim && msg.k) {
      const enemy = msg.by === msg.t ? this.recentEnemy(msg.t!, victim) : undefined;
      const m = this.meta.get(msg.t!);
      if (enemy && m) this.kill(m.lastAttacker, enemy, msg.t!, victim, m.lastHeadshot, m.lastWeapon, finish);
      else this.kill(msg.by, shooter, msg.t!, victim, msg.part === 'head', msg.weapon, finish);
    }
  }

  /**
   * Um tick sem comando (o cliente não mandou nada: aba escondida, rede, trapaça): o jogador
   * fica parado no lugar, sem atirar, mas a física segue (gravidade, queda, regeneração).
   */
  idle(id: string, dt: number) {
    const p = this.o.players.get(id);
    if (!p) return;
    this.command(id, { seq: -1, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: p.yaw, pitch: p.pitch, fire: false, alt: false }, dt);
  }

  private fire(id: string, shooter: SimPlayer, seq: number, shot: ShotEvent, view: ViewLookup) {
    if (shooter.invuln) this.endInvuln(id, shooter); // quem atira perde a proteção
    const lookup = view();
    const targets: ShotTarget[] = [];
    for (const [tid, tp] of this.o.players) {
      if (tid === id || tp.hp <= 0) continue;
      const pose = lookup(tid, tp);
      if (pose) targets.push({ id: tid, pose });
    }
    // Aplica a salva inteira no mesmo estado de partida, mesmo se o primeiro alvo encerrar o placar.
    const playing = this.playing;
    for (const msg of gunMessages(id, seq, shooter.weaponIndex, shot, this.map.shotBlockers, targets, this.arenaDrone?.props(id))) {
      if (msg.t === DRONE_ID) {
        msg.dmg = playing ? msg.dmg : 0;
        msg.k = this.arenaDrone!.damage(id, shooter.name, msg.dmg ?? 0);
      }
      const victim = msg.t ? this.o.players.get(msg.t) : undefined;
      if (victim) {
        msg.dmg = playing && !victim.invuln && !allies(this.mode, shooter, victim) ? msg.dmg : 0;
      }
      if (victim && msg.dmg && msg.dmg > 0) {
        victim.hp = Math.max(0, victim.hp - msg.dmg);
        victim.sinceHurt = 0;
        const vm = this.meta.get(msg.t!);
        if (vm) {
          vm.lastAttacker = id;
          vm.lastHeadshot = msg.part === 'head';
          vm.sinceEnemyHit = 0; vm.lastWeapon = msg.weapon ?? WEAPON_RIFLE;
        }
        msg.k = victim.hp <= 0;
      }
      this.emit({ type: 'shot', msg });
      if (msg.k && victim) this.kill(id, shooter, msg.t!, victim, msg.part === 'head', msg.weapon);
    }
  }

  private kill(killerId: string, killer: SimPlayer, victimId: string, victim: SimPlayer, headshot: boolean, weapon: string = WEAPON_RIFLE, finish = true) {
    victim.hp = 0;
    victim.deaths += 1;
    victim.respawnIn = this.rules.respawnDelay;
    victim.vx = 0;
    victim.vz = 0;
    if (killerId !== victimId) killer.kills += 1;
    this.emit({
      type: 'kill',
      msg: {
        killer: killer.name, victim: victim.name, killerId, victimId, weapon, headshot,
        killerIsBot: killer.bot, victimIsBot: victim.bot,
        ...(killer.team ? { killerTeam: killer.team } : {}),
        ...(victim.team ? { victimTeam: victim.team } : {}),
      },
    });
    if (killerId !== victimId && !allies(this.mode, killer, victim) && this.mode === 'tdm') this.award(killer.team ?? '', 1, finish);
    if (finish && this.playing && !teamMode(this.mode) && killer.kills >= this.rules.killLimit) this.end();
  }

  /** Um tick da sala (depois dos comandos da gente): bots, timers, partida. */
  tick(dt: number) {
    this.thinkBots(dt);
    if (this.playing && this.mode === 'hack') {
      this.objectives.tick(dt, this.o.players, (team, points) => this.award(team, points, false));
      if (Math.max(this.o.state.scoreA ?? 0, this.o.state.scoreB ?? 0) >= this.rules.killLimit) this.end();
    }
    if (this.playing) this.arenaDrone?.tick(dt, this.o.players, this.map.shotBlockers);
    if (this.playing) this.grenadeCombat.tick(dt, this.map.shotBlockers, this.o.players, (msg, dmg) => {
      this.slipperHit(msg, dmg, false);
      const drone = this.arenaDrone?.drone;
      const shooter = this.o.players.get(msg.by);
      if (msg.grenadePhase !== 'explode' || !drone || !shooter || drone.owner === msg.by || drone.phase === 'leaving') return;
      const damage = grenadeDamage({ x: msg.o[0], y: msg.o[1], z: msg.o[2] }, drone, this.map.shotBlockers);
      if (damage <= 0) return;
      const killed = this.arenaDrone!.damage(msg.by, shooter.name, damage);
      this.emit({ type: 'shot', msg: { by: msg.by, seq: msg.seq, o: msg.o, e: [drone.x, drone.y, drone.z], weapon: 'grenade', t: DRONE_ID, part: 'torso', dmg: damage, k: killed, continuation: true } });
    }, () => {
      // Só fecha o placar depois de todas as vítimas desta explosão serem resolvidas.
      const reached = this.mode === 'tdm'
        ? Math.max(this.o.state.scoreA ?? 0, this.o.state.scoreB ?? 0) >= this.rules.killLimit
        : !teamMode(this.mode) && [...this.o.players].some(([, p]) => p.kills >= this.rules.killLimit);
      if (reached) this.end();
      return this.playing;
    }, this.map.solids);
    this.slipperCombat.tick(dt, this.map.shotBlockers, this.o.players, (msg, dmg) => this.slipperHit(msg, dmg));
    for (const [id, p] of this.o.players) {
      const m = this.meta.get(id);
      if (!m) continue;
      if (p.hp <= 0) {
        p.respawnIn = Math.max(0, p.respawnIn - dt);
        if (p.respawnIn <= 0) this.respawn(id, p);
      } else if (p.invuln) {
        m.invulnLeft -= dt;
        if (m.invulnLeft <= 0) this.endInvuln(id, p);
      }
    }
    const s = this.o.state;
    if (s.phase === 'playing') {
      this.remaining -= dt;
      if (this.remaining <= 1e-6) this.end();
    } else if (s.phase === 'ended') {
      this.restartIn -= dt;
      if (this.restartIn <= 0) this.restart();
    }
    const left = Math.max(0, Math.ceil((s.phase === 'playing' ? this.remaining : s.phase === 'waiting' ? this.rules.timeLimit : this.restartIn) - 1e-6));
    if (s.timeLeft !== left) s.timeLeft = left;
  }

  private thinkBots(dt: number) {
    const hunt = this.arenaDrone?.botObjective(this.o.players);
    const views: BotView[] = [];
    for (const [id, p] of this.o.players) views.push({ id, x: p.x, y: p.y, z: p.z, alive: p.hp > 0, invuln: p.invuln, crouchAmount: p.crouchAmount, yaw: p.yaw, hp: p.hp });
    for (const [id, p] of this.o.players) {
      const brain = this.meta.get(id)?.brain;
      if (!brain) continue;
      const cmd = brain.think(p, views.filter((v) => v.id !== id && !allies(this.mode, p, this.o.players.get(v.id)!)), dt, this.mode === 'hack' ? [...this.objectives.drones].map(([, d]) => d).filter(d => d.team !== p.team) : hunt?.id === id ? [hunt.at] : [], { slipper: this.slipperCombat.restingOf(id) });
      this.command(id, cmd, dt, liveView);
    }
  }

  private endInvuln(id: string, p: SimPlayer) {
    p.invuln = false;
    const m = this.meta.get(id);
    if (m) m.invulnLeft = 0;
  }

  /** Renasce num ponto longe dos inimigos e fora da linha de visão deles. */
  private respawn(id: string, p: SimPlayer) {
    this.slipperCombat.removeOwner(id);
    const threats: { eye: Vec3 }[] = [];
    for (const [oid, o] of this.o.players) {
      if (oid !== id && o.hp > 0 && !allies(this.mode, p, o)) threats.push({ eye: { x: o.x, y: o.y + eyeOffset(o), z: o.z } });
    }
    const s = pickSpawn(this.map.spawns, threats, this.map.shotBlockers, this.o.rng);
    const yaw = spawnYaw(s, this.map.shotBlockers); // olha para onde a visão é livre (Favela: não encara o beco)
    Object.assign(p, flatAt(s, p.selectedWeapon ?? 0));
    if (this.mode === 'duel') addReserveMagazine(p);
    p.yaw = yaw;
    p.spawnX = s.x;
    p.spawnY = s.y;
    p.spawnZ = s.z;
    p.spawnYaw = yaw;
    p.life += 1;
    p.respawnIn = 0;
    p.hp = MAX_HP;
    const m = this.meta.get(id);
    if (m) {
      m.spawnedAt = this.o.now();
      m.invulnLeft = this.rules.invulnTime;
      m.lastAttacker = ''; m.sinceEnemyHit = Infinity; m.lastHeadshot = false; m.lastWeapon = WEAPON_RIFLE;
      m.brain?.reset(yaw);
    }
    p.invuln = this.rules.invulnTime > 0;
  }

  private end() {
    const s = this.o.state;
    s.phase = 'ended';
    this.arenaDrone?.reset();
    this.grenadeCombat.clear();
    if (teamMode(this.mode)) Object.assign(s, teamWinner(s.scoreA ?? 0, s.scoreB ?? 0));
    else Object.assign(s, individualWinner(this.o.players));
    this.restartIn = this.rules.endScreen;
    this.emit({ type: 'end', winnerId: s.winnerId, winnerName: s.winnerName });
  }

  /** Partida nova na mesma sala: zera o placar e todo mundo renasce. */
  restart() {
    const s = this.o.state;
    this.emit({ type: 'restarting', match: s.match });
    s.phase = this.mode === 'duel' && this.o.players.size < 2 ? 'waiting' : 'playing';
    s.winnerId = '';
    s.winnerName = '';
    Object.assign(s, { scoreA: 0, scoreB: 0, winnerTeam: '', drawn: false });
    this.objectives.reset();
    this.arenaDrone?.reset();
    this.grenadeCombat.clear();
    s.match += 1;
    this.remaining = this.rules.timeLimit;
    for (const [id, p] of this.o.players) {
      p.kills = 0;
      p.deaths = 0;
      this.respawn(id, p);
    }
    this.emit({ type: 'start', match: s.match });
  }

  private award(team: Team, points: number, finish = true) {
    if (!team || !this.playing) return;
    const key = team === 'a' ? 'scoreA' : 'scoreB';
    this.o.state[key] = (this.o.state[key] ?? 0) + points;
    if (finish && this.o.state[key]! >= this.rules.killLimit) this.end();
  }
}
