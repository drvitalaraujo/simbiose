// Configurações do jogador (sensibilidade, FOV, volume, qualidade, apelido, mapa), salvas no
// localStorage. Lógica pura: o armazenamento é injetável para os testes e toda leitura e
// escrita fica em try/catch (aba anônima ou site bloqueado não podem quebrar o jogo).

export type QualityPref = 'auto' | 'leve';
export type MapId = 'bairro' | 'pelourinho' | 'lapa' | 'favela' | 'patacho';
/** Mapa da Arena escolhido no menu (só competitivos; "aleatorio" sorteia ao entrar). */
export type ArenaMapId = 'pelourinho' | 'lapa' | 'favela' | 'patacho' | 'aleatorio';
/** Dificuldade dos bots do online (`&dificuldade=` na URL). */
export type Difficulty = 'facil' | 'normal' | 'dificil';

export interface Settings {
  /** Multiplicador da sensibilidade do mouse (1 = a de hoje). */
  sensitivity: number;
  /** Campo de visão em graus. */
  fov: number;
  /** Volume geral de 0 a 100. */
  volume: number;
  /** `auto` = qualidade adaptativa; `leve` = começa no nível 2 (igual a `?low`). */
  quality: QualityPref;
  nickname: string;
  map: MapId;
  /** Volume da trilha de 0 a 100 (o volume geral vale por cima). */
  music: number;
  /** Mapa da Arena (o Treino segue no Bairro). */
  arenaMap: ArenaMapId;
  /** Dificuldade dos bots da Arena. */
  difficulty: Difficulty;
  /**
   * "Movimento de câmera reduzido": menos balanço, tremida e coice visual da câmera (para quem
   * enjoa). A câmera lê com `getReducedMotion()` e escuta `settings().onChange`.
   */
  reducedMotion: boolean;
}

export const LIMITS = {
  sensitivity: { min: 0.1, max: 5, step: 0.05 },
  fov: { min: 70, max: 110, step: 1 },
  volume: { min: 0, max: 100, step: 1 },
  music: { min: 0, max: 100, step: 1 },
  nickname: { max: 16 },
} as const;

export const STORAGE_KEY = 'simbiose.settings.v1';

/** Apelido padrão: "Desplugado" + 3 dígitos. */
export function randomNickname(rand: () => number = Math.random): string {
  return `Desplugado${String(Math.floor(rand() * 1000)).padStart(3, '0')}`;
}

export function defaultSettings(rand?: () => number): Settings {
  return { sensitivity: 1, fov: 80, volume: 80, quality: 'auto', nickname: randomNickname(rand), map: 'bairro', music: 60, arenaMap: 'pelourinho', difficulty: 'normal', reducedMotion: false };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Apelido limpo: sem caracteres de controle/HTML, espaços colapsados, até 16 caracteres. */
export function sanitizeNickname(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>"'`&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LIMITS.nickname.max);
}

/** Corrige qualquer coisa vinda do armazenamento (valor velho, adulterado ou de outra versão). */
export function normalize(raw: unknown, fallback: Settings): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const num = (v: unknown, def: number, lim: { min: number; max: number }) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, lim.min, lim.max) : def;
  const nick = typeof r.nickname === 'string' ? sanitizeNickname(r.nickname) : '';
  return {
    sensitivity: num(r.sensitivity, fallback.sensitivity, LIMITS.sensitivity),
    fov: Math.round(num(r.fov, fallback.fov, LIMITS.fov)),
    volume: Math.round(num(r.volume, fallback.volume, LIMITS.volume)),
    quality: r.quality === 'leve' || r.quality === 'auto' ? r.quality : fallback.quality,
    nickname: nick || fallback.nickname,
    map: r.map === 'pelourinho' || r.map === 'bairro' || r.map === 'lapa' || r.map === 'favela' || r.map === 'patacho' ? r.map : fallback.map,
    music: Math.round(num(r.music, fallback.music, LIMITS.music)),
    // Quem já tinha escolhido um mapa competitivo antes desta opção existir continua nele
    arenaMap: isArenaMap(r.arenaMap) ? r.arenaMap : isArenaMap(r.map) && r.arenaMap === undefined ? r.map : fallback.arenaMap,
    difficulty: r.difficulty === 'facil' || r.difficulty === 'normal' || r.difficulty === 'dificil' ? r.difficulty : fallback.difficulty,
    reducedMotion: typeof r.reducedMotion === 'boolean' ? r.reducedMotion : fallback.reducedMotion,
  };
}

export function isArenaMap(v: unknown): v is ArenaMapId {
  return v === 'pelourinho' || v === 'lapa' || v === 'favela' || v === 'patacho' || v === 'aleatorio';
}

/** Sorteia o mapa quando a escolha é "aleatório"; os outros passam direto. */
export function resolveArenaMap(pick: ArenaMapId, rand: () => number = Math.random): Exclude<ArenaMapId, 'aleatorio'> {
  if (pick !== 'aleatorio') return pick;
  const all = ['pelourinho', 'lapa', 'patacho', 'favela'] as const;
  return all[Math.min(all.length - 1, Math.floor(rand() * all.length))];
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // acessar localStorage pode lançar (cookies bloqueados)
  }
}

type Listener = (s: Settings) => void;

export class SettingsStore {
  private current: Settings;
  private listeners = new Set<Listener>();

  constructor(private readonly store: KeyValueStore | null = browserStore(), rand?: () => number) {
    const fallback = defaultSettings(rand);
    let raw: unknown = null;
    try {
      const text = this.store?.getItem(STORAGE_KEY);
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = null;
    }
    this.current = normalize(raw, fallback);
  }

  get(): Readonly<Settings> {
    return this.current;
  }

  /** Muda alguns campos (normalizados), salva e avisa quem escuta. */
  set(patch: Partial<Settings>) {
    this.current = normalize({ ...this.current, ...patch }, this.current);
    try {
      this.store?.setItem(STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
    for (const fn of this.listeners) fn(this.current);
  }

  /** Escuta mudanças; retorna a função para parar de escutar. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

let shared: SettingsStore | null = null;

/** Configurações compartilhadas do jogo (uma instância por página). */
export function settings(): SettingsStore {
  shared ??= new SettingsStore();
  return shared;
}

// Getters para os sistemas que ainda vão ligar estas opções (input, câmera, áudio, rede).
export const getSensitivity = () => settings().get().sensitivity;
export const getFov = () => settings().get().fov;
/** Volume de 0 a 1. */
export const getVolume = () => settings().get().volume / 100;
export const getQuality = () => settings().get().quality;
export const getNickname = () => settings().get().nickname;
/** "Movimento de câmera reduzido" (Configurações). */
export const getReducedMotion = () => settings().get().reducedMotion;

/** Mapa escolhido pela URL (`?map=`), que é quem manda no mundo carregado. */
export function mapFromSearch(search: string): MapId {
  const id = new URLSearchParams(search).get('map');
  return id === 'patacho' ? 'patacho' : id === 'favela' ? 'favela' : id === 'lapa' ? 'lapa' : id === 'pelourinho' || id === 'arena1' ? 'pelourinho' : 'bairro';
}

/** URL de busca com o mapa trocado, mantendo os outros parâmetros (`?debug`, `?low`...). */
export function searchWithMap(search: string, map: MapId): string {
  const p = new URLSearchParams(search);
  if (map === 'bairro') p.delete('map');
  else p.set('map', map);
  return toSearch(p);
}

/** URL de busca com `low` ligado/desligado conforme a preferência de qualidade. */
export function searchWithQuality(search: string, quality: QualityPref): string {
  const p = new URLSearchParams(search);
  if (quality === 'leve') p.set('low', '');
  else p.delete('low');
  return toSearch(p);
}

/** `?debug` continua `?debug` (o URLSearchParams escreveria `?debug=`). */
function toSearch(p: URLSearchParams): string {
  const s = p.toString().replace(/=(?=&|$)/g, '');
  return s ? `?${s}` : '';
}
