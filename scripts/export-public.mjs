// Gera a cópia pública do SIMBIOSE: um repositório git novo, com um único commit, a partir do
// HEAD deste repositório e sem o material interno (relatórios de agentes, capturas de
// desenvolvimento, fotos de referência e artes de conceito geradas por IA).
//
// Uso: node scripts/export-public.mjs <pasta-destino> --email <id+usuario@users.noreply.github.com> [--name "Nome"]
// Depois: confira a pasta, crie o repositório público no GitHub e faça o push de lá.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/** Fica fora da cópia pública (pathspec do git). */
export const EXCLUDE = [
  'docs/reviews',
  'docs/screens',
  'docs/concept/**/*.png',
  'docs/concept/**/*.jpg',
  'docs/concept/**/*.jpeg',
  'docs/concept/**/*.webp',
];

/** Texto que não pode aparecer na cópia pública. */
const FORBIDDEN = [
  { what: 'caminho local de usuário', re: /[A-Za-z]:[\\/]+Users[\\/]+\w[^\\/\s`'"]*|\/home\/[a-z][\w-]*\//i },
  { what: 'e-mail pessoal', re: /[\w.%+-]+@(gmail|hotmail|outlook|yahoo|icloud)\.com/i },
];
/** Em Markdown, qualquer caminho absoluto de Windows (`C:/dev/...`) denuncia a máquina; `C:/Users/...` de exemplo passa. */
const MARKDOWN_PATH = /(?<![\w.+-])[A-Za-z]:[\\/]+(?!Users[\\/]+\.\.\.)\w[^\s`'")]*/;
const BINARY = /\.(png|jpe?g|webp|glb|gltf|bin|ogg|wav|mp3|woff2?|ttf|ico|gz|zip)$/i;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30, ...opts });
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function fail(msg) {
  console.error(`export-public: ${msg}`);
  process.exit(1);
}

const destArg = process.argv[2];
const email = arg('--email');
if (!destArg || destArg.startsWith('--')) fail('informe a pasta de destino');
if (!email || !/@users\.noreply\.github\.com$/.test(email)) fail('use --email com o endereço noreply do GitHub (…@users.noreply.github.com)');
const name = arg('--name') || git(['config', 'user.name']).trim();
const dest = resolve(destArg);
const root = git(['rev-parse', '--show-toplevel']).trim();
if (relative(root, dest) === '' || !relative(root, dest).startsWith('..')) fail('o destino precisa ficar fora deste repositório');
if (git(['status', '--porcelain']).trim()) fail('há mudanças não commitadas: a cópia sai do HEAD, faça commit antes');
if (existsSync(dest) && readdirSync(dest).length) fail(`a pasta ${dest} já existe e não está vazia`);
mkdirSync(dest, { recursive: true });

const head = git(['rev-parse', '--short', 'HEAD']).trim();
const tar = execFileSync('git', ['archive', '--format=tar', 'HEAD', '--', '.', ...EXCLUDE.map((p) => `:(exclude,glob)${p}`)], {
  cwd: root,
  maxBuffer: 1 << 30,
});
execFileSync('tar', ['-xf', '-'], { cwd: dest, input: tar, maxBuffer: 1 << 30 });

const files = walk(dest);
const problems = [];
let rewritten = 0;
for (const f of files) {
  const rel = relative(dest, f).replace(/\\/g, '/');
  if (BINARY.test(rel)) continue;
  let text = readFileSync(f, 'utf8');
  if (rel.endsWith('.md')) {
    // Link para arquivo que ficou fora da cópia vira texto (crédito e legenda continuam)
    const fixed = text.replace(/(!?)\[([^\]\n]*)\]\(([^)\s]+)\)/g, (all, _bang, label, target) => {
      if (/^([a-z]+:|#|mailto:)/i.test(target)) return all;
      const path = decodeURIComponent(target.split('#')[0]);
      if (!path || existsSync(join(dirname(f), path))) return all;
      rewritten++;
      return `${label || 'imagem'} *(não incluído na cópia pública)*`;
    });
    if (fixed !== text) writeFileSync(f, fixed);
    text = fixed;
    const abs = MARKDOWN_PATH.exec(text);
    if (abs) problems.push(`${rel}: caminho absoluto de máquina (${abs[0]})`);
  }
  for (const { what, re } of FORBIDDEN) {
    const m = re.exec(text);
    if (m) problems.push(`${rel}: ${what} (${m[0]})`);
  }
}
if (problems.length) fail(`conteúdo pessoal encontrado; corrija no repositório e rode de novo:\n  ${problems.join('\n  ')}`);

const id = ['-c', `user.name=${name}`, '-c', `user.email=${email}`];
git(['init', '-q', '-b', 'main'], { cwd: dest });
git(['add', '-A'], { cwd: dest });
git([...id, 'commit', '-q', '-m', `feat: primeira versão pública do SIMBIOSE\n\nCópia pública gerada de ${head} por scripts/export-public.mjs.`], { cwd: dest });

const size = files.reduce((s, f) => s + statSync(f).size, 0);
console.log(`Links para arquivos fora da cópia trocados por texto: ${rewritten}.`);
console.log(`Cópia pública pronta em ${dest}: ${files.length} arquivos, ${(size / 1048576).toFixed(1)} MB, 1 commit (${name} <${email}>).`);
console.log('Próximo passo (só com aprovação do dono): criar o repositório público e fazer o push.');
