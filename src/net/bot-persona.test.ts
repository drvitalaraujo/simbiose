// @vitest-environment node
// Decisões puras dos bots: persona por sala, arma pela distância, gatilho de semiautomática,
// recarga pelo pente certo, chinelada de perto/pelas costas e o arremesso que compensa a queda.
import { describe, expect, it } from 'vitest';
import { createRng } from '../sim/rng';
import { SLIPPER } from '../sim/slipper';
import { ARSENAL } from '../sim/weapons';
import { parseOnlineParams } from './client';
import {
  type AmmoView, chooseWeapon, DEFAULT_SKILL, DIFFICULTY, difficultyFrom, isBehind, MELEE_REACH, PERSONAS, pickPersona, type PersonaId,
  reloadFor, SLOT, slipperChoice, throwPitch, triggerFor,
} from './bot-persona';

function ammo(weaponIndex: number, over: Partial<AmmoView> = {}): AmmoView & { reloadRemaining: number } {
  const a = {
    weaponIndex, ammo: ARSENAL[weaponIndex].magazineSize, reserveAmmo: ARSENAL[weaponIndex].reserveAmmo, reloadRemaining: 0,
    ammo0: 30, ammo1: 36, ammo2: 5, ammo3: 6, reserve0: 120, reserve1: 144, reserve2: 20, reserve3: 30,
  };
  return { ...a, ...over };
}

describe('personas', () => {
  it('quatro bots saem com os quatro estilos, e a escolha é determinística', () => {
    const pick = (seed: number) => {
      const rng = createRng(seed);
      const used: PersonaId[] = [];
      for (let i = 0; i < 6; i++) used.push(pickPersona(rng, used).id);
      return used;
    };
    const a = pick(3);
    expect(new Set(a.slice(0, 4)).size).toBe(4);
    expect(pick(3)).toEqual(a);
    expect(new Set([pick(1).join(), pick(2).join(), pick(3).join(), pick(4).join()]).size).toBeGreaterThan(1);
  });

  it('cada persona nasce com uma arma diferente', () => {
    const primaries = Object.values(PERSONAS).map((p) => p.primary);
    expect(new Set(primaries).size).toBe(4);
  });
});

describe('arma pela distância', () => {
  it('atirador: Linha Morta de longe, Faísca quando alguém chega perto', () => {
    const p = PERSONAS.atirador;
    expect(chooseWeapon(p, 40, ammo(SLOT.sniper))).toBe(SLOT.sniper);
    expect(chooseWeapon(p, 6, ammo(SLOT.sniper))).toBe(SLOT.smg);
    // Folga: com a Faísca na mão, só volta para a sniper um pouco mais longe
    expect(chooseWeapon(p, p.closeRange + 1, ammo(SLOT.smg))).toBe(SLOT.smg);
    expect(chooseWeapon(p, p.closeRange + 5, ammo(SLOT.smg))).toBe(SLOT.sniper);
  });

  it('brigão: escopeta de perto, MK-2 para longe; sem alvo, volta para a principal', () => {
    const p = PERSONAS.brigao;
    expect(chooseWeapon(p, 4, ammo(SLOT.mk2))).toBe(SLOT.shotgun);
    expect(chooseWeapon(p, 35, ammo(SLOT.shotgun))).toBe(SLOT.mk2);
    expect(chooseWeapon(p, null, ammo(SLOT.mk2))).toBe(SLOT.shotgun);
  });

  it('pente vazio com inimigo perto: saca outra arma carregada; longe, fica e recarrega', () => {
    const p = PERSONAS.brigao;
    expect(chooseWeapon(p, 5, ammo(SLOT.shotgun, { ammo: 0 }))).toBe(SLOT.mk2);
    expect(chooseWeapon(p, 18, ammo(SLOT.shotgun, { ammo: 0 }))).toBe(SLOT.shotgun);
  });

  it('arma sem munição nenhuma fica de fora', () => {
    expect(chooseWeapon(PERSONAS.atirador, 40, ammo(SLOT.sniper, { ammo: 0, reserveAmmo: 0 }))).not.toBe(SLOT.sniper);
  });
});

describe('gatilho e recarga', () => {
  const dt = 1 / 60;
  it('automática segura o gatilho', () => {
    expect(triggerFor(SLOT.mk2, true, true, 0, dt)).toBe(true);
    expect(triggerFor(SLOT.smg, true, true, 0, dt)).toBe(true);
  });

  it('sniper e escopeta soltam e apertam de novo (e esperam a cadência)', () => {
    for (const slot of [SLOT.sniper, SLOT.shotgun]) {
      expect(triggerFor(slot, true, false, 0, dt)).toBe(true);
      expect(triggerFor(slot, true, true, 0, dt)).toBe(false);
      expect(triggerFor(slot, true, false, 0.5, dt)).toBe(false);
    }
  });

  it('recarrega pelo pente da arma atual, não pelo da MK-2', () => {
    // 5 de 5 na sniper: cheio (a MK-2 recarregaria abaixo de 30)
    expect(reloadFor(ammo(SLOT.sniper, { ammo: 5 }), false, false)).toBe(false);
    expect(reloadFor(ammo(SLOT.sniper, { ammo: 3 }), false, false)).toBe(true);
    expect(reloadFor(ammo(SLOT.smg, { ammo: 31 }), false, false)).toBe(true);
    expect(reloadFor(ammo(SLOT.shotgun, { ammo: 6 }), false, false)).toBe(false);
  });

  it('no combate só recarrega vazio; o R é apertado e solto; sem reserva não tenta', () => {
    expect(reloadFor(ammo(SLOT.mk2, { ammo: 10 }), true, false)).toBe(false);
    expect(reloadFor(ammo(SLOT.mk2, { ammo: 0 }), true, false)).toBe(true);
    expect(reloadFor(ammo(SLOT.mk2, { ammo: 0 }), true, true)).toBe(false);
    expect(reloadFor(ammo(SLOT.mk2, { ammo: 0, reserveAmmo: 0 }), true, false)).toBe(false);
  });
});

describe('chinelo', () => {
  const base = { distance: 10, behind: false, gunBusy: false, slowShot: false, targetHp: 100, ready: true, off: 0.02 };

  it('pelas costas e colado: sempre chinelada', () => {
    expect(slipperChoice(PERSONAS.atirador, { ...base, distance: 1.5, behind: true }, 0.99)).toBe('melee');
  });

  it('de frente e colado: chinelada se a arma não ajuda; senão depende do estilo', () => {
    expect(slipperChoice(PERSONAS.soldado, { ...base, distance: 1.5, gunBusy: true }, 0.99)).toBe('melee');
    expect(slipperChoice(PERSONAS.soldado, { ...base, distance: 1.5 }, 0.99)).toBe(null);
    expect(slipperChoice(PERSONAS.brigao, { ...base, distance: 1.5 }, 0.5)).toBe('melee');
  });

  it('fora do alcance do golpe não tenta chinelada', () => {
    expect(slipperChoice(PERSONAS.brigao, { ...base, distance: MELEE_REACH + 0.5, behind: true }, 0)).not.toBe('melee');
  });

  it('arremesso em média distância cobrindo a recarga ou para finalizar entre tiros lentos', () => {
    expect(slipperChoice(PERSONAS.pressao, { ...base, gunBusy: true }, 0.1)).toBe('throw');
    expect(slipperChoice(PERSONAS.pressao, base, 0.1)).toBe(null);
    expect(slipperChoice(PERSONAS.atirador, { ...base, slowShot: true, targetHp: 20 }, 0.1)).toBe('throw');
    expect(slipperChoice(PERSONAS.pressao, { ...base, gunBusy: true, distance: 40 }, 0)).toBe(null);
    expect(slipperChoice(PERSONAS.pressao, { ...base, gunBusy: true, ready: false }, 0)).toBe(null);
  });

  it('quem está atrás: mesma regra do servidor', () => {
    // Alvo olhando para -z (yaw 0); atrás dele é +z
    expect(isBehind({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 2 })).toBe(true);
    expect(isBehind({ x: 0, z: 0, yaw: 0 }, { x: 0, z: -2 })).toBe(false);
  });

  it('arremesso mira acima para compensar a queda e cai no alvo', () => {
    for (const [h, rise] of [[8, 0], [15, -0.3], [20, 1]] as const) {
      const pitch = throwPitch(h, rise)!;
      expect(pitch).toBeGreaterThan(Math.atan2(rise, h));
      // Trajetória: x = v cos t, y = v sin t − g t²/2
      const t = h / (SLIPPER.speed * Math.cos(pitch));
      const y = SLIPPER.speed * Math.sin(pitch) * t - SLIPPER.gravity * t * t / 2;
      expect(y).toBeCloseTo(rise, 5);
    }
    expect(throwPitch(500, 0)).toBeNull();
  });
});

describe('dificuldade', () => {
  it('normal é a mira de hoje; fácil erra e demora mais; difícil melhora sem perfeição', () => {
    expect(DIFFICULTY.normal.skill).toEqual(DEFAULT_SKILL);
    const { facil, dificil } = DIFFICULTY;
    expect(facil.skill.reaction[0]).toBeGreaterThan(DEFAULT_SKILL.reaction[0]);
    expect(facil.skill.errorSettled).toBeGreaterThan(DEFAULT_SKILL.errorSettled);
    expect(facil.aggression).toBeLessThan(1);
    expect(dificil.skill.errorSettled).toBeLessThan(DEFAULT_SKILL.errorSettled);
    // Ainda humano: reage em ≥ 0,2 s, erra e gira com limite
    expect(dificil.skill.reaction[0]).toBeGreaterThanOrEqual(0.2);
    expect(dificil.skill.errorSettled).toBeGreaterThan(0.005);
    expect(dificil.skill.turnRate).toBeLessThan(10);
  });

  it('texto da sala/URL vira nível (qualquer outra coisa = normal)', () => {
    expect(difficultyFrom('facil')).toBe('facil');
    expect(difficultyFrom('dificil')).toBe('dificil');
    expect(difficultyFrom('impossivel')).toBe('normal');
    expect(difficultyFrom(undefined)).toBe('normal');
    const page = { hostname: 'localhost', protocol: 'http:' };
    expect(parseOnlineParams('?online&dificuldade=dificil', page).difficulty).toBe('dificil');
    expect(parseOnlineParams('?online', page).difficulty).toBe('normal');
  });
});
