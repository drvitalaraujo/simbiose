import { describe, expect, it } from 'vitest';
import { createProgress, currentStep, feed, SHOTGUN, shouldAutoOpen, skipStep, SNIPER, STEPS, stepFraction, type TutorialSignal } from './tutorial-steps';

/** Sinais que cumprem cada passo, na ordem. */
const PERFECT: Record<string, TutorialSignal[]> = {
  move: [{ type: 'moved', meters: 6, walking: false }, { type: 'moved', meters: 8, walking: true }],
  shoot: [0, 1, 2].map(() => ({ type: 'targetDown', role: 'basic', weapon: 0, aiming: false }) as TutorialSignal),
  aim: [{ type: 'targetDown', role: 'aim', weapon: 0, aiming: true }],
  swap: [{ type: 'targetDown', role: 'far', weapon: SNIPER, aiming: true }, { type: 'targetDown', role: 'near', weapon: SHOTGUN, aiming: false }],
  reload: [{ type: 'reload' }],
  crouch: [{ type: 'crouch' }],
  melee: [{ type: 'melee', back: true }],
  throw: [{ type: 'throw' }, { type: 'pickup' }],
  hack: [{ type: 'hack' }],
};

describe('Teste de Admissão (passos do tutorial)', () => {
  it('cobre todas as ações pedidas, nesta ordem', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['move', 'shoot', 'aim', 'swap', 'reload', 'crouch', 'melee', 'throw', 'hack']);
    for (const s of STEPS) {
      expect(s.line.length).toBeGreaterThan(10);
      expect(s.hints.length).toBeGreaterThan(0);
      expect(PERFECT[s.id]).toBeDefined();
    }
  });

  it('do começo ao fim com as ações certas', () => {
    const p = createProgress();
    for (const s of STEPS) {
      expect(currentStep(p)?.id).toBe(s.id);
      const signals = PERFECT[s.id];
      signals.slice(0, -1).forEach((sig) => expect(feed(p, sig).kind).toBe('progress'));
      const last = feed(p, signals[signals.length - 1]);
      expect(last).toMatchObject({ kind: 'passed', step: { id: s.id } });
    }
    expect(p.done).toBe(true);
    expect(currentStep(p)).toBeNull();
    expect(feed(p, { type: 'hack' }).kind).toBe('none');
  });

  it('andar só passa com movimento normal e caminhada silenciosa', () => {
    const p = createProgress();
    feed(p, { type: 'moved', meters: 30, walking: false });
    expect(currentStep(p)?.id).toBe('move');
    expect(stepFraction(p)).toBeCloseTo(0.5);
    feed(p, { type: 'moved', meters: 4, walking: true });
    expect(stepFraction(p)).toBeCloseTo(0.75);
  });

  it('arma errada no alvo de longe/perto reprova e pede de novo', () => {
    const p = createProgress();
    while (currentStep(p)?.id !== 'swap') skipStep(p);
    expect(feed(p, { type: 'targetDown', role: 'far', weapon: 0, aiming: true })).toMatchObject({ kind: 'wrong', role: 'far' });
    expect(feed(p, { type: 'targetDown', role: 'near', weapon: SNIPER, aiming: false })).toMatchObject({ kind: 'wrong', role: 'near' });
    expect(stepFraction(p)).toBe(0);
  });

  it('mirar exige o botão direito; chinelada exige as costas', () => {
    const p = createProgress();
    while (currentStep(p)?.id !== 'aim') skipStep(p);
    expect(feed(p, { type: 'targetDown', role: 'aim', weapon: 0, aiming: false }).kind).toBe('wrong');
    while (currentStep(p)?.id !== 'melee') skipStep(p);
    expect(feed(p, { type: 'melee', back: false }).kind).toBe('wrong');
    expect(feed(p, { type: 'melee', back: true }).kind).toBe('passed');
  });

  it('recolher o chinelo só conta depois de arremessar', () => {
    const p = createProgress();
    while (currentStep(p)?.id !== 'throw') skipStep(p);
    expect(feed(p, { type: 'pickup' }).kind).toBe('none');
    expect(feed(p, { type: 'throw' }).kind).toBe('progress');
    expect(feed(p, { type: 'pickup' }).kind).toBe('passed');
  });

  it('sinal de outro passo não conta', () => {
    const p = createProgress();
    expect(feed(p, { type: 'hack' }).kind).toBe('none');
    expect(feed(p, { type: 'targetDown', role: 'basic', weapon: 0, aiming: false }).kind).toBe('none');
  });

  it('abre sozinho só na primeira vez; ?debug não abre, &tutorial força', () => {
    expect(shouldAutoOpen({ debug: false, forced: false, seen: false })).toBe(true);
    expect(shouldAutoOpen({ debug: false, forced: false, seen: true })).toBe(false);
    expect(shouldAutoOpen({ debug: true, forced: false, seen: false })).toBe(false);
    expect(shouldAutoOpen({ debug: true, forced: true, seen: true })).toBe(true);
  });
});
