import { setCharacterQuality } from '../characters/shading';
import { setGrimeQuality } from '../world/grime';
import { setStreetGrimeQuality } from '../world/street-grime';
import type { QualityLevel } from './quality';

// Acabamentos caros fora do pós (sombreamento dos personagens, sujeira de multiplicar dos mapas)
// seguem o nível do pipeline.
// Um ponto só, chamado por `createPipeline` e `setQuality`: vale para treino, online e
// espectador, e um jogo novo não herda o nível do anterior (estado de módulo).

let current: QualityLevel = 0;

export function applyDetailQuality(level: QualityLevel): void {
  current = level;
  setCharacterQuality(level);
  setGrimeQuality(level);
  setStreetGrimeQuality(level);
}

/** Nível em vigor (para o que é construído depois do pipeline, como o mapa do online). */
export function detailQuality(): QualityLevel {
  return current;
}
