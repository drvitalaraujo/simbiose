import { Game } from './game/game';
import { Menu, mapFromSearch, onlineSearch, onPlay, PauseOverlay, resolveArenaMap, settings, withQualityPref, type PlayRequest } from './game/menu';
import { shouldAutoOpen } from './game/tutorial-steps';
import { tutorialSeen } from './game/tutorial';
import { setCameraMotionScale } from './game/movement-camera';
import type { OnlineGame } from './game/online';
import { onlineSoundtrack, trainingSoundtrack } from './game/audio/soundtrack-links';
import type { Room } from '@colyseus/sdk';
import type { ArenaState } from './net/schema';
import type { BenchedMsg } from './net/spectate';

// `let`: o Modo Live troca o canvas quando o espectador da fila vira jogador
let canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const debug = import.meta.env.DEV && params.has('debug');
const online = params.has('online');

// Desvios da página (preserve todos ao mexer aqui):
//   ?characters  bonecos + hitboxes (dev)        ?hud     demonstração do HUD competitivo (dev)
//   ?online      multiplayer (npm run server)    ?debug   pula menu/tela de entrada, expõe __game
//   ?online&live Modo Live: anfitrião assiste e mostra o convite (debug expõe __spectator)
if (import.meta.env.DEV && params.has('characters')) {
  void import('./game/characters/page').then((m) => m.startCharacterPage(canvas));
} else if (import.meta.env.DEV && params.has('hud')) {
  startHudDemo();
} else if (online && params.has('live')) {
  void import('./game/spectator/entry').then((m) => m.startLive(canvas, debug));
} else if (online) {
  void createOnline();
} else {
  startTraining();
}

/**
 * Treino (drones). `usePrefs` aplica mapa, qualidade, sensibilidade e FOV salvos no menu;
 * fica desligado nas páginas de teste (`?debug`, `?hud`), que precisam abrir sempre iguais
 * para os agentes (o Chrome deles é o mesmo do dono).
 */
function createTraining(usePrefs: boolean): Game {
  const store = settings();
  // O Treino é no Bairro; outro mapa só pelo link (`?map=`). O mapa salvo no menu é o da Arena.
  const game = usePrefs ? withQualityPref(store, () => new Game(canvas)) : new Game(canvas);
  if (usePrefs) {
    const apply = () => {
      game.inputRef.sensitivity = store.get().sensitivity;
      game.baseFov = store.get().fov;
      game.sfx.setVolume(store.get().volume / 100);
      setCameraMotionScale(cameraMotion(store.get().reducedMotion));
    };
    apply();
    store.onChange(apply);
  }
  game.start();
  return game;
}

/** "Movimento de câmera reduzido" (menu): ~30% do balanço, inclinação, FOV dinâmico e tremor. */
function cameraMotion(reduced: boolean): number {
  return reduced ? 0.3 : 1;
}

/**
 * Online: import dinâmico (o treino não baixa a rede). A lógica é do `OnlineGame`. Tudo que a
 * página liga ao jogo entra em `teardown`: na troca jogador ↔ espectador (fila e rodízio do
 * Modo Live) o jogo descartado não deixa ouvinte, assinatura nem laço de quadro vivo.
 */
async function createOnline(room?: Room<unknown, ArenaState>): Promise<OnlineGame> {
  const { OnlineGame } = await import('./game/online');
  const { createAvatar } = await import('./game/online-avatar');
  const game = new OnlineGame(canvas, undefined, createAvatar, room);
  const teardown: (() => void)[] = [];
  const soundtrack = onlineSoundtrack(game, { store: debug ? null : settings(), debug }); // trilha e ambiente (W2)
  teardown.push(() => soundtrack.dispose()); // o jogo novo, ao ganhar a vaga, liga a própria trilha
  // Sala cheia de gente (ou perdeu no rodízio): assiste na fila e volta quando abrir vaga
  const toSpectator = (seat: Room<unknown, ArenaState>, benched?: BenchedMsg) => {
    for (const off of teardown.splice(0)) off();
    game.dispose(false); // a sala continua: a mesma conexão vira espectadora
    void import('./game/spectator/entry').then((m) => {
      canvas = m.freshCanvas(canvas);
      m.watchUntilSeat(canvas, seat, debug, (fresh, joined) => {
        canvas = fresh;
        void createOnline(joined);
      }, benched);
    });
  };
  game.onSpectate = (seat) => toSpectator(seat);
  game.onBench = (seat, msg) => toSpectator(seat, msg);
  // Outra participação na mesma conexão (banco e vaga de novo enquanto a conexão caiu): jogo novo
  game.onReseat = (seat) => {
    for (const off of teardown.splice(0)) off();
    game.dispose(false);
    void import('./game/spectator/entry').then((m) => {
      canvas = m.freshCanvas(canvas);
      void createOnline(seat);
    });
  };
  if (!debug) {
    const apply = () => {
      game.inputRef.sensitivity = settings().get().sensitivity;
      game.sfx.setVolume(settings().get().volume / 100);
      setCameraMotionScale(cameraMotion(settings().get().reducedMotion));
    };
    apply();
    const unsubscribe = settings().onChange(apply);
    window.addEventListener('pagehide', unsubscribe, { once: true });
    teardown.push(() => {
      unsubscribe();
      window.removeEventListener('pagehide', unsubscribe);
    });
  }
  game.start();
  startOnline(game, teardown);
  return game;
}

/** Expõe o jogo em `?debug`; devolve a função que solta o clique do canvas. */
function exposeForTests(game: Game | OnlineGame): () => void {
  game.inputRef.locked = true;
  (window as unknown as { __game: Game | OnlineGame }).__game = game;
  const target = canvas;
  const unlock = () => game.sfx.unlock();
  target.addEventListener('click', unlock);
  return () => target.removeEventListener('click', unlock);
}

function startTraining() {
  const store = settings();
  const game = createTraining(!debug);
  trainingSoundtrack(game, mapFromSearch(location.search), canvas, { store: debug ? null : store, debug });
  const menu = new Menu({
    root: document.getElementById('menu')!,
    store,
    // Ligados: sensibilidade, FOV, volume (mixer), qualidade (?low) e movimento de câmera reduzido.
    wiring: { live: { sensitivity: true, fov: true, volume: true, quality: true, music: true, reducedMotion: true } },
    onTutorial: () => {
      game.startTutorial(goArena);
      game.sfx.unlock();
      game.inputRef.lock();
    },
  });
  if (!debug) store.set({ map: mapFromSearch(location.search) });

  // Treino = o modo de drones de sempre: trava o mouse e o jogo começa. Na primeira vez,
  // o Teste de Admissão (tutorial) abre sozinho.
  onPlay('training', () => {
    if (!menu.isTrainingStarted && shouldAutoOpen({ debug, forced: false, seen: tutorialSeen() })) game.startTutorial(goArena);
    game.sfx.unlock();
    game.inputRef.lock();
  });
  // Jogar (FFA) e Duelo por link: recarrega no modo online com apelido e mapa
  const goOnline = ({ nickname, map, mode }: PlayRequest) => {
    if (mode === 'training' || mode === 'live') return;
    location.search = onlineSearch(location.search, nickname, map, mode, store.get().difficulty);
  };
  onPlay('ffa', goOnline);
  onPlay('duel', goOnline);
  onPlay('tdm', goOnline);
  onPlay('hack', goOnline);
  // Modo Live: cria a sala e assiste como anfitrião (QR do convite para a audiência)
  onPlay('live', ({ nickname, map }) => {
    location.search = `${onlineSearch(location.search, nickname, map, 'ffa', store.get().difficulty)}&live`;
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    menu.setVisible(!locked);
    if (locked) menu.setTrainingStarted(true);
  });

  // Modo de teste para agentes/automação (navegador controlado não aceita pointer lock):
  // localhost:5173/?debug joga sem travar o mouse e expõe `window.__game`.
  if (debug) {
    menu.setVisible(false);
    exposeForTests(game);
    if (params.has('tutorial')) game.startTutorial(goArena); // ?debug&tutorial força o teste
  }
}

/** Fim do tutorial: Arena no mapa escolhido no menu (sorteia se for "aleatório"). */
function goArena() {
  const s = settings().get();
  location.search = onlineSearch(location.search, s.nickname, resolveArenaMap(s.arenaMap), 'ffa', s.difficulty);
}

function startOnline(game: OnlineGame, teardown: (() => void)[]) {
  // Sem menu: só a tela "ENTRAR NA PARTIDA" enquanto o mouse está solto
  const overlay = new PauseOverlay(document.getElementById('menu')!, () => {
    game.sfx.unlock();
    game.inputRef.lock();
  });
  const updateOverlay = () => {
    const st = game.session?.room.state;
    if (st) overlay.setInfo({ map: st.mapId, mode: st.mode, difficulty: params.get('dificuldade') ?? (params.has('sala') ? 'sala' : null) });
    overlay.setVisible(!debug && game.session?.room.state.phase !== 'ended' && document.pointerLockElement !== canvas);
  };
  document.addEventListener('pointerlockchange', updateOverlay);
  game.events.on('match', updateOverlay); // `game.dispose()` limpa os eventos do jogo
  teardown.push(() => {
    document.removeEventListener('pointerlockchange', updateOverlay);
    overlay.dispose(); // o botão de entrar referencia o jogo descartado
  });
  if (debug) {
    overlay.setVisible(false);
    teardown.push(exposeForTests(game));
  }
}

function startHudDemo() {
  // O mundo renderizado atrás (sem jogar) dá o contexto real; o menu fica escondido.
  createTraining(false);
  document.getElementById('menu')!.classList.add('hidden');
  void import('./game/hud/demo').then((m) => m.startHudDemo());
}
