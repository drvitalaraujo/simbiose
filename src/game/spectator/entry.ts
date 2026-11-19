// Entradas do Modo Live: o anfitrião (`?online&live`) cria a sala e assiste com a tela de
// transmissão; quem chega pelo convite numa sala cheia assiste na fila e vira jogador na
// mesma conexão quando abrir a vaga (o main.ts liga o jogo num canvas novo).
import type { Room } from '@colyseus/sdk';
import { inviteLink, joinRoom, parseOnlineParams, waitForRole, withRoom } from '../../net/client';
import type { ArenaState } from '../../net/schema';
import type { BenchedMsg } from '../../net/spectate';
import { el } from '../hud/dom';
import { injectSpectatorStyle } from './style';
import { SpectatorView } from './view';

function expose(view: SpectatorView, debug: boolean) {
  if (debug) (window as unknown as { __spectator: SpectatorView }).__spectator = view;
}

function hideMenu() {
  document.getElementById('menu')?.classList.add('hidden');
}

/** Canvas novo no lugar do antigo (contexto WebGL limpo para o próximo renderizador). */
export function freshCanvas(old: HTMLCanvasElement): HTMLCanvasElement {
  const fresh = old.cloneNode(false) as HTMLCanvasElement;
  old.replaceWith(fresh);
  return fresh;
}

/** `?online&live` (+ `&mapa=`): cria a sala (ou volta para ela com `&sala=`) e assiste como anfitrião. */
export async function startLive(canvas: HTMLCanvasElement, debug: boolean): Promise<SpectatorView | null> {
  hideMenu();
  injectSpectatorStyle();
  const params = parseOnlineParams(location.search, location);
  const status = el('div', 'sp-status', `Abrindo a sala da live em ${params.endpoint}…`);
  document.body.append(status);
  try {
    const room = await joinRoom(params, { espectador: true }).catch((e: unknown) => {
      // Recarregou a página da live e a sala já fechou (o anfitrião era o único): abre outra
      if (!params.roomId || !/not found/i.test(String((e as Error)?.message ?? e))) throw e;
      return joinRoom({ ...params, roomId: null }, { espectador: true });
    });
    if (await waitForRole(room)) throw new Error('o servidor não aceitou o anfitrião como espectador');
    history.replaceState(null, '', withRoom(location.href, room.roomId));
    status.remove();
    const view = new SpectatorView(canvas, room, { host: true, waiting: false, inviteLink: inviteLink(location.href, room.roomId) });
    window.addEventListener('pagehide', () => view.dispose(true), { once: true });
    view.start();
    expose(view, debug);
    return view;
  } catch (e) {
    console.error('[SIMBIOSE] live:', e);
    status.textContent = `Sem conexão com ${params.endpoint}: rode "npm run server" (${(e as Error).message ?? e})`;
    return null;
  }
}

/**
 * Sala cheia (ou perdeu no rodízio, `benched`): assiste com o aviso da fila até o servidor
 * dar a vaga; então larga a tela sem sair da sala e chama `onSeat` com um canvas novo.
 */
export function watchUntilSeat(
  canvas: HTMLCanvasElement,
  room: Room<unknown, ArenaState>,
  debug: boolean,
  onSeat: (canvas: HTMLCanvasElement, room: Room<unknown, ArenaState>) => void,
  benched?: BenchedMsg,
): SpectatorView {
  hideMenu();
  const leave = () => view.dispose(true);
  const view: SpectatorView = new SpectatorView(canvas, room, {
    host: false,
    waiting: true,
    benched,
    onSeat: () => {
      window.removeEventListener('pagehide', leave);
      view.dispose(false);
      onSeat(freshCanvas(canvas), room);
    },
  });
  window.addEventListener('pagehide', leave, { once: true });
  view.start();
  expose(view, debug);
  return view;
}
