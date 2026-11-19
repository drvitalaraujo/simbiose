import { describe, expect, it } from 'vitest';
import { sourceUrl } from './source';

describe('endereço do código-fonte', () => {
  it('usa VITE_SOURCE_URL só quando é um endereço http(s)', () => {
    expect(sourceUrl('https://example.com/fork')).toBe('https://example.com/fork');
    expect(sourceUrl('javascript:alert(1)')).toBe('https://github.com/drvitalaraujo/simbiose');
    expect(sourceUrl(undefined)).toBe('https://github.com/drvitalaraujo/simbiose');
  });
});
