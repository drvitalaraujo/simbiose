import { describe, expect, it } from 'vitest';
import { angleDelta, chasePose, CHASE, smoothPose, stepFree, turn } from './cameras';

const box = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => ({ min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } });

describe('câmeras do espectador', () => {
  it('voo livre anda para onde olha; Shift acelera; Q/E sobem no eixo do mundo', () => {
    const cam = { x: 0, y: 5, z: 0, yaw: 0, pitch: 0 };
    const a = stepFree(cam, { right: 0, up: 0, forward: 1, fast: false }, 1);
    expect(a.z).toBeCloseTo(-9);
    const b = stepFree(cam, { right: 0, up: 0, forward: 1, fast: true }, 1);
    expect(b.z).toBeLessThan(a.z);
    const c = stepFree(cam, { right: 1, up: 1, forward: 0, fast: false }, 1);
    expect(c.x).toBeGreaterThan(0);
    expect(c.y).toBeGreaterThan(5);
    expect(Math.hypot(c.x, c.y - 5, c.z)).toBeCloseTo(9); // diagonal não é mais rápida
  });

  it('pitch preso ao girar', () => {
    expect(turn({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.5, 9).pitch).toBeLessThan(1.5);
  });

  it('3ª pessoa fica atrás do ombro e não atravessa parede', () => {
    const eye = { x: 0, y: 1.6, z: 0 };
    const open = chasePose(eye, 0, 0, []);
    expect(open.z).toBeGreaterThan(3); // yaw 0 olha para -z: câmera atrás (z+)
    expect(open.x).toBeGreaterThan(0); // ombro direito
    const wall = box(-5, 0, 1, 5, 5, 1.5);
    const blocked = chasePose(eye, 0, 0, [wall]);
    expect(blocked.z).toBeLessThan(1);
    expect(blocked.z).toBeGreaterThan(0);
    expect(CHASE.back).toBeGreaterThan(2);
  });

  it('suavização pega o caminho curto do ângulo e independe do quadro', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    const from = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const to = { x: 10, y: 0, z: 0, yaw: 1, pitch: 0 };
    let p = from;
    for (let i = 0; i < 60; i++) p = smoothPose(p, to, 1 / 60, 4);
    const once = smoothPose(from, to, 1, 4);
    expect(p.x).toBeCloseTo(once.x, 6);
    expect(p.yaw).toBeCloseTo(once.yaw, 6);
  });
});
