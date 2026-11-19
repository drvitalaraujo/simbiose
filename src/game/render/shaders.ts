// Shaders do pós-processamento (ver pipeline.ts).

export const FINAL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const FINAL_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tAo;
uniform float uBloom, uAo;
uniform vec2 uTexel;
uniform float uAspect, uPx, uNear, uFar, uTime;
uniform vec2 uProjScale;
uniform vec3 uInk, uInkFar, uShadowTint, uLightTint, uVignette, uAoTint;
uniform vec3 uSunUv; // xy = sol na tela, z = 1 se está na frente da câmera
uniform vec3 uSunGlare;
varying vec2 vUv;

// Distância (positiva) até a câmera a partir do buffer de profundidade perspectivo
float dist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return -(uNear * uFar) / ((uFar - uNear) * d - uFar);
}

vec3 viewPos(vec2 uv, float z) {
  return vec3((uv * 2.0 - 1.0) * uProjScale * z, -z);
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Oclusão de meia resolução ampliada sem vazar pela silhueta: das 4 amostras vizinhas,
// pesa mais as de distância parecida com a deste pixel.
float upsampleAo(float z) {
  vec2 h = uTexel;
  vec2 a0 = texture2D(tAo, vUv + vec2(-h.x, -h.y)).rg;
  vec2 a1 = texture2D(tAo, vUv + vec2(h.x, -h.y)).rg;
  vec2 a2 = texture2D(tAo, vUv + vec2(-h.x, h.y)).rg;
  vec2 a3 = texture2D(tAo, vUv + vec2(h.x, h.y)).rg;
  float tol = 0.05 * z + 0.04;
  vec4 w = vec4(abs(a0.g - z), abs(a1.g - z), abs(a2.g - z), abs(a3.g - z));
  w = 1.0 / (1e-3 + w / tol);
  return dot(vec4(a0.r, a1.r, a2.r, a3.r), w) / (w.x + w.y + w.z + w.w);
}

// Ombro suave: identidade até a, depois comprime até 1 (não lava as cores chapadas)
vec3 shoulder(vec3 x) {
  const float a = 0.72;
  vec3 over = max(x - a, 0.0);
  return min(x, vec3(a)) + (1.0 - a) * (1.0 - exp(-over / (1.0 - a)));
}

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 col = texture2D(tDiffuse, vUv).rgb;
  if (uBloom > 0.0) {
    // Halo de anime: o brilho volta um pouco mais saturado que a fonte
    vec3 b = texture2D(tBloom, vUv).rgb;
    col += max(mix(vec3(luma(b)), b, 1.25), 0.0) * uBloom;
  }

  // ------------------------------------------------ contorno de nanquim
  float zc = dist(vUv);
  bool sky = zc > uFar * 0.97;
  // Traço grosso perto, fino longe (meia largura em pixels)
  float w = mix(1.35, 0.6, smoothstep(3.0, 50.0, zc)) * uPx;
  vec2 dx = vec2(uTexel.x * w, 0.0);
  vec2 dy = vec2(0.0, uTexel.y * w);
  float zl = dist(vUv - dx), zr = dist(vUv + dx);
  float zd = dist(vUv - dy), zu = dist(vUv + dy);
  float zmin = min(zc, min(min(zl, zr), min(zu, zd)));

  // Silhueta: laplaciano de 1/z (é linear na tela em superfícies planas, então só
  // acende em quinas e em saltos de profundidade, mesmo com o chão em ângulo rasante)
  float wc = 1.0 / zc;
  float lap = (abs(1.0 / zl + 1.0 / zr - 2.0 * wc) + abs(1.0 / zu + 1.0 / zd - 2.0 * wc)) / wc;
  float sil = smoothstep(0.025, 0.07, lap);

  // Vinco: normais reconstruídas nos quatro quadrantes em volta do pixel
  vec3 pc = viewPos(vUv, zc);
  vec3 pl = viewPos(vUv - dx, zl) - pc, pr = viewPos(vUv + dx, zr) - pc;
  vec3 pd = viewPos(vUv - dy, zd) - pc, pu = viewPos(vUv + dy, zu) - pc;
  vec3 n1 = normalize(cross(pr, pu));
  vec3 n2 = normalize(cross(pl, pd));
  vec3 n3 = normalize(cross(pu, pl));
  vec3 n4 = normalize(cross(pd, pr));
  float agree = min(min(dot(n1, n2), dot(n3, n4)), min(dot(n1, n3), dot(n2, n4)));
  float crease = smoothstep(0.55, 0.8, 1.0 - agree);

  // ------------------------------------------------ oclusão ambiente tingida
  // Lilás/ameixa, nunca preta: a sombra de contato continua tendo cor (luz pintada)
  if (uAo > 0.0 && !sky && zc > 0.7) {
    float ao = upsampleAo(zc);
    col *= mix(vec3(1.0), uAoTint, (1.0 - ao) * uAo);
  }

  // A silhueta permanece firme; vincos têm menos tinta para não apagar mãos e ferragens.
  float edge = max(sil, crease * 0.55);
  // Longe, o traço clareia, vira um lilás de névoa e some (perspectiva aérea de anime)
  float far = smoothstep(30.0, 180.0, zmin);
  edge *= 1.0 - 0.8 * smoothstep(110.0, 240.0, zmin);
  // Cor do traço vem da superfície (mais escura e saturada), como no Guilty Gear/Hi-Fi Rush;
  // no céu o traço é o nanquim puro.
  float lc = luma(col);
  vec3 inkSurf = max(mix(vec3(lc), col, 1.8), 0.0) * 0.1 + uInk * 0.7;
  vec3 ink = sky ? uInk : mix(uInk, inkSurf, 0.8);
  ink = mix(ink, uInkFar, far);

  // ------------------------------------------------ brilho do sol na lente
  if (uSunUv.z > 0.0) {
    // Visibilidade: 5 leituras de profundidade em volta do disco (iguais em todo pixel: cache)
    float vis = 0.0;
    vec2 sr = vec2(0.012 / uAspect, 0.012);
    vis += step(uFar * 0.97, dist(clamp(uSunUv.xy, 0.0, 1.0)));
    vis += step(uFar * 0.97, dist(clamp(uSunUv.xy + vec2(sr.x, 0.0), 0.0, 1.0)));
    vis += step(uFar * 0.97, dist(clamp(uSunUv.xy - vec2(sr.x, 0.0), 0.0, 1.0)));
    vis += step(uFar * 0.97, dist(clamp(uSunUv.xy + vec2(0.0, sr.y), 0.0, 1.0)));
    vis += step(uFar * 0.97, dist(clamp(uSunUv.xy - vec2(0.0, sr.y), 0.0, 1.0)));
    vis *= 0.2 * uSunUv.z;
    vec2 sd = (vUv - uSunUv.xy) * vec2(uAspect, 1.0);
    float r = length(sd);
    float glow = exp(-r * 5.0) * 0.22 + exp(-r * 18.0) * 0.3;
    // Risco horizontal fino (lente anamórfica de anime) e um anel fraco
    float streak = exp(-abs(sd.y) * 140.0) * exp(-abs(sd.x) * 2.5) * 0.3;
    float ring = exp(-abs(r - 0.16) * 70.0) * 0.05;
    col += uSunGlare * (glow + streak + ring) * vis;
  }

  // ------------------------------------------------ gradação de cor
  // Split-toning: sombras lilás frias, luzes quentes
  float l = luma(col);
  col *= mix(uShadowTint, uLightTint, smoothstep(0.03, 0.6, l));
  // Saturação seletiva: realça meios-tons coloridos, poupa os cinzas e as altas luzes
  float chroma = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  float sat = 1.0 + 0.16 * smoothstep(0.02, 0.25, chroma) * (1.0 - smoothstep(0.6, 1.4, l));
  col = max(mix(vec3(l), col, sat), 0.0);
  // Curva de contraste suave em torno do meio-cinza (em luz linear)
  col = 0.18 * pow(col / 0.18 + 1e-5, vec3(1.07));
  col = shoulder(col);

  // Meio-tom nas sombras (pontos a 45 graus, como retícula de mangá), só perto
  if (!sky) {
    vec2 px = gl_FragCoord.xy / (4.0 * uPx);
    vec2 cell = vec2(px.x + px.y, px.x - px.y) * 0.7071;
    float shade = 1.0 - smoothstep(0.05, 0.22, l);
    float dotMask = 1.0 - smoothstep(0.3 * shade - 0.05, 0.3 * shade + 0.05, length(fract(cell) - 0.5));
    col *= 1.0 - dotMask * 0.045 * (1.0 - far);
  }

  // Vinheta leve e normalizada pelo enquadramento: ultrawide mantém visão periférica.
  vec2 v = (vUv - 0.5) * 2.0;
  col = mix(col, col * uVignette, smoothstep(0.6, 1.45, length(v)) * 0.28);

  col = mix(col, ink, edge);

  vec3 outc = toSRGB(col);
  outc += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0; // dither contra faixas
  gl_FragColor = vec4(outc, 1.0);
}`;
