import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// Oclusão ambiente barata (estilo "AO pintada" de anime): meia resolução, lida do buffer de
// profundidade que o pipeline já tem, 8 amostras em espiral girada por ruído (IGN) e um
// desfoque separável que respeita a profundidade. Saída: R = luz que sobra (1 = livre),
// G = distância à câmera, para o passe final ampliar sem vazar pela silhueta.
// Custo numa Intel integrada: ~0,5 ms em 1/4 dos pixels. Níveis 2 e 3 desligam.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
uniform sampler2D tDepth;
uniform float uNear, uFar;
uniform vec2 uProjScale;
float dist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -(uNear * uFar) / ((uFar - uNear) * d - uFar);
}
vec3 viewPos(vec2 uv, float z) {
  return vec3((uv * 2.0 - 1.0) * uProjScale * z, -z);
}
`;

const AO_FRAG = /* glsl */ `
${COMMON}
uniform vec2 uTexel; // texel da profundidade (resolução cheia)
uniform float uRadius, uSamples, uIntensity;
varying vec2 vUv;

void main() {
  float z = dist(vUv);
  // Céu, arma na mão e muito longe: sem oclusão
  if (z > uFar * 0.9 || z < 0.7 || z > 90.0) { gl_FragColor = vec4(1.0, z, 0.0, 1.0); return; }
  vec3 p = viewPos(vUv, z);
  // Normal pela vizinha mais parecida de cada eixo (evita vazar na silhueta)
  vec2 ox = vec2(uTexel.x * 2.0, 0.0), oy = vec2(0.0, uTexel.y * 2.0);
  vec3 pr = viewPos(vUv + ox, dist(vUv + ox)) - p, pl = p - viewPos(vUv - ox, dist(vUv - ox));
  vec3 pu = viewPos(vUv + oy, dist(vUv + oy)) - p, pd = p - viewPos(vUv - oy, dist(vUv - oy));
  vec3 n = normalize(cross(abs(pr.z) < abs(pl.z) ? pr : pl, abs(pu.z) < abs(pd.z) ? pu : pd));

  // Raio fixo no mundo, limitado na tela (perto não estoura o cache; longe não some)
  vec2 rad = clamp(vec2(uRadius) / (2.0 * uProjScale * z), uTexel * 6.0, vec2(0.12));
  float phi = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float occ = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uSamples) break;
    float t = (float(i) + 0.5) / uSamples;
    float a = phi + float(i) * 2.399963;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * rad * sqrt(t);
    vec3 d = viewPos(uv, dist(uv)) - p;
    float l = length(d);
    // Só o que fica na frente da superfície e dentro do raio ocupa o céu deste pixel
    float k = max(dot(n, d) / max(l, 0.001) - 0.05, 0.0);
    occ += k * (1.0 - smoothstep(uRadius * 0.6, uRadius * 1.6, l));
  }
  occ /= uSamples;
  float fade = 1.0 - smoothstep(55.0, 90.0, z);
  gl_FragColor = vec4(clamp(1.0 - occ * uIntensity * fade, 0.0, 1.0), z, 0.0, 1.0);
}`;

/** Desfoque de 5 amostras num eixo, pesado pela diferença de distância. */
const BLUR_FRAG = /* glsl */ `
uniform sampler2D tAo;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec2 c = texture2D(tAo, vUv).rg;
  float sum = c.r, wsum = 1.0;
  for (int i = -2; i <= 2; i++) {
    if (i == 0) continue;
    vec2 s = texture2D(tAo, vUv + uStep * float(i)).rg;
    float w = 1.0 - smoothstep(0.0, 0.06 * c.g + 0.05, abs(s.g - c.g));
    sum += s.r * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, c.g, 0.0, 1.0);
}`;

export class AmbientOcclusion {
  enabled = true;
  /** Raio da oclusão no mundo (m): pega quinas, pé de parede e sob sacadas. */
  radius = 1.4;
  samples = 8;
  /** Ganho da oclusão antes do passe final (que ainda aplica a força e o tom). */
  intensity = 4;
  private readonly a: THREE.WebGLRenderTarget;
  private readonly b: THREE.WebGLRenderTarget;
  private readonly aoMat: THREE.ShaderMaterial;
  private readonly blurMat: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor(depth: THREE.Texture) {
    const opts = { type: THREE.HalfFloatType, format: THREE.RGFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.a = new THREE.WebGLRenderTarget(1, 1, opts);
    this.b = new THREE.WebGLRenderTarget(1, 1, opts);
    const base = { vertexShader: VERT, depthTest: false, depthWrite: false };
    this.aoMat = new THREE.ShaderMaterial({
      ...base,
      fragmentShader: AO_FRAG,
      uniforms: {
        tDepth: { value: depth },
        uNear: { value: 0.1 },
        uFar: { value: 1000 },
        uProjScale: { value: new THREE.Vector2(1, 1) },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: this.radius },
        uSamples: { value: this.samples },
        uIntensity: { value: this.intensity },
      },
    });
    this.blurMat = new THREE.ShaderMaterial({
      ...base,
      fragmentShader: BLUR_FRAG,
      uniforms: { tAo: { value: null }, uStep: { value: new THREE.Vector2() } },
    });
    this.quad = new FullScreenQuad(this.aoMat);
  }

  /** Oclusão final (meia resolução): R = luz que sobra, G = distância. */
  get texture(): THREE.Texture {
    return this.a.texture;
  }

  setSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width / 2));
    const h = Math.max(1, Math.round(height / 2));
    this.a.setSize(w, h);
    this.b.setSize(w, h);
    this.aoMat.uniforms.uTexel.value.set(1 / width, 1 / height);
  }

  render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    const u = this.aoMat.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    const p = camera.projectionMatrix.elements;
    u.uProjScale.value.set(1 / p[0], 1 / p[5]);
    u.uRadius.value = this.radius;
    u.uSamples.value = this.samples;
    u.uIntensity.value = this.intensity;
    this.quad.material = this.aoMat;
    renderer.setRenderTarget(this.a);
    this.quad.render(renderer);
    // Desfoque separável: a -> b (horizontal) -> a (vertical)
    const bu = this.blurMat.uniforms;
    this.quad.material = this.blurMat;
    bu.tAo.value = this.a.texture;
    bu.uStep.value.set(1 / this.a.width, 0);
    renderer.setRenderTarget(this.b);
    this.quad.render(renderer);
    bu.tAo.value = this.b.texture;
    bu.uStep.value.set(0, 1 / this.a.height);
    renderer.setRenderTarget(this.a);
    this.quad.render(renderer);
  }

  dispose() {
    this.a.dispose();
    this.b.dispose();
    this.aoMat.dispose();
    this.blurMat.dispose();
    this.quad.dispose();
  }
}
