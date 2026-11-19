import { describe, expect, it } from 'vitest';
import { type MotionInput, RELOAD_TIME, Spring, ViewmodelMotion } from './motion';

const still: MotionInput = { vx: 0, vy: 0, vz: 0, onGround: true, bobPhase: 0, yaw: 0, pitch: 0 };
const DT = 1 / 60;

function run(m: ViewmodelMotion, frames: number, input: MotionInput = still) {
  for (let i = 0; i < frames; i++) m.update(DT, input);
  return m.pose;
}

describe('Spring', () => {
  it('volta ao alvo depois de um impulso e aguenta dt grande', () => {
    const s = new Spring(400, 22);
    s.velocity = 3;
    s.step(0.1);
    expect(Number.isFinite(s.value)).toBe(true);
    for (let i = 0; i < 120; i++) s.step(DT);
    expect(Math.abs(s.value)).toBeLessThan(1e-3);
  });
});

describe('ViewmodelMotion', () => {
  it('escopeta bombeia após o tiro, termina antes da cadência e não solta o depósito na recarga', () => {
    const m = new ViewmodelMotion(() => 0.5);
    const shotgun = { ...still, weaponIndex: 3 };
    m.shot(1.5);
    run(m, 18, shotgun);
    expect(m.pose.pump).toBeCloseTo(1);
    run(m, 22, shotgun);
    expect(m.pose.pump).toBe(0);
    m.update(DT, { ...shotgun, reloadRemaining: 1.2, reloadDuration: 2.1 });
    expect(m.pose.magY).toBe(0);
    expect(m.pose.handZ).toBeGreaterThan(0.1);
    m.update(DT, { ...shotgun, reloadRemaining: 0 });
    expect(m.pose.handZ).toBe(0);
  });
  it('recarga segue o relógio da simulação e uma correção/cancelamento recoloca o pente', () => {
    const m = new ViewmodelMotion(() => 0.5);
    m.update(DT, { ...still, reloadRemaining: RELOAD_TIME * 0.6 });
    expect(m.pose.magY).toBeLessThan(-0.2);
    m.update(0.1, { ...still, reloadRemaining: RELOAD_TIME * 0.6 });
    expect(m.pose.magY).toBeLessThan(-0.2);
    m.update(DT, { ...still, reloadRemaining: 0 });
    expect(m.reloading).toBe(false);
    expect(m.pose.magY).toBe(0);
    expect(m.pose.handY).toBe(0);
  });
  it('slide mistura a pose, reduz passos e mantém o coice responsivo', () => {
    const m = new ViewmodelMotion(() => 0.5);
    const slide = { ...still, vz: -11, sliding: true, crouchAmount: 1 };
    const first = { ...m.update(DT, slide) };
    expect(first.rz).toBeLessThan(0);
    expect(first.rz).toBeGreaterThan(-0.14);
    run(m, 80, slide);
    expect(m.pose.sprint).toBe(0);
    const before = m.pose.rz;
    m.update(DT, { ...slide, bobPhase: 50 });
    expect(m.pose.rz).toBeCloseTo(before, 3);
    m.shot();
    expect(run(m, 3, slide).rx).toBeGreaterThan(0.03);
    m.reset();
    expect(m.pose.rz).toBe(0);
  });
  it('coice: recua e sobe logo após o tiro, e volta ao descanso', () => {
    const m = new ViewmodelMotion(() => 0.5);
    run(m, 10);
    m.shot();
    expect(run(m, 1).bolt).toBe(1); // ferrolho todo para trás no quadro do tiro
    const p = run(m, 2);
    expect(p.z).toBeGreaterThan(0.01); // para trás (+z da câmera)
    expect(p.rx).toBeGreaterThan(0.03); // boca sobe
    run(m, 60);
    expect(Math.abs(m.pose.z)).toBeLessThan(0.002);
    expect(Math.abs(m.pose.rx)).toBeLessThan(0.005);
    expect(m.pose.bolt).toBe(0);
  });

  it('ferrolho fecha antes do próximo tiro (cadência de 9 por segundo)', () => {
    const m = new ViewmodelMotion(() => 0.5);
    m.shot();
    run(m, 6); // 0,1 s < 1/9 s
    expect(m.pose.bolt).toBe(0);
  });

  it('correndo abaixa a arma; atirando correndo, ela sobe de novo', () => {
    const m = new ViewmodelMotion(() => 0.5);
    const sprint = { ...still, vz: -11 };
    run(m, 40, sprint);
    expect(m.pose.sprint).toBeGreaterThan(0.9);
    m.shot();
    run(m, 12, sprint);
    expect(m.pose.sprint).toBeLessThan(0.3);
  });

  it('pouso de pulo dá um tranco para baixo', () => {
    const m = new ViewmodelMotion(() => 0.5);
    run(m, 10);
    run(m, 5, { ...still, onGround: false, vy: -9 });
    const before = m.pose.y;
    run(m, 4, still);
    expect(m.pose.y).toBeLessThan(before - 0.01);
  });

  it('girar a mira faz a arma atrasar para o lado oposto', () => {
    const m = new ViewmodelMotion(() => 0.5);
    let yaw = 0;
    for (let i = 0; i < 10; i++) {
      yaw += 0.05; // girando para a esquerda (yaw positivo)
      m.update(DT, { ...still, yaw });
    }
    expect(m.pose.x).toBeGreaterThan(0.005);
  });

  it('recarga tira e devolve o carregador e termina sozinha', () => {
    const m = new ViewmodelMotion(() => 0.5);
    m.reload();
    expect(m.reloading).toBe(true);
    run(m, Math.round(RELOAD_TIME * 60 * 0.4));
    expect(m.pose.magY).toBeLessThan(-0.1);
    expect(m.pose.cell).toBeLessThan(0.5);
    run(m, Math.round(RELOAD_TIME * 60 * 0.7));
    expect(m.reloading).toBe(false);
    expect(m.pose.magY).toBe(0);
    expect(m.pose.cell).toBe(1);
  });

  it('sacar: a arma sobe de baixo, passa um pouco do ponto e o ferrolho estala', () => {
    const m = new ViewmodelMotion(() => 0.5);
    m.equip();
    expect(run(m, 1).y).toBeLessThan(-0.15);
    let overshoot = 0;
    let rack = 0;
    for (let i = 0; i < 40; i++) {
      run(m, 1);
      overshoot = Math.min(overshoot, m.pose.equip);
      rack = Math.max(rack, m.pose.bolt);
    }
    expect(overshoot).toBeLessThan(-0.01);
    expect(rack).toBe(1);
    run(m, 30);
    expect(Math.abs(m.pose.equip)).toBeLessThan(0.01);
  });

  it('sniper: a alavanca sobe, o ferrolho recua e volta antes do próximo tiro (1,15 s)', () => {
    const m = new ViewmodelMotion(() => 0.5);
    const sniper = { ...still, weaponIndex: 2 };
    m.shot(1.7);
    expect(run(m, 1, sniper).bolt).toBe(0);
    run(m, 29, sniper); // 0,5 s
    expect(m.pose.boltLift).toBeGreaterThan(0.9);
    expect(m.pose.bolt).toBeGreaterThan(0.9);
    run(m, 30, sniper); // 1 s
    expect(m.pose.boltLift).toBe(0);
    expect(m.pose.bolt).toBe(0);
  });

  it('dt = 0 (hit-stop) congela a pose', () => {
    const m = new ViewmodelMotion(() => 0.5);
    m.shot();
    run(m, 2);
    const z = m.pose.z;
    m.update(0, still);
    expect(m.pose.z).toBe(z);
  });

  it('reset volta ao descanso na hora (mesmo com dt = 0) e não inventa pouso depois', () => {
    const m = new ViewmodelMotion(() => 0.5);
    run(m, 10);
    run(m, 20, { ...still, onGround: false, vy: -12 }); // caindo
    m.shot();
    m.reload();
    run(m, 2, { ...still, onGround: false, vy: -12 });
    expect(m.pose.bolt).toBeGreaterThan(0.5);
    m.reset();
    m.update(0, still);
    for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz', 'bolt', 'magY', 'handZ', 'sprint'] as const) expect(m.pose[k]).toBe(0);
    expect(m.pose.cell).toBe(1);
    expect(m.reloading).toBe(false);
    // Renasceu no chão: a primeira atualização não pode dar o tranco de pouso da queda anterior
    run(m, 4, { ...still, yaw: 2 }); // e nem tranco de mira pelo yaw novo
    expect(Math.abs(m.pose.y)).toBeLessThan(0.004);
    expect(Math.abs(m.pose.x)).toBeLessThan(0.002);
  });
});
