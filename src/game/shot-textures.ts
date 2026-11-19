import * as THREE from 'three';
import { PALETTE } from './toon';

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const WHITE: [number, number, number] = [255, 255, 255];
const HOLE = rgb(PALETTE.ink);
const CHIP = rgb(PALETTE.cobbleStone);

/** Texturas procedurais próprias: sem downloads, canvas ou atlas do cenário. */
export function shotTexture(kind: 'mark' | 'smoke'): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const angle = Math.atan2(v, u);
    const r = Math.hypot(u, v);
    let alpha: number;
    let tint = WHITE;
    if (kind === 'smoke') {
      const edge = r * (1 + 0.1 * Math.sin(angle * 5) + 0.07 * Math.cos(angle * 3));
      alpha = Math.pow(Math.max(0, 1 - edge * edge), 2);
    } else {
      const edge = r * (1 + 0.12 * Math.sin(angle * 7) + 0.08 * Math.cos(angle * 11));
      const core = 1 - THREE.MathUtils.smoothstep(edge, 0.24, 0.43);
      const rim = Math.max(0, 1 - Math.abs(edge - 0.48) / 0.18) * 0.5;
      const crack = Math.pow(Math.max(0, Math.cos(angle * 7 + r * 3)), 32) * 0.65;
      alpha = Math.max(core, rim, crack) * (1 - THREE.MathUtils.smoothstep(edge, 0.65, 0.95));
      // Buraco em tinta escura; borda lascada clara (o reboco exposto pega luz)
      const light = rim > core && rim > crack ? 1 : 0;
      tint = light ? CHIP : HOLE;
    }
    const i = (y * size + x) * 4;
    data[i] = tint[0];
    data[i + 1] = tint[1];
    data[i + 2] = tint[2];
    data[i + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Opacidade por instância: mantém marcas e fumaça em um draw call cada. */
export function instanceFade(material: THREE.Material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float instanceOpacity; varying float vInstanceOpacity;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
    shader.fragmentShader = 'varying float vInstanceOpacity;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vInstanceOpacity;');
  };
  material.customProgramCacheKey = () => 'shot-instance-fade';
}
