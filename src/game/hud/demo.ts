// Página de demonstração do HUD competitivo (só em dev): localhost:5173/?hud
// Todos os elementos com dados falsos, killfeed/placar/vida/munição animando sozinhos.
// Botões embaixo disparam cada tela. `?hud&cena=placar|morte|vitoria|derrota|empate` abre
// já numa cena (para screenshots); `&limpo` esconde os botões; `&estatico` desliga as
// animações CSS (aba em segundo plano congela animação e rAF). Expõe `window.__hud` e
// `window.__hudDemo.step(segundos)`, que avança a demo na mão (60 passos por segundo).
import { ARENA1 } from '../maps/arena1';
import { CompetitiveHud, damageAngle, setCompetitiveMode } from './index';
import type { KillEvent, MatchEndData, MatchOutcome, PlayerRef, ScoreRow } from './types';

const ME: PlayerRef = { id: 'eu', name: 'Kaia', team: 'a' };
const PLAYERS: PlayerRef[] = [
  ME,
  { id: 'p1', name: 'ZéDaLapa', team: 'a' },
  { id: 'p2', name: 'Bit-7', team: 'a', bot: true },
  { id: 'p3', name: 'SorrisoFixo', team: 'b' },
  { id: 'p4', name: 'Enxame_09', team: 'b', bot: true },
  { id: 'p5', name: 'PremiumPlus', team: 'b' },
];
const WEAPONS = ['Pistola', 'Rifle', 'Escopeta', 'Faca'];

export function startHudDemo() {
  setCompetitiveMode(true);
  const params = new URLSearchParams(location.search);
  const hud = new CompetitiveHud();
  (window as unknown as { __hud: CompetitiveHud }).__hud = hud;
  hud.setLocalPlayer({ id: ME.id, team: ME.team });
  hud.setTeamNames('RESISTÊNCIA', 'SORRIDENTES');
  hud.setWeapon('Pistola');
  hud.setTimer(5 * 60 + 12);
  hud.setRound('TDM 3v3');
  hud.setModeLabel('PRIMEIRO A 30 ABATES');
  hud.setMinimap(ARENA1.solids);

  const rows: ScoreRow[] = PLAYERS.map((p, i) => ({
    ...p,
    kills: [9, 6, 4, 8, 5, 3][i],
    deaths: [4, 5, 6, 5, 7, 6][i],
    assists: [3, 2, 1, 4, 0, 2][i],
    ping: p.bot ? 0 : [24, 48, 0, 71, 0, 133][i],
  }));
  const teamKills = (t: 'a' | 'b') => rows.filter((r) => r.team === t).reduce((s, r) => s + r.kills, 0);
  const refreshScores = () => {
    hud.setScoreboard(rows);
    hud.setTopScores({ value: teamKills('a'), label: 'RESISTÊNCIA' }, { value: teamKills('b'), label: 'SORRIDENTES' });
  };
  refreshScores();

  // Estado falso que anima sozinho
  let hp = 100;
  let shield = 50;
  let mag = 12;
  let reserve = 48;
  let reload = -1;
  let t = 0;
  let nextKill = 0.6;
  let nextShot = 0;
  let nextHurt = 2.5;
  const bots = PLAYERS.slice(1).map((p, i) => ({ p, a: i * 1.3, r: 8 + i * 4 }));

  const randomKill = (): KillEvent => {
    const pick = () => PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
    const killer = pick();
    let victim = pick();
    while (victim.team === killer.team) victim = pick(); // sem fogo amigo
    return { killer, victim, weapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)], headshot: Math.random() < 0.35 };
  };
  const applyKill = (e: KillEvent) => {
    hud.pushKill(e);
    const k = rows.find((r) => r.id === e.killer?.id);
    const v = rows.find((r) => r.id === e.victim.id);
    if (k) k.kills++;
    if (v) v.deaths++;
    refreshScores();
  };

  const tick = (dt: number) => {
    t += dt;
    // Vida/escudo: leva dano de vez em quando e regenera
    nextHurt -= dt;
    if (nextHurt <= 0) {
      nextHurt = 2 + Math.random() * 2.5;
      const dmg = 18 + Math.random() * 20;
      const fromShield = Math.min(shield, dmg);
      shield -= fromShield;
      hp = Math.max(8, hp - (dmg - fromShield));
      const from = { x: Math.cos(t * 3) * 20, z: Math.sin(t * 2) * 20 };
      hud.damageFrom(damageAngle(from, { x: 0, z: 0 }, t * 0.4), 0.6 + Math.random() * 0.4);
    } else {
      hp = Math.min(100, hp + dt * 6);
      if (hp >= 100) shield = Math.min(50, shield + dt * 8);
    }
    hud.setVitals(hp, 100, shield, 50);

    // Munição: atira, recarrega
    nextShot -= dt;
    if (reload >= 0) {
      reload += dt / 1.6;
      if (reload >= 1) {
        const take = Math.min(12 - mag, reserve);
        mag += take;
        reserve = reserve - take || 48;
        reload = -1;
      }
    } else if (nextShot <= 0) {
      nextShot = 0.35;
      mag--;
      hud.hitMarker(Math.random() < 0.25 ? 'head' : 'body');
      if (mag <= 0) {
        mag = 0;
        nextShot = 0.8; // mostra "RECARREGUE" um instante
        setTimeout(() => (reload = 0), 700);
      }
    }
    hud.setAmmo(mag, reserve, 12, reload >= 0, Math.max(0, reload));

    nextKill -= dt;
    if (nextKill <= 0) {
      nextKill = 1.4 + Math.random() * 1.8;
      const e = randomKill();
      if (e.victim.id === ME.id) e.victim = PLAYERS[3]; // a demo não mata você sozinha
      applyKill(e);
      if (e.killer?.id === ME.id) hud.killMarker(e.victim, e.headshot);
    }

    // Minimapa: você girando no meio, os outros andando em círculos
    hud.setMinimapPlayers(
      { x: Math.sin(t * 0.3) * 6, z: 10 + Math.cos(t * 0.3) * 6, yaw: t * 0.6 },
      bots.map((b) => ({
        x: Math.cos(b.a + t * 0.25) * b.r,
        z: Math.sin(b.a + t * 0.25) * b.r - 5,
        rel: b.p.team === ME.team ? 'ally' : 'enemy',
      })),
    );
    // Ping oscilando um pouco (o placar só se refaz se mudar e estiver aberto)
    if (Math.floor(t) !== Math.floor(t - dt)) {
      for (const r of rows) if (!r.bot) r.ping = Math.max(8, Math.round(r.ping + (Math.random() - 0.5) * 8));
      refreshScores();
    }
    hud.update(dt);
  };

  let last = performance.now();
  let paused = false;
  const loop = (now: number) => {
    if (!paused) tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  if (params.has('estatico')) document.body.classList.add('hud-static');

  const endData = (outcome: MatchOutcome): MatchEndData => {
    const a = teamKills('a');
    const b = teamKills('b');
    const me = rows[0];
    return {
      outcome,
      teamScore: outcome === 'draw' ? { a: 30, b: 30 } : outcome === 'win' ? { a: 30, b: Math.min(29, b) } : { a: Math.min(29, a), b: 30 },
      mvp: { ...PLAYERS[0], line: `${me.kills} abates · 62% de precisão · 4 tiros na cabeça` },
      stats: [
        { label: 'Abates', value: String(me.kills) },
        { label: 'Mortes', value: String(me.deaths) },
        { label: 'K/D', value: (me.kills / Math.max(1, me.deaths)).toFixed(2).replace('.', ',') },
        { label: 'Precisão', value: '62%' },
        { label: 'Na cabeça', value: '4' },
        { label: 'Maior sequência', value: '3' },
      ],
      rows,
    };
  };
  const scene = (name: string) => {
    hud.hideMatchEnd();
    hud.hideDeath();
    hud.showScoreboard(false);
    if (name !== 'abate') document.querySelector('.ch-kill')?.classList.remove('show'); // cena limpa no ?estatico
    if (name === 'placar') hud.showScoreboard(true);
    if (name === 'morte') {
      hud.showDeath({ killer: PLAYERS[3], weapon: 'Rifle', headshot: true, respawnIn: 5, killerHp: 34 });
      hud.pushKill({ killer: PLAYERS[3], victim: ME, weapon: 'Rifle', headshot: true });
    }
    if (name === 'vitoria' || name === 'derrota' || name === 'empate') {
      const outcome: MatchOutcome = name === 'vitoria' ? 'win' : name === 'derrota' ? 'loss' : 'draw';
      hud.showMatchEnd(endData(outcome), {
        onPlayAgain: () => {
          hud.hideMatchEnd();
          hud.announce('PARTIDA NOVA', 'Reiniciando sua felicidade em 3… 2… 1… ✨');
        },
        onMenu: () => hud.hideMatchEnd(),
      });
    }
    if (name === 'anuncio') hud.announce('', 'Sua derrota foi otimizada ✨');
    if (name === 'rodada') hud.announce('RODADA 3', 'Lembrete: perder também gera dados valiosos ✨');
    if (name === 'dano') for (const a of [-2.4, -0.6, 0.9, 3]) hud.damageFrom(a);
    if (name === 'abate') {
      hud.killMarker(PLAYERS[4], true);
      setTimeout(() => hud.killMarker(PLAYERS[5]), 600);
    }
  };

  (window as unknown as { __hudDemo: unknown }).__hudDemo = {
    step: (seconds: number) => {
      for (let i = 0; i < Math.round(seconds * 60); i++) tick(1 / 60);
    },
    scene,
    /** Para a animação automática (para montar uma cena na mão). */
    pause: (on = true) => (paused = on),
  };
  if (!params.has('limpo')) controls(scene);
  const start = params.get('cena');
  if (start) setTimeout(() => scene(start), 400); // deixa o killfeed encher um pouco antes
  else setTimeout(() => scene('anuncio'), 800);
}

function controls(scene: (name: string) => void) {
  const bar = document.createElement('div');
  bar.className = 'hud-demo-bar';
  const items: [string, string][] = [
    ['placar', 'Placar (Tab)'],
    ['morte', 'Morte'],
    ['vitoria', 'Vitória'],
    ['derrota', 'Derrota'],
    ['empate', 'Empate'],
    ['anuncio', 'Anúncio'],
    ['rodada', 'Rodada'],
    ['dano', 'Dano'],
    ['abate', 'Abate'],
    ['', 'Limpar'],
  ];
  for (const [id, label] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => scene(id));
    bar.append(b);
  }
  document.body.append(bar);
}
