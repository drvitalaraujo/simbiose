import { describe, expect, it } from 'vitest';
import { rng } from '../world/shapes';
import { ARENA1 } from './arena1';
import { emptyCommand } from '../../sim/command';
import { createPlayer, PLAYER_HALF, stepPlayer } from '../../sim/player';
import { acrossStreet, BODY, bodyCeiling, clearOfBody, coverAt, exposedFaces, facePoint, floorAt, reachableSupports, splitLots } from './facades';

const map = ARENA1;
const walls = exposedFaces(map, (s) => (s.kind === 'wall' && s.tint === 'neutral') || s.kind === 'edge');

describe('facades: faces à vista', () => {
  it('acha fachadas e nenhuma fica fora da área jogável ou colada noutra parede', () => {
    const total = walls.reduce((a, s) => a + (s.t1 - s.t0), 0);
    expect(total).toBeGreaterThan(400);
    for (const s of walls) {
      const p = facePoint(s, s.t0 + 0.25, 0.3); // ponto de amostra (fora das divisas)
      expect(coverAt(map, p.x, p.z), JSON.stringify(s)).toBe(s.base);
      expect(s.base).toBeLessThan(s.top);
    }
  });

  it('muro externo só é vestido do lado de dentro', () => {
    for (const s of walls.filter((w) => w.solid.kind === 'edge')) {
      const p = facePoint(s, (s.t0 + s.t1) / 2, 0.3);
      const { x0, z0, x1, z1 } = map.bounds;
      expect(p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1).toBe(true);
    }
  });
});

describe('facades: consultas', () => {
  it('lotes cobrem o trecho inteiro, sem buraco nem sobreposição', () => {
    const lots = splitLots(-46, -6, rng(3));
    expect(lots[0][0]).toBe(-46);
    expect(lots[lots.length - 1][1]).toBe(-6);
    for (let i = 1; i < lots.length; i++) expect(lots[i][0]).toBe(lots[i - 1][1]);
    for (const [a, b] of lots) expect(b - a).toBeGreaterThan(3);
  });

  it('piso: terraço da ladeira, palco do site A e chão comum', () => {
    expect(floorAt(map, -53, 0)).toBeCloseTo(0.8);
    expect(floorAt(map, -46, -24)).toBeCloseTo(1.2);
    expect(floorAt(map, 0, 22)).toBe(0);
  });

  it('do outro lado da ladeira A está o muro externo', () => {
    const r = acrossStreet(map, { axis: 'x', at: -46, n: -1 }, 0, 20);
    expect(r).not.toBeNull();
    expect(r!.d).toBeGreaterThan(13);
    expect(r!.d).toBeLessThan(15);
  });
});

// ---------------------------------------------------------------- envelope do corpo (achado H1)

const solids = map.solids.map((s) => s.box);
const footprint = (p: { x: number; z: number }) => ({ x0: p.x - PLAYER_HALF.x, z0: p.z - PLAYER_HALF.z, x1: p.x + PLAYER_HALF.x, z1: p.z + PLAYER_HALF.z });

describe('facades: alcance do corpo pulando', () => {
  it('a física do envelope bate com a do jogador', () => {
    expect(BODY.half).toBe(PLAYER_HALF.x);
    expect(BODY.height).toBeCloseTo(PLAYER_HALF.y * 2);
  });

  it('caso da revisão: pulo no terraço da ladeira A passa da laje da sacada antiga', () => {
    const s = createPlayer({ x: -59.64, y: 1.65, z: 3.8 });
    s.onGround = true;
    let top = 0;
    for (let i = 0; i < 60; i++) {
      stepPlayer(s, { ...emptyCommand(i), jump: i === 0 }, 1 / 60, solids);
      top = Math.max(top, s.pos.y + PLAYER_HALF.y);
      expect(s.pos.y + PLAYER_HALF.y).toBeLessThanOrEqual(bodyCeiling(map, footprint(s.pos)));
    }
    expect(top).toBeGreaterThan(3.84); // a cabeça passava pela laje (y 3.70..3.84)
    const slab = { min: { x: -59.97, y: 3.7, z: 3.34 }, max: { x: -59.4, y: 3.84, z: 4.84 } };
    expect(clearOfBody(map, slab)).toBe(false);
  });

  it('pulos correndo de qualquer piso ou cobertura alcançável ficam abaixo de bodyCeiling', () => {
    const r = rng(7);
    const sup = reachableSupports(map);
    let valid = 0;
    for (let trial = 0; trial < 400; trial++) {
      const b = sup[Math.floor(r() * sup.length)];
      const x = b.min.x + 0.05 + r() * Math.max(0, b.max.x - b.min.x - 0.1);
      const z = b.min.z + 0.05 + r() * Math.max(0, b.max.z - b.min.z - 0.1);
      const s = createPlayer({ x, y: b.max.y + PLAYER_HALF.y + 0.001, z });
      // Só testa partidas válidas (de pé sobre o apoio, fora de qualquer sólido)
      stepPlayer(s, emptyCommand(0), 1 / 60, solids);
      if (!s.onGround || Math.abs(s.pos.y - PLAYER_HALF.y - b.max.y) > 0.05) continue;
      valid++;
      let yaw = r() * Math.PI * 2;
      const jumpAt = Math.floor(r() * 25);
      const chain = r() < 0.4; // pula de novo a cada pouso (pulo encadeado)
      for (let i = 0; i < 90; i++) {
        if (i === jumpAt + 10 && r() < 0.5) yaw += (r() - 0.5) * 2; // vira no ar
        stepPlayer(s, { ...emptyCommand(i), moveZ: 1, sprint: true, jump: i === jumpAt || (chain && i > jumpAt && s.onGround), yaw }, 1 / 60, solids);
        const head = s.pos.y + PLAYER_HALF.y;
        expect(head, `tentativa ${trial}, tick ${i}`).toBeLessThanOrEqual(bodyCeiling(map, footprint(s.pos)));
      }
    }
    expect(valid).toBeGreaterThan(200);
  });

  it('coberturas alcançáveis contam como apoio: o pedestal do adro sobe pela mureta', () => {
    const sup = reachableSupports(map);
    const pedestal = map.solids.find((s) => s.kind === 'tall' && s.tint === 'B' && s.box.min.x === 42)!;
    expect(sup).toContain(pedestal.box);
    // Bloco de spawn da defesa (3 m, nada alto em volta): ninguém sobe
    const def = map.solids.find((s) => s.kind === 'tall' && s.tint === 'def')!;
    expect(sup).not.toContain(def.box);
  });
});
