// Banco de medidas para o console (só em dev com `?debug`): `await __bench()`.
// Põe o jogador em pontos de vista fixos, avança quadros na mão (funciona com a aba em
// segundo plano) e devolve a mediana do tempo de GPU e de parede, draw calls e triângulos.
// Os pontos dependem do mapa da URL (`?map=`): o bairro tem os seus, o Pelourinho os dele.

/** Nome, centro do corpo (x, y, z), yaw e pitch da mira. */
type View = [string, number, number, number, number, number?];

const BAIRRO: View[] = [
  ['spawn-N', 14, 1.1, 17.5, 0],
  ['spawn-W', 14, 1.1, 17.5, Math.PI / 2],
  ['centro-S', 0, 1.2, 0, Math.PI],
  ['canto-diag', -30, 1.1, -30, (-3 * Math.PI) / 4],
  ['deck-E', 0, 5.4, -16, -Math.PI / 2],
];

/** Mesmos pontos dos screenshots em docs/screens/pelourinho-*.jpg (y = pés + 0.86). */
const PELOURINHO: View[] = [
  ['largo', 49, 4.06, 23, 0, 0.12],
  ['ladeira-A', -53, 1.26, 23, 0.12, 0.05],
  ['adro-B', 50, 0.86, -15, 0.15, 0.16],
  ['casario', 50, 3.26, 15, 1.16, 0.12],
  ['sacada', 10, 2.46, -10, Math.PI * 0.8, -0.02],
  ['elevador', -33, 0.86, 33, 1.36, 0.3],
];

const LAPA: View[] = [
  ['Largo dos Arcos', 9, 0.86, 21, 0.1, 0.1],
  ['Circo Voador', -18, 0.86, -20, 0, 0.1],
  ['Fundição', 32, 0.86, -21, 0, 0.12],
  ['Arcos', 3, 0.86, 4, 0, 0.2],
  ['Beco do Sebo', -39, 0.86, 28, -Math.PI / 2, 0.03],
  ['Terraço do Choro', 20.5, 2.46, 33, 0.3, 0.1],
  ['Cristo nos Arcos', -12, 0.86, 19, 0.48, 0.25],
];
const FAVELA: View[] = [
  ['Quadra do Sol', -6, 0.86, 18, 0, 0.08],
  ['Laje da Caixa', -17, 3.26, 1, -Math.PI / 2, 0.08],
  ['Laje do Varal', 15, 4.06, 12, Math.PI / 2, 0.08],
  ['Feira', 0, 0.86, -8, 1.3, 0.08],
  ['Beco da Bica', -29, 0.86, 10, -0.43, 0.08],
  ['Associação', -5, 0.86, 15, Math.PI, 0.08],
];
const PATACHO_VIEWS: View[] = [
  ['Praia', 3, 0.86, 28, -0.5, 0.08],
  ['Vila', -2, 0.86, 6, -0.45, 0.08],
  ['Coqueiral', -26, 0.86, 5, -1.5, 0.08],
  ['Jangadas', 24, 0.86, 23, -1.57, 0.08],
  ['Piscinas', 21, 0.86, -2, -1.35, 0.06],
];
const VIEWS_BY_MAP: Record<string, View[]> = { pelourinho: PELOURINHO, arena1: PELOURINHO, lapa: LAPA, favela: FAVELA, patacho: PATACHO_VIEWS };

/** Mesmas câmeras na inspeção visual e na medição, atualizadas junto da planta. */
export function viewsFor(search: string): View[] {
  const id = new URLSearchParams(search).get('map');
  return id && Object.hasOwn(VIEWS_BY_MAP, id) ? VIEWS_BY_MAP[id] : BAIRRO;
}

/** Cede a vez ao navegador sem `setTimeout` (que é estrangulado em aba oculta). */
const yieldOnce = () =>
  new Promise<void>((res) => {
    const c = new MessageChannel();
    c.port1.onmessage = () => { c.port1.close(); c.port2.close(); res(); };
    c.port2.postMessage(0);
  });

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? +s[Math.floor(s.length / 2)].toFixed(2) : 0;
};

export async function bench(game: any, frames = 30, warm = 60) {
  const g = game;
  if (!g.player?.state || !g.director || !g.input) throw new Error('Benchmark disponível apenas no modo treino (?debug sem online).');
  if (g.benchmarkActive) throw new Error('Um benchmark já está em andamento.');
  const r = g.renderer;
  const gl = r.getContext() as WebGL2RenderingContext;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number } | null;
  const px = new Uint8Array(4);
  const sync = () => {
    r.setRenderTarget(null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  };
  const st = g.player.state;
  const state = structuredClone(st);
  const input = { yaw: g.input.yaw, pitch: g.input.pitch, locked: g.input.locked, fireHeld: g.input.fireHeld, rightHeld: g.input.rightHeld, jumpPressed: g.input.jumpPressed, lookEnabled: g.input.lookEnabled };
  const original = { director: g.director.update, delta: g.clock.getDelta, timing: g.pipeline.stats.timing, tick: g.tick, deadFor: g.deadFor, fxTime: g.fxTime, active: g.benchmarkActive, acc: g.fixed?.acc };
  const pausedAt = performance.now();
  const queries = new Set<WebGLQuery>();
  const resume = g.pauseForBenchmark?.();
  const views: { name: string; gpu: number; wall: number; calls: number; tris: number }[] = [];
  try {
    // Cena congelada: a medição não dispara tiros nem avança regras da partida.
    g.benchmarkActive = true;
    g.director.update = () => {};
    g.tick = () => {};
    g.deadFor = -1;
    g.input.locked = false;
    g.clock.getDelta = () => 1 / 60;
    g.pipeline.stats.timing = false;
    for (let i = 0; i < warm; i++) g.frame();
    for (const [name, x, y, z, yaw, pitch = 0] of viewsFor(location.search)) {
      // A câmera segue a mira da entrada; a posição vem do estado da simulação
      g.input.yaw = yaw;
      g.input.pitch = pitch;
      const put = () => {
        Object.assign(st.pos, { x, y, z });
        Object.assign(st.vel, { x: 0, y: 0, z: 0 });
        g.player.snap(); // sem interpolar do ponto anterior
      };
      for (let i = 0; i < 10; i++) {
        put();
        g.frame();
      }
      sync();
      const viewQueries: WebGLQuery[] = [];
      const wall: number[] = [];
      for (let i = 0; i < frames; i++) {
        put();
        const q = ext ? gl.createQuery()! : null;
        if (q) queries.add(q);
        if (ext && q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        const t0 = performance.now();
        try { g.frame(); } finally { if (ext && q) gl.endQuery(ext.TIME_ELAPSED_EXT); }
        sync();
        wall.push(performance.now() - t0);
        if (q) viewQueries.push(q);
      }
      const last = viewQueries[viewQueries.length - 1];
      for (let k = 0; last && k < 500 && !gl.getQueryParameter(last, gl.QUERY_RESULT_AVAILABLE); k++) await yieldOnce();
      const gpu: number[] = [];
      for (const q of viewQueries) {
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
        queries.delete(q);
      }
      views.push({ name, gpu: median(gpu), wall: median(wall), calls: g.pipeline.stats.calls, tris: g.pipeline.stats.triangles });
    }
    const avg = (k: 'gpu' | 'wall' | 'calls' | 'tris') => +(views.reduce((a, v) => a + v[k], 0) / views.length).toFixed(1);
    return {
      size: `${r.domElement.width}x${r.domElement.height}`,
      pixelRatio: r.getPixelRatio(),
      level: g.quality?.level,
      gpu: avg('gpu'),
      wall: avg('wall'),
      calls: avg('calls'),
      tris: avg('tris'),
      views,
    };
  } finally {
    for (const q of queries) gl.deleteQuery(q);
    g.director.update = original.director;
    g.clock.getDelta = original.delta;
    // O relógio real ficou parado: não simule o tempo gasto medindo ao retomar o jogo.
    if (g.clock.running && typeof g.clock.oldTime === 'number') g.clock.oldTime += performance.now() - pausedAt;
    g.pipeline.stats.timing = original.timing;
    g.tick = original.tick;
    g.deadFor = original.deadFor;
    g.fxTime = original.fxTime;
    g.benchmarkActive = original.active;
    if (g.fixed) g.fixed.acc = original.acc;
    const { pos, vel, spawn, ...rest } = state;
    Object.assign(st, rest);
    Object.assign(st.pos, pos);
    Object.assign(st.vel, vel);
    if (spawn) Object.assign(st.spawn, spawn);
    Object.assign(g.input, input);
    g.player.snap();
    resume?.();
  }
}
