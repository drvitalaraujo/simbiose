import { describe, expect, it } from 'vitest';
import { forward } from '../../sim/vec';
import { DRONE_CAM, droneKillcamView, droneShotOrigin, emptyDroneSample, killcamFromDrone, killcamTitle, type DroneState } from './replay-drone';
import { emptySample, ReplayRecorder } from './replay-recorder';

const drone = (x: number, extra: Partial<DroneState> = {}): DroneState => ({ x, y: 5, z: 0, hackerId: '', progress: 0, contested: false, phase: 'ally', owner: 'dono', target: 'eu', ...extra });

/**
 * Grava a 60 quadros/s; o drone anda em x = t a partir de `droneFrom` (antes disso não há
 * drone) e a leitura dele chega `lead` s "no futuro" do quadro, como no jogo.
 */
function run(rec: ReplayRecorder, seconds: number, droneFrom = 0, lead = 0.05, extra: (t: number) => Partial<DroneState> = () => ({})) {
  for (let i = 0; i <= seconds * 60; i++) {
    const t = i / 60;
    const dt = t + lead;
    rec.drone(dt, dt >= droneFrom ? drone(dt, extra(dt)) : null);
    rec.pushLocal(t, 'eu', { ...emptySample(), x: -t, alive: true });
    if (rec.begin(t)) {
      rec.player('dono', 'Riso', '', false, { ...emptySample(), x: 100, alive: true });
      rec.end({ name: 'Lia', team: '' });
    }
  }
}

describe('drone no replay', () => {
  it('grava o drone nos quadros e o clipe interpola a posição no tempo do replay', () => {
    const rec = new ReplayRecorder();
    run(rec, 4);
    const clip = rec.clip(1, 3)!;
    expect(clip.drone).not.toBeNull();
    const s = emptyDroneSample();
    expect(clip.drone!.sample(2.01, s)).toBe(true);
    // A leitura chegou adiantada, mas o quadro pega a do instante dele: x = t
    expect(s.x).toBeCloseTo(2.01, 2);
    expect(s.y).toBe(5);
    expect(s.phase).toBe('ally');
    expect(s.owner).toBe('dono');
    expect(s.target).toBe('eu');
  });

  it('guarda livre, hackeando, aliado e indo embora', () => {
    const rec = new ReplayRecorder();
    const phase = (t: number): Partial<DroneState> =>
      t < 1 ? { phase: 'free' } : t < 2 ? { phase: 'free', hackerId: 'dono', progress: (t - 1) / 2, contested: true } : t < 3 ? { phase: 'ally' } : { phase: 'leaving' };
    run(rec, 4, 0, 0, phase);
    const clip = rec.clip(0, 4)!;
    const s = emptyDroneSample();
    clip.drone!.sample(0.5, s); expect(s.phase).toBe('free');
    clip.drone!.sample(1.5, s); expect(s.phase).toBe('hacking'); expect(s.hacker).toBe('dono'); expect(s.contested).toBe(true);
    expect(s.progress).toBeCloseTo(0.25, 1);
    clip.drone!.sample(2.5, s); expect(s.phase).toBe('ally');
    clip.drone!.sample(3.5, s); expect(s.phase).toBe('leaving');
  });

  it('fica ausente antes de o drone aparecer e o clipe sem drone não tem trilha', () => {
    const rec = new ReplayRecorder();
    run(rec, 4, 2);
    const s = emptyDroneSample();
    expect(rec.clip(2.5, 3.5)!.drone!.sample(3, s)).toBe(true);
    const clip = rec.clip(0.5, 3.5)!;
    expect(clip.drone!.sample(1, s)).toBe(false);
    expect(rec.clip(0.2, 1.5)!.drone).toBeNull();
  });

  it('não aloca memória nova conforme grava (buffers fixos)', () => {
    const rec = new ReplayRecorder({ seconds: 2 });
    run(rec, 30);
    expect(rec.frames).toBe(rec.capacity);
    expect(rec.clip(rec.oldest, rec.newest)!.drone).not.toBeNull();
  });

  it('tiro do drone sai do drone gravado; sem drone gravado, da origem do servidor', () => {
    const rec = new ReplayRecorder();
    run(rec, 4);
    const clip = rec.clip(1, 3)!;
    const scratch = emptyDroneSample();
    const out = droneShotOrigin(clip.drone, 2.5, [9, 9, 9], scratch, { x: 0, y: 0, z: 0 });
    expect(out.x).toBeCloseTo(2.5, 2);
    expect(out.y).toBe(5);
    expect(droneShotOrigin(null, 2.5, [9, 8, 7], scratch, { x: 0, y: 0, z: 0 })).toEqual({ x: 9, y: 8, z: 7 });
  });

  it('killcam de morte por drone: câmera atrás do drone olhando o alvo', () => {
    expect(killcamFromDrone('drone')).toBe(true);
    expect(killcamFromDrone('mk2')).toBe(false);
    const d = { x: 0, y: 5, z: 0 };
    const target = { x: 10, y: 1, z: 0 };
    const v = droneKillcamView(d, target, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
    // Atrás (do lado oposto ao alvo), à direita de quem olha (+x → direita é +z) e acima
    expect(v.x).toBeCloseTo(-DRONE_CAM.back, 5);
    expect(v.y).toBeCloseTo(5 + DRONE_CAM.up, 5);
    expect(v.z).toBeCloseTo(DRONE_CAM.side, 5);
    // Olhando direto para o peito do alvo (e para baixo)
    const f = forward(v.yaw, v.pitch);
    const to = { x: target.x - v.x, y: target.y + DRONE_CAM.chest - v.y, z: target.z - v.z };
    const len = Math.hypot(to.x, to.y, to.z);
    expect(f.x).toBeCloseTo(to.x / len, 5);
    expect(f.y).toBeCloseTo(to.y / len, 5);
    expect(f.z).toBeCloseTo(to.z / len, 5);
    expect(v.pitch).toBeLessThan(0);
    // Sem alvo: mantém a direção anterior
    const keep = droneKillcamView(d, null, { x: 0, y: 0, z: 0, yaw: 1, pitch: -0.2 });
    expect(keep.yaw).toBe(1);
    expect(keep.pitch).toBe(-0.2);
  });

  it('câmera do drone não atravessa parede atrás dele', () => {
    const d = { x: 0, y: 5, z: 0 };
    const wall = { min: { x: -1.2, y: 0, z: -5 }, max: { x: -1, y: 10, z: 5 } };
    const v = droneKillcamView(d, { x: 10, y: 1, z: 0 }, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, [wall]);
    expect(v.x).toBeGreaterThan(-1 + 0.2);
    expect(v.x).toBeLessThan(0);
    const free = droneKillcamView(d, { x: 10, y: 1, z: 0 }, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, []);
    expect(free.x).toBeCloseTo(-DRONE_CAM.back, 5);
  });

  it('legenda da killcam diz de quem é o drone', () => {
    const c = killcamTitle('Riso', false, 'drone', 'Drone hackeado');
    expect(c.lead + c.name + c.tail).toBe('MORTO PELO DRONE DE Riso');
    const g = killcamTitle('Riso', true, 'sniper', 'Sniper');
    expect(g.lead + g.name + g.tail).toBe('MORTO POR BOT Riso · SNIPER');
  });
});
