import { describe, expect, it } from 'vitest';
import {
  barDuration, barEvents, clean, density, fillEvents, gapThreshold, quantize, STEPS, stinger, styleById, styleForMap,
  targetIntensity, tempo, type Intensity, type StyleId,
} from './music-patterns';
import { STYLES } from './music-styles';

const IDS = Object.keys(STYLES) as StyleId[];

describe('partituras', () => {
  it('toda faixa fecha compassos inteiros de 16 passos e usa só símbolos conhecidos', () => {
    for (const style of Object.values(STYLES)) {
      for (const track of style.tracks) {
        const p = clean(track.pattern);
        expect(p.length % STEPS, `${style.id}/${track.inst}`).toBe(0);
        expect(p, `${style.id}/${track.inst}`).toMatch(track.scale ? /^[0-9a-e.-]+$/ : /^[XxgoO13578.-]+$/);
      }
    }
  });

  it('cada estilo tem tempo, acordes e as camadas de calma, combate e tensão', () => {
    for (const id of IDS) {
      const style = styleById(id);
      expect(style.bpm).toBeGreaterThan(80);
      expect(style.chords.length).toBeGreaterThan(0);
      expect(barEvents(style, 0, 0).length).toBeGreaterThan(0);
    }
  });

  it('eventos ficam dentro do compasso, ordenados, com volume e notas válidas', () => {
    for (const id of IDS) for (const i of [0, 1, 2] as Intensity[]) for (let bar = 0; bar < 8; bar++) {
      const events = barEvents(styleById(id), bar, i);
      let last = 0;
      for (const e of events) {
        expect(e.step).toBeGreaterThanOrEqual(last);
        expect(e.step).toBeLessThan(STEPS);
        expect(e.vel).toBeGreaterThan(0);
        expect(e.vel).toBeLessThanOrEqual(1);
        expect(e.length).toBeGreaterThanOrEqual(1);
        for (const n of e.notes) { expect(n).toBeGreaterThanOrEqual(24); expect(n).toBeLessThanOrEqual(100); }
        last = e.step;
      }
    }
  });

  it('a densidade sobe com a intensidade: combate traz percussão cheia e baixo', () => {
    for (const id of IDS) {
      const style = styleById(id);
      expect(density(style, 1)).toBeGreaterThan(density(style, 0));
      expect(density(style, 2)).toBeGreaterThan(density(style, 1));
      const calm = new Set(barEvents(style, 0, 0).map(e => e.inst));
      const combat = new Set(barEvents(style, 0, 1).map(e => e.inst));
      if (id !== 'menu') expect(calm.has('bass')).toBe(false);
      expect(combat.has('bass')).toBe(true);
    }
  });

  it('a tensão acelera o andamento sem mudar a calma', () => {
    const style = styleById('favela');
    expect(tempo(style, 0)).toBe(style.bpm);
    expect(tempo(style, 2)).toBeGreaterThan(style.bpm);
    expect(barDuration(120)).toBeCloseTo(2);
  });

  it('cada mapa tem um estilo próprio', () => {
    expect(styleForMap('pelourinho')).toBe('pelourinho');
    expect(styleForMap('arena1')).toBe('pelourinho');
    expect(styleForMap('lapa')).toBe('lapa');
    expect(styleForMap('patacho')).toBe('pelourinho');
    expect(styleForMap('favela')).toBe('favela');
    expect(styleForMap('arena')).toBe('bairro');
    expect(styleForMap(undefined)).toBe('bairro');
  });
});

describe('transições', () => {
  it('quantiza na próxima virada da grade, sem voltar no tempo', () => {
    const bar = barDuration(100);
    expect(quantize(0.01, 0, bar)).toBeCloseTo(bar);
    expect(quantize(bar, 0, bar)).toBeCloseTo(bar);
    expect(quantize(bar * 2.5, 0, bar)).toBeCloseTo(bar * 3);
    expect(quantize(-1, 0, bar)).toBe(0);
  });

  it('a virada de caixa cresce até o compasso novo', () => {
    const fill = fillEvents(1);
    expect(fill.map(e => e.step)).toEqual([12, 13, 14, 15]);
    expect(fill[3].vel).toBeGreaterThan(fill[0].vel);
  });

  it('vinhetas no tom do estilo: início, abate curto, vitória sobe e derrota desce', () => {
    const style = styleById('lapa');
    const leadOf = (k: 'win' | 'lose') => stinger(k, style).filter(n => n.inst === 'lead').map(n => n.notes[0]);
    expect(stinger('kill', style).length).toBeLessThanOrEqual(2);
    const win = leadOf('win');
    const lose = leadOf('lose');
    expect(win[win.length - 1]).toBeGreaterThan(win[0]);
    expect(lose[lose.length - 1]).toBeLessThan(lose[0]);
    expect(stinger('start', style).some(n => n.inst === 'surdo')).toBe(true);
    expect(win[0] % 12).toBe(style.key);
  });
});

describe('intensidade', () => {
  it('calma sem combate, combate por ~6 s depois de atirar ou levar tiro', () => {
    expect(targetIntensity({ sinceCombat: Infinity })).toBe(0);
    expect(targetIntensity({ sinceCombat: 2 })).toBe(1);
    expect(targetIntensity({ sinceCombat: 5.9 })).toBe(1);
    expect(targetIntensity({ sinceCombat: 6.5 })).toBe(0);
  });

  it('tensão no último minuto, perto do limite de abates ou com o chefe', () => {
    expect(targetIntensity({ sinceCombat: Infinity, timeLeft: 45 })).toBe(2);
    expect(targetIntensity({ sinceCombat: Infinity, timeLeft: 200 })).toBe(0);
    expect(targetIntensity({ sinceCombat: Infinity, timeLeft: 0 })).toBe(0);
    expect(targetIntensity({ sinceCombat: 1, leaderGap: 3 })).toBe(2);
    expect(targetIntensity({ sinceCombat: 1, leaderGap: 4 })).toBe(1);
    expect(targetIntensity({ sinceCombat: Infinity, boss: true })).toBe(2);
    expect(targetIntensity({ sinceCombat: 1, timeLeft: 30, idle: true })).toBe(0);
  });

  it('limiar de tensão proporcional ao limite', () => {
    expect(gapThreshold(25)).toBe(3);
    expect(gapThreshold(5)).toBe(1);
    expect(gapThreshold(200, 'hack')).toBe(20);
  });
});
