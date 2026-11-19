// Arte de reserva dos cards de mapa (canvas 160×90), usada se a captura do jogo em
// public/assets/maps/ não carregar, e a arte do card "Aleatório". Cores só da PALETTE.
import { PALETTE } from '../toon';
import type { ArenaMapId, MapId } from './settings';

type Key = keyof typeof PALETTE;
const css = (k: Key) => `#${PALETTE[k].toString(16).padStart(6, '0')}`;
const W = 160;
const H = 90;

function sky(g: CanvasRenderingContext2D, top: Key, bottom: Key) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, css(top));
  grad.addColorStop(1, css(bottom));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

function bairro(g: CanvasRenderingContext2D) {
  // Silhueta de prédios ao pôr do sol
  sky(g, 'skyTop', 'horizon');
  g.fillStyle = css('sun');
  g.beginPath();
  g.arc(110, 58, 14, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css('ink');
  for (let x = 0, i = 0; x < W; i++) {
    const w = 12 + ((i * 37) % 17);
    const h = 26 + ((i * 53) % 40);
    g.fillRect(x, H - h, w - 2, h);
    x += w;
  }
}

function pelourinho(g: CanvasRenderingContext2D) {
  // Ladeira de casario colorido e a igreja azul de duas torres no alto
  sky(g, 'skyDeep', 'sky');
  const houses: Key[] = ['colonialYellow', 'colonialPink', 'colonialGreen', 'colonialSky', 'colonialYellow', 'telha'];
  for (let i = 0; i < 6; i++) {
    const x = i * 18;
    const top = 50 + i * 4;
    g.fillStyle = css(houses[i]);
    g.fillRect(x, top, 18, H - top);
    g.fillStyle = css('telha');
    g.fillRect(x - 1, top - 3, 20, 4);
    g.fillStyle = css('ink');
    g.fillRect(x + 4, top + 8, 3, 6);
    g.fillRect(x + 11, top + 8, 3, 6);
  }
  // Igreja
  g.fillStyle = css('colonialSky');
  g.fillRect(110, 34, 40, 56);
  g.fillRect(106, 22, 10, 68);
  g.fillRect(144, 22, 10, 68);
  g.fillStyle = css('paper');
  g.beginPath();
  g.moveTo(110, 34);
  g.lineTo(130, 22);
  g.lineTo(150, 34);
  g.fill();
  g.fillStyle = css('ink');
  g.fillRect(126, 62, 8, 28);
  g.fillRect(108, 30, 6, 6);
  g.fillRect(146, 30, 6, 6);
  g.fillStyle = css('stoneJoint');
  g.fillRect(0, 84, W, 6);
}

function lapa(g: CanvasRenderingContext2D) {
  // Aqueduto branco de dois andares de arcos, Cristo no morro ao fundo
  sky(g, 'dusk', 'horizon');
  g.fillStyle = css('glass');
  g.beginPath();
  g.moveTo(0, 50);
  g.quadraticCurveTo(40, 18, 80, 44);
  g.lineTo(80, 60);
  g.lineTo(0, 60);
  g.fill();
  g.fillStyle = css('paper');
  g.fillRect(38, 14, 2, 12); // Cristo
  g.fillRect(33, 17, 12, 2);
  g.fillStyle = css('paper');
  g.fillRect(0, 40, W, 50);
  g.fillStyle = css('ink');
  for (let row = 0; row < 2; row++) {
    const y = row === 0 ? 46 : 66;
    const h = row === 0 ? 14 : 24;
    for (let x = 4; x < W; x += 16) {
      g.beginPath();
      g.moveTo(x, y + h);
      g.lineTo(x, y + 5);
      g.arc(x + 5, y + 5, 5, Math.PI, 0);
      g.lineTo(x + 10, y + h);
      g.fill();
    }
  }
  g.fillStyle = css('pink');
  g.fillRect(0, 86, W, 4);
}

function favela(g: CanvasRenderingContext2D) {
  // Morro de casinhas empilhadas, caixa d'água azul e varal
  sky(g, 'skyTop', 'orange');
  const walls: Key[] = ['orange', 'colonialPink', 'concrete', 'colonialYellow', 'wine', 'colonialGreen', 'telha'];
  let n = 0;
  for (let row = 0; row < 5; row++) {
    const y = 76 - row * 13;
    const inset = row * 14;
    for (let x = inset - 6; x < W - inset + 6; x += 15) {
      g.fillStyle = css(walls[(n++ * 3) % walls.length]);
      g.fillRect(x, y, 14, 14);
      g.fillStyle = css('ink');
      g.fillRect(x + 5, y + 4, 4, 4);
    }
  }
  g.fillStyle = css('tank');
  g.fillRect(74, 8, 12, 8);
  g.strokeStyle = css('paper');
  g.beginPath();
  g.moveTo(20, 40);
  g.quadraticCurveTo(45, 48, 70, 40);
  g.stroke();
  g.fillStyle = css('asphalt');
  g.fillRect(0, 86, W, 4);
}

function random(g: CanvasRenderingContext2D) {
  // Três faixas (as cores dos três mapas) e um "?" de mangá no meio
  const bands: Key[] = ['colonialSky', 'paper', 'orange'];
  bands.forEach((k, i) => {
    g.fillStyle = css(k);
    g.beginPath();
    g.moveTo(i * 56 - 10, 0);
    g.lineTo(i * 56 + 50, 0);
    g.lineTo(i * 56 + 30, H);
    g.lineTo(i * 56 - 30, H);
    g.fill();
  });
  g.fillStyle = css('ink');
  g.globalAlpha = 0.45;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.font = 'italic 900 60px "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = css('pink');
  g.fillText('?', W / 2 + 4, H / 2 + 4);
  g.fillStyle = css('yellow');
  g.fillText('?', W / 2, H / 2);
}

function patacho(g: CanvasRenderingContext2D) {
  g.fillStyle = css('colonialSky');
  g.fillRect(0, 0, W, H);
  g.fillStyle = css('cal');
  g.fillRect(0, 26, W, 14);
  g.fillStyle = css('seaDeep');
  g.fillRect(0, 38, W, H - 38);
  g.fillStyle = css('seaTurquoise');
  g.fillRect(0, 42, W, 28);
  g.fillStyle = css('seaShallow');
  g.beginPath();
  g.ellipse(118, 55, 34, 8, -0.08, 0, Math.PI * 2);
  g.fill();
  // Arrecife e espuma
  g.strokeStyle = css('cantaria');
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(96, 48);
  g.lineTo(146, 50);
  g.stroke();
  // Jangada de vela latina
  g.fillStyle = css('cal');
  g.beginPath();
  g.moveTo(122, 46);
  g.lineTo(128, 22);
  g.lineTo(138, 45);
  g.closePath();
  g.fill();
  g.fillStyle = css('wood');
  g.fillRect(119, 45, 22, 3);
  // Praia em curva e pousada de piaçava
  g.fillStyle = css('beachSand');
  g.beginPath();
  g.moveTo(0, 46);
  g.quadraticCurveTo(78, 56, W, 82);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.fill();
  g.fillStyle = css('cal');
  g.fillRect(18, 42, 30, 16);
  g.fillStyle = css('ochre');
  g.beginPath();
  g.moveTo(14, 43);
  g.lineTo(33, 31);
  g.lineTo(52, 43);
  g.closePath();
  g.fill();
  // Coqueiros inclinados
  for (const [x, lean, topY] of [
    [10, 6, 16],
    [66, 9, 14],
    [94, 5, 22],
  ]) {
    g.strokeStyle = css('wood');
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(x, 68);
    g.quadraticCurveTo(x + lean * 0.4, 40, x + lean, topY);
    g.stroke();
    g.strokeStyle = css('leaf');
    g.lineWidth = 3;
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(x + lean, topY);
      g.quadraticCurveTo(x + lean + Math.cos(a) * 11, topY - 5, x + lean + Math.cos(a) * 18, topY + 6 + Math.sin(a) * 5);
      g.stroke();
    }
  }
}
const ART: Record<MapId | 'aleatorio', (g: CanvasRenderingContext2D) => void> = { bairro, pelourinho, lapa, favela, patacho, aleatorio: random };

/** Desenha a arte do mapa num canvas novo de 160×90. */
export function mapArt(id: MapId | ArenaMapId): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'mn-preview';
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (g) ART[id](g);
  return c;
}
