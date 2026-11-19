import { describe, expect, it } from 'vitest';
import { EYE_HEIGHT } from '../sim/player';
import { yawTowards } from './match';
import { MAPS } from './maps';
import { clearanceAlong, spawnYaw, yawDir } from './spawn-view';

const box = (x0: number, z0: number, x1: number, z1: number) => ({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: 4, z: z1 } });

describe('olhar ao nascer', () => {
  it('yawDir segue a convenção de yawTowards', () => {
    const yaw = yawTowards({ x: 0, z: 0 }, { x: 3, z: -4 });
    const d = yawDir(yaw);
    expect(d.x).toBeCloseTo(0.6);
    expect(d.z).toBeCloseTo(-0.8);
  });

  it('prefere o centro quando a vista está livre', () => {
    const yaw = spawnYaw({ x: 20, y: 0.86, z: 0 }, []);
    const d = yawDir(yaw);
    expect(d.x).toBeLessThan(-0.95); // olha para -x, onde fica o centro
  });

  it('não encara a parede mesmo com o centro atrás dela', () => {
    const wall = [box(17, -6, 18, 6)]; // parede entre o spawn e o centro
    const at = { x: 20, y: 0.86, z: 0 };
    const yaw = spawnYaw(at, wall);
    expect(clearanceAlong({ x: at.x, y: at.y + EYE_HEIGHT, z: at.z }, yaw, wall)).toBeGreaterThan(8);
  });

  for (const [id, map] of Object.entries(MAPS)) {
    it(`${id}: todo spawn nasce com pelo menos 8 m de visão livre`, () => {
      const bad: string[] = [];
      for (const s of map.spawns) {
        const yaw = spawnYaw(s, map.shotBlockers);
        const free = clearanceAlong({ x: s.x, y: s.y + EYE_HEIGHT, z: s.z }, yaw, map.shotBlockers);
        if (free < 8) bad.push(`(${s.x}, ${s.z}) → ${free.toFixed(1)} m`);
      }
      expect(bad).toEqual([]);
    });
  }

  it('favela: o jeito antigo (olhar para o centro) batia em parede em algum spawn', () => {
    const map = MAPS.favela;
    const worst = Math.min(...map.spawns.map((s) => clearanceAlong({ x: s.x, y: s.y + EYE_HEIGHT, z: s.z }, yawTowards(s, { x: 0, z: 0 }), map.shotBlockers)));
    const now = Math.min(...map.spawns.map((s) => clearanceAlong({ x: s.x, y: s.y + EYE_HEIGHT, z: s.z }, spawnYaw(s, map.shotBlockers), map.shotBlockers)));
    expect(now).toBeGreaterThan(worst);
  });
});
