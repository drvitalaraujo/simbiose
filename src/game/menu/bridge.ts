// Ponte provisória entre as Configurações e o render/quality.ts, que lê `?low` da URL na
// criação do jogo. Quando a qualidade ganhar uma API própria, apague este arquivo.
import { searchWithQuality, type SettingsStore } from './settings';

/**
 * Qualidade "leve": liga o `?low` só durante a criação do jogo e devolve a URL original
 * (o link compartilhado não muda).
 */
export function withQualityPref<T>(store: SettingsStore, create: () => T): T {
  const original = location.search;
  const wantLow = store.get().quality === 'leve' && !new URLSearchParams(original).has('low');
  if (!wantLow) return create();
  history.replaceState(history.state, '', `${location.pathname}${searchWithQuality(original, 'leve')}${location.hash}`);
  try {
    return create();
  } finally {
    history.replaceState(history.state, '', `${location.pathname}${original}${location.hash}`);
  }
}
