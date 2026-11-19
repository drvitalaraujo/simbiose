import * as THREE from 'three';
import { PALETTE, toonVertexColors } from '../toon';

// Materiais do viewmodel. A arma é desenhada na mesma cena e no mesmo passe do mundo (o
// pipeline de pós não muda), mas com dois truques no vertex shader:
//  1. projeção própria (FOV fixo, menor que o da câmera e sem o "zoom" da corrida);
//  2. profundidade encolhida: cada ponto é gravado no buffer de profundidade como se
//     estivesse `DEPTH_SCALE` vezes mais perto. Assim a arma nunca atravessa paredes (o
//     jogador não chega a 0,3 m de nada) e, como a escala é uniforme, o contorno de nanquim
//     do pós (laplaciano de 1/z e normais reconstruídas) continua desenhando os vincos dela.

export const VM_FOV = 62;
const DEPTH_SCALE = 0.28;

/** Uniforms compartilhados por todos os materiais do viewmodel (atualize uma vez por quadro). */
export const vmUniforms = {
  vmProj: { value: new THREE.Matrix4() },
  vmDepthA: { value: -1 },
  vmDepthB: { value: -0.1 },
  vmNear: { value: 0.05 },
  vmDepthScale: { value: DEPTH_SCALE },
  /** Brilho da célula de energia (vértices do osso do carregador no material de brilho). */
  vmCell: { value: 1 },
  /**
   * Mira (0 a 1): o que fica atrás da dobradiça (coronha, punho e antebraço direito) gira
   * para baixo e sai da tela, como se encostasse no ombro. No quadril não muda nada.
   */
  vmAim: { value: 0 },
  vmHinge: { value: 0.06 },
};

/** Recalcula a projeção do viewmodel a partir da câmera do jogo (aspecto, near/far). */
export function updateVmUniforms(camera: THREE.PerspectiveCamera) {
  const n = camera.near;
  const f = camera.far;
  vmUniforms.vmProj.value.makePerspective(
    ...frustum(VM_FOV, camera.aspect, n),
    n,
    f,
  );
  // Mesma relação profundidade↔distância da câmera principal: o pós linearizar certo
  vmUniforms.vmDepthA.value = -(f + n) / (f - n);
  vmUniforms.vmDepthB.value = (-2 * f * n) / (f - n);
  vmUniforms.vmNear.value = n * 1.02;
}

function frustum(fov: number, aspect: number, near: number): [number, number, number, number] {
  const top = near * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const right = top * aspect;
  return [-right, right, top, -top];
}

const PROJECT = /* glsl */ `
#include <project_vertex>
gl_Position = vmProj * mvPosition;
{
  float zs = max(-mvPosition.z * vmDepthScale, vmNear);
  gl_Position.z = ((vmDepthA * -zs + vmDepthB) / zs) * gl_Position.w;
}`;

const HEADER = /* glsl */ `
uniform mat4 vmProj;
uniform float vmDepthA, vmDepthB, vmNear, vmDepthScale, vmCell, vmAim, vmHinge;
`;

// Dobra da coronha na mira (posição ainda no espaço da arma, antes dos ossos)
const BEND = /* glsl */ `
#include <begin_vertex>
transformed.y -= vmAim * max(0.0, transformed.z - vmHinge) * 2.4;`;

function patch(material: THREE.Material, key: string, extra?: (s: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }) => void) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, vmUniforms);
    shader.vertexShader = HEADER + shader.vertexShader.replace('#include <project_vertex>', PROJECT).replace('#include <begin_vertex>', BEND);
    extra?.(shader);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

/** Toon com cor por vértice (corpo da arma, luvas, mangas): um draw call só. */
export function vmToon(): THREE.MeshToonMaterial {
  const m = toonVertexColors().clone();
  m.fog = false;
  return patch(m, 'vm-toon-finish-v1', s => {
    s.uniforms.vmMetalTint = { value: new THREE.Color(PALETTE.steelLight) };
    s.vertexShader = 'attribute float vmSurface; varying float vVmSurface;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvVmSurface = vmSurface;');
    s.fragmentShader = 'varying float vVmSurface; uniform vec3 vmMetalTint;\n' + s.fragmentShader;
    // Reflexo de estúdio preso à câmera: recortes amplos no aço, sem textura/PBR/passe extra.
    // Mantém a iluminação toon do mundo e nunca clareia luvas, mangas ou polímero.
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
      vec3 vmEye = normalize(vViewPosition);
      vec3 vmKey = normalize(vec3(-0.6, 0.8, 0.45));
      float vmSheen = smoothstep(0.35, 0.9, dot(normal, vmKey));
      float vmSpec = pow(max(dot(normal, normalize(vmKey + vmEye)), 0.0), 24.0);
      float vmRim = pow(1.0 - max(dot(normal, vmEye), 0.0), 3.0);
      outgoingLight += vmMetalTint * vVmSurface * (vmSheen * 0.16 + vmSpec * 0.45 + vmRim * 0.09);
      #include <opaque_fragment>
    `);
  }) as THREE.MeshToonMaterial;
}

/**
 * Sem luz, cor por vértice já multiplicada por GLOW (neon, mira, célula): estoura no bloom.
 * Os vértices do osso `cellBone` são multiplicados por `vmCell` (a célula apaga na recarga).
 */
export function vmGlow(cellBone: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  return patch(m, `vm-glow-${cellBone}`, (s) => {
    s.vertexShader = s.vertexShader.replace(
      '#include <color_vertex>',
      `#include <color_vertex>
#ifdef USE_SKINNING
  if (abs(skinIndex.x - ${cellBone.toFixed(1)}) < 0.5) vColor.rgb *= vmCell;
#endif`,
    );
  }) as THREE.MeshBasicMaterial;
}

/** Sem luz, cor fixa (clarão do disparo). */
export function vmBasic(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return patch(new THREE.MeshBasicMaterial({ fog: false, ...params }), `vm-basic-${params.transparent ? 't' : 'o'}`) as THREE.MeshBasicMaterial;
}

/**
 * Vidro das ópticas: aditivo e fraco (soma um reflexo da cor da lente, nunca escurece a
 * mira). Os vértices já trazem a cor da lente; `opacity` dosa o reflexo.
 */
export function vmLens(): THREE.MeshBasicMaterial {
  return patch(new THREE.MeshBasicMaterial({
    vertexColors: true, fog: false, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending,
  }), 'vm-lens') as THREE.MeshBasicMaterial;
}
