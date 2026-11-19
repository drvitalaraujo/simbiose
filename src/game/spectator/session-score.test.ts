import { describe, expect, it } from 'vitest';
import { SessionScore } from './session-score';

const row = (name: string, kills: number, deaths: number, team?: string, bot = false) => ({ name, kills, deaths, bot, ...(team ? { team } : {}) });

describe('placar da sessão (Modo Live)', () => {
  it('soma abates, mortes e vitórias por apelido ao longo das revanches', () => {
    const s = new SessionScore();
    s.commit({ match: 1, rows: [row('Ana', 10, 2), row('Beto', 4, 6)], winnerName: 'Ana' });
    s.commit({ match: 2, rows: [row('Ana', 3, 5), row('Beto', 9, 1), row('Caio', 1, 1)], winnerName: 'Beto' });
    s.commit({ match: 3, rows: [row('Beto', 7, 0)], winnerName: 'Beto' });
    const v = s.view();
    expect(v.map(r => r.name)).toEqual(['Beto', 'Ana', 'Caio']);
    expect(v[0]).toMatchObject({ kills: 20, deaths: 7, wins: 2, matches: 3 });
    expect(v[1]).toMatchObject({ kills: 13, deaths: 7, wins: 1, matches: 2 });
    expect(s.podium()).toHaveLength(3);
  });

  it('não soma a mesma partida duas vezes e mostra a partida em andamento sem gravá-la', () => {
    const s = new SessionScore();
    expect(s.commit({ match: 1, rows: [row('Ana', 5, 0)], winnerName: 'Ana' })).toBe(true);
    expect(s.commit({ match: 1, rows: [row('Ana', 5, 0)], winnerName: 'Ana' })).toBe(false);
    const live = { match: 2, rows: [row('Ana', 2, 1)] };
    expect(s.view(live)[0]).toMatchObject({ kills: 7, deaths: 1, wins: 1, matches: 1 });
    expect(s.view()[0]).toMatchObject({ kills: 5, deaths: 0 }); // ao vivo não grava
    expect(s.view({ match: 1, rows: [row('Ana', 99, 0)] })[0].kills).toBe(5); // já somada
  });

  it('vitória de time vale para todos do time; empate não dá vitória', () => {
    const s = new SessionScore();
    s.commit({ match: 1, rows: [row('A1', 3, 1, 'a'), row('A2', 1, 2, 'a'), row('B1', 4, 4, 'b')], winnerTeam: 'a' });
    s.commit({ match: 2, rows: [row('A1', 1, 1), row('B1', 1, 1)], winnerName: '', drawn: true });
    const by = Object.fromEntries(s.view().map(r => [r.name, r]));
    expect(by.A1.wins).toBe(1);
    expect(by.A2.wins).toBe(1);
    expect(by.B1.wins).toBe(0);
    expect(by.A1.matches).toBe(2);
  });

  it('volta do JSON salvo e ignora lixo', () => {
    const s = new SessionScore();
    s.commit({ match: 4, rows: [row('Ana', 2, 1), row('Bot Zé', 1, 2, undefined, true)], winnerName: 'Ana' });
    const back = new SessionScore(JSON.parse(JSON.stringify(s)));
    expect(back.view()).toEqual(s.view());
    expect(back.has(4)).toBe(true);
    expect(back.view().find(r => r.name === 'Bot Zé')?.bot).toBe(true);
    const junk = new SessionScore({ rows: [{ name: 3 }, { name: 'X', kills: -5, deaths: 'a' }] as never, counted: ['x'] as never });
    expect(junk.view()).toEqual([{ name: 'X', kills: 0, deaths: 0, wins: 0, matches: 0, bot: false }]);
  });
});
