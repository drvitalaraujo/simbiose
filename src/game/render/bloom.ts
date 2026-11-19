import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// Bloom barato (filtro duplo de Kawase): a imagem HDR desce em 5 mips pequenos e volta
// somando, em 8 passadas minúsculas. O resultado fica em 1/4 da resolução e é somado no
// passe final (sem mais um passe de tela cheia). Substitui o UnrealBloomPass, que custava
// ~3,5 ms numa Intel integrada; este fica em ~1 ms com o mesmo limiar (ver `GLOW` em toon.ts).

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Desce meia resolução com 5 amostras; no primeiro nível também aplica o limiar. */
const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uHalf; // meio texel da fonte
uniform float uThreshold; // < 0: sem limiar
varying vec2 vUv;
vec3 pick(vec2 uv) {
  vec3 c = texture2D(tSrc, uv).rgb;
  if (uThreshold < 0.0) return c;
  // Pico em luz linear: rosa/ciano/amarelo emissivos passam pelo mesmo limiar.
  // Luminância apagava o rosa mesmo com GLOW. Luz difusa muito intensa também pode passar.
  float l = max(c.r, max(c.g, c.b));
  return c * smoothstep(uThreshold, uThreshold + 0.08, l);
}
void main() {
  vec3 s = pick(vUv) * 4.0;
  s += pick(vUv - uHalf);
  s += pick(vUv + uHalf);
  s += pick(vUv + vec2(uHalf.x, -uHalf.y));
  s += pick(vUv - vec2(uHalf.x, -uHalf.y));
  gl_FragColor = vec4(min(s / 8.0, vec3(24.0)), 1.0);
}`;

/** Sobe para o dobro da resolução (8 amostras em losango) e soma o mip daquele nível. */
const UP = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tBase;
uniform vec2 uHalf; // meio texel da fonte (a menor)
uniform float uBase;
varying vec2 vUv;
void main() {
  vec2 h = uHalf;
  vec3 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tBase, vUv).rgb * uBase, 1.0);
}`;

const LEVELS = 5; // 1/2, 1/4, 1/8, 1/16, 1/32 da resolução

export class Bloom {
  enabled = true;
  /** Limiar em luz linear: só emissivos "estourados" passam. */
  threshold: number;
  private readonly down: THREE.WebGLRenderTarget[] = [];
  private readonly up: THREE.WebGLRenderTarget[] = [];
  private readonly downMat: THREE.ShaderMaterial;
  private readonly upMat: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor(threshold: number) {
    this.threshold = threshold;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    for (let i = 0; i < LEVELS; i++) this.down.push(new THREE.WebGLRenderTarget(1, 1, opts));
    // up[i - 1] corresponde a down[i]. Nunca subimos a 1/2: sem alvo HDR ocioso.
    for (let i = 1; i < LEVELS - 1; i++) this.up.push(new THREE.WebGLRenderTarget(1, 1, opts));
    const base = { vertexShader: VERT, depthTest: false, depthWrite: false };
    this.downMat = new THREE.ShaderMaterial({
      ...base,
      fragmentShader: DOWN,
      uniforms: { tSrc: { value: null }, uHalf: { value: new THREE.Vector2() }, uThreshold: { value: threshold } },
    });
    this.upMat = new THREE.ShaderMaterial({
      ...base,
      fragmentShader: UP,
      uniforms: { tSrc: { value: null }, tBase: { value: null }, uHalf: { value: new THREE.Vector2() }, uBase: { value: 1 } },
    });
    this.quad = new FullScreenQuad(this.downMat);
  }

  /** Textura final do bloom (1/4 da resolução), para o passe final somar. */
  get texture(): THREE.Texture {
    return this.up[0].texture;
  }

  setSize(width: number, height: number) {
    let w = width;
    let h = height;
    for (let i = 0; i < LEVELS; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      this.down[i].setSize(w, h);
      if (i > 0 && i < LEVELS - 1) this.up[i - 1].setSize(w, h);
    }
  }

  render(renderer: THREE.WebGLRenderer, source: THREE.Texture, sourceW: number, sourceH: number) {
    const du = this.downMat.uniforms;
    let src = source;
    let sw = sourceW;
    let sh = sourceH;
    this.quad.material = this.downMat;
    for (let i = 0; i < LEVELS; i++) {
      du.tSrc.value = src;
      du.uHalf.value.set(0.5 / sw, 0.5 / sh);
      du.uThreshold.value = i === 0 ? this.threshold : -1;
      renderer.setRenderTarget(this.down[i]);
      this.quad.render(renderer);
      src = this.down[i].texture;
      sw = this.down[i].width;
      sh = this.down[i].height;
    }
    // Sobe até 1/4 (up[0]); o nível de 1/2 só serve para filtrar a entrada sem cintilar
    const uu = this.upMat.uniforms;
    this.quad.material = this.upMat;
    let coarse = this.down[LEVELS - 1];
    for (let i = LEVELS - 2; i >= 1; i--) {
      uu.tSrc.value = coarse.texture;
      uu.tBase.value = this.down[i].texture;
      uu.uHalf.value.set(0.5 / coarse.width, 0.5 / coarse.height);
      renderer.setRenderTarget(this.up[i - 1]);
      this.quad.render(renderer);
      coarse = this.up[i - 1];
    }
  }

  dispose() {
    for (const t of [...this.down, ...this.up]) t.dispose();
    this.downMat.dispose();
    this.upMat.dispose();
    this.quad.dispose();
  }
}
