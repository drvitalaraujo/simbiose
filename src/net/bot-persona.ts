// Personalidades e dificuldade dos bots (puro, sem Three.js): cada bot tem um estilo de jogo
// (arma preferida, distância que gosta, quanto avança, se segura ângulo, se usa chinelo) e
// a sala tem um nível (fácil/normal/difícil) que mexe na mira e na agressividade. Aqui só
// moram dados e decisões pequenas e testáveis; quem executa é src/net/bot.ts.
import type { Rng } from '../sim/rng';
import { SLIPPER } from '../sim/slipper';
import { gunSpec } from '../sim/weapons';

/** Índices do ARSENAL (protocolo: nunca reordenar). */
export const SLOT = { mk2: 0, smg: 1, sniper: 2, shotgun: 3 } as const;

export interface BotSkill {
  /** Tempo de reação ao ver alguém (s): [mínimo, máximo]. */
  reaction: [number, number];
  /** Giro máximo da mira (rad/s). */
  turnRate: number;
  /** Erro de mira ao ver alguém (rad) e o erro depois de "assentar" a mira. */
  errorStart: number;
  errorSettled: number;
  /** Tempo para assentar a mira (s). */
  settle: number;
  /** Só atira com a mira a menos disto do alvo de verdade (rad). */
  fireCone: number;
  /** Alcance da visão (m) e meia abertura do cone (rad). */
  sight: number;
  fov: number;
}

export const DEFAULT_SKILL: Readonly<BotSkill> = {
  reaction: [0.28, 0.5],
  turnRate: 5,
  errorStart: 0.07,
  errorSettled: 0.018,
  settle: 1.2,
  fireCone: 0.06,
  sight: 70,
  fov: 1.15,
};

export type BotDifficulty = 'facil' | 'normal' | 'dificil';

export interface BotLevel {
  skill: Readonly<BotSkill>;
  /** Multiplica a vontade de avançar/perseguir da persona (0 a 1+). */
  aggression: number;
  /** Multiplica a chance de usar o chinelo. */
  slipper: number;
  /** Pausa extra entre rajadas (s). */
  pause: number;
}

/** Fácil erra mais e demora; difícil acerta mais, mas ainda reage, gira devagar e erra. */
export const DIFFICULTY: Readonly<Record<BotDifficulty, BotLevel>> = {
  facil: {
    skill: { reaction: [0.5, 0.85], turnRate: 3.3, errorStart: 0.12, errorSettled: 0.034, settle: 1.8, fireCone: 0.07, sight: 50, fov: 1 },
    aggression: 0.55, slipper: 0.5, pause: 0.35,
  },
  normal: { skill: DEFAULT_SKILL, aggression: 1, slipper: 1, pause: 0 },
  dificil: {
    skill: { reaction: [0.2, 0.34], turnRate: 7, errorStart: 0.05, errorSettled: 0.011, settle: 0.85, fireCone: 0.05, sight: 80, fov: 1.25 },
    aggression: 1.15, slipper: 1.2, pause: 0,
  },
};

export function difficultyFrom(raw: unknown): BotDifficulty {
  return raw === 'facil' || raw === 'dificil' ? raw : 'normal';
}

export type PersonaId = 'atirador' | 'brigao' | 'pressao' | 'soldado';

export interface BotPersona {
  id: PersonaId;
  /** Arma do dia a dia (nasce com ela e volta para ela). */
  primary: number;
  /** Arma de perto, usada com alvo a menos de `closeRange` m. */
  close?: number;
  closeRange: number;
  /** Arma de longe, usada com alvo a mais de `farRange` m. */
  far?: number;
  farRange: number;
  /** Distância que gosta de manter do alvo (m): [mínimo, máximo]. */
  range: [number, number];
  /** Vontade de avançar/perseguir (0 a 1). */
  aggression: number;
  /** Para de andar para atirar (atirador, soldado) ou atira andando (pressão, brigão). */
  stopToShoot: boolean;
  /** Mira pela arma (ADS) a partir desta distância (Infinity = nunca). */
  adsFrom: number;
  /** Agacha para atirar parado. */
  crouchShoot: boolean;
  /** Força do strafe (0 a 1) e intervalo entre trocas de lado (s). */
  strafe: number;
  strafeEvery: [number, number];
  /** Chance de dar chinelada de frente (pelas costas é sempre) e de arremessar. */
  melee: number;
  throwChance: number;
  /** Prefere pontos altos e segura posição lá (s). */
  high: boolean;
  hold: [number, number];
  /** Contorna o alvo em vez de vir reto. */
  flank: boolean;
  /** Pulos no meio do combate (chance por segundo). */
  hop: number;
  /** Visão a mais (multiplica o alcance). */
  sight: number;
}

const BASE: Omit<BotPersona, 'id' | 'primary'> = {
  closeRange: 0, farRange: Infinity, range: [10, 28], aggression: 0.5, stopToShoot: false, adsFrom: Infinity,
  crouchShoot: false, strafe: 1, strafeEvery: [0.5, 1.3], melee: 0.3, throwChance: 0.35,
  high: false, hold: [0, 0], flank: false, hop: 0, sight: 1,
};

export const PERSONAS: Readonly<Record<PersonaId, Readonly<BotPersona>>> = {
  /** Linha Morta no alto: segura ângulo agachado e com ADS; se chegarem perto, Faísca. */
  atirador: {
    ...BASE, id: 'atirador', primary: SLOT.sniper, close: SLOT.smg, closeRange: 11, range: [16, 80], aggression: 0.15,
    stopToShoot: true, adsFrom: 0, crouchShoot: true, strafe: 0.6, melee: 0.2, throwChance: 0.3,
    high: true, hold: [7, 14], sight: 1.3,
  },
  /** Quebra-Beco nos becos: avança, contorna, desliza e dá chinelada pelas costas. */
  brigao: {
    ...BASE, id: 'brigao', primary: SLOT.shotgun, far: SLOT.mk2, farRange: 22, range: [0, 5], aggression: 1,
    strafe: 0.7, strafeEvery: [0.6, 1.2], melee: 0.75, throwChance: 0.6, flank: true, hop: 0.25,
  },
  /** Faísca colada: aperta o passo, strafe forte e pula no meio da troca. */
  pressao: {
    ...BASE, id: 'pressao', primary: SLOT.smg, far: SLOT.mk2, farRange: 32, range: [5, 13], aggression: 0.8,
    strafe: 1, strafeEvery: [0.3, 0.7], melee: 0.4, throwChance: 0.5, hop: 0.5,
  },
  /** MK-2 de média distância: para para atirar e mira pela arma de longe. */
  soldado: {
    ...BASE, id: 'soldado', primary: SLOT.mk2, close: SLOT.shotgun, closeRange: 4, range: [10, 26], aggression: 0.45,
    stopToShoot: true, adsFrom: 16, throwChance: 0.4,
  },
};

export const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[];

/**
 * Persona do próximo bot: a menos usada entre os bots da sala, sorteada pelo rng da sala
 * (determinística). Quatro bots sempre saem com os quatro estilos.
 */
export function pickPersona(rng: Rng, inUse: readonly (PersonaId | undefined)[]): BotPersona {
  const count = (id: PersonaId) => inUse.filter((u) => u === id).length;
  const least = Math.min(...PERSONA_IDS.map(count));
  const free = PERSONA_IDS.filter((id) => count(id) === least);
  return PERSONAS[free[Math.floor(rng() * free.length) % free.length]];
}

/** Munição de uma arma do inventário (a atual está em `ammo`/`reserveAmmo`). */
export interface AmmoView {
  weaponIndex: number;
  ammo: number;
  reserveAmmo: number;
  ammo0: number; ammo1: number; ammo2: number; ammo3: number;
  reserve0: number; reserve1: number; reserve2: number; reserve3: number;
}

export function ammoIn(a: AmmoView, slot: number): { mag: number; reserve: number } {
  if (slot === a.weaponIndex) return { mag: a.ammo, reserve: a.reserveAmmo };
  const mags = [a.ammo0, a.ammo1, a.ammo2, a.ammo3];
  const reserves = [a.reserve0, a.reserve1, a.reserve2, a.reserve3];
  return { mag: mags[slot] ?? 0, reserve: reserves[slot] ?? 0 };
}

const HYSTERESIS = 3;
/** Com o pente vazio e alguém a menos disto (m), saca outra arma em vez de recarregar. */
const SWAP_RANGE = 14;

/**
 * Arma para a distância do alvo (null = sem alvo: volta à principal). Tem folga para não
 * ficar trocando na fronteira. Com o pente vazio no meio da briga, sacar outra arma
 * carregada é mais rápido que recarregar (como gente faz, se o inimigo está perto). Arma sem bala nenhuma fica de fora.
 */
export function chooseWeapon(persona: BotPersona, distance: number | null, a: AmmoView): number {
  const current = a.weaponIndex;
  let want = persona.primary;
  if (distance !== null) {
    const closeAt = persona.closeRange + (current === persona.close ? HYSTERESIS : 0);
    const farAt = persona.farRange - (current === persona.far ? HYSTERESIS : 0);
    if (persona.close !== undefined && distance < closeAt) want = persona.close;
    else if (persona.far !== undefined && distance > farAt) want = persona.far;
  }
  const has = (slot: number) => { const x = ammoIn(a, slot); return x.mag + x.reserve > 0; };
  const loaded = (slot: number) => ammoIn(a, slot).mag > 0;
  if (distance !== null && distance < SWAP_RANGE && !loaded(want)) {
    // No meio da briga: a outra arma do estilo, senão a MK-2, se tiver pente.
    for (const alt of [current, persona.close, persona.far, persona.primary, SLOT.mk2, SLOT.smg]) {
      if (alt !== undefined && loaded(alt)) return alt;
    }
  }
  if (has(want)) return want;
  for (const alt of [persona.primary, SLOT.mk2, SLOT.smg, SLOT.shotgun, SLOT.sniper]) if (has(alt)) return alt;
  return current;
}

/**
 * Gatilho: automática segura; semiautomática (sniper, escopeta) só dispara na borda, então
 * o bot solta e aperta de novo. `lastFire` = gatilho no tick anterior, `cooldown` = da arma.
 */
export function triggerFor(weaponIndex: number, want: boolean, lastFire: boolean, cooldown: number, dt: number): boolean {
  if (!want) return false;
  if (gunSpec(weaponIndex).automatic) return true;
  return !lastFire && cooldown <= dt + 1e-9;
}

/**
 * Recarga pelo pente da arma ATUAL: sem alvo completa o pente; com alvo só se acabou.
 * A arma reage à borda do R: o bot aperta e solta (`lastReload` = tick anterior).
 */
export function reloadFor(a: AmmoView & { reloadRemaining: number }, inFight: boolean, lastReload: boolean): boolean {
  if (a.reloadRemaining > 0 || a.reserveAmmo <= 0) return false;
  const mag = gunSpec(a.weaponIndex).magazineSize;
  const want = a.ammo < mag && (!inFight || a.ammo === 0);
  return want && !lastReload;
}

/** Quem atacou está atrás do alvo (mesma regra do golpe pelas costas, slipper-combat.ts). */
export function isBehind(target: { x: number; z: number; yaw: number }, from: { x: number; z: number }): boolean {
  const dx = from.x - target.x;
  const dz = from.z - target.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return false;
  return (-Math.sin(target.yaw) * dx - Math.cos(target.yaw) * dz) / d < -0.5;
}

/** Até onde a chinelada pega, a partir do centro do alvo (alcance do golpe menos o corpo). */
export const MELEE_REACH = SLIPPER.meleeRange - 0.25;

export interface SlipperSituation {
  distance: number;
  behind: boolean;
  /** A arma não atira tão cedo: recarregando, pente vazio ou trocando. */
  gunBusy: boolean;
  /** Entre dois tiros lentos (sniper, escopeta). */
  slowShot: boolean;
  targetHp: number;
  ready: boolean;
  /** Mira perto do alvo (rad). */
  off: number;
}

/**
 * Chinelo: golpe colado (sempre pelas costas; de frente quando a arma não ajuda ou pelo
 * estilo) e arremesso em média distância enquanto a arma não atira (mais ainda para finalizar). `roll` é um
 * sorteio em [0, 1) feito de tempos em tempos (não a cada tick).
 */
export function slipperChoice(persona: BotPersona, s: SlipperSituation, roll: number, use = 1): 'melee' | 'throw' | null {
  if (!s.ready) return null;
  if (s.distance <= MELEE_REACH && s.off < 0.35) {
    if (s.behind || s.gunBusy || roll < persona.melee * use) return 'melee';
    return null;
  }
  const finishing = s.targetHp <= SLIPPER.throwDamage;
  if (s.distance >= 5 && s.distance <= 20 && s.off < 0.08 && (s.gunBusy || (finishing && s.slowShot))) {
    if (roll < persona.throwChance * use * (finishing ? 1.5 : 1)) return 'throw';
  }
  return null;
}

/**
 * Inclinação (rad, + para cima) para o chinelo, que cai, acertar um ponto a `horizontal` m
 * e `rise` m acima do olho. Escolhe a trajetória baixa; null se não alcança.
 */
export function throwPitch(horizontal: number, rise: number, speed: number = SLIPPER.speed, gravity: number = SLIPPER.gravity): number | null {
  if (horizontal < 1e-6) return rise >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const v2 = speed * speed;
  const disc = v2 * v2 - gravity * (gravity * horizontal * horizontal + 2 * rise * v2);
  if (disc < 0) return null;
  return Math.atan((v2 - Math.sqrt(disc)) / (gravity * horizontal));
}
