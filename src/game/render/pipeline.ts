import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { PALETTE } from '../toon';
import { AmbientOcclusion } from './ao';
import { Bloom } from './bloom';
import { applyDetailQuality } from './detail-quality';
import { basePixelRatio, isWeakGpu, type QualityLevel, qualitySettings } from './quality';
import { SCENE_LIGHT, sceneHasSky, resetSceneLight } from './scene-light';
import { FINAL_FRAG, FINAL_VERT } from './shaders';
import { FrameStats } from './stats';

// Pós-processamento estilo ilustração cel-shaded:
//  1. a cena vai para um alvo HDR com textura de profundidade;
//  2. bloom leve só no que passa do limiar (neon, janelas acesas, telões, orbes);
//  3. oclusão ambiente em meia resolução, pelo mesmo buffer de profundidade (render/ao.ts);
//  4. passe final: contorno de nanquim com a cor da superfície, oclusão tingida de lilás,
//     soma do bloom, brilho do sol, gradação (split-toning, contraste, saturação seletiva),
//     meio-tom nas sombras, vinheta e saída em sRGB.
// Tudo isso custa poucos draw calls (quads), não depende do número de objetos.
//
// Sombra: o mundo é parado, então o mapa de sombra é desenhado uma vez só
// (`shadowMap.autoUpdate = false`) e refeito sob demanda com `refreshShadows()`.

export interface Pipeline {
  render(): void;
  setSize(width: number, height: number): void;
  /** Aplica um nível de qualidade (resolução e bloom). Chamar `setSize` depois. */
  setQuality(level: QualityLevel): void;
  /** Redesenha o mapa de sombra no próximo quadro (ex.: mudou algo que projeta sombra). */
  refreshShadows(): void;
  /** Liga/desliga o pós (debug: compara com a renderização crua). */
  enabled: boolean;
  readonly bloom: Bloom;
  readonly ao: AmbientOcclusion;
  readonly final: THREE.ShaderMaterial;
  /** Draw calls, triângulos e tempos do último quadro (painel em `?debug`). */
  readonly stats: FrameStats;
  /** GPU integrada/móvel detectada (começa com `pixelRatio` 1). */
  readonly weakGpu: boolean;
  /** Libera os alvos e materiais do pós (o renderer e a cena são de quem criou). */
  dispose(): void;
}

const DEBUG = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

// `await __bench()` no console (dev + ?debug): mede 5 pontos de vista fixos
if (DEBUG) {
  void import('./bench').then(({ bench }) => {
    const w = window as unknown as { __bench: (frames?: number) => Promise<unknown>; __game?: unknown };
    w.__bench = (frames?: number) => bench(w.__game, frames);
  });
}

/** Limiar do bloom em luz linear: só emissivos "estourados" passam (ver `GLOW` em toon.ts). */
const BLOOM_THRESHOLD = 1.05;
/** Força do bloom somado no passe final (calibrada para parecer o UnrealBloom antigo). */
const BLOOM_STRENGTH = 0.34;
/** Força da oclusão ambiente (0 = desligada). */
const AO_STRENGTH = 1;

function gpuName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
}

export function createPipeline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): Pipeline {
  resetSceneLight();
  const weakGpu = isWeakGpu(gpuName(renderer));
  const basePR = basePixelRatio(window.devicePixelRatio, weakGpu);
  renderer.setPixelRatio(basePR);
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    // Sem MSAA: em GPU integrada o resolve de 4x em HalfFloat custava ~18 ms. O traço de
    // nanquim (suave) já esconde o serrilhado das silhuetas.
    samples: 0,
    depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.FloatType),
  });

  const bloom = new Bloom(BLOOM_THRESHOLD);
  const ao = new AmbientOcclusion(target.depthTexture!);
  let glare = true;
  const sunNdc = new THREE.Vector3();
  applyDetailQuality(0); // jogo novo começa no nível 0, como o pós

  const c = (n: number) => new THREE.Color(n);
  const aoTint = c(PALETTE.dusk).lerp(c(PALETTE.paper), 0.45).multiplyScalar(1.2);
  const aoLuma = aoTint.r * 0.2126 + aoTint.g * 0.7152 + aoTint.b * 0.0722;
  const final = new THREE.ShaderMaterial({
    vertexShader: FINAL_VERT,
    fragmentShader: FINAL_FRAG,
    uniforms: {
      tDiffuse: { value: target.texture },
      tDepth: { value: target.depthTexture },
      tBloom: { value: null },
      uBloom: { value: BLOOM_STRENGTH },
      tAo: { value: ao.texture },
      uAo: { value: AO_STRENGTH },
      // Oclusão cor de ameixa: o contato escurece puxando para o lilás, não para o cinza
      uAoTint: { value: aoTint.clone() },
      uSunUv: { value: new THREE.Vector3() },
      uSunGlare: { value: c(PALETTE.sun).lerp(c(PALETTE.orange), 0.25) },
      uTexel: { value: new THREE.Vector2(1 / size.x, 1 / size.y) },
      uAspect: { value: size.x / size.y },
      uPx: { value: 1 },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uProjScale: { value: new THREE.Vector2(1, 1) },
      uInk: { value: c(PALETTE.ink) },
      uInkFar: { value: c(PALETTE.dusk) },
      uShadowTint: { value: new THREE.Vector3(0.95, 0.95, 1.07) },
      uLightTint: { value: new THREE.Vector3(1.05, 1.0, 0.94) },
      uVignette: { value: c(PALETTE.dusk).lerp(c(PALETTE.wine), 0.35) },
      uTime: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(final);

  // São vários `render()` por quadro; sem isso, `renderer.info` só contaria o último quad
  renderer.info.autoReset = false;
  const t0 = performance.now();
  // Ajuste fino no console em ?debug: `__luz.light.uLuzOn.value = 0`, `__luz.final.uniforms.uAo.value`...
  if (DEBUG) (window as unknown as { __luz: unknown }).__luz = { light: SCENE_LIGHT, final, ao };
  const stats = new FrameStats(renderer, DEBUG);

  /**
   * Desenha a cena. No quadro em que o mapa de sombra é refeito, as cópias de sombra do
   * cenário (`userData.shadowProxy`, ver world/builder.ts) aparecem só durante esse render.
   */
  function drawScene() {
    if (!renderer.shadowMap.needsUpdate) {
      renderer.render(scene, camera);
      return;
    }
    const proxies: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.shadowProxy) proxies.push(o);
    });
    for (const o of proxies) o.visible = true;
    renderer.render(scene, camera);
    for (const o of proxies) o.visible = false;
  }

  function draw() {
    if (!pipeline.enabled) {
      renderer.setRenderTarget(null);
      drawScene();
      return;
    }
    renderer.setRenderTarget(target);
    drawScene();

    // Todos os passes abaixo cobrem o alvo inteiro, sem blend nem teste de profundidade.
    // Poupa limpar cada mip/quad antes de sobrescrever os mesmos pixels. A cena continua
    // com sua limpeza normal no próximo quadro, mesmo se algum passe lançar uma exceção.
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      drawPost();
    } finally {
      renderer.autoClear = autoClear;
    }
  }

  function drawPost() {
    const u = final.uniforms;
    const tint = SCENE_LIGHT.uLuzTintStrength.value;
    u.uShadowTint.value.set(1 - 0.05 * tint, 1 - 0.05 * tint, 1 + 0.07 * tint);
    u.uAoTint.value.setRGB(aoLuma, aoLuma, aoLuma).lerp(aoTint, tint);
    if (bloom.enabled) {
      bloom.render(renderer, target.texture, target.width, target.height);
      u.tBloom.value = bloom.texture;
      u.uBloom.value = BLOOM_STRENGTH;
    } else {
      u.uBloom.value = 0;
    }
    if (ao.enabled) {
      ao.render(renderer, camera);
      u.tAo.value = ao.texture;
      u.uAo.value = AO_STRENGTH;
    } else {
      u.uAo.value = 0;
    }
    // Sol na tela (só com céu na cena): o passe final confere se ele está encoberto
    u.uSunUv.value.z = 0;
    if (glare && sceneHasSky()) {
      sunNdc.copy(SCENE_LIGHT.uLuzSunDir.value).multiplyScalar(camera.far * 0.5).add(camera.position).project(camera);
      const ahead = sunNdc.z < 1 && Math.abs(sunNdc.x) < 1.6 && Math.abs(sunNdc.y) < 1.6;
      if (ahead) u.uSunUv.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5, 1);
    }
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    const p = camera.projectionMatrix.elements;
    u.uProjScale.value.set(1 / p[0], 1 / p[5]);
    u.uTime.value = (performance.now() - t0) / 1000;
    renderer.setRenderTarget(null);
    quad.render(renderer);
  }

  const pipeline: Pipeline = {
    enabled: true,
    bloom,
    ao,
    final,
    stats,
    weakGpu,
    render() {
      renderer.info.reset();
      stats.begin();
      try { draw(); } finally { stats.end(); }
    },
    setQuality(level: QualityLevel) {
      const q = qualitySettings(level);
      bloom.enabled = q.bloom;
      ao.enabled = q.aoSamples > 0;
      ao.samples = Math.max(1, q.aoSamples);
      glare = q.glare;
      applyDetailQuality(level);
      renderer.setPixelRatio(basePR * q.scale);
      pipeline.refreshShadows();
    },
    refreshShadows() {
      renderer.shadowMap.needsUpdate = true;
    },
    setSize() {
      // O tamanho vem do renderer (já com o pixelRatio do nível de qualidade)
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      target.setSize(s.x, s.y);
      bloom.setSize(s.x, s.y);
      ao.setSize(s.x, s.y);
      const u = final.uniforms;
      u.uTexel.value.set(1 / s.x, 1 / s.y);
      u.uAspect.value = s.x / s.y;
      // Espessura do traço acompanha a resolução de saída (1 px em ~900 linhas da tela)
      u.uPx.value = THREE.MathUtils.clamp(s.y / 900, 1, 2.6);
    },
    dispose() {
      target.depthTexture?.dispose();
      target.dispose();
      bloom.dispose();
      ao.dispose();
      SCENE_LIGHT.tLuzFloors.value.dispose();
      final.dispose();
      quad.dispose();
    },
  };
  return pipeline;
}
