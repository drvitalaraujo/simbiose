// Liga a trilha ao jogo pelo lado de fora: momentos do Sfx (tiro, acerto, dano, morte,
// onda), eventos do online e o estado da sala. Nenhuma classe de jogo conhece a música.
import { isBossWave } from '../brain';
import type { Game } from '../game';
import type { SettingsStore } from '../menu/settings';
import type { OnlineGame } from '../online';
import type { Sfx, SfxCue } from './sfx';
import { gapThreshold, styleForMap } from './music-patterns';
import { Soundtrack } from './soundtrack';

interface LinkOptions {
  /** Preferências salvas (null em `?debug`: volume padrão, igual ao resto do áudio). */
  store: SettingsStore | null;
  debug: boolean;
}

const MUSIC_DEFAULT = 0.6;

function create(sfx: Sfx, { store, debug }: LinkOptions): Soundtrack {
  const track = new Soundtrack(sfx.mixer);
  const apply = () => track.setVolume(store ? store.get().music / 100 : MUSIC_DEFAULT);
  apply();
  const off = store?.onChange(apply);
  // Autoplay exige gesto: o primeiro clique/tecla na página já destrava o áudio (música do menu).
  const unlock = () => {
    sfx.unlock();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  // `dispose()` também desfaz a ligação (preferências, gesto, saída da página): a troca
  // jogador ↔ espectador do Modo Live não deixa o jogo descartado preso aqui.
  const halt = track.dispose.bind(track);
  const unlink = () => {
    off?.();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('pagehide', unlink);
    halt();
  };
  track.dispose = unlink;
  window.addEventListener('pagehide', unlink, { once: true });
  if (debug) (window as unknown as { __music: Soundtrack }).__music = track;
  return track;
}

/** Cadeia comum: combate, abate, morte e renascimento vêm dos sons que o jogo já toca. */
function listen(sfx: Sfx, track: Soundtrack, extra: (cue: SfxCue) => void) {
  sfx.onCue = cue => {
    if (cue === 'shot' || cue === 'hit' || cue === 'hurt') track.combat();
    else if (cue === 'kill') { track.combat(); track.stinger('kill'); }
    else if (cue === 'win' || cue === 'lose') track.stinger(cue);
    extra(cue);
  };
}

/** Treino: menu toca o tema; jogando, o estilo do mapa. Ondas e chefe sobem a intensidade. */
export function trainingSoundtrack(game: Game, map: string, canvas: HTMLCanvasElement, options: LinkOptions): Soundtrack {
  const track = create(game.sfx, options);
  const style = styleForMap(map);
  let wave = 0;
  let dead = false;
  let started = false;
  listen(game.sfx, track, cue => {
    if (cue === 'wave') { wave++; track.combat(); }
    else if (cue === 'death') { dead = true; track.setDead(true); track.stinger('lose'); }
    else if (cue === 'reset') {
      wave = 0;
      if (dead) { dead = false; track.setDead(false); track.stinger('start'); }
    }
  });
  const playing = () => options.debug || document.pointerLockElement === canvas;
  track.setContext(() => {
    const on = playing();
    if (on && !started) { started = true; track.stinger('start'); }
    return { style: on ? style : 'menu', scene: on ? style : null, boss: isBossWave(wave) };
  });
  return track;
}

/** Online: estilo pelo mapa da sala; tensão no último minuto ou com alguém perto do limite. */
export function onlineSoundtrack(game: OnlineGame, options: LinkOptions): Soundtrack {
  const track = create(game.sfx, options);
  listen(game.sfx, track, cue => {
    if (cue === 'death') track.setDead(true);
    else if (cue === 'reset') track.setDead(false);
  });
  game.events.on('match', e => {
    if (e.phase === 'playing') { track.setDead(false); track.stinger('start'); }
  });
  track.setContext(() => {
    const st = game.session?.room.state;
    if (!st) return { style: 'menu', scene: null, idle: true };
    const style = styleForMap(st.mapId);
    const team = st.mode === 'tdm' || st.mode === 'hack';
    let best = 0;
    if (team) best = Math.max(st.scoreA ?? 0, st.scoreB ?? 0);
    else st.players.forEach(p => { best = Math.max(best, p.kills); });
    return {
      style, scene: style, idle: st.phase !== 'playing', timeLeft: st.timeLeft,
      leaderGap: st.killLimit > 0 ? st.killLimit - best : null, gapThreshold: gapThreshold(st.killLimit, st.mode),
    };
  });
  return track;
}
