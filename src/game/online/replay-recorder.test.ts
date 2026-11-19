import { describe, expect, it } from 'vitest';
import { angleDelta, emptySample, type ReplayEvent, ReplayRecorder, type ReplaySample } from './replay-recorder';

const pose = (x: number, extra: Partial<ReplaySample> = {}): ReplaySample => ({ ...emptySample(), x, alive: true, ...extra });

function shot(t: number, by: string, target = ''): ReplayEvent {
  return { t, kind: 'shot', by, target, weapon: 'mk2', o: [0, 1, 0], e: [1, 1, 0], pellets: null, part: target ? 'torso' : '', damage: target ? 25 : 0, killed: false, headshot: false, continuation: false };
}

/** Grava `seconds` a 60 quadros/s: "bot" anda em x = t, você em x = −t. */
function run(rec: ReplayRecorder, seconds: number, start = 0) {
  for (let i = 0; i <= seconds * 60; i++) {
    const t = start + i / 60;
    rec.pushLocal(t, 'eu', pose(-t));
    if (rec.begin(t)) {
      rec.player('bot', 'Riso', '', true, pose(t, { yaw: 1 }));
      rec.end({ name: 'Lia', team: '' });
    }
  }
}

describe('gravador de replay', () => {
  it('grava mira e recarga do matador, sem misturar armas na troca', () => {
    const rec = new ReplayRecorder({ hz: 10 });
    rec.begin(0); rec.player('a', 'A', '', false, pose(0, { weapon: 0, aim: 0.2, reload: 1 })); rec.end();
    rec.begin(0.1); rec.player('a', 'A', '', false, pose(0, { weapon: 0, aim: 0.8, reload: 0.9 })); rec.end();
    rec.begin(0.2); rec.player('a', 'A', '', false, pose(0, { weapon: 2, aim: 0, reload: 0 })); rec.end();
    const clip = rec.clip(0, 1)!;
    const out = emptySample();
    clip.sample(0, 0.05, out);
    expect(out.aim).toBeCloseTo(0.5);
    expect(out.reload).toBeCloseTo(0.95);
    clip.sample(0, 0.14, out);
    expect(out.weapon).toBe(0);
    expect(out.aim).toBeCloseTo(0.8);
    expect(out.reload).toBeCloseTo(0.9);
    clip.sample(0, 0.16, out);
    expect(out).toMatchObject({ weapon: 2, aim: 0, reload: 0 });
  });

  it('mira e recarga locais usam o mesmo atraso da pose prevista', () => {
    const rec = new ReplayRecorder({ hz: 10 });
    rec.localDelay = 0.15;
    for (let i = 0; i <= 5; i++) {
      const t = i / 10;
      rec.pushLocal(t, 'eu', pose(t, { aim: t, reload: 1 - t }));
      rec.begin(t); rec.end({ name: 'Eu', team: '' });
    }
    const clip = rec.clip(0, 1)!;
    const out = emptySample();
    clip.sample(0, 0.3, out);
    expect(out.aim).toBeCloseTo(0.15);
    expect(out.reload).toBeCloseTo(0.85);
  });

  it('grava a ~30 Hz e guarda só os últimos ~12 s', () => {
    const rec = new ReplayRecorder({ seconds: 12, hz: 30 });
    run(rec, 20);
    expect(rec.frames).toBe(rec.capacity);
    expect(rec.newest).toBeCloseTo(20, 5);
    expect(rec.newest - rec.oldest).toBeCloseTo(12, 1);
  });

  it('não aloca memória nova conforme grava (buffers fixos)', () => {
    const rec = new ReplayRecorder({ seconds: 2 });
    run(rec, 1);
    const cap = rec.capacity;
    run(rec, 30, 1);
    expect(rec.capacity).toBe(cap);
    expect(rec.frames).toBe(cap);
  });

  it('recorta um clipe e interpola a pose entre quadros', () => {
    const rec = new ReplayRecorder();
    run(rec, 6);
    const clip = rec.clip(2, 5)!;
    expect(clip.start).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(clip.end).toBeLessThanOrEqual(5 + 1e-6);
    const out = emptySample();
    const bot = clip.slotOf('bot');
    expect(clip.sample(bot, 3.01, out)).toBe(true);
    expect(out.x).toBeCloseTo(3.01, 2);
    expect(out.alive).toBe(true);
    expect(clip.actors[bot]).toMatchObject({ name: 'Riso', bot: true });
  });

  it('atrasa a sua pose prevista para alinhar com os outros', () => {
    const rec = new ReplayRecorder();
    rec.localDelay = 0.1;
    run(rec, 4);
    const clip = rec.clip(1, 3)!;
    const out = emptySample();
    expect(clip.sample(clip.slotOf('eu'), 2, out)).toBe(true);
    expect(out.x).toBeCloseTo(-(2 - 0.1), 2);
  });

  it('o clipe é uma cópia: continuar gravando não muda o que foi congelado', () => {
    const rec = new ReplayRecorder({ seconds: 3 });
    run(rec, 3);
    const clip = rec.clip(1, 2)!;
    const out = emptySample();
    clip.sample(clip.slotOf('bot'), 1.5, out);
    const before = out.x;
    run(rec, 10, 3);
    clip.sample(clip.slotOf('bot'), 1.5, out);
    expect(out.x).toBe(before);
  });

  it('leva os eventos do trecho, em ordem', () => {
    const rec = new ReplayRecorder();
    run(rec, 5);
    rec.event(shot(1.5, 'bot'));
    rec.event(shot(4.2, 'bot', 'eu'));
    rec.event(shot(3.1, 'eu'));
    const clip = rec.clip(3, 5)!;
    expect(clip.events.map(e => e.t)).toEqual([3.1, 4.2]);
    expect(rec.findEvent(e => e.target === 'eu')?.t).toBe(4.2);
  });

  it('quem não estava na sala não aparece', () => {
    const rec = new ReplayRecorder();
    for (let i = 0; i < 90; i++) {
      const t = i / 30;
      if (!rec.begin(t)) continue;
      if (t >= 2) rec.player('novo', 'Novo', '', false, pose(5));
      rec.player('bot', 'Riso', '', true, pose(t));
      rec.end();
    }
    const clip = rec.clip(0, 3)!;
    const out = emptySample();
    expect(clip.sample(clip.slotOf('novo'), 1, out)).toBe(false);
    expect(clip.sample(clip.slotOf('novo'), 2.5, out)).toBe(true);
  });

  it('gira pelo caminho mais curto e não desliza ao renascer longe', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(Math.PI * 2 - 6, 5);
    const rec = new ReplayRecorder({ hz: 10 });
    rec.begin(0); rec.player('a', 'A', '', false, pose(0, { yaw: 3 })); rec.end();
    rec.begin(0.1); rec.player('a', 'A', '', false, pose(0.2, { yaw: -3 })); rec.end();
    rec.begin(0.2); rec.player('a', 'A', '', false, pose(30, { yaw: -3 })); rec.end();
    const clip = rec.clip(0, 1)!;
    const out = emptySample();
    clip.sample(0, 0.05, out);
    expect(Math.abs(out.yaw)).toBeGreaterThan(3);
    clip.sample(0, 0.13, out);
    expect(out.x).toBeCloseTo(0.2, 5);
  });

  it('sem quadros suficientes não há clipe', () => {
    const rec = new ReplayRecorder();
    expect(rec.clip(0, 10)).toBeNull();
  });
});
