// Testes de caracterização: congelam a sensação de movimento e de tiro aprovada pelo dono
// ("bem gostoso"). Os números foram gravados com o código ANTERIOR à fase F0 (Player e
// Weapon antigos, dt por quadro). Recuo e velocidades revisados a pedido do dono em
// 2026-10-03: movimento menos rápido e slide mais curto (slide.test.ts), coice em
// recoil.test.ts. A nova trajetória protege esse ajuste; tiro permanece congelado.
// Movimento revisto em 2026-11-14: Shift anda a 3 m/s, sem corrida/slide.
// Se um teste quebrar, a sensação mudou. Só importa src/sim/**.
import { describe, expect, it } from 'vitest';
import type { PlayerCommand } from './command';
import { EventBus } from './events';
import type { Box } from './physics';
import { createPlayer, stepPlayer } from './player';
import { createWeapon, stepWeapon } from './weapon';

const DT = 1 / 60;

/** [tick, x, y, z, vx, vy, vz, noChão] a cada 10 ticks. Velocidades revistas em 2026-10-03. */
const TRAJECTORY: [number, number, number, number, number, number, number, boolean][] = [[9,0,0.8501,0,0,0,0,true],[19,0,0.8501,0,0,0,0,true],[29,0.7499999999999999,0.8501,-6.123233995736766e-17,6,0,-3.6739403974420594e-16,true],[39,1.7500000000000004,0.8501,-1.2246467991473532e-16,6,0,-3.6739403974420594e-16,true],[49,2.7500000000000013,1.2501,-1.836970198721031e-16,6,0,-3.6739403974420594e-16,true],[59,3.750000000000002,1.6501,-2.4492935982947084e-16,6,0,-3.6739403974420594e-16,true],[69,4.75,2.4501000000000004,-3.061616997868386e-16,6,0,-3.6739403974420594e-16,true],[79,5.7499999999999964,2.8501000000000003,-3.673940397442064e-16,6,0,-3.6739403974420594e-16,true],[89,6.749999999999993,2.8501000000000003,-4.2862637970157415e-16,6,0,-3.6739403974420594e-16,true],[99,7.749999999999989,2.8501000000000003,-4.898587196589419e-16,6,0,-3.6739403974420594e-16,true],[109,8.749999999999986,2.8501000000000003,-5.510910596163096e-16,6,0,-3.6739403974420594e-16,true],[119,8.849999999999985,2.8501000000000003,-5.81707229594993e-16,-3,0,-1.8369701987210297e-16,true],[129,8.349999999999978,2.8501000000000003,-6.123233995736764e-16,-3,0,-1.8369701987210297e-16,true],[139,7.849999999999975,2.8501000000000003,-6.429395695523598e-16,-3,0,-1.8369701987210297e-16,true],[149,7.3499999999999766,3.9528777777777764,-6.735557395310432e-16,-3,4.666666666666664,-1.8369701987210297e-16,false],[159,6.849999999999978,4.333433333333331,-7.041719095097266e-16,-3,0.3333333333333295,-1.8369701987210297e-16,false],[169,6.34999999999998,3.991766666666663,-7.3478807948841e-16,-3,-4.000000000000004,-1.8369701987210297e-16,false],[179,5.849999999999982,2.9278777777777716,-7.654042494670934e-16,-3,-8.33333333333334,-1.8369701987210297e-16,false],[189,5.349999999999984,2.8501000000000003,-7.960204194457768e-16,-3,0,-1.8369701987210297e-16,true],[199,4.849999999999985,2.7417666666666674,-8.266365894244602e-16,-3,-2.166666666666667,-1.8369701987210297e-16,false],[209,4.175735931288058,2.3778777777777784,-0.3216666666666675,-4.242640687119285,-1.7333333333333334,-3.6999999999999997,false],[219,3.4686291501015116,1.6917666666666673,-1.0247294364012267,-4.242640687119285,-6.066666666666669,-4.242640687119285,false],[229,2.7615223689149655,1.4478777777777765,-1.731836217587775,-4.242640687119285,-3.033333333333334,-4.242640687119285,false],[239,2.0544155877284194,0.8501,-2.438942998774322,-4.242640687119285,0,-4.242640687119285,true],[249,1.347308806541871,0.8501,-2.6498999999999997,-4.242640687119285,0,-4.242640687119285,true],[259,0.6402020253553233,0.8501,-2.6498999999999997,-4.242640687119285,0,-4.242640687119285,true],[269,0.524025979547371,0.8501,-2.6498999999999997,0,0,0,true],[279,0.524025979547371,0.8501,-2.6498999999999997,0,0,0,true],[289,0.524025979547371,0.8501,-2.6498999999999997,0,0,0,true],[299,0.524025979547371,0.8501,-2.6498999999999997,0,0,0,true]];

/** [dx, dy, dz, ox, oy, oz] dos 5 primeiros tiros (yaw 0.3, pitch -0.2, sorteios fixos). */
const SPREAD_SHOTS = [[-0.28475549,-0.203368965,-0.936779256,0,1.502777778,0],[-0.291766449,-0.195492482,-0.936298579,0,1.5001,0],[-0.295703116,-0.192781991,-0.935625337,0,1.5001,0],[-0.289629478,-0.198669331,-0.936293364,0,1.5001,0],[-0.28475549,-0.203368965,-0.936779256,0,1.5001,0]];

// Cenário: chão, escada de 5 degraus (0.4 cada) subindo em +x e uma parede em z = -3.
const floor: Box = { min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } };
const steps: Box[] = [0, 1, 2, 3, 4].map((k) => ({
  min: { x: 3 + k * 0.6, y: 0, z: -2.5 },
  max: { x: 3 + (k + 1) * 0.6, y: 0.4 * (k + 1), z: 2.5 },
}));
const landing: Box = { min: { x: 6, y: 0, z: -2.5 }, max: { x: 12, y: 2, z: 2.5 } };
const wall: Box = { min: { x: -50, y: 0, z: -4 }, max: { x: 50, y: 6, z: -3 } };
const SOLIDS = [floor, ...steps, landing, wall];

interface Frame {
  keys: string[];
  yaw: number;
  pitch: number;
  jump: boolean;
}

/** Roteiro fixo de 300 ticks: parado, anda, sobe a escada, corre, pula, raspa na parede. */
function script(t: number): Frame {
  if (t < 20) return { keys: [], yaw: 0, pitch: 0, jump: false }; // assenta no chão
  if (t < 110) return { keys: ['KeyW'], yaw: -Math.PI / 2, pitch: 0, jump: false }; // anda em +x e sobe
  if (t < 140) return { keys: ['KeyW', 'ShiftLeft'], yaw: Math.PI / 2, pitch: 0.1, jump: false }; // anda em silêncio de volta
  if (t < 200) return { keys: ['KeyW', 'ShiftLeft'], yaw: Math.PI / 2, pitch: 0.1, jump: t === 140 }; // pula com Shift
  if (t < 260) return { keys: ['KeyW', 'KeyD'], yaw: Math.PI / 2, pitch: 0, jump: t === 230 }; // diagonal contra a parede
  return { keys: [], yaw: Math.PI / 2, pitch: 0, jump: false }; // solta e freia
}

interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  g: boolean;
}

function command(t: number): PlayerCommand {
  const f = script(t);
  const k = (code: string) => (f.keys.includes(code) ? 1 : 0);
  return {
    seq: t, moveX: k('KeyD') - k('KeyA'), moveZ: k('KeyW') - k('KeyS'), sprint: k('ShiftLeft') === 1,
    jump: f.jump, yaw: f.yaw, pitch: f.pitch, fire: false, alt: false,
  };
}

function runPlayer(): Sample[] {
  const p = createPlayer({ x: 0, y: 0.86, z: 0 });
  const out: Sample[] = [];
  for (let t = 0; t < 300; t++) {
    stepPlayer(p, command(t), DT, SOLIDS);
    if (t % 10 === 9) out.push({ t, x: p.pos.x, y: p.pos.y, z: p.pos.z, vx: p.vel.x, vy: p.vel.y, vz: p.vel.z, g: p.onGround });
  }
  return out;
}

describe('caracterização: movimento do jogador', () => {
  it('segue a trajetória gravada (andar, escada, andar em silêncio, pular, parede)', () => {
    const got = runPlayer();
    expect(got.length).toBe(TRAJECTORY.length);
    got.forEach((s, i) => {
      const [t, x, y, z, vx, vy, vz, g] = TRAJECTORY[i];
      expect(s.t).toBe(t);
      expect(s.g, `onGround no tick ${t}`).toBe(g);
      for (const [a, b, name] of [[s.x, x, 'x'], [s.y, y, 'y'], [s.z, z, 'z'], [s.vx, vx, 'vx'], [s.vy, vy, 'vy'], [s.vz, vz, 'vz']] as const) {
        expect(a, `${name} no tick ${t}`).toBeCloseTo(b, 6);
      }
    });
  });
});

const idle: PlayerCommand = { seq: 0, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0, pitch: 0, fire: false, alt: false };

describe('caracterização: arma', () => {
  it('cadência: com o gatilho segurado a 60 Hz, um tiro a cada 7 ticks', () => {
    const p = createPlayer({ x: 0, y: 0.86, z: 0 });
    const w = createWeapon();
    const events = new EventBus();
    const shots: number[] = [];
    for (let t = 0; t < 120; t++) {
      stepPlayer(p, idle, DT, [floor]);
      if (stepWeapon(w, p, t < 50 || t >= 70, DT, { solids: [floor], rng: () => 0.5, events })) shots.push(t); // solta entre 50 e 69
    }
    // 16 tiros: ~8.6 tiros/s (FIRE_INTERVAL = 1/9 vira 7 ticks a 60 Hz)
    expect(shots).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 70, 77, 84, 91, 98, 105, 112, 119]);
    expect(events.drain().filter((e) => e.type === 'shot').length).toBe(16);
  });

  it('espalhamento isolado: preserva direção do tiro e impulso originais', () => {
    const p = createPlayer({ x: 0, y: 0.86, z: 0 });
    const w = createWeapon();
    const events = new EventBus();
    // Pares de sorteio (x, y) que cada tiro gravado usou. No código antigo o Math.random
    // também era consumido pelo Three (uuid do rastro), por isso a ordem não é a da lista.
    const seq = [0.9, 0.1, 0.33, 0.77, 0.0, 1.0, 0.5, 0.5, 0.9, 0.1];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const dirs: number[][] = [];
    const recoil: number[] = [];
    for (let t = 0; t < 30; t++) {
      stepPlayer(p, { ...idle, yaw: 0.3, pitch: -0.2 }, DT, [floor]);
      // Isola a dispersão base aprovada: o primeiro quadro nasce 1 cm acima do chão.
      // Penalidades de movimento/ar autorizadas em 2026-10-03 têm teste próprio.
      p.onGround = true;
      p.recoil = 0;
      stepWeapon(w, p, true, DT, { solids: [], rng, events });
      for (const e of events.drain()) if (e.type === 'shot') dirs.push([e.dir.x, e.dir.y, e.dir.z, e.origin.x, e.origin.y, e.origin.z]);
      recoil.push(p.recoil);
    }
    expect(dirs.length).toBe(SPREAD_SHOTS.length);
    dirs.forEach((d, k) => d.forEach((v, j) => expect(v, `tiro ${k}, componente ${j}`).toBeCloseTo(SPREAD_SHOTS[k][j], 6)));
    // Impulso original preservado; recuperação e acúmulo são testados separadamente.
    expect(recoil).toEqual([0.014, 0, 0, 0, 0, 0, 0, 0.014, 0, 0, 0, 0, 0, 0, 0.014, 0, 0, 0, 0, 0, 0, 0.014, 0, 0, 0, 0, 0, 0, 0.014, 0]);
  });
});
