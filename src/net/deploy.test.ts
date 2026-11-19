import { describe, expect, it } from 'vitest';
import { inviteLink, parseOnlineParams } from './client';
import { DEFAULT_LIMITS, limitsFromEnv, validateLimits } from './limits';

describe('configuração de publicação', () => {
  const page = { hostname: 'jogo.example', protocol: 'https:' };
  it('usa o endpoint do build, com override explícito e fallback local', () => {
    expect(parseOnlineParams('?online', page, undefined, ' wss://api.example ').endpoint).toBe('wss://api.example');
    expect(parseOnlineParams('?servidor=ws://localhost:2568', page, undefined, 'wss://api.example').endpoint).toBe('ws://localhost:2568');
    expect(parseOnlineParams('', { hostname: 'localhost', protocol: 'http:' }, undefined, '').endpoint).toBe('ws://localhost:2567');
  });
  it('convite mantém servidor explícito sem levar nome, debug ou lag', () => {
    const link = new URL(inviteLink('https://jogo.example/?online&servidor=wss://api.example&nome=Ana&lag=150&debug', 'a/b'));
    expect([...link.searchParams.keys()]).toEqual(['online', 'sala', 'servidor']);
    expect(link.searchParams.get('sala')).toBe('a/b');
    expect(parseOnlineParams(link.search, page).endpoint).toBe('wss://api.example');
  });
  it('aceita cotas de ambiente e recusa valores que desligariam proteção', () => {
    expect(limitsFromEnv({})).toEqual(DEFAULT_LIMITS);
    expect(limitsFromEnv({ SIMBIOSE_MAX_ROOMS: '12' }).maxRooms).toBe(12);
    for (const raw of ['0', '-1', 'NaN', 'Infinity', '1.5', ' ']) {
      expect(() => limitsFromEnv({ SIMBIOSE_CONNECTIONS_PER_IP: raw })).toThrow(/inteiro positivo/);
    }
    expect(() => validateLimits({ ...DEFAULT_LIMITS, maxPayload: NaN })).toThrow();
  });
});
