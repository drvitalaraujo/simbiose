import { describe, expect, it } from 'vitest';
import { basePixelRatio, initialQuality, isWeakGpu, qualitySettings, stepQuality } from './quality';

const run = (ms: number, seconds: number, start = initialQuality('')) => {
  let s = start;
  for (let t = 0; t < seconds; t += 1 / 60) s = stepQuality(s, ms, 1 / 60);
  return s;
};

describe('qualidade adaptativa', () => {
  it('não mexe quando o jogo está rápido', () => {
    expect(run(12, 10).level).toBe(0);
  });

  it('baixa um nível depois de ~2 s lento', () => {
    expect(run(35, 1).level).toBe(0);
    expect(run(35, 3).level).toBe(1);
  });

  it('pico isolado não derruba a qualidade', () => {
    let s = initialQuality('');
    for (let i = 0; i < 600; i++) s = stepQuality(s, i % 60 === 0 ? 80 : 12, 1 / 60);
    expect(s.level).toBe(0);
  });

  it('?low começa no nível 2 e nunca passa de 3', () => {
    expect(initialQuality('?low').level).toBe(2);
    expect(run(60, 30).level).toBe(3);
  });

  it('voltar de aba em segundo plano (dt gigante) não derruba a qualidade', () => {
    let s = run(12, 2);
    // A aba ficou 5 s escondida: o primeiro quadro chega com dt de 5 s
    for (let i = 0; i < 3; i++) s = stepQuality(s, 5000, 0.1);
    s = run(12, 3, s);
    expect(s.level).toBe(0);
    expect(s.avgMs).toBeLessThan(16);
  });

  it('cada nível só tira coisa (resolução cai, bloom some por último)', () => {
    const scales = ([0, 1, 2, 3] as const).map((l) => qualitySettings(l).scale);
    expect(scales).toEqual([...scales].sort((a, b) => b - a));
    expect(qualitySettings(2).bloom).toBe(true);
    expect(qualitySettings(3).bloom).toBe(false);
  });

  it('oclusão e brilho do sol desligam nos níveis econômicos', () => {
    const ao = ([0, 1, 2, 3] as const).map((l) => qualitySettings(l).aoSamples);
    expect(ao).toEqual([...ao].sort((a, b) => b - a));
    expect(qualitySettings(2).aoSamples).toBe(0);
    expect(qualitySettings(2).glare).toBe(false);
    expect(qualitySettings(3).aoSamples).toBe(0);
    expect(qualitySettings(3).glare).toBe(false);
  });
});

describe('GPU fraca', () => {
  it('reconhece GPUs integradas pelo nome do renderizador', () => {
    expect(isWeakGpu('ANGLE (Intel, Intel(R) Graphics (0x00007D67) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isWeakGpu('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isWeakGpu('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(isWeakGpu('Mali-G78')).toBe(true);
    expect(isWeakGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(isWeakGpu('ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
  });

  it('pixelRatio 1 em GPU fraca, até 1.5 nas outras', () => {
    expect(basePixelRatio(2, true)).toBe(1);
    expect(basePixelRatio(2, false)).toBe(1.5);
    expect(basePixelRatio(1, false)).toBe(1);
  });
});
