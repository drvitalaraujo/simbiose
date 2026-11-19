// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { inviteLink, parseOnlineParams, withRoom } from './client';
import { DelayLine, installLag, parseLag, releaseAt, type Scheduler } from './lag';
import { getMap, MAPS } from './maps';
import { cleanName, commandFromWire, FLAT_FIELDS, flatAt, stepFlat, stepNet, wrapAngle, type WireInput } from './protocol';
import { createPlayer, stepPlayer } from '../sim/player';
import { createRng } from '../sim/rng';

const idleWire: WireInput = { moveX: 0, moveZ: 0, sprint: false, jump: false, crouch: false, yaw: 0, pitch: 0, fire: false, alt: false };

/** Relógio falso: o tempo só anda quando o teste manda. */
function fakeClock() {
  let t = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const clock: Scheduler = {
    now: () => t,
    setTimeout: (fn, ms) => timers.push({ at: t + ms, fn }),
  };
  const advance = (ms: number) => {
    const end = t + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift();
      t = next.at;
      next.fn();
    }
    t = end;
  };
  return { clock, advance };
}

describe('simulador de lag', () => {
  it('lê os parâmetros da URL', () => {
    expect(parseLag('?online')).toBeNull();
    expect(parseLag('?online&lag=150&jitter=20&perda=5')).toEqual({ lag: 150, jitter: 20, loss: 0.05 });
  });

  it('atrasa metade do lag por sentido e nunca troca a ordem', () => {
    const o = { lag: 100, jitter: 40, loss: 0 };
    expect(releaseAt(0, 0, o, () => 0.5)).toBe(50);
    // jitter puxando para trás não ultrapassa o pacote anterior
    expect(releaseAt(10, 90, o, () => 0)).toBe(90);
  });

  it('entrega na hora certa e em ordem', () => {
    const { clock, advance } = fakeClock();
    const seq = [0.9, 0.1, 0.5];
    let i = 0;
    const line = new DelayLine({ lag: 100, jitter: 30, loss: 0 }, () => seq[i++ % seq.length], clock);
    const got: number[] = [];
    line.push(() => got.push(1));
    line.push(() => got.push(2));
    line.push(() => got.push(3));
    advance(30);
    expect(got).toEqual([]);
    advance(100);
    expect(got).toEqual([1, 2, 3]);
  });

  it('copia os bytes na hora do envio (o SDK reaproveita o buffer)', () => {
    const { clock, advance } = fakeClock();
    const sent: Uint8Array[] = [];
    const ws = { send: (d: unknown) => sent.push(d as Uint8Array), onmessage: null };
    installLag(ws, { lag: 100, jitter: 0, loss: 0 }, () => 0.5, clock);
    const buf = new Uint8Array([1, 2, 3, 4]);
    ws.send(buf.subarray(0, 2));
    buf[0] = 9; // o SDK escreve o próximo comando no mesmo buffer
    ws.send(buf.subarray(0, 2));
    advance(60);
    expect(sent.map((s) => [...s])).toEqual([[1, 2], [9, 2]]);
  });

  it('envolve envio e recebimento de um socket', () => {
    const { clock, advance } = fakeClock();
    const sent: unknown[] = [];
    const recv: unknown[] = [];
    const ws = { send: (d: unknown) => sent.push(d), onmessage: (e: unknown) => recv.push(e) as unknown as void };
    installLag(ws, { lag: 200, jitter: 0, loss: 0 }, () => 0.5, clock);
    ws.send('a');
    ws.onmessage!('b');
    advance(99);
    expect(sent).toEqual([]);
    expect(recv).toEqual([]);
    advance(1);
    expect(sent).toEqual(['a']);
    expect(recv).toEqual(['b']);
  });
});

describe('protocolo', () => {
  it('stepFlat é exatamente o stepPlayer da sim', () => {
    const map = getMap('arena');
    const spawn = map.spawns[0];
    const flat = flatAt(spawn);
    const ref = createPlayer(spawn);
    for (let t = 0; t < 240; t++) {
      const w: WireInput = {
        moveX: t % 50 < 25 ? 1 : 0, moveZ: 1, sprint: t > 100, jump: t === 30, crouch: false,
        yaw: Math.fround(t * 0.01), pitch: 0, fire: false, alt: false,
      };
      const cmd = commandFromWire(w, t);
      stepFlat(flat, cmd, 1 / 60, map.solids, spawn);
      stepPlayer(ref, cmd, 1 / 60, map.solids);
    }
    expect(flat.x).toBe(ref.pos.x);
    expect(flat.y).toBe(ref.pos.y);
    expect(flat.z).toBe(ref.pos.z);
    expect(flat.vy).toBe(ref.vel.y);
    expect(FLAT_FIELDS.every((f) => f in flat)).toBe(true);
  });

  it('stepNet: movimento igual ao da sim e cadência da arma, qualquer que seja o rng do espalhamento', () => {
    const map = getMap('arena');
    const spawn = map.spawns[0];
    const runs = [createRng(77), createRng(12345)].map((rng) => {
      const flat = flatAt(spawn);
      const ref = createPlayer(spawn);
      const fired: number[] = [];
      for (let t = 1; t <= 120; t++) {
        const cmd = commandFromWire({ moveX: 1, moveZ: 0, sprint: false, jump: false, crouch: false, yaw: 0.2, pitch: 0, fire: true, alt: false }, t);
        if (stepNet(flat, cmd, 1 / 60, map.solids, spawn, rng)) fired.push(t);
        stepPlayer(ref, cmd, 1 / 60, map.solids);
        ref.recoil = flat.recoil; // o coice vem da arma (stepWeapon)
      }
      expect(flat.x).toBe(ref.pos.x);
      expect(flat.z).toBe(ref.pos.z);
      expect(fired.slice(0, 4)).toEqual([1, 8, 15, 22]); // 1 tiro a cada 7 ticks
      return flat;
    });
    // Predição com rng local diferente do servidor: posição, coice e cadência batem igual
    expect(runs[0]).toEqual(runs[1]);
  });

  it('stepNet: morto não anda, não atira e não regenera', () => {
    const map = getMap('arena');
    const spawn = map.spawns[0];
    const f = { ...flatAt(spawn), hp: 0, sinceHurt: 99 };
    for (let t = 1; t <= 60; t++) {
      expect(stepNet(f, commandFromWire({ ...idleWire, moveZ: 1, fire: true }, t), 1 / 60, map.solids, spawn, createRng(1))).toBeNull();
    }
    expect(f.hp).toBe(0);
    expect(f.x).toBeCloseTo(spawn.x, 9);
    expect(f.z).toBeCloseTo(spawn.z, 9);
  });

  it('ângulo vai para [-π, π) e apelido é limpo', () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(0.5)).toBe(0.5);
    expect(cleanName('  <b>Zé</b>\u0000 ', 'x')).toBe('bZé/b');
    expect(cleanName('', 'Jogador 1')).toBe('Jogador 1');
    expect(cleanName(42, 'Jogador 1')).toBe('Jogador 1');
    expect(cleanName('a'.repeat(40), 'x')).toHaveLength(16);
  });

  it('spawns dos mapas ficam em cima do chão e fora das caixas', () => {
    for (const map of Object.values(MAPS)) {
      for (const s of map.spawns) {
        const inside = map.solids.some((b) =>
          s.x > b.min.x - 0.35 && s.x < b.max.x + 0.35 && s.z > b.min.z - 0.35 && s.z < b.max.z + 0.35 &&
          s.y - 0.85 < b.max.y && s.y + 0.85 > b.min.y);
        expect(inside).toBe(false);
      }
    }
  });
});

describe('parâmetros da URL', () => {
  const page = { hostname: 'localhost', protocol: 'http:' };

  it('sala, apelido e servidor', () => {
    const p = parseOnlineParams('?online&sala=abc&nome=Vital&lag=150', page);
    expect(p.roomId).toBe('abc');
    expect(p.name).toBe('Vital');
    expect(p.endpoint).toBe('ws://localhost:2567');
    expect(p.lag?.lag).toBe(150);
    expect(p.bots).toBeNull();
    const r = parseOnlineParams('?online&bots=3&abates=10&tempo=2&mapa=arena', page);
    expect([r.bots, r.killLimit, r.minutes, r.map]).toEqual([3, 10, 2, 'arena']);
    expect(parseOnlineParams('?online&bots=0', page).bots).toBe(0);
    const q = parseOnlineParams('?online', { hostname: 'jogo.com', protocol: 'https:' }, () => 0);
    expect(q.roomId).toBeNull();
    expect(q.name).toBe('Capivara10');
    expect(q.endpoint).toBe('wss://jogo.com:2567');
  });

  it('link de convite só leva a sala', () => {
    expect(inviteLink('http://localhost:5181/?online&debug&lag=150&nome=A', 'xyz')).toBe('http://localhost:5181/?online&sala=xyz');
    expect(withRoom('http://localhost:5181/?online&debug&lag=150', 'xyz')).toBe('http://localhost:5181/?online&debug&lag=150&sala=xyz');
  });
});
