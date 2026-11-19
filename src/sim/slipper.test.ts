import { describe, expect, it } from 'vitest';
import { emptyCommand } from './command';
import { createSlipper, stepSlipper } from './slipper';

describe('cadência da Chinelada', () => {
  it('uma pressão dá um golpe; segurar não repete', () => {
    const s = createSlipper();
    const cmd = { ...emptyCommand(), melee: true };
    expect(stepSlipper(s, cmd, 1 / 60, true)).toBe('melee');
    for (let i = 0; i < 100; i++) expect(stepSlipper(s, cmd, 1 / 60, true)).toBeNull();
    stepSlipper(s, emptyCommand(), 1 / 60, true);
    expect(stepSlipper(s, cmd, 1 / 60, true)).toBe('melee');
  });
  it('arremesso consome o chinelo até recolher; morto não ataca', () => {
    const s = createSlipper();
    expect(stepSlipper(s, { ...emptyCommand(), throwSlipper: true }, 1 / 60, false)).toBeNull();
    stepSlipper(s, emptyCommand(), 1, true);
    expect(stepSlipper(s, { ...emptyCommand(), throwSlipper: true }, 1 / 60, true)).toBe('throw');
    expect(s.slipperReady).toBe(false);
    stepSlipper(s, emptyCommand(), 1, true);
    expect(stepSlipper(s, { ...emptyCommand(), melee: true }, 1 / 60, true)).toBeNull();
  });
});
