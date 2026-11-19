import * as THREE from 'three';
import type { Box } from '../physics';
import { PALETTE } from '../toon';
import { groundLevels, NO_LEVEL } from './ground-levels';

// Luz pintada do cenário (Hi-Fi Rush / Jet Set Radio), direto no shader toon do mundo:
//  - pé das paredes mais escuro e frio até ~1,5 m (oclusão pintada à mão);
//  - rebatida quente do chão nas faces que olham para baixo (sacadas, beirais, marquises)
//    e um pouco nas laterais baixas; topo das paredes recebe mais céu;
//  - perspectiva atmosférica: a névoa usa a cor do céu na direção da vista (mais quente
//    perto do sol, mais azul para cima) e é um pouco mais densa embaixo.
// Tudo por `onBeforeCompile` nos materiais toon do cenário (o Builder chama `sceneLit` no
// `finish`): sem draw call, sem alvo extra. Personagens e viewmodel ficam de fora.

const c = (n: number) => new THREE.Color(n);
const DEFAULT_BASE = 1.6;
const DEFAULT_BASE_TINT = new THREE.Vector3(0.66, 0.6, 0.84);
const DEFAULT_BOUNCE = c(PALETTE.orange).lerp(c(PALETTE.horizon), 0.5).multiplyScalar(0.3);

/** Uniformes compartilhados por todos os materiais do cenário (mudar o valor vale para todos). */
export const SCENE_LIGHT = {
  /** 0 desliga o gradiente pintado (comparação). */
  uLuzOn: { value: 1 },
  /** Altura do chão de referência do mapa (névoa de altura; pé onde não há caixa). */
  uLuzGround: { value: 0 },
  /** Até 4 pisos (rua, laje...) por célula do mapa, crescentes: ver `ground-levels.ts`. */
  tLuzFloors: { value: emptyFloors() as THREE.Texture },
  /** x0, z0, largura e profundidade (m) cobertas por `tLuzFloors`. */
  uLuzFloorRect: { value: new THREE.Vector4(-1e5, -1e5, 2e5, 2e5) },
  /** Altura até onde vai a oclusão pintada (m). */
  uLuzBase: { value: DEFAULT_BASE },
  /** Multiplicador da cor no pé da parede (frio, lilás). */
  uLuzBaseTint: { value: DEFAULT_BASE_TINT.clone() },
  /** Tom da luz indireta (lado sem sol e sombra projetada): lilás frio, como pintura de anime. */
  uLuzShade: { value: new THREE.Vector3(0.96, 0.92, 1.1) },
  /** Intensidade cromática das sombras, também usada pelo pós. */
  uLuzTintStrength: { value: 1 },
  /** Rebatida quente do chão (somada proporcional ao albedo). */
  uLuzBounce: { value: DEFAULT_BOUNCE.clone() },
  /** Céu extra no alto das paredes. */
  uLuzSky: { value: c(PALETTE.colonialSky).lerp(c(PALETTE.cal), 0.5).multiplyScalar(0.07) },
  /** Direção do sol (mundo) e cor da névoa contra o sol. */
  uLuzSunDir: { value: new THREE.Vector3(-0.85, 0.44, 0.27).normalize() },
  uLuzSunFog: { value: c(PALETTE.horizon).lerp(c(PALETTE.sun), 0.35) },
  /** Cor da névoa olhando para cima (perto do zênite). */
  uLuzZenith: { value: c(PALETTE.colonialSky) },
  /** Véu de perspectiva aérea (0 = só a névoa linear do Three). */
  uLuzAerial: { value: 0.3 },
};

function emptyFloors(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Float32Array(4).fill(NO_LEVEL), 1, 1, THREE.RGBAFormat, THREE.FloatType);
  t.needsUpdate = true;
  return t;
}

/** Monta o mapa de pisos a partir das caixas sólidas do mapa (Builder.finish). */
export function setSceneFloors(solids: readonly Box[]) {
  const g = groundLevels(solids);
  if (!g) {
    SCENE_LIGHT.tLuzFloors.value.dispose();
    SCENE_LIGHT.tLuzFloors.value = emptyFloors();
    SCENE_LIGHT.uLuzFloorRect.value.set(-1e5, -1e5, 2e5, 2e5);
    return;
  }
  const t = new THREE.DataTexture(g.data, g.width, g.height, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  SCENE_LIGHT.tLuzFloors.value.dispose();
  SCENE_LIGHT.tLuzFloors.value = t;
  SCENE_LIGHT.uLuzFloorRect.value.set(g.x0, g.z0, g.width * g.cell, g.height * g.cell);
}

export interface SceneLightOptions {
  /** Intensidade cromática das sombras (Bairro usa 65%; padrão 100%). */
  tintStrength?: number;
  /** Altura do chão de referência (padrão 0). */
  ground?: number;
  /** Força da perspectiva aérea extra (padrão 0.3). */
  aerial?: number;
  /** Altura da oclusão pintada no pé das paredes (padrão 1.6 m). */
  base?: number;
  /** Multiplicador da cor no pé das paredes. */
  baseTint?: THREE.Vector3;
  /** Rebatida quente do chão (em luz linear). */
  bounce?: THREE.Color;
  /** Cor da névoa olhando para cima. */
  zenith?: THREE.ColorRepresentation;
  /** Cor da névoa olhando para o sol. */
  sunFog?: THREE.ColorRepresentation;
}

let hasSky = false;

/** Já houve céu configurado (o pós só desenha o brilho do sol se houver). */
export function sceneHasSky(): boolean {
  return hasSky;
}

/** Novo jogo/vitrine não herda o céu nem os pisos da cena descartada. */
export function resetSceneLight(): void {
  hasSky = false;
  setSceneFloors([]);
  SCENE_LIGHT.uLuzTintStrength.value = 1;
  SCENE_LIGHT.uLuzBase.value = DEFAULT_BASE;
  SCENE_LIGHT.uLuzBaseTint.value.copy(DEFAULT_BASE_TINT);
  SCENE_LIGHT.uLuzBounce.value.copy(DEFAULT_BOUNCE);
  SCENE_LIGHT.uLuzOn.value = 1;
}

/** Ajuste por mapa (chamado pelo céu; mapas pedem pelo coordenador). */
export function configureSceneLight(sunDir: THREE.Vector3, opts: SceneLightOptions = {}) {
  hasSky = true;
  const tint = opts.tintStrength ?? 1;
  SCENE_LIGHT.uLuzTintStrength.value = tint;
  SCENE_LIGHT.uLuzShade.value.set(1 - 0.04 * tint, 1 - 0.08 * tint, 1 + 0.1 * tint);
  SCENE_LIGHT.uLuzSunDir.value.copy(sunDir).normalize();
  SCENE_LIGHT.uLuzGround.value = opts.ground ?? 0;
  SCENE_LIGHT.uLuzAerial.value = opts.aerial ?? 0.3;
  SCENE_LIGHT.uLuzBase.value = opts.base ?? DEFAULT_BASE;
  SCENE_LIGHT.uLuzBaseTint.value.copy(opts.baseTint ?? DEFAULT_BASE_TINT);
  SCENE_LIGHT.uLuzBounce.value.copy(opts.bounce ?? DEFAULT_BOUNCE);
  SCENE_LIGHT.uLuzZenith.value.set(opts.zenith ?? PALETTE.colonialSky);
  SCENE_LIGHT.uLuzSunFog.value.set(opts.sunFog ?? c(PALETTE.horizon).lerp(c(PALETTE.sun), 0.35));
}

const VERT_PARS = /* glsl */ `
varying vec3 vLuzWorld;
varying vec3 vLuzNormal;
`;

const VERT_MAIN = /* glsl */ `
  {
    vec4 luzW = vec4(transformed, 1.0);
    vec3 luzN = objectNormal;
    #ifdef USE_INSTANCING
      luzW = instanceMatrix * luzW;
      luzN = mat3(instanceMatrix) * luzN;
    #endif
    vLuzWorld = (modelMatrix * luzW).xyz;
    vLuzNormal = normalize(mat3(modelMatrix) * luzN);
  }
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vLuzWorld;
varying vec3 vLuzNormal;
uniform float uLuzOn, uLuzGround, uLuzBase, uLuzAerial;
uniform sampler2D tLuzFloors;
uniform vec4 uLuzFloorRect;
uniform vec3 uLuzShade, uLuzBaseTint, uLuzBounce, uLuzSky, uLuzSunDir, uLuzSunFog, uLuzZenith;
`;

const FRAG_SHADE = /* glsl */ `
  // Sombra com cor: a parte que só recebe céu (sem sol) puxa para o lilás
  reflectedLight.indirectDiffuse *= mix(vec3(1.0), uLuzShade, uLuzOn);
`;

const FRAG_LIGHT = /* glsl */ `
  if (uLuzOn > 0.0) {
    vec3 luzN = normalize(vLuzNormal);
    // Rebatida quente nas faces viradas para baixo (sacadas, beirais, marquises)
    outgoingLight += diffuseColor.rgb * uLuzBounce * clamp(-luzN.y, 0.0, 1.0) * uLuzOn;
    // Laterais (paredes, caixas): o chão e os topos não escurecem nem leem o mapa de pisos
    float luzSide = 1.0 - smoothstep(0.5, 0.85, abs(luzN.y));
    if (luzSide > 0.0) {
      // Piso logo à frente da face: o mais alto abaixo do pixel (rua, laje, passarela)
      vec2 luzUv = (vLuzWorld.xz + luzN.xz * 0.35 - uLuzFloorRect.xy) / uLuzFloorRect.zw;
      vec4 luzFloors = texture2D(tLuzFloors, luzUv);
      float luzTop = vLuzWorld.y + 0.15;
      float luzFloor = -1e4;
      if (luzFloors.x <= luzTop) luzFloor = luzFloors.x;
      if (luzFloors.y <= luzTop) luzFloor = luzFloors.y;
      if (luzFloors.z <= luzTop) luzFloor = luzFloors.z;
      if (luzFloors.w <= luzTop) luzFloor = luzFloors.w;
      float luzH = vLuzWorld.y - luzFloor;
      // Pé da parede mais escuro e frio (oclusão pintada até ~1,6 m)
      float luzBase = pow(1.0 - smoothstep(0.0, uLuzBase, luzH), 1.5) * (luzH > -0.3 ? 1.0 : 0.0);
      outgoingLight *= mix(vec3(1.0), uLuzBaseTint, luzBase * luzSide * uLuzOn);
      // Logo acima do pé, rebatida quente do chão até ~3,5 m
      float luzLow = (1.0 - smoothstep(0.4, 3.5, luzH)) * (1.0 - luzBase) * 0.45;
      outgoingLight += diffuseColor.rgb * uLuzBounce * luzLow * luzSide * uLuzOn;
      // Alto das paredes pega mais céu
      outgoingLight += diffuseColor.rgb * uLuzSky * smoothstep(3.0, 14.0, luzH) * luzSide * uLuzOn;
    }
  }
`;

const FRAG_FOG = /* glsl */ `
#ifdef USE_FOG
  {
    vec3 luzV = vLuzWorld - cameraPosition;
    vec3 luzDir = normalize(luzV);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    // Névoa de altura: mais densa no fundo do vale, mais rala no alto
    float luzLow = exp(-max(vLuzWorld.y - uLuzGround, 0.0) * 0.06);
    fogFactor = clamp(fogFactor * mix(0.8, 1.2, luzLow), 0.0, 1.0);
    // Perspectiva aérea: véu leve a partir de ~30 m (inimigo a 60 m mal muda)
    float luzAerial = smoothstep(30.0, 160.0, vFogDepth) * uLuzAerial;
    float luzSun = pow(max(dot(luzDir, uLuzSunDir), 0.0), 4.0);
    vec3 luzFog = mix(fogColor, uLuzSunFog, luzSun * 0.75);
    luzFog = mix(luzFog, uLuzZenith, clamp(luzDir.y, 0.0, 1.0) * 0.45);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, luzFog, max(fogFactor, luzAerial));
  }
#endif
`;

const patched = new WeakSet<THREE.Material>();

/** Liga a luz pintada e a névoa atmosférica num material toon opaco do cenário (idempotente). */
export function sceneLit(material: THREE.Material): void {
  // Só toon opaco: decalques transparentes e MeshBasic (multiplicativos, céu) ficam como estão
  if (!(material instanceof THREE.MeshToonMaterial) || material.transparent || patched.has(material)) return;
  patched.add(material);
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, SCENE_LIGHT);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${FRAG_SHADE}`)
      .replace('#include <opaque_fragment>', `${FRAG_LIGHT}\n#include <opaque_fragment>`)
      .replace('#include <fog_fragment>', FRAG_FOG);
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|luz-cenario`;
  material.needsUpdate = true;
}

/** O material já passou por `sceneLit`. */
export function isSceneLit(material: THREE.Material): boolean {
  return patched.has(material);
}
