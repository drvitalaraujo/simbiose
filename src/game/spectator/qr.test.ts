import { describe, expect, it } from 'vitest';
import { qrMatrix, qrSvg } from './qr';

describe('QR do convite', () => {
  it('gera a matriz com os três quadrados de posição', () => {
    const link = 'https://simbiose.example/?online&sala=AbC123xyz&servidor=wss%3A%2F%2Fjogo.example';
    const m = qrMatrix(link);
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect((n - 17) % 4).toBe(0); // tamanho válido de QR (versão 1..40)
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      expect(m[r][c]).toBe(true); // canto do quadrado de posição
      expect(m[r + 1][c + 1]).toBe(false); // anel claro
      expect(m[r + 3][c + 3]).toBe(true); // miolo
    }
  });

  it('SVG com margem clara e cores pedidas', () => {
    const svg = qrSvg('oi', '#1a1026', '#f4ecff');
    expect(svg).toMatch(/^<svg[^>]+viewBox="0 0 29 29"/); // 21 módulos + 2 × 4 de margem
    expect(svg).toContain('fill="#f4ecff"');
    expect(svg).toContain('fill="#1a1026"');
  });
});
