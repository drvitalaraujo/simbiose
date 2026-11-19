// Em que bloco espacial cai cada peça do cenário (lógica pura, sem Three.js).
//
// O Builder mescla a geometria por material *dentro de cada bloco*. Assim cada malha
// mesclada tem uma esfera envolvente pequena e o frustum culling descarta o que está fora
// da tela (inclusive no passe de sombra). Perto: grade de CHUNK metros. Longe (silhueta da
// cidade, nuvens): fatias de pizza em volta do centro, para não virar uma chuva de draw calls.

/** Lado do bloco da grade, em metros. */
export const CHUNK = 48;
/** A partir dessa distância do centro, a peça vai para uma fatia angular. */
export const FAR_RING = 112;
/** Número de fatias angulares do anel distante. */
export const SECTORS = 12;

export function chunkKey(x: number, z: number): string {
  if (Math.hypot(x, z) >= FAR_RING) {
    const a = Math.atan2(z, x) + Math.PI; // 0..2π
    return `s${Math.min(SECTORS - 1, Math.floor((a / (Math.PI * 2)) * SECTORS))}`;
  }
  return `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
}
