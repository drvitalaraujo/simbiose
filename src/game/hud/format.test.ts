import { describe, expect, it } from 'vitest';
import { ARENA1 } from '../maps/arena1';
import {
  boundsOf,
  damageAngle,
  fitRect,
  formatClock,
  groupByTeam,
  kdRatio,
  minimapSolids,
  pingLabel,
  relation,
  sortRows,
} from './format';
import type { ScoreRow } from './types';

const row = (id: string, kills: number, deaths: number, extra: Partial<ScoreRow> = {}): ScoreRow => ({
  id,
  name: id,
  kills,
  deaths,
  ping: 30,
  ...extra,
});

describe('cores por relação', () => {
  it('você, aliado e inimigo', () => {
    expect(relation({ id: 'eu' }, { id: 'eu' })).toBe('self');
    expect(relation({ id: 'x', team: 'a' }, { id: 'eu', team: 'a' })).toBe('ally');
    expect(relation({ id: 'x', team: 'b' }, { id: 'eu', team: 'a' })).toBe('enemy');
  });
  it('no FFA todo mundo é inimigo', () => {
    expect(relation({ id: 'x' }, { id: 'eu' })).toBe('enemy');
  });
});

describe('relógio e números', () => {
  it('formata mm:ss arredondando para cima', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(-4)).toBe('0:00');
  });
  it('décimos nos últimos 10 s', () => {
    expect(formatClock(9.46, true)).toBe('9.5');
    expect(formatClock(12, true)).toBe('0:12');
  });
  it('K/D com vírgula', () => {
    expect(kdRatio(7, 2)).toBe('3,50');
    expect(kdRatio(4, 0)).toBe('4,00');
  });
  it('ping por faixa e bot sem ping', () => {
    expect(pingLabel({ ping: 22 }).level).toBe('good');
    expect(pingLabel({ ping: 90 }).level).toBe('mid');
    expect(pingLabel({ ping: 200 }).level).toBe('bad');
    expect(pingLabel({ ping: 0, bot: true })).toEqual({ text: 'BOT', level: 'bot' });
  });
});

describe('placar', () => {
  it('ordena por abates, depois menos mortes', () => {
    const rows = [row('c', 3, 1), row('a', 5, 4), row('b', 5, 2)];
    expect(sortRows(rows).map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(rows[0].id).toBe('c'); // não muda a entrada
  });
  it('pontos do modo vencem abates', () => {
    expect(sortRows([row('a', 9, 0), row('b', 1, 0, { score: 12 })])[0].id).toBe('b');
  });
  it('agrupa por time só quando há times', () => {
    expect(groupByTeam([row('a', 1, 0), row('b', 2, 0)])).toHaveLength(1);
    const g = groupByTeam([row('a', 1, 0, { team: 'b' }), row('b', 2, 0, { team: 'a' })]);
    expect(g.map((x) => x.team)).toEqual(['a', 'b']);
    expect(g[0].rows[0].id).toBe('b');
  });
});

describe('direção do dano', () => {
  const me = { x: 0, z: 0 };
  it('yaw 0 olha para -Z', () => {
    expect(damageAngle({ x: 0, z: -10 }, me, 0)).toBeCloseTo(0);
    expect(damageAngle({ x: 10, z: 0 }, me, 0)).toBeCloseTo(Math.PI / 2); // direita
    expect(damageAngle({ x: -10, z: 0 }, me, 0)).toBeCloseTo(-Math.PI / 2); // esquerda
    expect(Math.abs(damageAngle({ x: 0, z: 10 }, me, 0))).toBeCloseTo(Math.PI); // costas
  });
  it('gira junto com a mira', () => {
    // yaw = +90° olha para -X (forward = (-sen, -cos)); o tiro vindo de -X fica de frente
    expect(damageAngle({ x: -10, z: 0 }, me, Math.PI / 2)).toBeCloseTo(0);
  });
});

describe('minimapa', () => {
  it('usa só paredes/coberturas do mapa e cabe no quadrado', () => {
    const solids = minimapSolids(ARENA1.solids);
    expect(solids.length).toBeGreaterThan(10);
    expect(solids.every((s) => s.kind !== 'ground' && s.kind !== 'bound')).toBe(true);
    const r = boundsOf(solids);
    const fit = fitRect(r, 200);
    const px = (x: number) => x * fit.scale + fit.ox;
    const pz = (z: number) => z * fit.scale + fit.oz;
    expect(px(r.x0)).toBeGreaterThanOrEqual(-0.001);
    expect(px(r.x1)).toBeLessThanOrEqual(200.001);
    expect(pz(r.z0)).toBeGreaterThanOrEqual(-0.001);
    expect(pz(r.z1)).toBeLessThanOrEqual(200.001);
  });
  it('sem tipo, ignora chão e caixas gigantes', () => {
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => ({
      box: { min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } },
    });
    const kept = minimapSolids([box(-200, -1, -200, 200, 0, 200), box(0, 0, 0, 4, 3, 4), box(-300, 0, -300, 300, 40, 300)]);
    expect(kept).toHaveLength(1);
  });
});
