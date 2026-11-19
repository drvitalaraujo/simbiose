// @vitest-environment node
// Partidas só de bots, determinísticas (mesma semente = mesma partida): com personas, os bots
// abatem com armas variadas e com o chinelo, e o nível da sala muda o ritmo sem virar aimbot.
import { describe, expect, it } from 'vitest';
import { createRng } from '../sim/rng';
import { ArenaSim, type MatchFields, type SimPlayer } from './arena-sim';
import type { BotDifficulty } from './bot-persona';
import { getMap } from './maps';
import { DEFAULT_RULES } from './match';

const BOTS = 6;
const SECONDS = 90;

function match(mapId: string, difficulty: BotDifficulty, seed: number, dummy = false) {
  const players = new Map<string, SimPlayer>();
  const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
  let ms = 0;
  const sim = new ArenaSim({
    map: getMap(mapId), rules: { ...DEFAULT_RULES, killLimit: 999, timeLimit: 999 }, rng: createRng(seed), state, players,
    create: (p) => ({ ...p }), now: () => ms, difficulty,
  });
  const weapons = new Map<string, number>();
  const switches = new Set<string>();
  let kills = 0;
  sim.on((e) => {
    if (e.type !== 'kill') return;
    kills += 1;
    weapons.set(e.msg.weapon, (weapons.get(e.msg.weapon) ?? 0) + 1);
  });
  // "Gente" de teste: fica no lugar onde nasceu fazendo strafe e nunca atira
  if (dummy) sim.join('gente', 'Gente');
  sim.setBotTarget(BOTS);
  for (let t = 0; t < SECONDS * 60; t++) {
    if (dummy) {
      const g = players.get('gente')!;
      sim.command('gente', { seq: t, moveX: Math.sin(t / 40) > 0 ? 1 : -1, moveZ: 0, sprint: false, jump: false, yaw: g.yaw, pitch: 0, fire: false, alt: false }, 1 / 60);
    }
    sim.tick(1 / 60);
    ms += 1000 / 60;
    for (const [id, p] of players) switches.add(`${id}:${p.weaponIndex}`);
  }
  const deaths = dummy ? players.get('gente')!.deaths : 0;
  return { kills, weapons, switches, perMinute: kills / (SECONDS / 60), dummyPerMinute: deaths / (SECONDS / 60) };
}

describe('partida de bots com personas (90 s)', () => {
  const runs = (['facil', 'normal', 'dificil'] as const).map((difficulty) => {
    const results = ['favela', 'lapa', 'pelourinho'].map((map) => ({ map, ...match(map, difficulty, 7) }));
    return { difficulty, results };
  });

  it('abates com pelo menos 3 armas diferentes e com o chinelo', () => {
    const normal = runs.find((r) => r.difficulty === 'normal')!;
    const all = new Map<string, number>();
    for (const r of normal.results) for (const [w, n] of r.weapons) all.set(w, (all.get(w) ?? 0) + n);
    console.info('[bots:armas normal]', Object.fromEntries(all));
    const guns = [...all.keys()].filter((w) => !w.startsWith('chinelo'));
    expect(guns.length).toBeGreaterThanOrEqual(3);
    expect((all.get('chinelo') ?? 0) + (all.get('chinelo-arremesso') ?? 0)).toBeGreaterThan(0);
  }, 120000);

  it('fácil < difícil em abates por minuto, e o difícil não vira aimbot', () => {
    const rate = Object.fromEntries(runs.map((r) => [r.difficulty, r.results.reduce((s, x) => s + x.perMinute, 0) / r.results.length]));
    for (const r of runs) {
      console.info(`[bots:${r.difficulty}]`, r.results.map((x) => `${x.map} ${x.perMinute.toFixed(1)}/min ${JSON.stringify(Object.fromEntries(x.weapons))}`).join(' | '));
    }
    console.info('[bots:abates/min médios]', rate);
    expect(rate.facil).toBeLessThan(rate.dificil);
    // 6 bots: difícil abaixo de 4,5 abates por bot por minuto (partida só de bots, todos no mesmo nível)
    expect(rate.dificil / BOTS).toBeLessThan(4.5);
    expect(rate.facil).toBeGreaterThan(0);
  }, 120000);

  it('colado pelas costas de alguém, qualquer persona dá chinelada (abate de 100)', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const players = new Map<string, SimPlayer>();
      const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
      const sim = new ArenaSim({
        map: getMap('arena'), rules: { ...DEFAULT_RULES, invulnTime: 0 }, rng: createRng(seed), state, players,
        create: (p) => ({ ...p }), now: () => 0, botNav: false,
      });
      const kills: string[] = [];
      sim.on((e) => { if (e.type === 'kill') kills.push(e.msg.weapon); });
      sim.join('gente', 'Gente');
      sim.setBotTarget(2);
      const botId = [...players.keys()].find((id) => id !== 'gente')!;
      // Gente olha para -z; o bot fica 1,6 m atrás (+z), olhando para ela
      sim.teleport('gente', { x: 0, y: 0.86, z: -16 }, 0);
      sim.teleport(botId, { x: 0, y: 0.86, z: -14.4 }, 0);
      for (let t = 0; t < 90 && kills.length === 0; t++) {
        sim.command('gente', { seq: t, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0, pitch: 0, fire: false, alt: false }, 1 / 60);
        sim.tick(1 / 60);
      }
      expect(kills, `semente ${seed}`).toEqual(['chinelo']);
    }
  });

  it('duelo de mira na arena: quanto mais difícil, mais acerta, sem virar aimbot', () => {
    const stats = Object.fromEntries((['facil', 'normal', 'dificil'] as const).map((d) => {
      const sum = { kills: 0, shots: 0, hits: 0 };
      // Sem corrida, oito sementes deixam normal/difícil próximos; ampliar a amostra
      // conserva as exigências de precisão sem reajustar a dificuldade para o teste.
      for (let seed = 1; seed <= 32; seed++) {
        const r = duel(d, seed);
        sum.kills += r.kills; sum.shots += r.shots; sum.hits += r.hits;
      }
      return [d, { perMinute: sum.kills / 32, accuracy: sum.hits / Math.max(1, sum.shots) }];
    }));
    console.info('[bots:duelo a 20 m contra quem só faz strafe (abates/min, acerto)]', stats);
    expect(stats.facil.accuracy).toBeLessThan(stats.normal.accuracy);
    expect(stats.normal.accuracy).toBeLessThan(stats.dificil.accuracy);
    expect(stats.facil.perMinute).toBeLessThan(stats.dificil.perMinute);
    // Difícil ainda erra e leva tempo: nada de acertar tudo nem de abate a cada 2 s
    expect(stats.dificil.accuracy).toBeLessThan(0.75);
    expect(stats.dificil.perMinute).toBeLessThan(25);
  }, 120000);
});

/** Um bot contra "gente" que só faz strafe, a ~20 m em campo aberto, por 60 s. */
function duel(difficulty: BotDifficulty, seed: number) {
  const players = new Map<string, SimPlayer>();
  const state: MatchFields = { phase: '', timeLeft: 0, killLimit: 0, winnerId: '', winnerName: '', match: 0 };
  const sim = new ArenaSim({
    map: getMap('arena'), rules: { ...DEFAULT_RULES, killLimit: 999, timeLimit: 999, invulnTime: 0, respawnDelay: 0.5 }, rng: createRng(seed), state, players,
    create: (p) => ({ ...p }), now: () => 0, difficulty, botNav: false, arenaDrone: false, // o drone mudaria o duelo
  });
  sim.join('gente', 'Gente');
  sim.setBotTarget(2);
  const botId = [...players.keys()].find((id) => id !== 'gente')!;
  let shots = 0;
  let hits = 0;
  sim.on((e) => {
    if (e.type !== 'shot' || e.msg.by !== botId || e.msg.continuation || e.msg.weapon?.startsWith('chinelo')) return;
    shots += 1;
    if (e.msg.t) hits += 1;
  });
  const place = () => {
    sim.teleport('gente', { x: 4, y: 0.86, z: -16 }, Math.PI / 2);
    sim.teleport(botId, { x: -16, y: 0.86, z: -16 }, -Math.PI / 2);
  };
  place();
  let life = players.get('gente')!.life;
  for (let t = 0; t < 60 * 60; t++) {
    const g = players.get('gente')!;
    if (g.life !== life) { life = g.life; place(); }
    sim.command('gente', { seq: t, moveX: Math.sin(t / 35) > 0 ? 1 : -1, moveZ: 0, sprint: false, jump: false, yaw: g.yaw, pitch: 0, fire: false, alt: false }, 1 / 60);
    sim.tick(1 / 60);
  }
  return { kills: players.get('gente')!.deaths, shots, hits };
}
