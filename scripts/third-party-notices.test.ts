import { describe, expect, it } from 'vitest';
import { headerNotice, needsMitText, noticeKey, packageDir, revisionUrl } from './third-party-notices';

describe('avisos de terceiros', () => {
  it('acha o pacote dono do módulo, inclusive com escopo e node_modules aninhado', () => {
    expect(packageDir(String.raw`C:\dev\Game\node_modules\three\build\three.module.js`)).toBe('C:/dev/Game/node_modules/three');
    expect(packageDir('/r/node_modules/@colyseus/sdk/node_modules/@colyseus/msgpackr/index.js')).toBe('/r/node_modules/@colyseus/sdk/node_modules/@colyseus/msgpackr');
    expect(packageDir('\0vite/preload-helper.js')).toBeNull();
    expect(packageDir('/r/src/main.ts')).toBeNull();
  });

  it('pega o aviso de copyright do topo do arquivo e ignora comentário comum', () => {
    const qr = '//---------\n//\n// QR Code Generator\n//\n// Copyright (c) 2009 Kazuhiko Arase\n//\n// Licensed under the MIT license\n//---------\n\nvar qrcode = 1;';
    expect(headerNotice(qr)).toContain('Copyright (c) 2009 Kazuhiko Arase');
    expect(headerNotice('/**\n * @license\n * Copyright 2010-2026 Three.js Authors\n */\nconst a = 1;')).toContain('Three.js Authors');
    expect(headerNotice('// só um comentário\nexport const a = 1;\n// Copyright tardio')).toBeNull();
  });

  it('acrescenta o texto MIT só a avisos que apenas citam a licença', () => {
    expect(needsMitText('Copyright (c) 2009 Kazuhiko Arase\nLicensed under the MIT license')).toBe(true);
    expect(needsMitText('The MIT License (MIT)\nPermission is hereby granted, free of charge')).toBe(false);
    expect(needsMitText('Copyright 2020 Alguém\nApache License 2.0')).toBe(false);
  });

  it('aponta para a revisão exata e avisa build com mudanças locais', () => {
    const url = 'https://github.com/dono/jogo';
    expect(revisionUrl(url, { hash: 'abc', dirty: false })).toBe('https://github.com/dono/jogo/tree/abc');
    expect(revisionUrl(url, { hash: 'abc', dirty: true })).toContain('não distribua');
    expect(revisionUrl('https://gitlab.com/x/y', { hash: 'abc', dirty: false })).toBe('https://gitlab.com/x/y (commit abc)');
  });

  it('trata como iguais avisos que só mudam o nome do arquivo', () => {
    const a = '@colyseus/sdk - a.ts\nCopyright (c) 2026 Endel Dreyer.\nThis software is released under the MIT License.';
    const b = '@colyseus/sdk - b.ts\nCopyright (c) 2026 Endel Dreyer.\nThis software is released under the MIT License.';
    expect(noticeKey(a)).toBe(noticeKey(b));
    expect(noticeKey(a)).not.toBe(noticeKey('Copyright 2016 Andrey Sitnik\nThe MIT License (MIT)'));
  });
});
