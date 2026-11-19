import { defineConfig, loadEnv } from 'vite';
import { thirdPartyNotices } from './scripts/third-party-notices';
import { sourceUrl } from './src/game/menu/source';

// base relativa: o build roda em qualquer subpasta (itch.io, GitHub Pages).
export default defineConfig(({ mode }) => ({
  base: './',
  server: { port: 5173, strictPort: true },
  // O Three.js sozinho tem ~550 kB; dividir o pacote não compensa num jogo de página única.
  build: { chunkSizeWarningLimit: 800 },
  plugins: [thirdPartyNotices(sourceUrl(loadEnv(mode, process.cwd(), 'VITE_').VITE_SOURCE_URL ?? ''))],
  // Worktrees de outros agentes ficam dentro do repo: não rodar os testes deles.
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
}));
