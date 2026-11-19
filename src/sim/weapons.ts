// Catálogo puro compartilhado pelo servidor, treino e apresentação. Cada arma reúne
// dano, queda, munição, cadência, espalhamento e mira; weapon.ts executa essas regras.
// A MK-2 conserva os valores congelados por feel.test.ts. A hitbox só diz a parte atingida.
import { SPRINT, WALK } from './player';

/** Parte do corpo atingida (mesmos nomes de characters/hitbox.ts). */
export type BodyPart = 'head' | 'torso' | 'legs';
export type WeaponId = 'mk2' | 'smg' | 'sniper' | 'shotgun';

export interface WeaponSpec {
  id: string;
  name: string;
  /** Dano de um tiro no tronco, até `falloffStart`. */
  bodyDamage: number;
  /** Multiplicador por parte do corpo (tronco = 1). */
  multiplier: Record<BodyPart, number>;
  /** O dano começa a cair a partir desta distância (m)... */
  falloffStart: number;
  /** ...e chega ao mínimo nesta distância (m). */
  falloffEnd: number;
  /** Fração do dano que sobra a partir de `falloffEnd`. */
  falloffMin: number;
}

export interface GunSpec extends WeaponSpec {
  id: WeaponId;
  category: 'Fuzil' | 'SMG' | 'Sniper' | 'Escopeta';
  role: string;
  automatic: boolean;
  fireInterval: number;
  spread: number;
  recoilKick: number;
  range: number;
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number;
  pellets: number;
  aimTime: number;
  aimSpread: number;
  /** Dispersão adicional na velocidade de caminhada, corrida e ao estar no ar. */
  movementSpread: Readonly<{ walk: number; sprint: number; air: number; aimScale: number }>;
  /** Zoom óptico: razão entre as tangentes do meio FOV. */
  zoom: number;
}

/**
 * Gambiarra MK-2, a arma de hoje (9 tiros/s). Com ×4 na cabeça ela matava em ~0.2 s; agora:
 * 20 no tronco (5 tiros), 40 na cabeça (3 tiros), 15 nas pernas. A partir de 18 m o dano cai
 * em linha reta até 60% aos 40 m (benchmark de concorrentes, 2026-10-02).
 */
export const MK2: Readonly<GunSpec> = {
  id: 'mk2',
  name: 'Gambiarra MK-2',
  bodyDamage: 20,
  multiplier: { head: 2, torso: 1, legs: 0.75 },
  falloffStart: 18,
  falloffEnd: 40,
  falloffMin: 0.6,
  category: 'Fuzil', role: 'Versátil · rajadas em média distância', automatic: true,
  fireInterval: 1 / 9, spread: 0.012, recoilKick: 0.014, range: 120,
  magazineSize: 30, reserveAmmo: 120, reloadTime: 1.35, pellets: 1,
  aimTime: 0.18, aimSpread: 0.55, zoom: 1.35,
  movementSpread: { walk: 0.024, sprint: 0.06, air: 0.075, aimScale: 0.7 },
};

/** Índices fazem parte do protocolo: acrescente ao fim, nunca reordene. */
export const ARSENAL: readonly Readonly<GunSpec>[] = [
  MK2,
  { id: 'smg', name: 'Faísca', category: 'SMG', role: 'Pressão de perto · perde força longe',
    bodyDamage: 17, multiplier: { head: 1.8, torso: 1, legs: 0.75 },
    falloffStart: 10, falloffEnd: 28, falloffMin: 0.4,
    automatic: true, fireInterval: 1 / 13, spread: 0.022, recoilKick: 0.009, range: 80,
    magazineSize: 36, reserveAmmo: 144, reloadTime: 1.5, pellets: 1,
    aimTime: 0.14, aimSpread: 0.65, zoom: 1.2,
    movementSpread: { walk: 0.012, sprint: 0.032, air: 0.045, aimScale: 0.8 } },
  { id: 'sniper', name: 'Linha Morta', category: 'Sniper', role: 'Precisão · tronco letal, erro custa tempo',
    bodyDamage: 105, multiplier: { head: 1.5, torso: 1, legs: 0.65 },
    falloffStart: 100, falloffEnd: 160, falloffMin: 0.85,
    automatic: false, fireInterval: 1.45, spread: 0.065, recoilKick: 0.045, range: 200,
    magazineSize: 5, reserveAmmo: 20, reloadTime: 2.4, pellets: 1,
    aimTime: 0.32, aimSpread: 0.01, zoom: 4,
    movementSpread: { walk: 0.05, sprint: 0.11, air: 0.14, aimScale: 1 } },
  { id: 'shotgun', name: 'Quebra-Beco', category: 'Escopeta', role: 'Oito projéteis · domine os corredores',
    bodyDamage: 14, multiplier: { head: 1.25, torso: 1, legs: 0.8 },
    falloffStart: 6, falloffEnd: 20, falloffMin: 0.15,
    automatic: false, fireInterval: 0.8, spread: 0.13, recoilKick: 0.035, range: 45,
    magazineSize: 6, reserveAmmo: 30, reloadTime: 2.1, pellets: 8,
    aimTime: 0.2, aimSpread: 0.85, zoom: 1.15,
    movementSpread: { walk: 0.018, sprint: 0.045, air: 0.06, aimScale: 0.85 } },
];

export function validWeaponIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < ARSENAL.length;
}

export function gunSpec(index = 0): Readonly<GunSpec> {
  return ARSENAL[validWeaponIndex(index) ? index : 0];
}

/** Mesma dispersão na regra do tiro e no indicador da mira. */
export function weaponSpread(index: number, aimAmount: number, onGround = true, speed = 0): number {
  const spec = gunSpec(index);
  const aim = Math.max(0, Math.min(1, aimAmount));
  const profile = spec.movementSpread;
  // Velocidade simulada, nunca a tecla de corrida: soltar Shift não apaga a inércia.
  // Zona estável pequena + curva contínua permitem frear e atirar sem timer escondido.
  const walking = smoothSpeed(speed, 0.5, WALK);
  const sprinting = smoothSpeed(speed, WALK, SPRINT);
  const movement = profile.walk * walking + (profile.sprint - profile.walk) * sprinting;
  // ADS ajuda, mas não elimina o custo de movimento. Slide herda a velocidade real;
  // agachado anda mais devagar e ganha estabilidade sem bônus instantâneo pela tecla.
  const penalty = (movement + (onGround ? 0 : profile.air)) * (1 + (profile.aimScale - 1) * aim);
  return spec.spread * (1 + (spec.aimSpread - 1) * aim) + penalty;
}

function smoothSpeed(speed: number, from: number, to: number): number {
  const t = Math.max(0, Math.min(1, (speed - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Valores de Chinelada aprovados: golpe e arremesso não têm queda por distância. */
export const SLIPPER_DAMAGE = { melee: 50, back: 100, thrown: 60, head: 100 } as const;

/** Fração do dano que chega a `distance` metros (1 perto, `falloffMin` longe). */
export function falloff(spec: WeaponSpec, distance: number): number {
  if (distance <= spec.falloffStart) return 1;
  if (distance >= spec.falloffEnd) return spec.falloffMin;
  const k = (distance - spec.falloffStart) / (spec.falloffEnd - spec.falloffStart);
  return 1 + (spec.falloffMin - 1) * k;
}

/** Dano de um acerto na parte `part` a `distance` metros. */
export function weaponDamage(spec: WeaponSpec, part: BodyPart, distance: number): number {
  return spec.bodyDamage * spec.multiplier[part] * falloff(spec, distance);
}
