import { describe, expect, it } from 'vitest';
import type { KillFeedEvent, ScoreRow } from '../../net/feed';
import { killView, matchEndView, weaponLabel } from './hud-data';

const rows: ScoreRow[] = [
  { id: 'bot', name: 'Riso', kills: 20, deaths: 5, ping: 0, bot: true },
  { id: 'me', name: '<Lia>', kills: 10, deaths: 7, ping: 30, bot: false },
];
const kill: KillFeedEvent = { killerId: 'bot', victimId: 'me', killer: 'Riso', victim: '<Lia>', killerIsBot: true, victimIsBot: false, weapon: 'mk2', headshot: true };

describe('dados do HUD online', () => {
  it('preserva as equipes do evento mesmo se o jogador saiu da sala', () => {
    expect(killView({ ...kill, killerTeam: 'b', victimTeam: 'a' })).toMatchObject({ killer: { team: 'b' }, victim: { team: 'a' } });
    expect(killView({ ...kill, killerTeam: '', victimTeam: '' })).toEqual(killView(kill));
  });
  it('nomeia os dois ataques de chinelo', () => {
    expect(weaponLabel('chinelo')).toBe('Chinelada');
    expect(weaponLabel('chinelo-arremesso')).toBe('Chinelo voador');
  });
  it('vitória de time usa equipe autoritativa e mostra pontos do modo', () => {
    const teams = rows.map((r, i) => ({ ...r, team: i === 0 ? 'a' : 'b' }));
    const data = { rows: teams, me: 'me', winnerId: 'team-b', winnerName: 'Equipe B', winnerTeam: 'b', mode: 'hack', scoreA: 17, scoreB: 20 };
    expect(matchEndView(data)).toMatchObject({ outcome: 'win', title: 'VITÓRIA', teamScore: { a: 17, b: 20 } });
    expect(matchEndView({ ...data, winnerId: '', drawn: true }).outcome).toBe('draw');
    expect(matchEndView({ ...data, winnerTeam: 'a' }).outcome).toBe('loss');
  });
  it('preserva identidades, nome literal, bot e cabeça no killfeed', () => {
    expect(killView(kill)).toEqual({ killer: { id: 'bot', name: 'Riso', bot: true }, victim: { id: 'me', name: '<Lia>', bot: false }, weapon: 'Gambiarra MK-2', headshot: true });
    expect(killView({ ...kill, killerId: '' }).killer).toBeNull();
  });
  it('usa o vencedor autoritativo e mostra posição/estatísticas locais', () => {
    const result = matchEndView({ rows, me: 'me', winnerId: 'bot', winnerName: 'Riso' });
    expect(result.outcome).toBe('loss');
    expect(result.title).toBe('2º LUGAR');
    expect(result.mvp.bot).toBe(true);
    expect(result.stats.map((s) => s.value)).toEqual(['10', '7']);
    expect(result.rows).not.toBe(rows);
    expect(matchEndView({ rows, me: 'bot', winnerId: 'bot', winnerName: 'Riso' }).outcome).toBe('win');
  });
  it('tolera jogador que saiu e partida sem vencedor', () => {
    const gone = matchEndView({ rows: [], me: 'me', winnerId: 'gone', winnerName: 'Quem saiu' });
    expect(gone.mvp.name).toBe('Quem saiu');
    expect(gone.title).toBe('FIM DE PARTIDA');
    expect(gone.stats.map((s) => s.value)).toEqual(['0', '0']);
    expect(matchEndView({ rows, me: 'me', winnerId: '', winnerName: '' }).outcome).toBe('draw');
  });
});
