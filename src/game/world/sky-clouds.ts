// Campos das nuvens, calculados uma vez na CPU. O céu só consulta dois canais da
// textura: evita dezenas de ruídos e centenas de senos por pixel em cada quadro.
// Ruído periódico no azimute: não existe emenda ao olhar para trás do mapa.
export const CLOUD_WIDTH = 1024;
export const CLOUD_HEIGHT = 256;

const wrap = (n: number, period: number) => ((n % period) + period) % period;
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function hash(x: number, y: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number, period: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  // cloudFields normaliza a volta; a deformação e os deslocamentos mantêm X positivo.
  const a = ix % period, b = a + 1 === period ? 0 : a + 1;
  const u = fade(x - ix), v = fade(y - iy);
  return mix(mix(hash(a, iy), hash(b, iy), u), mix(hash(a, iy + 1), hash(b, iy + 1), u), v);
}

function fbm(x: number, y: number, period: number): number {
  let value = 0, amplitude = 0.5;
  for (let octave = 0; octave < 4; octave++) {
    value += noise(x, y, period) * amplitude;
    x = x * 2 + 7; y = y * 2 + 13; period *= 2; amplitude *= 0.5;
  }
  return value;
}

/** Azimute em voltas, altura normalizada: massas baixas e pinceladas de cirros. */
export function cloudFields(turn: number, height: number): [number, number] {
  const u = wrap(turn, 1);
  const warp = fbm(u * 20, height * 7, 20);
  const low = fbm(u * 28 + warp * 0.9, height * 10 + warp * 0.45, 28);
  const high = fbm(u * 30 + warp * 0.4, height * 22, 30)
    - 0.15 * fbm(u * 76, height * 88, 76);
  return [low, Math.max(0, high)];
}

/** RG8, centros de texel em X e polos em Y; bytes sem correção de cor. */
export function bakeCloudField(width = CLOUD_WIDTH, height = CLOUD_HEIGHT): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 2) {
    throw new Error('A textura de nuvens precisa de dimensões inteiras, largura ≥ 1 e altura ≥ 2.');
  }
  const data = new Uint8Array(width * height * 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [low, high] = cloudFields((x + 0.5) / width, y / (height - 1));
      const offset = (y * width + x) * 2;
      data[offset] = Math.round(low * 255);
      data[offset + 1] = Math.round(high * 255);
    }
  }
  return data;
}

let cached: Uint8Array | undefined;

/** Trocar de mapa reaproveita os bytes; cada cena continua dona da sua textura GPU. */
export function cloudField(): Uint8Array {
  return cached ??= bakeCloudField();
}
