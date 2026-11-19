import { describe, expect, it } from 'vitest';
import { fxBudget, MovementBursts, puffScale, type MovementSample } from './movement-fx-logic';
import type { MovementCue } from './movement-camera';

const NONE: MovementCue = { step: 0, land: 0, jump: false };
const sample = (over: Partial<MovementSample> = {}): MovementSample => ({
  feet: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: -9.5 }, yaw: 0, sliding: false, onGround: true, ...over,
});
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('efeitos do movimento', () => {
  it('puff incha, murcha e some', () => {
    expect(puffScale(0)).toBe(0);
    expect(puffScale(0.18)).toBeCloseTo(1, 6);
    expect(puffScale(0.6)).toBeGreaterThan(0.3);
    expect(puffScale(1)).toBe(0);
  });

  it('poeira só nas passadas correndo, nada andando', () => {
    const b = new MovementBursts([1, 2], rnd);
    expect(b.emit(1 / 60, sample(), { ...NONE, step: 1 }, 0).length).toBe(3);
    expect(b.emit(1 / 60, sample({ vel: { x: 0, y: 0, z: -6 } }), { ...NONE, step: 1 }, 0).length).toBe(0);
    expect(b.emit(1 / 60, sample(), NONE, 0).length).toBe(0);
  });

  it('nuvem da aterrissagem cresce com a força e cabe no orçamento da qualidade', () => {
    const b = new MovementBursts([1], rnd);
    const soft = b.emit(1 / 60, sample(), { ...NONE, land: 0.1 }, 0);
    const hard = b.emit(1 / 60, sample(), { ...NONE, land: 1 }, 0);
    const hardLow = b.emit(1 / 60, sample(), { ...NONE, land: 1 }, 2);
    expect(hard.length).toBeGreaterThan(soft.length * 4);
    expect(hardLow.length).toBeLessThan(hard.length);
    expect(Math.max(...hard.map(p => p.size))).toBeGreaterThan(Math.max(...soft.map(p => p.size)));
    expect(fxBudget(3)).toBeLessThan(fxBudget(2));
  });

  it('slide rápido solta poeira e faíscas contínuas, sem faísca na qualidade 3', () => {
    const b = new MovementBursts([1], rnd);
    let dust = 0, sparks = 0, sparksLow = 0;
    const slide = sample({ sliding: true, vel: { x: 0, y: 0, z: -13 } });
    for (let i = 0; i < 60; i++) for (const p of b.emit(1 / 60, slide, NONE, 0)) p.spark ? sparks++ : dust++;
    for (let i = 0; i < 60; i++) sparksLow += b.emit(1 / 60, slide, NONE, 3).filter(p => p.spark).length;
    expect(dust).toBeGreaterThan(20);
    expect(sparks).toBeGreaterThan(8);
    expect(sparksLow).toBe(0);
  });

  it('puff de poeira sobe devagar e para; faísca cai', () => {
    const b = new MovementBursts([1], rnd);
    const [p] = b.emit(1 / 60, sample(), { ...NONE, step: 1 }, 0);
    for (let i = 0; i < 20; i++) b.stepDust(p, 1 / 60);
    expect(p.y).toBeGreaterThan(0.06);
    const spark = { ...p, vy: 2, spark: true, age: 0, life: 1 };
    for (let i = 0; i < 30; i++) b.stepSpark(spark, 1 / 60);
    expect(spark.vy).toBeLessThan(0);
  });
});
