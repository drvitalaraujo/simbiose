import '../style.css';
import { saveShot } from '../game/characters/page-ui';
import { bench, viewsFor } from '../game/render/bench';

// Vitrine de desenvolvimento: enquadramentos reproduzíveis, sem pointer lock/console.
// Não entra no bundle do jogo (HTML separado; nenhuma importação em main.ts).
if (!import.meta.env.DEV) throw new Error('Revisão visual disponível apenas em desenvolvimento.');
const iframe = document.querySelector<HTMLIFrameElement>('#review-game')!;
const params = new URLSearchParams(location.search); params.set('debug', '');
await new Promise<void>((resolve) => { iframe.onload = () => resolve(); iframe.src = `./?${params}`; });
if (params.has('characters')) {
  // O carregamento dos bonecos é assíncrono; o gancho aparece depois do GLTF.
  const win = iframe.contentWindow as any;
  while (!win.__chars) await new Promise(resolve => setTimeout(resolve, 100));
  const c = win.__chars;
  iframe.contentDocument!.getElementById('chars-hit')!.click();
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:12px;right:12px;z-index:1000;display:flex;gap:6px;background:#1a1026dd;padding:8px;color:white';
  document.body.append(panel);
  for (const [view, label] of [['front', 'Frente'], ['side', 'Lado'], ['back', 'Costas']]) {
    const b = document.createElement('button'); b.textContent = `Salvar ${label}`;
    b.onclick = () => { c.view(view); c.shot(`revisao-personagens-${view}`); };
    panel.append(b);
  }
  c.view('front'); c.frame(1 / 60);
} else {
// As propriedades privadas do Game são usadas só pelo laboratório, como em __bench.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = (iframe.contentWindow as any).__game;
g.renderer.setAnimationLoop(null);
g.director.update = () => {};
g.clock.getDelta = () => 1 / 60;
g.pipeline.stats.timing = false;
g.benchmarkActive = true;
g.pipeline.setQuality(g.quality.level);
g.resize();
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:12px;left:12px;z-index:1000;display:flex;gap:6px;flex-wrap:wrap;max-width:920px;background:#1a1026dd;padding:8px;color:white;font:12px sans-serif';
document.body.append(panel);
const info = document.createElement('output');
info.style.cssText = 'position:fixed;bottom:8px;left:8px;color:white;background:#1a1026dd;padding:6px;z-index:1000;font:12px monospace';
document.body.append(info);
let viewTag = 'spawn';
const button = (text: string, action: () => void) => {
  const b = document.createElement('button'); b.textContent = text; b.onclick = action;
  panel.append(b);
};
function draw() { g.frame(); info.textContent = JSON.stringify({pos:g.player.state.pos, kills:g.kills, quality:g.quality.level, calls:g.pipeline.stats.calls, triangles:g.pipeline.stats.triangles}); }
function pose(x: number, y: number, z: number, yaw: number, pitch = 0) {
  viewTag = `${x}-${z}`;
  Object.assign(g.player.state.pos, {x,y,z}); Object.assign(g.player.state.vel, {x:0,y:0,z:0});
  g.player.snap(); g.input.yaw = yaw; g.input.pitch = pitch;
  draw();
}
const map = new URLSearchParams(location.search).get('map');
if (map === 'patacho' || map === 'favela' || map === 'lapa') {
  for (const [name, x, y, z, yaw, pitch] of viewsFor(location.search)) {
    button(name, () => pose(x, y, z, yaw, pitch));
  }
} else if (map === 'pelourinho' || map === 'arena1') {
  button('Largo', () => pose(49,4.06,23,-0.04,0.1));
  button('Praça central', () => pose(-1.5,0.86,16,0.05,0.06));
  button('Ladeira', () => pose(-53,1.26,23,0.12,0.05));
  button('Igreja', () => pose(50,0.86,-15,0.15,0.16));
  button('Spawn', () => pose(49,4.06,23,0,0.03));
} else {
  button('Carro', () => pose(-0.2,1.11,22.4,0.72,0.12));
  button('Praça', () => pose(0,1.11,0,Math.PI,-0.03));
  button('Prédios', () => pose(0,5.4,-16,-Math.PI/2,-0.13));
}
for (const [i, name] of ['Fuzil', 'SMG', 'Sniper', 'Escopeta'].entries()) button(name, () => {
  g.input.weaponSlot = i + 1; g.input.locked = true;
  const render = g.pipeline.render; g.pipeline.render = () => {};
  for (let k=0;k<30;k++) g.frame();
  g.pipeline.render = render; draw();
});
button('Mira', () => {
  g.input.rightHeld = !g.input.rightHeld; g.input.locked = true;
  const render = g.pipeline.render; g.pipeline.render = () => {};
  for (let k=0;k<35;k++) g.frame();
  g.pipeline.render = render; draw();
});
button('Avançar 120 quadros', () => {
  const render = g.pipeline.render; g.pipeline.render = () => {};
  for (let k=0;k<120;k++) g.frame();
  g.pipeline.render = render; draw();
});
button('Trocar qualidade', () => {
  g.quality.level = (g.quality.level + 1) % 4;
  g.pipeline.setQuality(g.quality.level); g.resize(); draw();
});
button('Salvar imagem', () => {
  g.pipeline.render(); saveShot(g.renderer.domElement, `revisao-${map ?? 'bairro'}-${g.gun.weaponIndex}-${viewTag}-${g.input.rightHeld ? 'mira' : 'livre'}`, 1280);
});
button('Medir GPU', () => { void (async () => {
  g.benchmarkActive = false;
  try { info.textContent = JSON.stringify(await bench(g,12,10)); }
  finally { g.renderer.setAnimationLoop(null); g.benchmarkActive = true; }
})().catch(error => { info.textContent = String(error); }); });
draw();
}
