import { describe, expect, it } from 'vitest';
import {
  accelerate, DRONE_SPEED, escortSlot, fireInterval, HACK_RANGE, HACK_TIME, hackable, hackProgress, huggerChance, isBossWave,
  MAX_ALLIES, overloadedAllies, steer, turnToward, wander, waveSize,
} from './brain';

const player = { x: 0, y: 1, z: 0 };
const speed = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

describe('steer', () => {
  it('aproxima quando está longe', () => {
    const v = steer({ x: 30, y: 3.5, z: 0 }, player, 0, 1);
    expect(v.x).toBeLessThan(0);
  });

  it('afasta quando está perto demais', () => {
    const v = steer({ x: 3, y: 3.5, z: 0 }, player, 0, 1);
    expect(v.x).toBeGreaterThan(0);
  });

  it('circula na distância preferida, no sentido pedido', () => {
    const a = steer({ x: 10, y: 3.5, z: 0 }, player, 0, 1);
    const b = steer({ x: 10, y: 3.5, z: 0 }, player, 0, -1);
    expect(Math.abs(a.x)).toBeLessThan(0.01);
    expect(Math.sign(a.z)).toBe(-Math.sign(b.z));
  });

  it('nunca passa da velocidade máxima', () => {
    for (const p of [{ x: 50, y: -10, z: 50 }, { x: 0.1, y: 20, z: 0 }]) {
      expect(speed(steer(p, player, 2, 1))).toBeLessThanOrEqual(DRONE_SPEED + 1e-9);
    }
  });
});

describe('movimento vivo', () => {
  it('accelerate respeita a aceleração máxima e chega no alvo', () => {
    const v = accelerate({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 20, 0.1);
    expect(v.x).toBeCloseTo(2, 5);
    expect(accelerate({ x: 9.9, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 20, 0.1).x).toBe(10);
  });

  it('wander fica limitado', () => {
    for (let t = 0; t < 30; t += 0.37) expect(speed(wander(t, 1.3))).toBeLessThan(1.6);
  });

  it('turnToward usa o caminho mais curto', () => {
    const a = turnToward(3.0, -3.0, 1, 0.1); // atravessa o ±π, não volta por 0
    expect(a).toBeGreaterThan(3.0);
    expect(turnToward(0, 0.05, 1, 0.1)).toBe(0.05);
  });

  it('escolta fica atrás do jogador', () => {
    // yaw 0: jogador olha para -z, então "atrás" é +z
    for (let s = 0; s < 3; s++) expect(escortSlot(s, 0).z).toBeGreaterThan(0);
    const left = escortSlot(0, 0);
    const right = escortSlot(1, 0);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
  });
});

describe('hack', () => {
  it('só drone inimigo em pane e no alcance', () => {
    expect(hackable(1, 'enemy', 10)).toBe(true);
    expect(hackable(2, 'enemy', 10)).toBe(false);
    expect(hackable(1, 'ally', 10)).toBe(false);
    expect(hackable(1, 'enemy', HACK_RANGE + 1)).toBe(false);
  });

  it('enche segurando no mesmo alvo e completa em HACK_TIME', () => {
    let p = 0;
    for (let t = 0; t < HACK_TIME - 1e-9; t += 0.05) p = hackProgress(p, 0.05, true, true);
    expect(p).toBeCloseTo(1, 5);
  });

  it('trocar de alvo zera; soltar esvazia aos poucos', () => {
    expect(hackProgress(0.8, 0.016, true, false)).toBe(0);
    const released = hackProgress(0.8, 0.05, false, true);
    expect(released).toBeLessThan(0.8);
    expect(released).toBeGreaterThan(0);
  });

  it('sobrecarga acima do limite de aliados', () => {
    expect(overloadedAllies(MAX_ALLIES)).toBe(0);
    expect(overloadedAllies(MAX_ALLIES + 1)).toBe(1);
  });
});

describe('ondas', () => {
  it('crescem e têm teto', () => {
    expect(waveSize(1)).toBe(3);
    expect(waveSize(2)).toBeGreaterThan(waveSize(1));
    expect(waveSize(50)).toBe(15);
  });

  it('chefe a cada 5 ondas', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(isBossWave)).toEqual([false, false, false, false, true, false, true]);
  });

  it('Abraço Grátis aparece da onda 2 em diante, com teto', () => {
    expect(huggerChance(1)).toBe(0);
    expect(huggerChance(2)).toBeGreaterThan(0);
    expect(huggerChance(3)).toBeGreaterThan(huggerChance(2));
    expect(huggerChance(99)).toBe(0.45);
  });

  it('tiro fica mais frequente, mas com limite', () => {
    expect(fireInterval(2)).toBeLessThan(fireInterval(1));
    expect(fireInterval(100)).toBe(1);
  });
});
