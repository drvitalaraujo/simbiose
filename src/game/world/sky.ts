import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { configureSceneLight } from '../render/scene-light';
import { PALETTE } from '../toon';
import { Builder, paint, place } from './builder';
import { rng } from './shapes';
import { cloudField, CLOUD_WIDTH, CLOUD_HEIGHT } from './sky-clouds';

// Céu de fim de tarde em anime: atmosfera suave, disco solar e nuvens em três tons.

/** Disco, nuvens e sombra compartilham a mesma direção de luz. */
const SUN_POSITION = new THREE.Vector3(-62, 32, 20);
export const SUN_DIR = SUN_POSITION.clone().normalize();
const SKY_RADIUS = 260;

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  // Céu acompanha a câmera: a translação do jogador não pode cortar a esfera no far.
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position.z = gl_Position.w;
}`;

const FRAG = /* glsl */ `
uniform vec3 uTop, uMid, uLow, uHorizon, uGround, uSun, uSunDir, uWarm, uCloudLit, uCloudShade;
uniform float uTime;
uniform sampler2D tClouds;
uniform vec2 uCloudHeight;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float sunDot = dot(normalize(d.xz), normalize(uSunDir.xz));
  float toSun = smoothstep(-0.2, 1.0, sunDot); // lado do sol fica mais quente
  float az = atan(d.z, d.x);
  // Um campo RG periódico substitui o ruído fractal recalculado em cada pixel.
  // Derivada do ângulo pela direção: não seleciona mip borrado na emenda de atan.
  const float INV_TAU = 0.159154943;
  vec2 cloudUv = vec2(az * INV_TAU + 0.5 + uTime * 0.000212, h * uCloudHeight.x + uCloudHeight.y);
  float azScale = INV_TAU / max(dot(d.xz, d.xz), 0.00001);
  vec2 cloudDx = vec2((d.x * dFdx(d.z) - d.z * dFdx(d.x)) * azScale, dFdx(h) * uCloudHeight.x);
  vec2 cloudDy = vec2((d.x * dFdy(d.z) - d.z * dFdy(d.x)) * azScale, dFdy(h) * uCloudHeight.x);
  vec2 fields = texture2DGradEXT(tClouds, cloudUv, cloudDx, cloudDy).rg;
  // Gradiente pintado: a altura ganha um leve ondulado de pincel (faixas largas, não ruído)
  float hc = clamp(h, 0.0, 1.0);
  float t = hc + (noise(vec2(az * 2.0, hc * 3.0)) - 0.5) * 0.035 * smoothstep(0.02, 0.2, hc);
  vec3 low = mix(uLow, uWarm, toSun * 0.65);
  vec3 col = mix(mix(uHorizon, uWarm, toSun * 0.45), low, smoothstep(0.0, 0.1, t));
  col = mix(col, uMid, smoothstep(0.1, 0.34, t));
  col = mix(col, uTop, smoothstep(0.3, 0.85, t));
  // Faixa quente e fina colada no horizonte, mais forte do lado do sol
  col = mix(col, mix(uHorizon, uSun, 0.35), (1.0 - smoothstep(0.0, 0.05, abs(h - 0.01))) * (0.25 + 0.4 * toSun));
  col = mix(col, uGround, 1.0 - smoothstep(-0.15, 0.0, h));

  // Halo do sol (antes das nuvens: elas passam na frente do brilho)
  float ang = length(d - uSunDir);
  float R = 0.065;
  float halo = 1.0 - smoothstep(R, R * 6.0, ang);
  col = mix(col, uSun, halo * halo * 0.32);
  col += uWarm * exp(-ang * 3.2) * 0.12;

  // Camada baixa: nuvens de anime em bolos, recortadas em 3 tons e andando devagar.
  // A deformação já está no campo; a borda de dentro acende do lado do sol.
  if (h > 0.02 && h < 0.42) {
    float band = smoothstep(0.03, 0.1, h) * (1.0 - smoothstep(0.22, 0.4, h));
    float m = (fields.r - 0.1) * band;
    float aa = max(fwidth(m), 0.006);
    float body = smoothstep(0.32 - aa, 0.32 + aa, m);
    // Faixa da borda (perto do limiar) acesa; o miolo fica no tom da sombra
    float rim = body * (1.0 - smoothstep(0.36 - aa, 0.36 + aa, m));
    vec3 shade = mix(uCloudShade, uMid, 0.25);
    vec3 cc = mix(shade, mix(uCloudLit, uSun, 0.25 * toSun), 0.3 + 0.45 * toSun);
    cc = mix(cc, mix(uCloudLit, uSun, 0.6), rim * (0.25 + 0.6 * toSun));
    col = mix(col, cc, body * 0.92);
  }

  // Cirros: faixas longas de nuvem fina, recortadas em 2 tons (lado do sol aceso)
  if (h > 0.03) {
    float band = smoothstep(0.08, 0.5, h) * (1.0 - smoothstep(0.5, 0.75, h));
    float m = fields.g * band;
    vec3 cl = mix(uCloudShade, uCloudLit, toSun);
    float aa = max(fwidth(m), 0.006);
    col = mix(col, cl, smoothstep(0.39 - aa, 0.39 + aa, m) * 0.68);
    col = mix(col, mix(uCloudLit, uSun, 0.5), smoothstep(0.47 - aa, 0.47 + aa, m) * toSun * 0.9);
  }

  // Distância de corda: dispensa acos por pixel; disco estilizado com borda filtrada.
  float dy = h - uSunDir.y;
  // Disco acima de 1.0 em luz linear: passa do limiar do bloom
  float edge = max(fwidth(ang), 0.0003);
  vec3 disk = mix(uSun * 1.7, uHorizon, (1.0 - smoothstep(-R, 0.02, dy)) * 0.4);
  col = mix(col, disk, 1.0 - smoothstep(R - edge, R + edge, ang));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** Cor da névoa: silhuetas pintadas além dela (`world/backdrop.ts`) se fundem no mesmo tom. */
export function fogColor(): THREE.Color {
  return new THREE.Color(PALETTE.sky).lerp(new THREE.Color(PALETTE.horizon), 0.35);
}

/**
 * Monta céu, luzes e nuvens. Devolve a animação do céu (cirros andando). `clear`: rumos
 * (ângulo no plano xz, como `Math.atan2(z, x)`) sem cúmulos, atrás de marcos do horizonte.
 */
export function buildSky(scene: THREE.Scene, b: Builder, coastal = false, clear: number[] = [], tropical = false): (dt: number, time: number) => void {
  const c = (n: number) => new THREE.Color(n);
  const cloudTexture = new THREE.DataTexture(cloudField(), CLOUD_WIDTH, CLOUD_HEIGHT, THREE.RGFormat);
  cloudTexture.wrapS = THREE.RepeatWrapping;
  cloudTexture.magFilter = THREE.LinearFilter;
  cloudTexture.minFilter = THREE.LinearMipmapLinearFilter;
  cloudTexture.generateMipmaps = true;
  cloudTexture.needsUpdate = true;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        tClouds: { value: cloudTexture },
        uCloudHeight: { value: new THREE.Vector2((CLOUD_HEIGHT - 1) / CLOUD_HEIGHT, 0.5 / CLOUD_HEIGHT) },
        uTop: { value: c(coastal ? PALETTE.colonialBlue : PALETTE.skyDeep) },
        uMid: { value: coastal ? c(PALETTE.colonialSky) : c(PALETTE.skyTop).lerp(c(PALETTE.magenta), 0.25) },
        uLow: { value: c(coastal ? PALETTE.cal : PALETTE.sky) },
        uWarm: { value: c(tropical ? PALETTE.cal : PALETTE.orange) },
        uCloudLit: { value: c(tropical ? PALETTE.cal : PALETTE.horizon) },
        uCloudShade: { value: coastal ? c(PALETTE.colonialSky).lerp(c(PALETTE.cal), 0.45) : c(PALETTE.magenta).lerp(c(PALETTE.lilac), 0.4) },
        uTime: { value: 0 },
        uHorizon: { value: c(tropical ? PALETTE.cal : PALETTE.horizon) },
        uGround: { value: c(tropical ? PALETTE.seaDeep : PALETTE.concreteDark) },
        uSun: { value: c(PALETTE.sun) },
        uSunDir: { value: SUN_DIR },
      },
    }),
  );
  sky.material.addEventListener('dispose', () => cloudTexture.dispose());
  // Desenhado por último entre os opacos, com teste de profundidade: o shader do céu
  // só roda nos pixels que sobram entre os prédios. Desenhado primeiro, ele pintava a
  // tela inteira e custava ~4 ms numa Intel integrada.
  sky.renderOrder = 10;
  sky.frustumCulled = false;
  sky.raycast = () => {};
  scene.add(sky);

  // Névoa na cor do horizonte: os prédios distantes viram camadas de silhueta. O cenário
  // tinge a névoa pela direção da vista (render/scene-light.ts): quente para o sol, céu para cima.
  scene.fog = new THREE.Fog(
    tropical ? c(PALETTE.cal).lerp(c(PALETTE.colonialSky), 0.22) : fogColor(),
    tropical ? 78 : 45,
    tropical ? 340 : 250,
  );
  configureSceneLight(SUN_DIR, {
    tintStrength: tropical ? 0.72 : coastal ? 1 : 0.65,
    aerial: tropical ? 0.2 : 0.3,
    base: tropical ? 1.05 : undefined,
    baseTint: tropical ? new THREE.Vector3(0.84, 0.81, 0.91) : undefined,
    bounce: tropical ? c(PALETTE.beachSand).lerp(c(PALETTE.sun), 0.35).multiplyScalar(0.32) : undefined,
    zenith: coastal ? c(PALETTE.colonialSky).lerp(c(PALETTE.colonialBlue), 0.3) : c(PALETTE.skyTop).lerp(c(PALETTE.magenta), 0.25),
    sunFog: tropical ? c(PALETTE.cal).lerp(c(PALETTE.sun), 0.3) : c(PALETTE.horizon).lerp(c(PALETTE.orange), 0.25),
  });

  // Luz: céu quente por cima, rebote lilás por baixo; sol baixo e alaranjado (sombras longas)
  scene.add(new THREE.HemisphereLight(c(PALETTE.cal).lerp(c(PALETTE.colonialSky), 0.3), PALETTE.concreteDark, 1.1));
  const sun = new THREE.DirectionalLight(c(PALETTE.sun).lerp(c(PALETTE.orange), 0.16), 2.35);
  sun.position.copy(SUN_POSITION);
  // Contraluz rosa do lado oposto: recorta as faces na sombra (rim light de anime)
  const rim = new THREE.DirectionalLight(c(PALETTE.colonialSky).lerp(c(PALETTE.magenta), 0.25), 0.45);
  rim.position.set(50, 18, -30);
  scene.add(rim);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -62;
  cam.right = 62;
  cam.top = 62;
  cam.bottom = -62;
  cam.near = 10;
  cam.far = 200;
  // Borda da sombra mais macia (PCF girado por ruído; o pós limpa o pontilhado)
  sun.shadow.radius = 2.5;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  // O mapa de sombra é estático (render/pipeline.ts). O Builder usa este volume para tirar
  // projeção e recepção de sombra do que fica fora dele (cidade distante, silhueta, nuvens).
  cam.position.copy(sun.position);
  cam.lookAt(sun.target.position);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  b.shadowFrustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));

  const cumulus = clouds(coastal, clear);
  scene.add(cumulus);
  const uTime = (sky.material as THREE.ShaderMaterial).uniforms.uTime;
  return (_dt, time) => {
    uTime.value = time;
    // Deriva lenta dos cúmulos (vai e volta: o recorte atrás dos marcos continua livre)
    cumulus.rotation.y = Math.sin(time * 0.01) * 0.035;
  };
}

/**
 * Nuvens de anime (cúmulos estilo Shinkai): bolhas grandes iluminadas pelo sol em 3 faixas.
 * Uma malha só (um draw call), girando devagar em volta do mapa.
 */
function clouds(coastal: boolean, clear: number[]): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const r = rng(99);
  const lit = new THREE.Color(PALETTE.sun).lerp(new THREE.Color(PALETTE.horizon), 0.35);
  const mid = coastal ? new THREE.Color(PALETTE.cal) : new THREE.Color(PALETTE.sky).lerp(new THREE.Color(PALETTE.orange), 0.25);
  const shade = coastal ? new THREE.Color(PALETTE.colonialSky) : new THREE.Color(PALETTE.lilac).lerp(new THREE.Color(PALETTE.magenta), 0.35);
  const n = new THREE.Vector3();
  const sunAz = Math.atan2(SUN_DIR.z, SUN_DIR.x);
  const COUNT = 22;
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2 + r() * 0.25;
    const da = Math.atan2(Math.sin(a - sunAz), Math.cos(a - sunAz));
    if (Math.abs(da) < 0.16) continue; // deixa o disco do sol livre
    if (clear.some((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < 0.3)) continue;
    const dist = 200 + r() * 35;
    const tower = r() < 0.45; // cúmulo alto que sobe do horizonte
    const y = tower ? 18 + r() * 12 : 45 + r() * 50;
    const cx = Math.cos(a) * dist;
    const cz = Math.sin(a) * dist;
    const size = tower ? 16 + r() * 10 : 9 + r() * 8;
    const puffs = tower ? 9 + Math.floor(r() * 5) : 4 + Math.floor(r() * 4);
    for (let k = 0; k < puffs; k++) {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const s = size * (0.55 + r() * 0.5);
      const off = (k / puffs - 0.5) * size * (tower ? 2.6 : 3.2);
      // Torre: as bolhas do meio sobem mais (pirâmide fofa)
      const lift = tower ? (1 - Math.abs(off) / (size * 1.4)) * size * 1.6 * (0.6 + r() * 0.6) : r() * size * 0.4;
      g.scale(s * 1.25, s * (tower ? 0.85 : 0.5), s);
      place(g, cx - Math.sin(a) * off, y + Math.max(0, lift), cz + Math.cos(a) * off);
      paint(g, PALETTE.paper);
      const col = g.attributes.color;
      const pos = g.attributes.position;
      const nor = g.attributes.normal;
      for (let v = 0; v < pos.count; v++) {
        n.set(nor.getX(v), nor.getY(v), nor.getZ(v)).normalize();
        // Luz do sol baixo + um pouco de céu por cima; recorte em 3 tons
        const l = n.dot(SUN_DIR) * 0.75 + n.y * 0.35;
        const tone = l > 0.32 ? lit : l > -0.05 ? mid : shade;
        col.setXYZ(v, tone.r, tone.g, tone.b);
      }
      g.deleteAttribute('uv');
      geos.push(g);
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos, false) ?? new THREE.BufferGeometry(), mat);
  mesh.raycast = () => {};
  mesh.frustumCulled = false;
  return mesh;
}
