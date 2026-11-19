// Sorteio determinístico para a simulação (mulberry32): mesma semente, mesma sequência
// no cliente e no servidor. A simulação NUNCA usa Math.random.

export type Rng = () => number;

/** Gerador com semente; devolve números em [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
