import { expect, it, vi } from 'vitest';
import { OnlineGame } from './online';
import type { OnlineSession } from '../net/client';

it('dano próprio mostra dor sem acerto/abate positivo local; rival ainda dá feedback', () => {
  // Exercita os handlers reais sem criar GPU/DOM ou conexão de rede.
  const game = Object.create(OnlineGame.prototype) as OnlineGame;
  const fx = { worldShot: vi.fn(), confirmHit: vi.fn(), hurt: vi.fn(), died: vi.fn(), juice: { punch: vi.fn() } };
  const hud = { hit: vi.fn(), hurt: vi.fn(), kill: vi.fn() }, events = { emit: vi.fn() };
  Object.assign(game, { disposed: false, kills: 0, fx, hud, events, input: { yaw: 0 }, avatars: new Map(), avatarTeams: new Map(), objectives: {}, replays: { playing: false, shot: vi.fn(), kill: vi.fn() } });
  const session = { room: { sessionId: 'me' }, me: { state: { x: 0, y: 1, z: 0 } }, self: { hp: 0 } } as unknown as OnlineSession;
  const hit = { by: 'me', t: 'me', seq: 1, o: [0, 0, 0] as [number, number, number], e: [0, 1, 0] as [number, number, number], weapon: 'grenade' as const, part: 'torso' as const, dmg: 110, k: true, continuation: true };
  game['onShot'](session, hit);
  expect(fx.confirmHit).not.toHaveBeenCalled(); expect(hud.hit).not.toHaveBeenCalled();
  expect(events.emit.mock.calls.map(c => c[0])).toEqual(['hurt']); expect(fx.hurt).toHaveBeenCalledOnce();
  expect(fx.juice.punch).toHaveBeenCalledWith('hurt', expect.anything(), expect.anything());
  const death = { killerId: 'me', victimId: 'me', killer: 'Eu', victim: 'Eu', weapon: 'grenade', headshot: false, killerIsBot: false, victimIsBot: false };
  game['onKill'](session, death); expect(game.kills).toBe(0); expect(fx.died).toHaveBeenCalledOnce();
  game['onShot'](session, { ...hit, t: 'enemy' }); expect(fx.confirmHit).toHaveBeenCalledOnce(); expect(hud.hit).toHaveBeenCalledOnce();
  game['onKill'](session, { ...death, victimId: 'enemy' }); expect(game.kills).toBe(1);
});
