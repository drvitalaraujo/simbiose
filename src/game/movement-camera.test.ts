import { describe, expect, it } from 'vitest';
import {
  cameraMotionScale, dynamicFov, MovementCamera, type CameraMovement, setCameraMotionScale, setReducedMotion,
  speedLineAmount, Spring, STRIDE, CameraKick, lateralOf,
} from './movement-camera';
import { FixedStep, TICK } from '../sim/clock';
import { emptyCommand } from '../sim/command';
import { createPlayer, stepPlayer } from '../sim/player';
import { box, stairs } from './world/shapes';

const standing: CameraMovement = {
  x: 0, y: 0.8501, z: 0, onGround: true, alive: true,
  sliding: false, crouch: 0, aim: 0,
};
const DT = 1 / 60;

describe('câmera do movimento', () => {
  it('sobe um degrau sem copiar o salto de 40 cm e assenta ao parar', () => {
    const camera = new MovementCamera();
    camera.update(standing, DT);
    const step = { ...standing, x: 0.12, y: standing.y + 0.4 };
    const first = camera.update(step, DT);
    expect(first.y - standing.y).toBeGreaterThan(0);
    expect(first.y - standing.y).toBeLessThan(0.08);
    let last = first.y;
    for (let i = 0; i < 30; i++) {
      const motion = camera.update(step, DT);
      expect(motion.y).toBeGreaterThanOrEqual(last);
      expect(motion.y).toBeLessThanOrEqual(step.y);
      last = motion.y;
    }
    expect(last).toBeCloseTo(step.y, 4);
  });

  it('mantém a mesma resposta em 30, 60 e 144 Hz numa subida contínua', () => {
    const heights = [30, 60, 144].map(fps => {
      const camera = new MovementCamera();
      camera.update(standing, 1 / fps);
      let y = 0;
      for (let i = 1; i <= fps; i++) {
        y = camera.update({ ...standing, x: i * 7 / fps, y: standing.y + i * 4 / fps }, 1 / fps).y;
      }
      return y;
    });
    expect(heights[0]).toBeCloseTo(heights[1], 10);
    expect(heights[1]).toBeCloseTo(heights[2], 10);
  });

  it.each([30, 60, 144])('suaviza uma escada física sem travar nem ultrapassar o olho a %i Hz', fps => {
    const p = createPlayer({ x: 0, y: standing.y, z: 0 });
    p.onGround = true;
    const solids = [box(-20, -1, -5, 20, 0, 5),
      ...stairs({ axis: 'x', start: 1, dir: 1, across: [-2, 2], base: 0, top: 2 }),
      box(4, 0, -2, 12, 2, 2)];
    const fixed = new FixedStep();
    const camera = new MovementCamera();
    let previous = { ...p.pos };
    let lastRaw = p.pos.y, lastView = p.pos.y;
    let rawRise = 0, viewRise = 0;
    for (let frame = 0; frame < fps; frame++) {
      const ticks = fixed.advance(1 / fps);
      for (let i = 0; i < ticks; i++) {
        previous = { ...p.pos };
        stepPlayer(p, { ...emptyCommand(), moveX: 1 }, TICK, solids);
      }
      const lerp = (key: 'x' | 'y' | 'z') => previous[key] + (p.pos[key] - previous[key]) * fixed.alpha;
      const sample = { ...standing, x: lerp('x'), y: lerp('y'), z: lerp('z'), onGround: p.onGround };
      const view = camera.update(sample, 1 / fps);
      rawRise = Math.max(rawRise, sample.y - lastRaw);
      viewRise = Math.max(viewRise, view.y - lastView);
      expect(view.y).toBeLessThanOrEqual(sample.y);
      expect(sample.y - view.y).toBeLessThanOrEqual(0.450001);
      expect(view.y).toBeGreaterThanOrEqual(lastView - 1e-6);
      lastRaw = sample.y; lastView = view.y;
    }
    expect(p.pos.y).toBeCloseTo(2.8501, 6);
    expect(p.onGround).toBe(true);
    expect(viewRise).toBeLessThan(rawRise * 0.8);
  });

  it('não amortece o salto, a queda ou a descida física dos degraus', () => {
    const camera = new MovementCamera();
    camera.update(standing, DT);
    for (const [y, onGround] of [[1, false], [1.5, false], [1.4, false], [0.85, true], [0.8, false]] as const) {
      const motion = camera.update({ ...standing, x: 0.1, y, onGround }, DT);
      expect(motion.y).toBe(y);
    }
  });

  it('saltar durante a subida responde imediatamente, sem zerar o offset de uma vez', () => {
    const camera = new MovementCamera();
    camera.update(standing, DT);
    const step = { ...standing, x: 0.12, y: standing.y + 0.4 };
    const first = camera.update(step, DT);
    const jump = camera.update({ ...step, x: 0.24, y: step.y + 0.15, onGround: false }, DT);
    expect(jump.y - first.y).toBeGreaterThanOrEqual(0.15);
    expect(jump.y).toBeLessThan(step.y + 0.15);
  });

  it('limita a diferença do olho mesmo correndo e agachado numa escadaria', () => {
    const camera = new MovementCamera();
    camera.update(standing, DT);
    for (let i = 1; i <= 120; i++) {
      const p = { ...standing, x: i * 0.183, y: standing.y + Math.floor(i / 3) * 0.4, crouch: 1 };
      const motion = camera.update(p, DT);
      expect(p.y - motion.y).toBeLessThanOrEqual(0.450001);
      expect(motion.y).toBeLessThanOrEqual(p.y);
      expect(motion.bob).toBe(0);
    }
  });

  it('não suaviza teleporte, renascimento nem retorno de uma pausa longa', () => {
    for (const mode of ['teleport', 'reset', 'pause', 'dead']) {
      const camera = new MovementCamera();
      camera.update(standing, DT);
      const step = { ...standing, x: 0.12, y: standing.y + 0.4 };
      camera.update(step, DT);
      if (mode === 'reset') camera.reset();
      const next = { ...step, x: mode === 'teleport' ? 10 : step.x, alive: mode !== 'dead' };
      expect(camera.update(next, mode === 'pause' ? 1 : DT).y).toBe(next.y);
    }
  });

  /** Corre para frente (yaw 0 olha para -Z) por `frames` quadros, a partir de z = -from. */
  const run = (camera: MovementCamera, speed: number, frames: number, posture: Partial<CameraMovement> = {}, from = 0) => {
    let motion = camera.update({ ...standing, ...posture, z: -from }, DT);
    for (let i = 1; i <= frames; i++) motion = camera.update({ ...standing, ...posture, z: -(from + i * speed * DT) }, DT);
    return motion;
  };

  it('balanço e inclinação desaparecem ao parar, inclusive pressionando uma parede', () => {
    const camera = new MovementCamera();
    camera.update(standing, DT);
    let peak = 0, sway = 0;
    let p = standing;
    for (let i = 1; i <= 120; i++) {
      p = { ...standing, x: i * 9.5 * DT, yaw: -Math.PI / 2 }; // olhando e correndo em +x
      const m = camera.update(p, DT);
      peak = Math.max(peak, m.bob);
      sway = Math.max(sway, Math.abs(m.sway));
    }
    expect(peak).toBeGreaterThan(0.025);
    expect(peak).toBeLessThanOrEqual(0.03);
    expect(sway).toBeGreaterThan(0.005);
    let moving = camera.update(p, DT);
    for (let i = 0; i < 90; i++) moving = camera.update(p, DT);
    expect(moving.bob).toBeLessThan(0.00001);
    expect(Math.abs(moving.roll)).toBeLessThan(0.0005);
    expect(moving.fov).toBeLessThan(0.05);
  });

  it('o vale do balanço coincide com cada passada do som (a cada 2,15 m)', () => {
    const camera = new MovementCamera();
    camera.update(standing, DT);
    const steps: number[] = [];
    let z = 0;
    for (let i = 1; i <= 120; i++) {
      z -= 9 * DT;
      const m = camera.update({ ...standing, z }, DT);
      if (m.cue.step) {
        steps.push(-z);
        expect(m.bob).toBeLessThan(0.003); // pé no chão = olho no ponto mais baixo
      }
    }
    expect(steps.length).toBe(Math.floor(9 * 2 / STRIDE));
    for (let i = 1; i < steps.length; i++) expect(steps[i] - steps[i - 1]).toBeCloseTo(STRIDE, 0);
  });

  it('ladeira de microdegraus (Pelourinho): descer andando mantém passadas e balanço', () => {
    const solids = [box(-20, -1, -40, 20, 0, 40)];
    for (let i = 0; i < 32; i++) solids.push(box(-3, 0, i - 8, 3, (i + 1) / 10, i - 7));
    const p = createPlayer({ x: 0, y: 3.2 + 0.8501, z: 23.5 });
    p.onGround = true;
    const camera = new MovementCamera();
    let steps = 0, peak = 0, airFrames = 0;
    for (let i = 0; i < 150; i++) {
      stepPlayer(p, { ...emptyCommand(), moveZ: 1, sprint: false }, TICK, solids);
      const m = camera.update({ ...standing, x: p.pos.x, y: p.pos.y, z: p.pos.z, onGround: p.onGround }, TICK);
      if (m.cue.step) steps++;
      if (!p.onGround) airFrames++;
      if (i > 30) peak = Math.max(peak, m.bob);
    }
    expect(airFrames).toBeGreaterThan(10); // a física solta o corpo nos degraus...
    expect(steps).toBeGreaterThanOrEqual(5); // ...mas a câmera continua contando passadas
    expect(peak).toBeGreaterThan(0.015); // balanço menor a 6 m/s
  });

  it('reduz balanço na mira e o retira no slide e no ar com transição', () => {
    const sample = (posture: Partial<CameraMovement>) => run(new MovementCamera(), 7, 50, posture);
    expect(sample({}).bob).toBeGreaterThan(0.001);
    expect(sample({ aim: 1 }).bob).toBeCloseTo(sample({}).bob * 0.15, 8);
    expect(sample({ sliding: true }).bob).toBe(0);
    expect(sample({ onGround: false }).bob).toBe(0);
  });

  it('aterrissagem afunda proporcional à queda e volta por mola sem ficar presa', () => {
    const drop = (height: number) => {
      const camera = new MovementCamera();
      let y = standing.y + height, vy = 0;
      let motion = camera.update({ ...standing, y, onGround: false }, DT);
      camera.update({ ...standing, y, onGround: false }, DT);
      let land = 0;
      while (y > standing.y) {
        vy -= 26 * DT;
        y = Math.max(standing.y, y + vy * DT);
        motion = camera.update({ ...standing, y, onGround: y <= standing.y }, DT);
        land = Math.max(land, motion.cue.land);
      }
      let deepest = 0, settled = motion;
      for (let i = 0; i < 90; i++) {
        settled = camera.update({ ...standing }, DT);
        deepest = Math.min(deepest, settled.dip);
      }
      return { deepest, land, settled: settled.dip, pitch: settled.pitch };
    };
    const small = drop(1.4), big = drop(6), tiny = drop(0.1);
    expect(tiny.deepest).toBe(0);
    expect(small.deepest).toBeLessThan(-0.02);
    expect(big.deepest).toBeLessThan(small.deepest * 2);
    expect(big.deepest).toBeGreaterThan(-0.16);
    expect(big.land).toBeGreaterThan(small.land);
    expect(Math.abs(big.settled)).toBeLessThan(0.001);
    expect(Math.abs(big.pitch)).toBeLessThan(0.0005);
  });

  it('impulso pequeno no início do pulo', () => {
    const camera = new MovementCamera();
    camera.update(standing, DT);
    camera.update(standing, DT);
    const jump = camera.update({ ...standing, y: standing.y + 9 * DT, onGround: false }, DT);
    expect(jump.cue.jump).toBe(true);
    let low = 0;
    for (let i = 2; i < 20; i++) low = Math.min(low, camera.update({ ...standing, y: standing.y + 9 * i * DT, onGround: false }, DT).dip);
    expect(low).toBeLessThan(-0.01);
    expect(low).toBeGreaterThan(-0.04);
  });

  it('inclina para o lado do strafe e mais no slide, com amplitude pequena', () => {
    expect(Math.abs(run(new MovementCamera(), 6, 60).roll)).toBeLessThan(0.006); // para frente: só a passada
    const camera = new MovementCamera();
    camera.update(standing, DT);
    let roll = 0;
    for (let i = 1; i <= 60; i++) roll = camera.update({ ...standing, x: i * 6 * DT, onGround: false }, DT).roll;
    expect(roll).toBeLessThan(-0.005); // para a direita, tomba para a direita
    expect(roll).toBeGreaterThan(-0.02);
    const slide = run(new MovementCamera(), 12, 40, { sliding: true, crouch: 1 });
    expect(Math.abs(slide.roll)).toBeGreaterThan(0.03);
    expect(Math.abs(slide.roll)).toBeLessThan(0.05);
  });

  it('FOV dinâmico: corrida +, slide ++, mira cancela, sem passar do alvo', () => {
    const fovOf = (speed: number, posture: Partial<CameraMovement> = {}) => {
      const camera = new MovementCamera();
      camera.update({ ...standing, ...posture }, DT);
      let top = 0, last = 0;
      for (let i = 1; i <= 90; i++) {
        last = camera.update({ ...standing, ...posture, z: -i * speed * DT }, DT).fov;
        top = Math.max(top, last);
      }
      return { last, top };
    };
    const walk = fovOf(6), sprint = fovOf(9.5), slide = fovOf(12, { sliding: true, crouch: 1 });
    expect(walk.last).toBeLessThan(0.5);
    expect(sprint.last).toBeGreaterThan(4);
    expect(slide.last).toBeGreaterThan(sprint.last + 2);
    expect(slide.top).toBeLessThanOrEqual(slide.last + 0.05);
    expect(fovOf(9.5, { aim: 1 }).last).toBeLessThan(0.05);
    expect(dynamicFov({ speed: 0, sliding: false, vy: -18, onGround: false, aim: 0 })).toBeCloseTo(4, 5);
    expect(speedLineAmount({ speed: 12, sliding: true, vy: 0, onGround: true, aim: 0 })).toBeGreaterThan(0.8);
    expect(speedLineAmount({ speed: 6, sliding: false, vy: 0, onGround: true, aim: 0 })).toBe(0);
    expect(dynamicFov({ speed: 0, sliding: true, vy: 0, onGround: true, aim: 0 })).toBe(0); // slide preso na parede
    expect(speedLineAmount({ speed: 0, sliding: true, vy: 0, onGround: true, aim: 0 })).toBe(0);
  });

  it('agachar suaviza o olho sem atrasar demais', () => {
    const camera = new MovementCamera();
    camera.update(standing, DT);
    const first = camera.update({ ...standing, crouch: 0.26 }, DT);
    expect(first.crouch).toBeLessThan(0.26);
    let m = first;
    for (let i = 0; i < 15; i++) m = camera.update({ ...standing, crouch: 1 }, DT);
    expect(m.crouch).toBeGreaterThan(0.97);
    expect(m.crouch).toBeLessThanOrEqual(1);
  });

  it.each(['dead', 'teleport', 'pause'])('zera o FOV e a velocidade visual em %s', mode => {
    const camera = new MovementCamera();
    expect(run(camera, 9.5, 120).fov).toBeGreaterThan(4);
    const next = { ...standing, z: -19, x: mode === 'teleport' ? 10 : 0, alive: mode !== 'dead' };
    const motion = camera.update(next, mode === 'pause' ? 1 : DT);
    expect(motion.fov).toBe(0);
    expect(motion.speed).toBe(0);
  });

  it('mola ignora tempo inválido sem envenenar a câmera', () => {
    const spring = new Spring(12, 0.5);
    spring.kick(0.1);
    for (const dt of [NaN, Infinity, -1, 0, 1e-15]) expect(Number.isFinite(spring.step(dt))).toBe(true);
    expect(Number.isFinite(spring.step(DT))).toBe(true);
  });

  it('escala de conforto e prefers-reduced-motion reduzem tudo, inclusive para zero', () => {
    try {
      const sprintWith = () => run(new MovementCamera(), 9.5, 45);
      const normal = sprintWith();
      setCameraMotionScale(0);
      const off = sprintWith();
      expect(Math.abs(off.bob) + Math.abs(off.roll) + Math.abs(off.fov) + Math.abs(off.sway)).toBe(0);
      expect(off.y).toBe(normal.y); // degraus continuam amortecidos (conforto)
      setCameraMotionScale(1);
      setReducedMotion(true);
      expect(cameraMotionScale()).toBeCloseTo(0.3, 6);
      expect(sprintWith().bob).toBeCloseTo(normal.bob * 0.3, 6);
      setCameraMotionScale(Number.NaN);
      expect(cameraMotionScale()).toBeCloseTo(0.3, 6);
    } finally {
      setCameraMotionScale(1);
      setReducedMotion(false);
    }
  });

  it.each([30, 60, 144])('mola dá a mesma resposta a %i Hz', fps => {
    const s = new Spring(12, 0.5);
    s.kick(-0.1);
    let low = 0;
    for (let i = 0; i < fps * 0.5; i++) low = Math.min(low, s.step(1 / fps));
    expect(low).toBeCloseTo(-0.1, 2);
    expect(Math.abs(s.value)).toBeLessThan(0.01);
  });

});

describe('soco de câmera', () => {
  const settle = (k: CameraKick, seconds = 0.6) => { for (let i = 0; i < seconds * 60; i++) k.step(1 / 60); return k.read(); };

  it('limita o soco quando vários projéteis acertam no mesmo quadro', () => {
    const k = new CameraKick();
    for (let i = 0; i < 12; i++) { k.add('head'); k.add('hurt', 1, { x: 1, y: 0, z: 0 }); }
    for (let i = 0; i < 60; i++) {
      k.step(DT);
      const r = k.read();
      expect(Math.abs(r.roll)).toBeLessThanOrEqual(0.06);
      expect(r.fov).toBeGreaterThanOrEqual(-5);
      expect(r.fov).toBeLessThanOrEqual(3);
      expect(Math.abs(r.x)).toBeLessThanOrEqual(0.06);
    }
  });

  it('abate congela a pose do impacto e volta a zero', () => {
    const k = new CameraKick();
    k.add('kill');
    const frozen = k.read();
    expect(frozen.fov).toBeCloseTo(-3.5, 6);
    expect(Math.abs(frozen.roll)).toBeGreaterThan(0.03);
    const back = settle(k);
    expect(Math.abs(back.fov)).toBeLessThan(0.05);
    expect(Math.abs(back.roll)).toBeLessThan(0.002);
  });

  it('dano tomba a cabeça para longe de quem atirou e empurra a câmera', () => {
    const fromRight = new CameraKick();
    fromRight.add('hurt', 1, { x: -1, y: 0, z: 0 });
    let roll = 0, x = 0;
    for (let i = 0; i < 6; i++) { fromRight.step(1 / 60); const r = fromRight.read(); roll = Math.max(roll, r.roll); x = Math.min(x, r.x); }
    expect(roll).toBeGreaterThan(0.02);
    expect(x).toBeLessThan(-0.02);
    const fromLeft = new CameraKick();
    fromLeft.add('hurt', -1);
    fromLeft.step(3 / 60);
    expect(fromLeft.read().roll).toBeLessThan(0);
    expect(Math.abs(settle(fromRight).x)).toBeLessThan(0.002);
  });

  it('acertos seguidos alternam o lado e respeitam um piso de conforto', () => {
    const k = new CameraKick();
    k.add('hit'); k.step(2 / 60);
    const a = k.read().roll;
    settle(k);
    k.add('hit'); k.step(2 / 60);
    expect(Math.sign(k.read().roll)).toBe(-Math.sign(a));
    try {
      setCameraMotionScale(0);
      const off = new CameraKick();
      off.add('kill');
      expect(off.read().fov).toBeCloseTo(-3.5 * 0.25, 6);
    } finally { setCameraMotionScale(1); }
  });

  it('calcula o lado do atacante em relação ao olhar', () => {
    expect(lateralOf({ x: 5, z: 0 }, { x: 0, z: 0 }, 0)).toBeCloseTo(1, 6);
    expect(lateralOf({ x: 0, z: -5 }, { x: 0, z: 0 }, 0)).toBeCloseTo(0, 6);
    expect(lateralOf({ x: 0, z: -5 }, { x: 0, z: 0 }, Math.PI / 2)).toBeCloseTo(1, 6);
  });
});
