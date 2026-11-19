// Ritmo dos replays (puro): quanto o tempo do replay anda por segundo real. A killcam corre
// um pouco acelerada e freia até a câmera lenta no tiro final, para caber antes do
// renascimento (3 s no servidor, começando ~0,5 s depois da morte). A Jogada da Partida
// anda em tempo normal e mergulha em câmera lenta em cada abate, mais fundo no auge.

/** Janela da killcam em torno do tiro fatal (s, relativo a ele). */
export const KILLCAM = { before: 2.2, after: 0.2, delay: 0.5, fast: 1.8, slow: 0.4, rampFrom: -0.5, slowFrom: -0.15 } as const;

/** O que fazer com a morte pendente neste quadro: esperar, descartar ou mostrar a killcam. */
export type KillcamGate = 'wait' | 'drop' | 'show';

/**
 * A mensagem de abate chega antes do patch que zera a vida, e o patch pode atrasar além do
 * `delay` (rede). `delay` é só o atraso MÍNIMO: a morte fica pendente até o estado mostrar a
 * morte da MESMA vida (hp 0 com o `life` do abate). O prazo máximo é o renascimento (`life`
 * muda) ou o fim da partida — aí descarta.
 */
export function killcamGate(elapsed: number, deathLife: number, now: { phase: string; life: number; hp: number }): KillcamGate {
  if (now.phase !== 'playing' || now.life !== deathLife) return 'drop';
  if (elapsed < KILLCAM.delay || now.hp > 0) return 'wait';
  return 'show';
}

/** Velocidade da killcam em `x` segundos do tiro fatal (negativo = antes). */
export function killcamSpeed(x: number): number {
  const k = KILLCAM;
  if (x >= k.slowFrom) return k.slow;
  if (x <= k.rampFrom) return k.fast;
  const u = (x - k.rampFrom) / (k.slowFrom - k.rampFrom);
  return k.fast + (k.slow - k.fast) * u * u * (3 - 2 * u);
}

/** A velocidade já é de câmera lenta (o HUD mostra o efeito). */
export function isSlowMotion(speed: number): boolean {
  return speed < 0.75;
}

/** Velocidade da Jogada da Partida no instante `t`, com abates em `marks` e o auge em `peak`. */
export function highlightSpeed(t: number, marks: readonly number[], peak: number): number {
  let speed = 1;
  for (const m of marks) {
    const x = t - m;
    const deep = m === peak;
    const lo = deep ? -0.22 : -0.1;
    const hi = deep ? 0.35 : 0.18;
    const floor = deep ? 0.3 : 0.45;
    const fade = 0.25;
    let s = 1;
    if (x >= lo && x <= hi) s = floor;
    else if (x > lo - fade && x < lo) s = floor + (1 - floor) * ((lo - x) / fade);
    else if (x > hi && x < hi + fade) s = floor + (1 - floor) * ((x - hi) / fade);
    speed = Math.min(speed, s);
  }
  return speed;
}

/** Quanto tempo real leva para tocar de `from` a `to` com a velocidade dada. */
export function realDuration(from: number, to: number, speed: (t: number) => number, step = 1 / 120): number {
  let t = from;
  let real = 0;
  while (t < to) {
    t += step * speed(t);
    real += step;
  }
  return real;
}

/**
 * Corta o começo do trecho até ele caber em `maxReal` segundos reais, sem passar de
 * `keepFrom` (o primeiro abate menos um respiro).
 */
export function fitStart(from: number, to: number, keepFrom: number, maxReal: number, speed: (t: number) => number): number {
  let start = from;
  while (start + 0.1 <= keepFrom && realDuration(start, to, speed) > maxReal) start += 0.1;
  return start;
}
