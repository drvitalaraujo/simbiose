import { describe, expect, it } from 'vitest';
import { menuSearch, onlineSearch } from './online-entry';

describe('link do online', () => {
  it('leva apelido e mapa', () => {
    expect(onlineSearch('', 'Kaia', 'bairro')).toBe('?online&nome=Kaia');
    expect(onlineSearch('?map=pelourinho', 'Zé da Lapa', 'pelourinho')).toBe('?online&nome=Z%C3%A9+da+Lapa&mapa=pelourinho');
    expect(onlineSearch('?map=lapa', 'Kaia', 'lapa')).toBe('?online&nome=Kaia&mapa=lapa');
    expect(onlineSearch('?map=favela', 'Kaia', 'favela')).toBe('?online&nome=Kaia&mapa=favela');
  });
  it('mantém servidor e debug, descarta o resto', () => {
    expect(onlineSearch('?debug&servidor=ws://localhost:2570&map=pelourinho', 'A', 'bairro')).toBe('?online&nome=A&servidor=ws%3A%2F%2Flocalhost%3A2570&debug');
  });
  it('volta ao menu sem sala', () => {
    expect(menuSearch('?online&sala=abc&nome=A&debug')).toBe('?debug');
  });
  it('leva o modo competitivo escolhido e remove-o ao voltar ao menu', () => {
    for (const mode of ['duel', 'tdm', 'hack'] as const) {
      expect(onlineSearch('', 'A', 'pelourinho', mode)).toContain(`modo=${mode}`);
      expect(menuSearch(`?online&sala=abc&nome=A&modo=${mode}&debug`)).toBe('?debug');
    }
  });
  it('leva a dificuldade dos bots (contrato &dificuldade=) e tira ao voltar', () => {
    expect(onlineSearch('', 'A', 'lapa', 'ffa', 'dificil')).toBe('?online&nome=A&mapa=lapa&dificuldade=dificil');
    expect(onlineSearch('', 'A', 'favela', 'ffa', 'facil')).toContain('dificuldade=facil');
    expect(menuSearch('?online&nome=A&dificuldade=facil&debug')).toBe('?debug');
  });
});
