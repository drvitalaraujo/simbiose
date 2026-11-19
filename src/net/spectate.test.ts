import { describe, expect, it } from 'vitest';
import { Audience, seatFor, SPECTATOR_SLOTS } from './spectate';

describe('plateia da sala (puro)', () => {
  it('decide o papel: pediu para assistir, sala cheia de gente ou joga', () => {
    const a = new Audience();
    expect(a.admit('h', 'Host', true, 0, 2)).toBe('spectator');
    expect(a.admit('p', 'P', false, 1, 2)).toBe('player');
    expect(a.admit('w1', 'W1', false, 2, 2)).toBe('waiting');
    // Já há fila: ninguém fura, mesmo se a contagem mostra vaga
    expect(a.admit('w2', 'W2', false, 1, 2)).toBe('waiting');
    expect(a.size).toBe(3);
    expect(a.waitingCount).toBe(2);
    expect(a.isWaiting('h')).toBe(false);
    expect(a.message(2, 2)).toEqual({ players: 2, capacity: 2, spectators: 3, waiting: 2 });
  });

  it('promove a fila na ordem de chegada; espectador por escolha nunca vira jogador', () => {
    const a = new Audience();
    a.admit('h', 'Host', true, 0, 2);
    a.admit('w1', 'W1', false, 2, 2);
    a.admit('w2', 'W2', false, 2, 2);
    expect(a.promote(0)).toEqual([]);
    expect(a.promote(1)).toEqual([{ id: 'w1', name: 'W1' }]);
    expect(a.promote(5)).toEqual([{ id: 'w2', name: 'W2' }]);
    expect(a.promote(5)).toEqual([]);
    expect(a.has('h')).toBe(true);
    expect(a.remove('h')).toBe(true);
    expect(a.remove('h')).toBe(false);
  });

  it('plateia tem teto: voluntário ou fila além de SPECTATOR_SLOTS é recusado', () => {
    const a = new Audience();
    for (let i = 0; i < SPECTATOR_SLOTS; i++) expect(a.admit(`s${i}`, 'S', true, 0, 2)).toBe('spectator');
    expect(a.admit('mais', 'M', true, 0, 2)).toBe('full');
    expect(a.admit('fila', 'F', false, 2, 2)).toBe('full');
    // Jogador com vaga continua entrando mesmo com a plateia lotada
    expect(a.admit('p', 'P', false, 0, 2)).toBe('player');
    expect(a.size).toBe(SPECTATOR_SLOTS);
  });

  it('rodízio: quem sai vai para o fim da fila e sabe a posição', () => {
    const a = new Audience();
    a.admit('h', 'Host', true, 0, 2);
    a.admit('w1', 'W1', false, 2, 2);
    a.admit('w2', 'W2', false, 2, 2);
    a.bench('loser', 'Loser');
    expect(a.placeOf('w1')).toBe(1);
    expect(a.placeOf('loser')).toBe(3);
    expect(a.placeOf('h')).toBe(0);
    expect(a.promote(1)).toEqual([{ id: 'w1', name: 'W1' }]);
    expect(a.placeOf('loser')).toBe(2);
    expect(a.message(2, 2)).toEqual({ players: 2, capacity: 2, spectators: 3, waiting: 2 });
  });
});

describe('reserva de vaga por papel (puro)', () => {
  it('jogador com vaga sempre passa, mesmo com a plateia lotada', () => {
    expect(seatFor(false, 8, 0, SPECTATOR_SLOTS, [])).toBe('player');
    expect(seatFor(true, 8, 0, SPECTATOR_SLOTS, [])).toBe('full');
    expect(seatFor(true, 8, 0, SPECTATOR_SLOTS - 1, [])).toBe('audience');
  });

  it('conta reservas pendentes: espectadores e quem sobra da capacidade', () => {
    // 7 na plateia + 1 espectador pendente = teto
    expect(seatFor(true, 2, 0, SPECTATOR_SLOTS - 1, [true])).toBe('full');
    // Dois jogadores pendentes ocupam o duelo: o terceiro vira fila (cabe na plateia)
    expect(seatFor(false, 2, 0, 0, [false, false])).toBe('audience');
    expect(seatFor(false, 2, 0, SPECTATOR_SLOTS, [false, false])).toBe('full');
    expect(seatFor(false, 2, 1, SPECTATOR_SLOTS, [])).toBe('player');
  });
});
