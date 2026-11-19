# Licenças por parte do projeto

O SIMBIOSE mistura código próprio, conteúdo próprio e assets de terceiros. Cada parte tem a
sua licença; nenhuma licença abaixo se estende às outras.

| Parte | Caminhos | Licença |
|---|---|---|
| Código do jogo e do servidor | `src/`, `server/`, `scripts/`, `index.html`, `visual-review.html`, arquivos de configuração e testes | [AGPL-3.0-only](LICENSE) |
| Conteúdo próprio (documentação, roteiro, plantas, miniaturas dos mapas) | `docs/` (exceto o que está marcado como de terceiros), `public/assets/maps/*.webp`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `TRADEMARKS.md` e este arquivo | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.pt-br) |
| Boneco e animações | `public/assets/characters/` | CC0 1.0 (Quaternius), ver `LICENSE-quaternius-ual.txt` |
| Sons gravados | `public/audio/` | CC0 1.0 (Kenney; Free Firearm Sound Library), ver `LICENSE-*.txt` e `sources.json` |
| Fontes | `public/fonts/` | SIL Open Font License 1.1, ver `OFL-*.txt` |
| Dependências npm | `node_modules/` (não versionado) | Licença de cada pacote; o build gera `THIRD-PARTY-NOTICES.txt` com as que entram no cliente |

Origem, autor e data de cada asset externo: [`docs/assets.md`](docs/assets.md).

## Notas

- Textos e falas que estão dentro do código (`src/`) seguem a licença do código.
- Arte procedural (mapas, personagens, armas, céu, músicas sintetizadas) é gerada pelo código e
  segue a licença do código. As capturas de tela do jogo seguem a do conteúdo próprio.
- O nome e o logotipo "SIMBIOSE" não são licenciados por nenhuma das licenças acima: ver
  [`TRADEMARKS.md`](TRADEMARKS.md).
- `LICENSE` é o texto oficial da AGPL-3.0, que a própria licença não permite modificar.
- O repositório público não inclui as fotos de referência nem as artes de conceito geradas por
  IA usadas no desenvolvimento. Os READMEs de `docs/concept/` mantêm créditos, links e prompts.

Copyright © 2026 os autores do SIMBIOSE.
