import type * as THREE from 'three';

// Contador de desempenho por quadro: draw calls, triângulos, tempo de CPU e de GPU.
// A GPU é medida com EXT_disjoint_timer_query_webgl2 (assíncrono: o resultado chega alguns
// quadros depois). Em `?debug` (só em dev) aparece um painel no canto da tela.

type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

export class FrameStats {
  calls = 0;
  triangles = 0;
  /** Média móvel do tempo de CPU gasto em `render()` (ms). */
  cpuMs = 0;
  /** Média móvel do tempo de GPU do quadro inteiro (ms); 0 se o navegador não expõe. */
  gpuMs = 0;
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExt | null;
  private query: WebGLQuery | null = null;
  private inFlight = false;
  private measuring = false;
  /** Desligue para medir a GPU por fora (só uma consulta de tempo pode estar aberta). */
  timing = true;
  private t0 = 0;
  private panel: HTMLDivElement | null = null;
  private lastPanel = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer, showPanel: boolean) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    if (showPanel && typeof document !== 'undefined') {
      const p = document.createElement('div');
      p.style.cssText =
        'position:fixed;right:8px;bottom:8px;z-index:50;font:11px/1.3 monospace;color:#f4ecff;' +
        'background:rgba(26,16,38,.75);padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre';
      document.body.appendChild(p);
      this.panel = p;
    }
  }

  begin() {
    this.t0 = performance.now();
    const { gl, ext } = this;
    if (!ext || !this.timing) return;
    if (this.inFlight && this.query) {
      // Ainda esperando o quadro anterior: não abre outra consulta
      if (!gl.getQueryParameter(this.query, gl.QUERY_RESULT_AVAILABLE)) return;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (!disjoint) {
        const ms = gl.getQueryParameter(this.query, gl.QUERY_RESULT) / 1e6;
        this.gpuMs = this.gpuMs ? this.gpuMs + (ms - this.gpuMs) * 0.1 : ms;
      }
      this.inFlight = false;
    }
    this.query ??= gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, this.query!);
    this.inFlight = true;
    this.measuring = true;
  }

  end() {
    if (this.measuring && this.ext) this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.measuring = false;
    const ms = performance.now() - this.t0;
    this.cpuMs = this.cpuMs ? this.cpuMs + (ms - this.cpuMs) * 0.1 : ms;
    const info = this.renderer.info.render;
    this.calls = info.calls;
    this.triangles = info.triangles;
    if (this.panel && this.t0 - this.lastPanel > 250) {
      this.lastPanel = this.t0;
      const gpu = this.ext ? `${this.gpuMs.toFixed(1)} ms` : 'n/d';
      this.panel.textContent =
        `GPU ${gpu} · CPU ${this.cpuMs.toFixed(1)} ms\n` +
        `${this.calls} draws · ${(this.triangles / 1000).toFixed(0)}k tri · ${this.renderer.getPixelRatio().toFixed(2)}x`;
    }
  }
}
