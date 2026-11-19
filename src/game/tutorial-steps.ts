// Passos do "Teste de Admissão da Resistência" (tutorial do Treino), em lógica pura: o que
// cada passo pede, as falas da Kaia e do Bit e como cada sinal do jogo conta para a meta.
// Quem observa o jogo e manda os sinais é o `tutorial.ts`.

export type Speaker = 'KAIA' | 'BIT';

/** Papel de um alvo de treino (diz qual regra vale quando ele cai). */
export type TargetRole = 'basic' | 'aim' | 'far' | 'near' | 'dummy' | 'pane';

/**
 * Índices de arma do ARSENAL (src/sim/weapons.ts): 2 = sniper, 3 = escopeta. As teclas seguem a
 * barra de armas (arsenal.ts): 1 escopeta, 2 SMG, 3 fuzil, 4 sniper.
 */
export const SNIPER = 2;
export const SHOTGUN = 3;

/** O que o jogo observou num tick (o tutorial.ts traduz estado/eventos nisto). */
export type TutorialSignal =
  | { type: 'moved'; meters: number; walking: boolean }
  | { type: 'targetDown'; role: TargetRole; weapon: number; aiming: boolean }
  | { type: 'reload' }
  | { type: 'crouch' }
  | { type: 'melee'; back: boolean }
  | { type: 'throw' }
  | { type: 'pickup' }
  | { type: 'hack' };

export interface TargetSpec {
  role: TargetRole;
  /** Distância à frente do jogador no começo do passo (m). */
  distance: number;
  /** Deslocamento lateral (m, + = direita). */
  side?: number;
  /** Altura do centro acima do olho do jogador (m). */
  rise?: number;
  /** `away`: de costas para o jogador (o boneco da chinelada). */
  facing?: 'player' | 'away';
  /** Vida em "tiros de fuzil" (a vida dos drones; 1 = em pane). */
  hp: number;
}

export interface StepHint {
  keys: string[];
  text: string;
}

export interface StepDef {
  id: string;
  title: string;
  speaker: Speaker;
  line: string;
  hints: StepHint[];
  /** Metas: chave → quanto precisa (metros, alvos, ações). */
  goals: Record<string, number>;
  /** Fala de celebração ao passar. */
  praise: string;
  targets: TargetSpec[];
}

export const STEPS: readonly StepDef[] = [
  {
    id: 'move', title: 'ANDAR EM SILÊNCIO', speaker: 'KAIA',
    line: 'Teste de Admissão da Resistência. Primeiro: prove que você anda. A OTIMIZA adora alvo parado.',
    hints: [{ keys: ['W', 'A', 'S', 'D'], text: 'andar' }, { keys: ['SHIFT'], text: 'andar sem fazer passos' }],
    goals: { walk: 6, silent: 8 },
    praise: 'Passos leves. A OTIMIZA vai ter que prestar atenção.',
    targets: [],
  },
  {
    id: 'shoot', title: 'ATIRAR', speaker: 'BIT',
    line: 'Três drones de treino. Desligados, não revidam. Ao contrário dos de verdade.',
    hints: [{ keys: ['mouseL'], text: 'atirar' }],
    goals: { basic: 3 },
    praise: 'Três a zero. Os drones vão abrir chamado no suporte.',
    targets: [
      { role: 'basic', distance: 11, side: -4, rise: 0.4, hp: 3 },
      { role: 'basic', distance: 13, side: 0, rise: 1.2, hp: 3 },
      { role: 'basic', distance: 11, side: 4, rise: 0.4, hp: 3 },
    ],
  },
  {
    id: 'aim', title: 'MIRAR', speaker: 'KAIA',
    line: 'Aquele lá longe pede calma. Segure o botão direito para mirar e derrube MIRANDO.',
    hints: [{ keys: ['mouseR'], text: 'segure para mirar' }, { keys: ['mouseL'], text: 'atirar' }],
    goals: { aimed: 1 },
    praise: 'Mira de quem já foi demitido por excesso de precisão.',
    targets: [{ role: 'aim', distance: 26, rise: 1, hp: 3 }],
  },
  {
    id: 'swap', title: 'TROCAR DE ARMA', speaker: 'BIT',
    line: 'Cada problema, uma ferramenta. O de longe pede a Linha Morta; o de perto, a escopeta.',
    hints: [{ keys: ['4'], text: 'sniper (longe)' }, { keys: ['1'], text: 'escopeta (perto)' }, { keys: ['3'], text: 'volta ao fuzil' }],
    goals: { far: 1, near: 1 },
    praise: 'Arsenal completo. Kaia está quase orgulhosa. Quase.',
    targets: [
      { role: 'far', distance: 45, rise: 1.5, hp: 4 },
      { role: 'near', distance: 5, side: 2.5, rise: 0, hp: 3 },
    ],
  },
  {
    id: 'reload', title: 'RECARREGAR', speaker: 'KAIA',
    line: 'Pente vazio na Arena é bilhete de volta ao spawn. Recarregue antes de precisar.',
    hints: [{ keys: ['R'], text: 'recarregar (gaste uns tiros antes)' }],
    goals: { reload: 1 },
    praise: 'Recarregou sem ninguém mandar. Maturidade.',
    targets: [],
  },
  {
    id: 'crouch', title: 'AGACHAR', speaker: 'BIT',
    line: 'Segure C ou Ctrl para agachar e usar coberturas baixas.',
    hints: [{ keys: ['C', 'CTRL'], text: 'segure para agachar' }],
    goals: { crouch: 1 },
    praise: 'Boa. Cobertura baixa também é cobertura.',
    targets: [],
  },
  {
    id: 'melee', title: 'CHINELADA', speaker: 'KAIA',
    line: 'O boneco de treino está distraído. Dê a volta e acerte uma chinelada PELAS COSTAS.',
    hints: [{ keys: ['V'], text: 'chinelada (pelas costas dói o dobro)' }],
    goals: { back: 1 },
    praise: 'PÁÁÁ! A chinelada da vó: a arma mais antiga da resistência.',
    targets: [{ role: 'dummy', distance: 6, rise: -0.3, facing: 'away', hp: 99 }],
  },
  {
    id: 'throw', title: 'ARREMESSAR O CHINELO', speaker: 'BIT',
    line: 'O chinelo também voa. Arremesse com G e depois vá buscar: chinelo não nasce em árvore.',
    hints: [{ keys: ['G'], text: 'arremessar' }, { keys: ['W', 'A', 'S', 'D'], text: 'passe por cima para recolher' }],
    goals: { throw: 1, pickup: 1 },
    praise: 'Arremessou e recolheu. Sustentável e ofensivo.',
    targets: [],
  },
  {
    id: 'hack', title: 'HACKEAR', speaker: 'KAIA',
    line: 'Drone em pane: a cara treme. Mire nele e segure E. A OTIMIZA chama de furto; nós, de reciclagem.',
    hints: [{ keys: ['E'], text: 'segure mirando no drone em pane' }],
    goals: { hack: 1 },
    praise: 'Ele é nosso agora. Dê um nome. Ou não, eles duram pouco.',
    targets: [{ role: 'pane', distance: 6, rise: 0.6, hp: 1 }],
  },
];

export const FINAL_LINE = 'Admissão aprovada. Bem-vindo à Resistência. Pronto para a Arena?';

export interface TutorialProgress {
  index: number;
  counts: Record<string, number>;
  done: boolean;
}

export type Outcome =
  | { kind: 'none' }
  | { kind: 'progress' }
  | { kind: 'passed'; step: StepDef; finished: boolean }
  | { kind: 'wrong'; line: string; role?: TargetRole };

export function createProgress(): TutorialProgress {
  return { index: 0, counts: {}, done: false };
}

export function currentStep(p: TutorialProgress): StepDef | null {
  return p.done ? null : STEPS[p.index] ?? null;
}

/** Fração cumprida do passo atual (0 a 1), média das metas. */
export function stepFraction(p: TutorialProgress): number {
  const step = currentStep(p);
  if (!step) return 1;
  const keys = Object.keys(step.goals);
  return keys.reduce((sum, k) => sum + Math.min(1, (p.counts[k] ?? 0) / step.goals[k]), 0) / keys.length;
}

/** Pula para o passo seguinte (botão "pular passo"). */
export function skipStep(p: TutorialProgress): Outcome {
  const step = currentStep(p);
  if (!step) return { kind: 'none' };
  return advance(p, step);
}

/** Aplica um sinal ao passo atual. */
export function feed(p: TutorialProgress, s: TutorialSignal): Outcome {
  const step = currentStep(p);
  if (!step) return { kind: 'none' };
  const r = rule(step.id, s, p.counts);
  if (!r) return { kind: 'none' };
  if ('wrong' in r) return { kind: 'wrong', line: r.wrong, role: r.role };
  p.counts[r.key] = (p.counts[r.key] ?? 0) + r.amount;
  const met = Object.entries(step.goals).every(([k, n]) => (p.counts[k] ?? 0) >= n);
  return met ? advance(p, step) : { kind: 'progress' };
}

function advance(p: TutorialProgress, step: StepDef): Outcome {
  p.index += 1;
  p.counts = {};
  p.done = p.index >= STEPS.length;
  return { kind: 'passed', step, finished: p.done };
}

type Rule = { key: string; amount: number } | { wrong: string; role?: TargetRole } | null;

/** Como um sinal conta em cada passo. */
function rule(step: string, s: TutorialSignal, counts: Record<string, number>): Rule {
  switch (step) {
    case 'move':
      if (s.type !== 'moved') return null;
      return s.walking ? { key: 'silent', amount: s.meters } : { key: 'walk', amount: s.meters };
    case 'shoot':
      return s.type === 'targetDown' && s.role === 'basic' ? { key: 'basic', amount: 1 } : null;
    case 'aim':
      if (s.type !== 'targetDown' || s.role !== 'aim') return null;
      return s.aiming ? { key: 'aimed', amount: 1 } : { wrong: 'Sem mirar não vale! Segure o botão direito. Ele volta.', role: 'aim' };
    case 'swap':
      if (s.type !== 'targetDown') return null;
      if (s.role === 'far') return s.weapon === SNIPER ? { key: 'far', amount: 1 } : { wrong: 'Esse pedia a SNIPER (tecla 4). Reiniciando o alvo...', role: 'far' };
      if (s.role === 'near') return s.weapon === SHOTGUN ? { key: 'near', amount: 1 } : { wrong: 'De perto é ESCOPETA (tecla 1). De novo!', role: 'near' };
      return null;
    case 'reload':
      return s.type === 'reload' ? { key: 'reload', amount: 1 } : null;
    case 'crouch':
      return s.type === 'crouch' ? { key: 'crouch', amount: 1 } : null;
    case 'melee':
      if (s.type !== 'melee') return null;
      return s.back ? { key: 'back', amount: 1 } : { wrong: 'Pela frente ele te viu! Dê a volta: PELAS COSTAS.' };
    case 'throw':
      if (s.type === 'throw') return { key: 'throw', amount: 1 };
      // Recolher só conta depois de arremessar neste passo
      if (s.type === 'pickup') return (counts.throw ?? 0) > 0 ? { key: 'pickup', amount: 1 } : null;
      return null;
    case 'hack':
      return s.type === 'hack' ? { key: 'hack', amount: 1 } : null;
    default:
      return null;
  }
}

/** Chave do localStorage: o tutorial já abriu sozinho uma vez. */
export const SEEN_KEY = 'simbiose.tutorial.v1';

/**
 * Abrir sozinho? Só na primeira vez no Treino; nunca em `?debug` (os agentes testam sempre
 * igual), a não ser com `&tutorial`, que força.
 */
export function shouldAutoOpen(o: { debug: boolean; forced: boolean; seen: boolean }): boolean {
  if (o.forced) return true;
  if (o.debug) return false;
  return !o.seen;
}
