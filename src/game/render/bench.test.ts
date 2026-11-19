import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayer } from '../../sim/player';
import { bench } from './bench';

afterEach(() => vi.unstubAllGlobals());

function fixture(timing: boolean, fail = false) {
  vi.stubGlobal('location', { search: '?map=pelourinho' });
  const gl = {
    getExtension: () => ({ TIME_ELAPSED_EXT: 1 }),
    createQuery: vi.fn(() => ({})), beginQuery: vi.fn(), endQuery: vi.fn(), deleteQuery: vi.fn(),
    getQueryParameter: () => 1,
    readPixels() {}, RGBA: 1, UNSIGNED_BYTE: 1, QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 1,
  };
  const resume = vi.fn();
  const g = {
    renderer: { getContext: () => gl, setRenderTarget() {}, domElement: { width: 800, height: 600 }, getPixelRatio: () => 1 },
    player: { state: createPlayer({ x: 2, y: 3, z: 4 }), snap: vi.fn() },
    input: { yaw: 0.4, pitch: -0.3, locked: true, fireHeld: true, rightHeld: true, jumpPressed: true, lookEnabled: false },
    director: { update: vi.fn() }, clock: { getDelta: () => 0.03 },
    pipeline: { stats: { timing, calls: 12, triangles: 34 } },
    tick: vi.fn(), fixed: { acc: 0.005 }, deadFor: 0.7, fxTime: 12,
    frame: vi.fn(), pauseForBenchmark: vi.fn(() => resume),
  };
  g.player.state.vel = { x: 1, y: 2, z: 3 };
  g.player.state.yaw = 0.4;
  g.player.state.pitch = -0.3;
  g.player.state.onGround = true;
  g.frame.mockImplementation(() => {
    g.tick();
    g.fxTime += 1;
    g.fixed.acc = 0;
    // Exceção depois de criar/iniciar uma query GPU, exercitando o finally interno.
    if (fail && g.frame.mock.calls.length === 11) throw new Error('falha de render');
  });
  return { g, gl, resume };
}

describe('benchmark restaura a partida', () => {
  for (const timing of [true, false]) for (const fail of [true, false]) {
    it(`timing=${timing}, exceção=${fail}`, async () => {
      const { g, gl, resume } = fixture(timing, fail);
      const state = structuredClone(g.player.state);
      const pos = g.player.state.pos;
      const vel = g.player.state.vel;
      const input = { ...g.input };
      const delta = g.clock.getDelta;
      const director = g.director.update;
      const tick = g.tick;
      if (fail) await expect(bench(g, 1, 0)).rejects.toThrow('falha de render');
      else expect((await bench(g, 1, 0)).views).toHaveLength(6);
      expect(g.player.state).toEqual(state);
      expect(g.player.state.pos).toBe(pos);
      expect(g.player.state.vel).toBe(vel);
      expect(g.input).toEqual(input);
      expect(g.clock.getDelta).toBe(delta);
      expect(g.director.update).toBe(director);
      expect(g.tick).toBe(tick);
      expect(tick).not.toHaveBeenCalled();
      expect(g.pipeline.stats.timing).toBe(timing);
      expect(g.deadFor).toBe(0.7);
      expect(g.fxTime).toBe(12);
      expect(g.fixed.acc).toBe(0.005);
      expect(resume).toHaveBeenCalledOnce();
      expect(gl.deleteQuery.mock.calls.length).toBe(gl.createQuery.mock.calls.length);
      expect(gl.endQuery.mock.calls.length).toBe(gl.beginQuery.mock.calls.length);
    });
  }

  it('informa claramente que online não suporta benchmark', async () => {
    await expect(bench({})).rejects.toThrow('apenas no modo treino');
  });

  it('não acumula o tempo de parede do benchmark no próximo tick', async () => {
    const { g } = fixture(false);
    const clock = Object.assign(g.clock, { running: true, oldTime: 100 });
    await bench(g, 1, 0);
    expect(clock.oldTime).toBeGreaterThan(100);
  });
});
