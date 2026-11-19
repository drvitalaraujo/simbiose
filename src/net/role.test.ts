import { describe, expect, it } from 'vitest';
import { RoleTracker } from './role';

const state = (seat?: number) => ({ get: (id: string) => (id === 'me' && seat !== undefined ? { seat } : undefined) });

describe('papel da conexão (vaga/banco)', () => {
  it('sem anúncio, vale o jogador que estiver no estado', () => {
    const r = new RoleTracker();
    expect(r.seated(state(), 'me')).toBeNull();
    expect(r.seated(state(4), 'me')).toEqual({ seat: 4 });
    expect(r.stale(4)).toBe(false);
  });

  it('banco: nem o boneco antigo ainda no estado conta como vaga', () => {
    const r = new RoleTracker();
    r.bench({ place: 1, waiting: 1 });
    expect(r.seated(state(1), 'me')).toBeNull();
    expect(r.stale(1)).toBe(true);
  });

  it('vaga chega antes do patch: espera o NetPlayer da geração anunciada', () => {
    const r = new RoleTracker();
    r.bench({ place: 1, waiting: 1 });
    r.seat({ seat: 3 });
    expect(r.seated(state(1), 'me')).toBeNull(); // patch velho: ainda o boneco do banco
    expect(r.seated(state(3), 'me')).toEqual({ seat: 3 });
    expect(r.stale(1)).toBe(true);
    expect(r.stale(3)).toBe(false);
  });

  it('mensagem repetida é idempotente e avisa os ouvintes', () => {
    const r = new RoleTracker();
    let calls = 0;
    const off = r.on(() => { calls += 1; });
    r.seat({ seat: 2 });
    r.seat({ seat: 2 });
    r.seat({ seat: 0 }); // inválida: ignorada
    off();
    r.bench({ place: 2, waiting: 2 });
    expect(calls).toBe(2);
    expect(r.role).toEqual({ kind: 'bench', msg: { place: 2, waiting: 2 } });
  });
});
