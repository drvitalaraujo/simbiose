// Preferência "Movimento de câmera reduzido" (Configurações) aplicada à página: a classe
// `reduce-motion` no <body> faz a interface parar de pulsar/tremer e desliga o parallax do
// menu. A câmera (frente de movimento) lê `getReducedMotion()` e escuta `settings().onChange`.
// Em `?debug`/`?hud` vale a página padrão (preferências do jogador não entram nos testes).
import type { SettingsStore } from './settings';

export const REDUCE_MOTION_CLASS = 'reduce-motion';

/** Liga a classe do <body> à preferência; devolve a função que desliga. */
export function bindReducedMotion(store: SettingsStore): () => void {
  const q = new URLSearchParams(location.search);
  if (q.has('debug') || q.has('hud')) return () => {};
  const apply = () => document.body.classList.toggle(REDUCE_MOTION_CLASS, store.get().reducedMotion);
  apply();
  return store.onChange(apply);
}

/** Movimento decorativo da interface liberado? (preferência do jogo e a do sistema) */
export function uiMotionAllowed(): boolean {
  if (document.body.classList.contains(REDUCE_MOTION_CLASS)) return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
