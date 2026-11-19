// Gestos por arma, puros (sem Three.js): recarga, ciclo do ferrolho da sniper e
// bombeamento da escopeta. Tempo normalizado: `t` de 0 a 1 na recarga; segundos no ciclo.

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smooth = (t: number) => {
  const k = clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
};
/** Janela suave: sobe de a até b e desce de c até d. */
export const window4 = (t: number, a: number, b: number, c: number, d: number) => smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));

/** Saída da recarga: raiz da arma, carregador, mão de apoio, célula e ferrolho. */
export interface ReloadOut {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rz: number;
  bolt: number;
  boltLift: number;
  magY: number;
  magZ: number;
  magRx: number;
  handX: number;
  handY: number;
  handZ: number;
  cell: number;
}

export const restReload = (): ReloadOut => ({
  x: 0, y: 0, rx: 0, ry: 0, rz: 0, bolt: 0, boltLift: 0, magY: 0, magZ: 0, magRx: 0, handX: 0, handY: 0, handZ: 0, cell: 1,
});

/** Quanto cada arma inclina para mostrar o carregador (rad) e como fecha o ferrolho. */
const STYLE = [
  { rz: -0.6, rx: 0.22, drop: 0.22, lift: false }, // MK-2: rola a barriga para o meio da tela
  { rz: -0.75, rx: 0.16, drop: 0.24, lift: false }, // Faísca: giro mais seco e largo
  { rz: -0.42, rx: 0.26, drop: 0.16, lift: true }, // Linha Morta: carregador curto, ferrolho manual no fim
];

/**
 * Carregador (MK-2, Faísca e Linha Morta): inclina a arma, a mão de apoio vai ao carregador,
 * tira, traz um novo, encaixa com um tapa, a célula reacende e o ferrolho estala.
 */
export function magazineReload(t: number, weaponIndex: number, out: ReloadOut): ReloadOut {
  const s = STYLE[weaponIndex] ?? STYLE[0];
  const tilt = window4(t, 0, 0.14, 0.78, 1);
  out.rz = tilt * s.rz;
  out.rx = tilt * s.rx;
  out.ry = -tilt * 0.1;
  out.y = tilt * 0.035;
  out.x = -tilt * 0.04;
  // Carregador: sai para baixo (0.18–0.36), some, volta (0.45–0.62) e encaixa (0.62–0.68)
  const out1 = smooth((t - 0.18) / 0.18);
  const in1 = smooth((t - 0.45) / 0.17);
  const gone = out1 * (1 - in1);
  out.magY = -gone * s.drop;
  out.magZ = gone * 0.04;
  out.magRx = gone * 0.5;
  const seat = window4(t, 0.6, 0.64, 0.66, 0.74);
  out.y += seat * 0.012;
  out.rx += seat * 0.06;
  // Mão de apoio: vai ao carregador, desce junto, volta com o novo
  const toMag = window4(t, 0.06, 0.18, 0.7, 0.82);
  out.handX = toMag * 0.01;
  out.handY = toMag * -0.06 + out.magY * 0.9;
  out.handZ = toMag * 0.11 + out.magZ;
  out.handY += window4(t, 0.56, 0.62, 0.64, 0.72) * 0.02; // tapa por baixo
  if (s.lift) {
    // Ferrolho manual: levanta, recua, avança e abaixa; a arma rola para mostrar
    out.boltLift = window4(t, 0.76, 0.8, 0.92, 0.96);
    out.bolt = window4(t, 0.8, 0.84, 0.88, 0.92);
    out.rz += out.boltLift * 0.12;
  } else {
    out.bolt = window4(t, 0.79, 0.81, 0.84, 0.9);
  }
  out.cell = 1 - gone + seat * 1.5;
  return out;
}

/** Escopeta: rola a janela de carga para cima e empurra três cartuchos. */
export function shellReload(t: number, out: ReloadOut): ReloadOut {
  const reach = window4(t, 0.06, 0.2, 0.82, 1);
  const insert = Math.pow(Math.sin(clamp((t - 0.2) / 0.6, 0, 1) * Math.PI * 3), 2) * reach;
  out.rz = reach * 0.32;
  out.rx = reach * 0.12;
  out.y = reach * 0.02;
  out.x = -reach * 0.02;
  out.handX = -0.025 * reach;
  out.handY = -0.065 * reach + insert * 0.025;
  out.handZ = 0.14 * reach;
  out.y += insert * 0.004; // cada cartucho dá um tranquinho
  return out;
}

/** Ciclo do ferrolho manual depois do tiro (s): levanta, recua, avança, abaixa. */
export function boltCycle(since: number): { lift: number; back: number } {
  return {
    lift: window4(since, 0.3, 0.37, 0.66, 0.73),
    back: window4(since, 0.37, 0.46, 0.55, 0.66),
  };
}

/** Bombeamento da escopeta depois do tiro (s). */
export const pumpCycle = (since: number) => window4(since, 0.12, 0.26, 0.36, 0.53);

/** Momento em que a cápsula sai (s após o tiro): no recuo do ferrolho ou da telha. */
export const EJECT_DELAY = [0, 0, 0.44, 0.24];
