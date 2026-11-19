// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TICK } from '../sim/clock';
import type { PlayerCommand } from '../sim/command';
import { EYE_HEIGHT } from '../sim/player';
import { createRng } from '../sim/rng';
import { ArenaSim, type MatchFields, type SimPlayer } from './arena-sim';
import { BotBrain } from './bot';
import { HackObjectives, HACK_RULES, type HackDrone, type HackPlayer } from './hack-objectives';
import { getMap } from './maps';
import { DEFAULT_RULES, rulesFrom } from './match';
import { MODE_CONFIG, modeFrom, type MatchMode } from './modes';

const cmd = (over: Partial<PlayerCommand> = {}): PlayerCommand => ({ seq: 1, moveX: 0, moveZ: 0, jump: false, sprint: false, yaw: 0, pitch: 0, fire: false, alt: false, ...over });
function setup(mode: MatchMode, limit = 20) {
  const players = new Map<string, SimPlayer>();
  const drones = new Map<string, HackDrone>();
  const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
  const sim = new ArenaSim({ map: getMap('arena'), rules: { ...DEFAULT_RULES, mode, killLimit: limit, invulnTime: 0 }, players, drones, state, rng: createRng(42), now: () => 0, create: p => p, botNav: false });
  return { sim, players, drones, state };
}
function fire(sim: ArenaSim, p: SimPlayer, id: string, extra: Partial<PlayerCommand> = {}) {
  p.cooldown = 0; p.recoil = 0;
  sim.command(id, cmd({ fire: true, ...extra }), TICK);
}

describe('modos competitivos', () => {
  it('valida ids sem aceitar propriedades herdadas e mantém FFA compatível', () => {
    for (const id of ['__proto__', 'constructor', 'x', null]) expect(modeFrom(id)).toBe('ffa');
    expect(MODE_CONFIG.duel.capacity).toBe(2);
    expect(MODE_CONFIG.tdm.capacity).toBe(6);
    expect(MODE_CONFIG.hack.capacity).toBe(6);
    expect(rulesFrom({ modo: 'hack' }).killLimit).toBe(150);
    expect(rulesFrom({ modo: 'tdm' }).killLimit).toBe(40);
  });

  it('Duelo aguarda dois jogadores, recusa terceiro e retorna à espera ao sair rival', () => {
    const { sim, state } = setup('duel');
    sim.join('a', 'A');
    for (let i = 0; i < 600; i++) sim.tick(TICK);
    expect(state.phase).toBe('waiting');
    expect(state.timeLeft).toBe(DEFAULT_RULES.timeLimit);
    sim.join('b', 'B');
    expect(state.phase).toBe('playing');
    expect(() => sim.join('c', 'C')).toThrow('Sala cheia');
    sim.leave('b');
    expect(state.phase).toBe('waiting');
  });

  it('times humanos/bots ficam 3v3 mesmo quando pessoas substituem bots e saem', () => {
    const { sim, players } = setup('tdm');
    sim.join('a', 'A'); sim.setBotTarget(6);
    sim.join('b', 'B'); sim.balanceBots();
    expect(players.get('a')!.team).not.toBe(players.get('b')!.team);
    const counts = () => ['a', 'b'].map(team => [...players.values()].filter(p => p.team === team).length);
    expect(counts()).toEqual([3, 3]);
    sim.join('c', 'C'); sim.balanceBots();
    expect(players.size).toBe(6); expect(counts()).toEqual([3, 3]);
    sim.leave('a'); sim.balanceBots();
    expect(counts()).toEqual([3, 3]);
  });

  it('rifle e chinelo não ferem aliados; TDM pontua só abate inimigo', () => {
    const { sim, players, state } = setup('tdm', 1);
    const kills: unknown[] = [];
    sim.on(e => { if (e.type === 'kill') kills.push(e.msg); });
    const a = sim.join('a', 'A'), enemy = sim.join('b', 'B'), ally = sim.join('c', 'C');
    expect(a.team).toBe(ally.team);
    sim.teleport('a', { x: -19, y: 0.86, z: -8 });
    sim.teleport('c', { x: -19, y: 0.86, z: -10 });
    sim.teleport('b', { x: 19, y: 0.86, z: 19 });
    fire(sim, a, 'a'); expect(ally.hp).toBe(100);
    sim.command('a', cmd({ melee: true }), TICK); expect(ally.hp).toBe(100);
    expect(state.scoreA).toBe(0);
    sim.teleport('c', { x: 19, y: 0.86, z: 18 });
    sim.teleport('b', { x: -19, y: 0.86, z: -10 });
    enemy.hp = 1;
    a.slipperCooldown = 0;
    fire(sim, a, 'a');
    expect(players.get('b')!.hp).toBe(0);
    expect(kills[0]).toMatchObject({ killerTeam: 'a', victimTeam: 'b' });
    expect(state.scoreA).toBe(1); expect(state.winnerTeam).toBe('a'); expect(state.phase).toBe('ended');
    sim.restart();
    expect(state.scoreA).toBe(0); expect(state.scoreB).toBe(0); expect(state.winnerTeam).toBe('');
  });

  it('igualdade de pontuação no limite de tempo produz empate real', () => {
    for (const mode of ['ffa', 'duel', 'tdm', 'hack'] as MatchMode[]) {
      const { sim, state } = setup(mode);
      sim.join('a', 'A'); sim.join('b', 'B');
      for (let i = 0; i < DEFAULT_RULES.timeLimit * 60; i++) sim.tick(TICK);
      expect(state.phase).toBe('ended'); expect(state.drawn).toBe(true); expect(state.winnerId).toBe('');
    }
  });

  it('Hack contabiliza equipes simultaneamente e reinicia drones neutros', () => {
    const { sim, drones, state } = setup('hack', 1);
    sim.join('a', 'A'); sim.join('b', 'B');
    drones.get('drone-1')!.team = 'a'; drones.get('drone-2')!.team = 'b';
    for (let i = 0; i < 60; i++) sim.tick(TICK);
    expect(state.scoreA).toBe(1); expect(state.scoreB).toBe(1); expect(state.drawn).toBe(true);
    sim.restart();
    expect([...drones.values()].every(d => d.team === '' && d.progress === 0)).toBe(true);
  });

  it('bots hackeiam com comandos reais e pontuam sem humanos', () => {
    const { sim, drones, players, state } = setup('hack');
    const bot = sim.join('bot', 'Bot', true);
    sim.teleport('bot', { x: -10, y: 0.86, z: 3 });
    for (let i = 0; i < 240; i++) sim.tick(TICK);
    expect(drones.get('drone-1')!.team).toBe(bot.team);
    expect(state.scoreA).toBeGreaterThan(0);
    expect(Number.isFinite(players.get('bot')!.z)).toBe(true);
  });
});

describe('canalização autoritativa de hack', () => {
  function fixture() {
    const d: HackDrone = { x: 0, y: 1.8, z: -2, team: '', hackerId: '', progress: 0, contested: false };
    const p: HackPlayer = { x: 0, y: 0.86, z: 0, yaw: 0, pitch: Math.atan2(d.y - (0.86 + EYE_HEIGHT), 2), hp: 100, team: 'a' };
    const drones = new Map([['d', d]]);
    const hack = new HackObjectives(drones, []);
    return { d, p, hack };
  }
  it('canaliza por 2s, soltar E cancela, reconquista pelo rival', () => {
    const { d, p, hack } = fixture();
    const players = new Map([['a', p]]);
    hack.input('a', true);
    for (let i = 0; i < 60; i++) hack.tick(TICK, players, () => {});
    expect(d.progress).toBeCloseTo(0.5); expect(d.team).toBe('');
    hack.input('a', false); hack.tick(TICK, players, () => {}); expect(d.progress).toBe(0);
    hack.input('a', true);
    for (let i = 0; i < 120; i++) hack.tick(TICK, players, () => {});
    expect(d.team).toBe('a');
    p.team = 'b';
    for (let i = 0; i < 120; i++) hack.tick(TICK, players, () => {});
    expect(d.team).toBe('b');
  });
  it('fora de alcance, sem mira, morto ou atrás de parede não canaliza', () => {
    const { d, p, hack } = fixture();
    expect(hack.canHack(p, d)).toBe(true);
    expect(hack.canHack({ ...p, z: 10 }, d)).toBe(false);
    expect(hack.canHack({ ...p, yaw: Math.PI }, d)).toBe(false);
    expect(hack.canHack({ ...p, hp: 0 }, d)).toBe(false);
    const blocked = new HackObjectives(new Map(), [{ min: { x: -1, y: 0, z: -1.2 }, max: { x: 1, y: 4, z: -0.8 } }]);
    expect(blocked.canHack(p, d)).toBe(false);
  });
  it('rivais canalizando o mesmo neutro disputam e cancelam progresso', () => {
    const { d, p, hack } = fixture();
    hack.input('a', true); hack.input('b', true);
    hack.tick(TICK, [['a', p], ['b', { ...p, team: 'b' }]], () => {});
    expect(d.contested).toBe(true); expect(d.progress).toBe(0);
  });
  it('dt enorme e rajada de inputs não aceleram canalização', () => {
    const { d, p, hack } = fixture();
    for (let i = 0; i < 1000; i++) hack.input('a', true);
    hack.tick(999, [['a', p]], () => {});
    expect(d.progress).toBeCloseTo(TICK / HACK_RULES.channel);
  });
  it('bot busca drone e segura E ao alcance sem editar posição', () => {
    const brain = new BotBrain({ solids: [], nav: null, rng: createRng(2) });
    const { p, d } = fixture();
    const { sim } = setup('hack'); const self = sim.join('bot', 'Bot');
    Object.assign(self, p);
    const before = { x: self.x, y: self.y, z: self.z };
    const command = brain.think(self, [], TICK, [d]);
    expect(command.alt).toBe(true); expect(command.fire).toBe(false);
    expect({ x: self.x, y: self.y, z: self.z }).toEqual(before);
  });

  it('bots no Pelourinho alcançam objetivos por navegação e pontuam', () => {
    const players = new Map<string, SimPlayer>();
    const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
    const sim = new ArenaSim({ map: getMap('pelourinho'), rules: { ...DEFAULT_RULES, mode: 'hack', killLimit: 500, invulnTime: 0 }, players, state, rng: createRng(42), now: () => 0, create: p => p });
    sim.setBotTarget(6);
    for (let i = 0; i < 90 * 60 && (state.scoreA ?? 0) + (state.scoreB ?? 0) === 0; i++) sim.tick(TICK);
    expect((state.scoreA ?? 0) + (state.scoreB ?? 0)).toBeGreaterThan(0);
  });
});
