import * as THREE from 'three';
import { PALETTE, toonWith } from '../toon';

// Sombreamento próprio dos bonecos (luz de personagem separada da do cenário, como no
// Hi-Fi Rush): por cima do toon da cena, cada boneco ganha
//  - piso de luz próprio em duas faixas, coerente com o sol: nunca some num beco escuro;
//  - sombra quente na pele (o "vermelho" da luz que atravessa a pele, pintado);
//  - contorno de luz (fresnel) na cor do céu, em faixa dura, que recorta a silhueta do fundo;
//  - faixa de brilho anime no cabelo ("angel ring", Kajiya-Kay deslocado e serrilhado);
//  - faixa de reflexo no metal, olhos sempre claros, piscar e clarão de dano.
// O material é um por boneco (uniforms próprios: piscar, dano), mas o programa é um só.

/** Tipo de superfície por vértice (atributo `charMat.x`). */
export const SURFACE = { cloth: 0, skin: 1, hair: 2, metal: 3, eye: 4, blink: 5, glow: 6 } as const;
export type Surface = (typeof SURFACE)[keyof typeof SURFACE];

const SKIN_COLORS = new Set<number>([PALETTE.skinWarm, PALETTE.skinDeep, PALETTE.skinLight]);
const METAL_COLORS = new Set<number>([PALETTE.steel, PALETTE.steelLight]);

/** Superfície padrão de uma cor da paleta (pele e aço têm resposta própria). */
export function surfaceOf(color: number): Surface {
  if (SKIN_COLORS.has(color)) return SURFACE.skin;
  if (METAL_COLORS.has(color)) return SURFACE.metal;
  return SURFACE.cloth;
}

export interface CharacterShading {
  material: THREE.MeshToonMaterial;
  /** 0 = olho aberto, 1 = fechado. */
  blink: { value: number };
  /** Clarão de dano (0..1). */
  hit: { value: number };
  /** Atualiza a direção da luz (chame no `onBeforeRender` das malhas do boneco). */
  sync(scene: THREE.Scene, camera: THREE.Camera): void;
}

const RIM = new THREE.Color(PALETTE.colonialSky).lerp(new THREE.Color(PALETTE.paper), 0.35);
const HIT = new THREE.Color(PALETTE.paper);
const LIT_TINT = new THREE.Color(PALETTE.sun).lerp(new THREE.Color(PALETTE.paper), 0.5);
const SHADE_TINT = new THREE.Color(PALETTE.concrete).lerp(new THREE.Color(PALETTE.colonialSky), 0.4);

const suns = new WeakMap<THREE.Scene, THREE.DirectionalLight | null>();
/** O sol da cena: a luz direcional que faz sombra (ou a mais forte). Procura uma vez por cena. */
function sunOf(scene: THREE.Scene): THREE.DirectionalLight | null {
  let sun = suns.get(scene);
  if (sun === undefined || (sun && !sun.parent)) {
    sun = null;
    scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (!l.isDirectionalLight) return;
      if (!sun || (l.castShadow && !sun.castShadow) || (l.castShadow === sun.castShadow && l.intensity > sun.intensity)) sun = l;
    });
    suns.set(scene, sun);
  }
  return sun;
}

const DEFAULT_SUN = new THREE.Vector3(-0.55, 0.75, 0.35).normalize();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// Compartilhado: avatares existentes e futuros acompanham a qualidade sem recompilar.
const detail = { value: 1 };
export function setCharacterQuality(level: 0 | 1 | 2 | 3): void {
  detail.value = level < 2 ? 1 : 0;
}

export function characterShading(): CharacterShading {
  const material = toonWith({ color: 0xffffff, vertexColors: true });
  const uniforms = {
    charKey: { value: new THREE.Vector3(0, 1, 0) },
    charUp: { value: new THREE.Vector3(0, 1, 0) },
    charRim: { value: RIM.clone() },
    charLit: { value: LIT_TINT.clone() },
    charShade: { value: SHADE_TINT.clone() },
    charHitColor: { value: HIT.clone() },
    charBlink: { value: 0 },
    charHit: { value: 0 },
    charDetail: detail,
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 charMat;
uniform float charBlink;
varying float vCharSurface;
varying vec3 vCharRest;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vCharSurface = charMat.x;
vCharRest = position;
// Piscar: as peças do olho achatam na vertical até o centro do próprio olho.
if (charMat.x > 4.5 && charMat.x < 5.5) transformed.y = charMat.z + (transformed.y - charMat.z) * (1.0 - 0.9 * charBlink);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 charKey;
uniform vec3 charUp;
uniform vec3 charRim;
uniform vec3 charLit;
uniform vec3 charShade;
uniform vec3 charHitColor;
uniform float charHit;
uniform float charDetail;
varying float vCharSurface;
varying vec3 vCharRest;`)
      .replace('#include <opaque_fragment>', `{
  float surf = floor(vCharSurface + 0.5);
  vec3 N = normalize(normal);
  vec3 V = normalize(vViewPosition);
  vec3 albedo = diffuseColor.rgb;
  float ndl = dot(N, charKey);
  float lit = smoothstep(-0.04, 0.06, ndl);
  bool glow = surf > 5.5;
  bool eye = surf > 3.5 && surf < 5.5;
  if (!glow) {
    // Piso de luz do personagem: duas faixas, frias na sombra e quentes na luz.
    vec3 floorLight = albedo * mix(charShade * 0.5, charLit * 0.78, lit);
    outgoingLight = max(outgoingLight, floorLight);
    if (eye) outgoingLight = max(outgoingLight, albedo * 0.95);
    // Pele: sombra quente e terminador avermelhado.
    if (surf > 0.5 && surf < 1.5) {
      float terminator = smoothstep(-0.25, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.2, ndl));
      outgoingLight += albedo * ((1.0 - lit) * vec3(0.14, 0.03, 0.0) + terminator * vec3(0.2, 0.04, 0.0));
    }
    if (charDetail > 0.5) {
    vec3 H = normalize(charKey + V);
    // Cabelo: faixa anime (Kajiya-Kay com a tangente deslocada pela normal), serrilhada.
    if (surf > 1.5 && surf < 2.5) {
      vec3 T = normalize(charUp + N * 0.55);
      float th = dot(T, H);
      float aniso = pow(sqrt(max(0.0, 1.0 - th * th)), 90.0);
      float jag = 0.06 * sin(vCharRest.x * 140.0 + vCharRest.z * 60.0);
      float ring = smoothstep(0.55 + jag, 0.62 + jag, aniso) * (0.35 + 0.65 * lit);
      outgoingLight += ring * mix(charRim, vec3(1.0), 0.4) * 0.42;
    }
    // Metal: uma faixa de reflexo dura.
    if (surf > 2.5 && surf < 3.5) outgoingLight += smoothstep(0.9, 0.93, dot(N, H)) * charLit * 0.45;
    // Contorno de luz: fresnel em faixa, mais forte do lado do sol, e sempre um pouco atrás.
    float fres = 1.0 - max(dot(N, V), 0.0);
    float rim = smoothstep(0.6, 0.66, fres) * (0.3 + 0.7 * smoothstep(-0.35, 0.25, ndl));
    // Sem contorno de luz em faces viradas para o chão (solas) e menos em cor já clara (bloom).
    rim *= smoothstep(-0.55, -0.2, dot(N, charUp)) * smoothstep(0.06, 0.3, vCharRest.y);
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    outgoingLight += rim * charRim * 0.34 * (1.0 - 0.65 * lum);
    }
  }
  outgoingLight = mix(outgoingLight, charHitColor, charHit * 0.6);
}
#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'character-shading-v2';

  const keyView = uniforms.charKey.value;
  const upView = uniforms.charUp.value;
  return {
    material,
    blink: uniforms.charBlink,
    hit: uniforms.charHit,
    sync(scene, camera) {
      const sun = sunOf(scene);
      if (sun) {
        sun.getWorldPosition(_a);
        sun.target.getWorldPosition(_b);
        keyView.copy(_a.sub(_b)).normalize();
        if (keyView.lengthSq() < 0.5) keyView.copy(DEFAULT_SUN);
      } else keyView.copy(DEFAULT_SUN);
      keyView.transformDirection(camera.matrixWorldInverse);
      upView.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
    },
  };
}
