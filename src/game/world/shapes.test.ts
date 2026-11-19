import { describe, expect, it } from 'vitest';
import { type Box, moveAndCollide } from '../physics';
import { box, insideAny, MAX_RISE, rng, slabWithHole, stairs } from './shapes';

const HALF = { x: 0.35, y: 0.85, z: 0.35 }; // mesmo tamanho do jogador
const STEP = 0.45;

/** Anda em linha reta como o Player (gravidade + subida de degrau) e devolve o centro final. */
function walk(start: { x: number; y: number; z: number }, dirX: number, dirZ: number, solids: Box[], seconds: number) {
  const c = { ...start };
  let vy = 0;
  let onGround = false;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    vy -= 26 * dt;
    const r = moveAndCollide(c, HALF, { x: dirX * 7 * dt, y: vy * dt, z: dirZ * 7 * dt }, solids, onGround ? STEP : 0);
    onGround = r.onGround;
    if (r.onGround || r.hitCeiling) vy = 0;
  }
  return c;
}

describe('escadas do bairro', () => {
  const spec = { axis: 'x' as const, start: -32, dir: 1 as const, across: [-18, -14] as [number, number], base: 0.25, top: 4.5 };

  it('tem degraus iguais e baixos o bastante para subir andando', () => {
    const steps = stairs(spec);
    let prev = spec.base;
    for (const s of steps) {
      expect(s.max.y - prev).toBeLessThanOrEqual(MAX_RISE + 1e-9);
      expect(s.max.y).toBeGreaterThan(prev);
      prev = s.max.y;
    }
    expect(prev).toBeCloseTo(spec.top, 9);
  });

  it('o jogador sobe a escada andando até o deque, sem pular', () => {
    const steps = stairs(spec);
    const end = spec.start + steps.length * 0.6;
    const ground = box(-60, -1, -30, 60, spec.base, 30);
    const deck = box(end, 3.5, -18, end + 10, spec.top, -14);
    const c = walk({ x: spec.start - 2, y: spec.base + HALF.y + 0.01, z: -16 }, 1, 0, [ground, ...steps, deck], 2.5);
    expect(c.x).toBeGreaterThan(end);
    expect(c.y).toBeCloseTo(spec.top + HALF.y, 2);
  });

  it('escada descendo para o fosso do metrô também é subível (sentido -z)', () => {
    const pit = stairs({ axis: 'z', start: 28, dir: -1, across: [12, 16], base: -3.5, top: 0.25, floor: -4, depth: 0.8 });
    const end = 28 - pit.length * 0.8;
    const floorBottom = box(10, -5, 27, 18, -3.5, 32);
    const sidewalk = box(10, -4, end - 10, 18, 0.25, end);
    const c = walk({ x: 14, y: -3.5 + HALF.y + 0.01, z: 29 }, 0, -1, [floorBottom, sidewalk, ...pit], 2);
    expect(c.z).toBeLessThan(end);
    expect(c.y).toBeCloseTo(0.25 + HALF.y, 2);
  });
});

describe('laje com buraco', () => {
  it('cobre a área de fora do buraco sem sobrepor', () => {
    const outer = { x0: 0, z0: 0, x1: 10, z1: 10 };
    const hole = { x0: 2, z0: 3, x1: 5, z1: 8 };
    const parts = slabWithHole(outer, hole, -1, 0);
    const area = parts.reduce((a, b) => a + (b.max.x - b.min.x) * (b.max.z - b.min.z), 0);
    expect(area).toBeCloseTo(100 - 15, 9);
    expect(insideAny({ x: 3, y: -0.5, z: 5 }, parts)).toBe(false); // dentro do buraco
    expect(insideAny({ x: 8, y: -0.5, z: 5 }, parts)).toBe(true);
  });
});

describe('rng', () => {
  it('é determinístico e fica em [0, 1)', () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
