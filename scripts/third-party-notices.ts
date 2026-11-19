// Plugin do Vite: gera THIRD-PARTY-NOTICES.txt no build com a licença de cada pacote npm
// que de fato entrou no JavaScript do cliente (lido dos módulos de cada chunk), os avisos de
// copyright do topo dos arquivos usados (bibliotecas embutidas em outros pacotes, como o
// decodificador meshopt do Three.js) e os assets externos de public/. Também copia a licença
// do jogo (LICENSE.txt). O minificador tira os comentários de licença do código, e as
// licenças MIT/BSD/Apache exigem que o aviso acompanhe a cópia distribuída.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i;
const PUBLIC_LICENSES = [
  'public/assets/characters/LICENSE-quaternius-ual.txt',
  'public/audio/LICENSE-kenney.txt',
  'public/audio/LICENSE-firearms.txt',
  'public/fonts/OFL-barlow.txt',
  'public/fonts/OFL-dela-gothic-one.txt',
];

/** Pasta do pacote dono do módulo (o node_modules mais interno ganha). */
export function packageDir(moduleId: string): string | null {
  const id = moduleId.replace(/^\0/, '').replace(/\\/g, '/');
  const m = /^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(id);
  return m ? m[1] : null;
}

/** Comentário de licença/copyright no topo do arquivo (antes do primeiro código), se houver. */
export function headerNotice(source: string): string | null {
  const lines: string[] = [];
  let inBlock = false;
  for (const raw of source.split(/\r?\n/).slice(0, 60)) {
    const line = raw.trim();
    if (inBlock) {
      lines.push(line.replace(/\*\/\s*$/, '').replace(/^\*\s?/, ''));
      if (line.includes('*/')) inBlock = false;
    } else if (line.startsWith('//')) lines.push(line.replace(/^\/\/\s?/, ''));
    else if (line.startsWith('/*')) {
      lines.push(line.replace(/^\/\*+!?\s?/, '').replace(/\*\/\s*$/, ''));
      inBlock = !line.includes('*/');
    } else if (line && !line.startsWith('#!') && !/^['"]use strict['"];?$/.test(line)) break;
  }
  const text = lines.join('\n').replace(/^[-=*\s]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  return /copyright|licen[cs]e|\(c\)/i.test(text) ? text : null;
}

/** Chave para não repetir o mesmo aviso: só as linhas de copyright/licença (o resto varia por arquivo). */
export function noticeKey(header: string): string {
  return header
    .split('\n')
    .filter((l) => /copyright|licen[cs]|\(c\)/i.test(l))
    .map((l) => l.trim())
    .join('\n');
}

interface Pkg {
  key: string;
  head: string;
  files: string[];
  headers: Map<string, string>;
}

function readPkg(dir: string): Pkg | null {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string; version: string; license?: string; homepage?: string };
  const files = readdirSync(dir).filter((f) => LICENSE_FILE.test(f)).sort().map((f) => readFileSync(join(dir, f), 'utf8').trim());
  const head = `${pkg.name}@${pkg.version} — ${pkg.license ?? 'licença não declarada'}${pkg.homepage ? `\n${pkg.homepage}` : ''}`;
  return { key: `${pkg.name}@${pkg.version}`, head, files, headers: new Map() };
}

/** Texto padrão da licença MIT (sem a linha de copyright, que vem de cada aviso). */
export const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`;

/** Aviso MIT que só cita a licença (sem o texto da permissão) precisa do texto junto. */
export function needsMitText(header: string): boolean {
  return /\bMIT\b/.test(header) && !/Permission is hereby granted/.test(header);
}

/** Commit do build e se a pasta tinha mudanças fora dele (aí o código não bate com o commit). */
export function buildRevision(): { hash: string; dirty: boolean } {
  try {
    const run = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { hash: run(['rev-parse', 'HEAD']), dirty: run(['status', '--porcelain']) !== '' };
  } catch {
    return { hash: '', dirty: true };
  }
}

/** Onde baixar o código exato deste build (só sabe montar o link de revisão do GitHub). */
export function revisionUrl(sourceUrl: string, rev: { hash: string; dirty: boolean }): string {
  if (!rev.hash) return `${sourceUrl} (revisão desconhecida)`;
  const base = /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(sourceUrl) ? `${sourceUrl.replace(/\/$/, '')}/tree/${rev.hash}` : `${sourceUrl} (commit ${rev.hash})`;
  return rev.dirty ? `${base} + mudanças locais não commitadas (build de teste: não distribua)` : base;
}

export function thirdPartyNotices(sourceUrl: string): Plugin {
  return {
    name: 'simbiose-third-party-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      const pkgs = new Map<string, Pkg>();
      const byDir = new Map<string, Pkg | null>();
      for (const out of Object.values(bundle)) {
        if (out.type !== 'chunk') continue;
        for (const id of out.moduleIds) {
          const dir = packageDir(id);
          if (!dir) continue;
          if (!byDir.has(dir)) {
            const p = readPkg(dir);
            if (!p) this.warn(`sem package.json para avisos de licença: ${dir}`);
            byDir.set(dir, p ? (pkgs.get(p.key) ?? (pkgs.set(p.key, p), p)) : null);
          }
          const pkg = byDir.get(dir);
          const file = id.replace(/^\0/, '').split('?')[0];
          if (!pkg || !existsSync(file)) continue;
          const header = headerNotice(readFileSync(file, 'utf8'));
          // Cabeçalho que só repete a licença do pacote não acrescenta nada
          if (!header || pkg.files.some((f) => f.includes(header))) continue;
          const key = noticeKey(header);
          if (!pkg.headers.has(key)) pkg.headers.set(key, header);
        }
      }
      const sep = `\n\n${'='.repeat(78)}\n\n`;
      const packageText = (p: Pkg) => {
        const parts = [p.head, ...p.files];
        if (!p.files.length) parts.push('(o pacote não traz arquivo de licença; avisos dos arquivos abaixo)');
        if (p.headers.size) {
          const headers = [...p.headers.values()].sort();
          parts.push('Avisos no topo dos arquivos usados:', ...headers);
          if (headers.some(needsMitText)) parts.push(`Texto da licença MIT que vale para os avisos MIT acima:\n\n${MIT_TEXT}`);
        }
        return parts.join('\n\n');
      };
      const notices = [
        'SIMBIOSE — avisos de terceiros\n\n' +
          `Código do jogo: MIT (texto completo em LICENSE.txt). Código-fonte: ${sourceUrl}\n` +
          `Código exato deste build: ${revisionUrl(sourceUrl, buildRevision())}\n` +
          'Origem e licença de cada asset externo: LICENSE-ASSETS.md e docs/assets.md no código-fonte.',
        ...[...pkgs.keys()].sort().map((k) => packageText(pkgs.get(k)!)),
        ...PUBLIC_LICENSES.map((p) => `${p.replace(/^public\//, '')}\n\n${readFileSync(p, 'utf8').trim()}`),
      ];
      this.emitFile({ type: 'asset', fileName: 'THIRD-PARTY-NOTICES.txt', source: notices.join(sep) + '\n' });
      this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: readFileSync('LICENSE', 'utf8') });
    },
  };
}
