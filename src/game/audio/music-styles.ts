// Partituras da trilha (dados). Notação em music-patterns.ts. Todos os temas são autorais.
import type { Style, StyleId } from './music-patterns';

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];

/** Tema do SIMBIOSE: neon em meio-tempo com ganzá e agogô por baixo (Ré menor). */
const menu: Style = {
  id: 'menu', name: 'Tema SIMBIOSE', bpm: 112, swing: 0.08, key: 2, scale: MINOR,
  chords: [{ root: 2, quality: 'm9' }, { root: 10, quality: 'maj7' }, { root: 7, quality: 'm7' }, { root: 9, quality: '7' }],
  bassWave: 'sawtooth', leadWave: 'square',
  tracks: [
    { inst: 'pad', pattern: 'X... .... .... ....', min: 0, gain: 0.5 },
    { inst: 'pluck', pattern: '1..5 ..8. 3..5 ..7.', min: 0, gain: 0.4 },
    { inst: 'ganza', pattern: 'gggx gggx gggx gggx', min: 0, gain: 0.5 },
    { inst: 'agogoLow', alt: 'agogoHigh', pattern: 'o.x. oo.x .o.x o.x.', min: 1, gain: 0.45 },
    { inst: 'kick', pattern: 'X... ...x ..X. ....', min: 1 },
    { inst: 'snare', pattern: '.... .... X... ...g', min: 1, gain: 0.8 },
    { inst: 'hat', pattern: '..x. ..x. ..x. ..x.', min: 1, gain: 0.6 },
    { inst: 'bass', pattern: '1--. ..1. 8-.. 5-7-', min: 1 },
    { inst: 'tamborim', pattern: '..x. .x.. x.x. .x.x', min: 2, gain: 0.5 },
    { inst: 'lead', scale: true, min: 1, gain: 0.7,
      pattern: '7--9 --8- 7-4- ---- | 5--7 --9- 8-7- ---- | 3--5 --7- 9-a- 9-8- | 8--- 4--- 1-4- 7---' },
  ],
};

/** Bairro/Treino: synthwave de quatro no chão com agogô de escola de samba (Lá menor). */
const bairro: Style = {
  id: 'bairro', name: 'Neon do Bairro', bpm: 108, swing: 0, key: 9, scale: MINOR,
  chords: [{ root: 9, quality: 'm' }, { root: 5, quality: 'maj7' }, { root: 0, quality: 'M' }, { root: 7, quality: 'M' }],
  bassWave: 'sawtooth', leadWave: 'sawtooth',
  tracks: [
    { inst: 'pad', pattern: 'X... .... .... ....', min: 0, gain: 0.5 },
    { inst: 'pluck', pattern: '1.3. 5.8. 5.3. 5.8.', min: 0, gain: 0.32 },
    { inst: 'agogoLow', alt: 'agogoHigh', pattern: 'o.x. o.xx o.x. o.x.', min: 0, gain: 0.35 },
    { inst: 'kick', pattern: 'X... X... X... X...', min: 1 },
    { inst: 'snare', pattern: '.... X... .... X..g', min: 1, gain: 0.85 },
    { inst: 'hat', pattern: '..x. ..x. ..x. ..x.', min: 1, gain: 0.6 },
    { inst: 'bass', pattern: '1.18 1.18 1.18 1.18', min: 1, gain: 0.85 },
    { inst: 'hat', pattern: 'gggg gggg gggg gggg', min: 2, gain: 0.55 },
    { inst: 'lead', scale: true, min: 2, gain: 0.65,
      pattern: '4--- 2-4- 7--- 6-4- | 5--- 4-2- 0--- ---- | 2--- 4-7- 9--- 8-7- | 6--- ---- 4-6- 7---' },
  ],
};

/** Pelourinho: samba-reggae/axé com surdos marcados, caixa em clave e repique (Sol maior). */
const pelourinho: Style = {
  id: 'pelourinho', name: 'Ladeira do Pelô', bpm: 100, swing: 0.04, key: 7, scale: MAJOR,
  chords: [{ root: 7, quality: 'M' }, { root: 4, quality: 'm' }, { root: 0, quality: 'M' }, { root: 2, quality: 'M' }],
  bassWave: 'triangle', leadWave: 'square',
  tracks: [
    { inst: 'pad', pattern: 'X... .... .... ....', min: 0, gain: 0.4 },
    { inst: 'surdo', pattern: 'X... .... X... ....', min: 0, max: 0, gain: 0.55 },
    { inst: 'pluck', pattern: '8..5 ..3. 8..5 ..3.', min: 0, gain: 0.35 },
    { inst: 'ganza', pattern: 'g.g. g.g. g.g. g.gx', min: 0, gain: 0.45 },
    { inst: 'surdo', alt: 'surdoMute', pattern: 'X... o... X... o.X.', min: 1 },
    { inst: 'tom', pattern: '.... X... .... X.x.', min: 1, gain: 0.85 },
    { inst: 'snare', pattern: 'X.gX .gX. g.X. Xg.g', min: 1, gain: 0.7 },
    { inst: 'bass', pattern: '1-.. ..1. 5-.. ..1.', min: 1 },
    { inst: 'repique', pattern: 'x.xx .x.x x.x. xxx. | x.xx .x.x x.x. X.X.', min: 2, gain: 0.8 },
    { inst: 'lead', scale: true, min: 2, gain: 0.6,
      pattern: '4-4- 5-4- 2--- ---- | 4-4- 5-7- 5--- ---- | 7-7- 8-7- 5-4- 2--- | 1--- 2-3- 4--- ----' },
  ],
};

/** Lapa: samba e choro eletrônicos, cavaco no teleco-teco e baixo de sete cordas (Ré menor). */
const lapa: Style = {
  id: 'lapa', name: 'Choro dos Arcos', bpm: 96, swing: 0.14, key: 2, scale: HARMONIC_MINOR,
  chords: [{ root: 2, quality: 'm' }, { root: 9, quality: '7' }, { root: 2, quality: 'm' }, { root: 2, quality: '7' },
    { root: 7, quality: 'm' }, { root: 2, quality: 'm' }, { root: 4, quality: '7' }, { root: 9, quality: '7' }],
  bassWave: 'triangle', leadWave: 'triangle',
  tracks: [
    { inst: 'pad', pattern: 'X... .... .... ....', min: 0, gain: 0.3 },
    { inst: 'pluck', pattern: 'X.x. xx.x .x.X x.x.', min: 0, gain: 0.3 },
    { inst: 'ganza', pattern: 'ggxg ggxg ggxg ggxg', min: 0, gain: 0.4 },
    { inst: 'surdo', alt: 'surdoMute', pattern: 'o... X... o... X...', min: 1 },
    { inst: 'tamborim', pattern: 'x.x. .x.x .x.. x.x.', min: 1, gain: 0.7 },
    // Baixaria de sete cordas: graus da escala, com corrida na volta do ciclo.
    { inst: 'bass', scale: true, octave: 2, min: 1, pattern:
      '0-.. 4-.. 0-.. 4-2- | 4-.. 1-.. 4-.. 5-6- | 7-.. 4-.. 7-.. 4-.. | 0-.. 4-.. 0-.. 1-2- |' +
      '3-.. 0-.. 3-.. 0-.. | 0-.. 4-.. 7-.. 4-.. | 1-.. 7-.. 1-.. 0-.. | 4-3- 2-1- 0-6- 5-6-' },
    { inst: 'repique', pattern: '.... .... .... x.xx', min: 2, gain: 0.6 },
    { inst: 'lead', scale: true, octave: 4, min: 2, gain: 0.6, pattern:
      '7.9. b.9. 7.4. 2.0. | 6.8. b.8. 6.4. 1.4. | 7-9- b-e- d-b- 9-7- | b--- a-9- 7--- ---- |' +
      'a.c. e.c. a.7. 5.3. | 7.9. b.9. 7-.. .... | 8-.. 7-.. 8-.. b-.. | d.c. b.a. 9.8. 7.6.' },
  ],
};

/** Favela: tamborzão do funk carioca com atabaque e grave de 808 (Fá menor). */
const favela: Style = {
  id: 'favela', name: 'Tamborzão da Laje', bpm: 130, swing: 0.03, key: 5, scale: MINOR,
  chords: [{ root: 5, quality: 'm' }, { root: 5, quality: 'm' }, { root: 1, quality: 'maj7' }, { root: 3, quality: 'M' }],
  bassWave: 'sine', leadWave: 'square',
  tracks: [
    { inst: 'pad', pattern: 'X... .... .... ....', min: 0, gain: 0.35 },
    { inst: 'tom', pattern: 'x..x ..x. ..x. .x..', min: 0, gain: 0.55 },
    { inst: 'pluck', pattern: '..x. .... ..x. ....', min: 0, gain: 0.25 },
    { inst: 'kick', pattern: 'X..x ..X. ..X. .x..', min: 1 },
    { inst: 'clap', pattern: '.... X... .... X...', min: 1, gain: 0.8 },
    { inst: 'tom', pattern: 'g.g. x..g .x.g x...', min: 1, gain: 0.5 },
    { inst: 'bass', pattern: '1--1 --1- --8- -1--', min: 1 },
    { inst: 'hat', pattern: 'gggx gggx gggx gggx', min: 2, gain: 0.6 },
    { inst: 'lead', scale: true, min: 2, gain: 0.5,
      pattern: '7..7 ..7. ..9. .7.. | 9..9 ..9. ..a. .9.. | c..c ..b. ..9. .b.. | a..a ..8. ..7. ....' },
  ],
};

export const STYLES: Record<StyleId, Style> = { menu, bairro, pelourinho, lapa, favela };
