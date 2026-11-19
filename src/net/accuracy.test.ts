// @vitest-environment node
import { expect, it } from 'vitest';
import { emptyCommand } from '../sim/command';
import { EventBus } from '../sim/events';
import { createPlayer, stepPlayer, SILENT_WALK, WALK } from '../sim/player';
import { createRng } from '../sim/rng';
import { createWeapon, stepWeapon } from '../sim/weapon';
import { flatAt, stepNet } from './protocol';

it.each([0, 1, 2, 3])('arma %i: treino e servidor produzem o mesmo tiro andando, freando, em ADS, agachado e no ar', index => {
  const spawn = { x: 0, y: 0.8501, z: 0 };
  const solids = [{ min: { x: -100, y: -1, z: -100 }, max: { x: 100, y: 0, z: 100 } }];
  for (const state of ['silent', 'braking', 'ads-walk', 'crouch', 'air', 'ads-air'] as const) {
    const f = flatAt(spawn, index), p = createPlayer(spawn), w = createWeapon(index);
    const serverRng = createRng(55), trainingRng = createRng(55);
    for (let tick = 0; tick <= 90; tick++) {
      const firing = tick === 90;
      const cmd = { ...emptyCommand(), seq: tick,
        moveX: state === 'air' || state === 'ads-air' || (state === 'braking' && firing) ? 0 : 1,
        sprint: state !== 'ads-walk', jump: (state === 'air' || state === 'ads-air') && tick === 75,
        crouch: state === 'crouch' && firing, aim: state === 'ads-walk' || state === 'ads-air', fire: firing };
      const serverShot = stepNet(f, cmd, 1 / 60, solids, spawn, serverRng);
      stepPlayer(p, cmd, 1 / 60, solids);
      const events = new EventBus();
      stepWeapon(w, p, cmd.fire, 1 / 60, { solids, rng: trainingRng, events }, false, true, cmd.aim);
      const trainingShot = events.drain().find(e => e.type === 'shot') ?? null;
      expect(serverShot).toEqual(trainingShot);
      expect(f.recoil).toBe(p.recoil);
      expect(f.aimAmount).toBe(w.aimAmount);
      if (firing) {
        expect(serverShot, state).not.toBeNull();
        if (state === 'silent') expect(f.vx).toBe(SILENT_WALK);
        if (state === 'braking') expect(f.vx).toBe(SILENT_WALK - 1);
        if (state === 'ads-walk') { expect(f.vx).toBe(WALK); expect(f.aimAmount).toBe(1); }
        if (state === 'crouch') { expect(f.sliding).toBe(false); expect(f.crouching).toBe(true); expect(f.vx).toBeLessThanOrEqual(SILENT_WALK); }
        if (state === 'air' || state === 'ads-air') expect(f.onGround).toBe(false);
        if (state === 'ads-air' && index === 2) expect(f.aimAmount).toBeLessThan(0.2);
        if (state === 'ads-air' && index !== 2) expect(f.aimAmount).toBe(1);
      }
    }
  }
});
