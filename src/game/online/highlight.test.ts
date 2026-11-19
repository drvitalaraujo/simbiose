import { describe, expect, it } from 'vitest';
import { HIGHLIGHT, type HighlightKill, HighlightTracker, playTitle, scorePlay } from './highlight';
import { fitStart, highlightSpeed, KILLCAM, killcamSpeed, realDuration } from './replay-timing';

const kill = (t: number, killerId: string, extra: Partial<HighlightKill> = {}): HighlightKill => ({
  t, killerId, killerName: killerId.toUpperCase(), victimId: `v${t}`, weapon: 'mk2', headshot: false, distance: 10, ...extra,
});
const ctx = { timeLeft: 300, killLimit: 25 };

describe('nota do lance', () => {
  it('sequência rápida vale mais que abates soltos, e o título diz o tamanho', () => {
    const triple = scorePlay([kill(0, 'a'), kill(1, 'a'), kill(2, 'a')]);
    const single = scorePlay([kill(0, 'a', { headshot: true })]);
    expect(triple.label).toBe('ABATE TRIPLO');
    expect(triple.score).toBeGreaterThan(single.score * 3);
    expect(triple.reasons.map(r => r.label)).toContain('RAPIDEZ');
    expect(single.label).toBe('TIRO NA CABEÇA');
  });

  it('chinelada, sniper de longe e virada explicam a nota', () => {
    expect(scorePlay([kill(0, 'a', { weapon: 'chinelo-arremesso' })]).label).toBe('CHINELO VOADOR');
    const sniper = scorePlay([kill(0, 'a', { weapon: 'sniper', distance: 52 })]);
    expect(sniper.label).toBe('TIRO DE LONGE');
    expect(sniper.reasons.find(r => r.label.startsWith('TIRO DE LONGE'))?.label).toBe('TIRO DE LONGE · 52 m');
    const clutch = scorePlay([kill(0, 'a')], { clutch: true });
    expect(clutch.label).toBe('VIRADA NO FIM');
    expect(clutch.score).toBe(clutch.reasons.reduce((s, r) => s + r.points, 0));
  });
});

describe('rastreador da Jogada da Partida', () => {
  it('junta a sequência e pede para congelar depois do respiro', () => {
    const h = new HighlightTracker();
    h.kill(kill(10, 'a'), ctx);
    h.kill(kill(12, 'a'), ctx);
    expect(h.due(12.5)).toBeNull();
    const req = h.due(12 + HIGHLIGHT.postRoll)!;
    expect(req.play.label).toBe('ABATE DUPLO');
    expect(req.from).toBeCloseTo(10 - HIGHLIGHT.preRoll);
    expect(req.to).toBeCloseTo(12 + HIGHLIGHT.postRoll);
    h.commit(req.play);
    expect(h.due(20)).toBeNull(); // já congelado
  });

  it('abate comum espera para ver se vira sequência; só troca o guardado por lance melhor', () => {
    const h = new HighlightTracker();
    h.kill(kill(10, 'a'), ctx);
    expect(h.due(11.5)).toBeNull();
    const first = h.due(15)!;
    h.commit(first.play);
    h.kill(kill(30, 'b'), ctx);
    expect(h.due(40)).toBeNull(); // empate com o guardado: não recorta de novo
    h.kill(kill(50, 'b', { headshot: true }), ctx);
    h.kill(kill(51, 'b'), ctx);
    h.kill(kill(52, 'b'), ctx);
    const best = h.due(60)!;
    expect(best.play.killerId).toBe('b');
    expect(best.play.kills).toHaveLength(3);
    h.commit(best.play);
    expect(playTitle(h.best!)).toBe('JOGADA DA PARTIDA — B: ABATE TRIPLO');
  });

  it('virada no fim e abate da vitória contam pelo placar', () => {
    const h = new HighlightTracker();
    h.kill(kill(1, 'b'), ctx);
    h.kill(kill(2, 'b'), ctx);
    h.kill(kill(20, 'a'), ctx);
    h.kill(kill(40, 'a'), ctx);
    h.due(50); // os lances antigos já foram vistos (e o duplo do B segue fora)
    h.kill(kill(60, 'a'), { timeLeft: 10, killLimit: 25 });
    const req = h.due(60.2, true)!;
    expect(req.play.reasons.map(r => r.label)).toContain('VIRADA NO FIM');
    const win = new HighlightTracker();
    win.kill(kill(1, 'a'), { timeLeft: 100, killLimit: 1 });
    expect(win.due(1.2, true)!.play.reasons.map(r => r.label)).toContain('ABATE DA VITÓRIA');
  });

  it('no fim da partida força o pendente, limitado ao que já foi gravado', () => {
    const h = new HighlightTracker();
    h.kill(kill(100, 'a'), ctx);
    h.kill(kill(101, 'a'), ctx);
    const req = h.due(101.3, true)!;
    expect(req.to).toBeCloseTo(101.3);
    h.kill(kill(5, 'a', { killerId: '' }), ctx);
    h.kill(kill(6, 'x', { victimId: 'x' }), ctx);
  });
});

describe('ritmo dos replays', () => {
  it('killcam cabe entre o atraso inicial e o renascimento (3 s)', () => {
    const real = realDuration(-KILLCAM.before, KILLCAM.after, killcamSpeed);
    expect(KILLCAM.delay + real).toBeLessThan(2.95);
    expect(killcamSpeed(0)).toBeLessThan(0.5);
    expect(killcamSpeed(-2)).toBeGreaterThan(1);
  });

  it('Jogada desacelera no abate, mais fundo no auge, e o corte cabe no tempo pedido', () => {
    const marks = [10, 11];
    expect(highlightSpeed(10, marks, 11)).toBeLessThan(0.5);
    expect(highlightSpeed(11, marks, 11)).toBeLessThan(highlightSpeed(10, marks, 11));
    expect(highlightSpeed(5, marks, 11)).toBe(1);
    const speed = (t: number) => highlightSpeed(t, marks, 11);
    const start = fitStart(4, 12, 9.2, 5.5, speed);
    expect(start).toBeGreaterThan(4);
    expect(realDuration(start, 12, speed)).toBeLessThanOrEqual(5.55);
  });
});
