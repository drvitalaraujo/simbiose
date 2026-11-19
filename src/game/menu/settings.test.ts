import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  mapFromSearch,
  normalize,
  resolveArenaMap,
  sanitizeNickname,
  searchWithMap,
  searchWithQuality,
  SettingsStore,
  STORAGE_KEY,
  type KeyValueStore,
} from './settings';

function memory(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

const fixed = () => 0.042;

describe('configurações', () => {
  it('começa no padrão quando não há nada salvo', () => {
    const s = new SettingsStore(memory(), fixed).get();
    expect(s).toEqual(defaultSettings(fixed));
    expect(s.nickname).toBe('Desplugado042');
  });

  it('salva e lê de volta', () => {
    const mem = memory();
    new SettingsStore(mem, fixed).set({ fov: 95, sensitivity: 1.5, quality: 'leve', nickname: 'Kaia' });
    const again = new SettingsStore(mem, fixed).get();
    expect(again.fov).toBe(95);
    expect(again.sensitivity).toBe(1.5);
    expect(again.quality).toBe('leve');
    expect(again.nickname).toBe('Kaia');
  });

  it('corrige valores fora do limite, de tipo errado ou JSON quebrado', () => {
    const fb = defaultSettings(fixed);
    expect(normalize({ fov: 500, volume: -3, sensitivity: 'x', quality: 'ultra', map: 'lua' }, fb)).toEqual({
      ...fb,
      fov: 110,
      volume: 0,
    });
    const broken = new SettingsStore(memory({ [STORAGE_KEY]: '{nao é json' }), fixed).get();
    expect(broken).toEqual(fb);
  });

  it('não quebra se o armazenamento lançar erro', () => {
    const angry: KeyValueStore = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const store = new SettingsStore(angry, fixed);
    expect(() => store.set({ volume: 10 })).not.toThrow();
    expect(store.get().volume).toBe(10);
  });

  it('avisa quem escuta e para de avisar ao cancelar', () => {
    const store = new SettingsStore(memory(), fixed);
    const seen: number[] = [];
    const off = store.onChange((s) => seen.push(s.volume));
    store.set({ volume: 20 });
    off();
    store.set({ volume: 30 });
    expect(seen).toEqual([20]);
  });

  it('limpa o apelido', () => {
    expect(sanitizeNickname('  <b>Zé</b>   da   Lapa\n ')).toBe('bZé/b da Lapa');
    expect(sanitizeNickname('a'.repeat(40))).toHaveLength(16);
    expect(normalize({ nickname: '   ' }, defaultSettings(fixed)).nickname).toBe('Desplugado042');
  });
});

describe('música', () => {
  it('padrão 60, limitado a 0–100 e preservado em configurações antigas', () => {
    expect(defaultSettings(fixed).music).toBe(60);
    expect(normalize({ music: 140 }, defaultSettings(fixed)).music).toBe(100);
    expect(normalize({ music: 'alto' }, defaultSettings(fixed)).music).toBe(60);
    expect(normalize({ volume: 30 }, defaultSettings(fixed)).music).toBe(60);
  });
});

describe('mapa e qualidade na URL', () => {
  it('lê o mapa da URL', () => {
    expect(mapFromSearch('')).toBe('bairro');
    expect(mapFromSearch('?map=pelourinho')).toBe('pelourinho');
    expect(mapFromSearch('?debug&map=arena1')).toBe('pelourinho');
    expect(mapFromSearch('?debug&map=lapa')).toBe('lapa');
    expect(mapFromSearch('?debug&map=favela')).toBe('favela');
    expect(normalize({ map: 'favela' }, defaultSettings(fixed)).map).toBe('favela');
    expect(normalize({ map: 'lapa' }, defaultSettings(fixed)).map).toBe('lapa');
  });

  it('troca o mapa mantendo os outros parâmetros', () => {
    expect(searchWithMap('?debug', 'pelourinho')).toBe('?debug&map=pelourinho');
    expect(searchWithMap('?map=pelourinho', 'bairro')).toBe('');
    expect(searchWithMap('?debug&low', 'lapa')).toBe('?debug&low&map=lapa');
  });

  it('liga e desliga o ?low', () => {
    expect(searchWithQuality('', 'leve')).toBe('?low');
    expect(searchWithQuality('?map=pelourinho&low', 'auto')).toBe('?map=pelourinho');
  });

  it('Arena e Treino têm mapas separados; dificuldade padrão é normal', () => {
    const fb = defaultSettings(fixed);
    expect(fb.arenaMap).toBe('pelourinho');
    expect(fb.difficulty).toBe('normal');
    expect(normalize({ arenaMap: 'bairro', difficulty: 'impossivel' }, fb)).toMatchObject({ arenaMap: 'pelourinho', difficulty: 'normal' });
    expect(normalize({ arenaMap: 'aleatorio', difficulty: 'dificil' }, fb)).toMatchObject({ arenaMap: 'aleatorio', difficulty: 'dificil' });
    // Preferência antiga (mapa único) vira o mapa da Arena
    expect(normalize({ map: 'favela' }, fb).arenaMap).toBe('favela');
    expect(normalize({ map: 'bairro' }, fb).arenaMap).toBe('pelourinho');
  });

  it('"aleatório" sorteia só entre os mapas competitivos', () => {
    expect(resolveArenaMap('lapa', () => 0.9)).toBe('lapa');
    expect(resolveArenaMap('aleatorio', () => 0)).toBe('pelourinho');
    expect(resolveArenaMap('aleatorio', () => 0.5)).toBe('patacho');
    expect(resolveArenaMap('aleatorio', () => 0.9999)).toBe('favela');
  });
});

describe('movimento de câmera reduzido', () => {
  it('desligado por padrão, só aceita booleano e é salvo como as outras opções', () => {
    const fb = defaultSettings(fixed);
    expect(fb.reducedMotion).toBe(false);
    expect(normalize({ reducedMotion: 'sim' }, fb).reducedMotion).toBe(false);
    expect(normalize({ reducedMotion: true }, fb).reducedMotion).toBe(true);
    const disk = memory();
    new SettingsStore(disk, fixed).set({ reducedMotion: true });
    expect(new SettingsStore(disk, fixed).get().reducedMotion).toBe(true);
  });
});
