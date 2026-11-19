# SIMBIOSE

![Praia do Patacho no SIMBIOSE](public/assets/maps/patacho.webp)

**FPS competitivo em anime que roda no navegador.** A Resistência enfrenta as gangues aliadas da
OTIMIZA, uma IA que quer você feliz à força, em lugares do Brasil reimaginados: Pelourinho, Lapa,
favela carioca e Praia do Patacho. Sala por link, bots e combate com chinelada.

O jogo tem um dono que **não programa**: todo o código foi escrito por agentes de IA (Claude,
Codex e outros), coordenados por instruções em [`AGENTS.md`](AGENTS.md). O repositório também
serve de estudo sobre como fazer software de verdade assim.

> Estado: protótipo jogável (Temporada 0). Espere mudanças grandes e arestas.

*English: SIMBIOSE is a browser-based competitive anime FPS set in a reimagined post-AI Brazil,
built with Three.js, TypeScript and Colyseus, entirely coded by AI agents. MIT licensed.
Docs and in-game text are in Brazilian Portuguese.*

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org/) 22 ou mais novo.

```bash
npm install
npm run dev        # jogo em http://localhost:5173
npm run server     # servidor multiplayer (porta 2567), em outro terminal
npm run check      # tipos + testes + build
```

- `http://localhost:5173/?debug` pula o menu (útil para testar).
- Online local: `?online` no endereço; o link da sala convida outra pessoa na mesma rede.
- Mais detalhes em [`docs/jogar-e-testar.md`](docs/jogar-e-testar.md); hospedagem em
  [`deploy/README.md`](deploy/README.md).
- Publicar uma versão (para mantenedores): [`docs/publicar-codigo-aberto.md`](docs/publicar-codigo-aberto.md).

## Como o código está organizado

| Pasta | O quê |
|---|---|
| `src/sim/` | Regras do jogo, puras e determinísticas (60 Hz), compartilhadas por cliente e servidor |
| `src/game/` | Cliente: render (Three.js), mapas, armas, HUD, menu, áudio |
| `src/net/` | Protocolo, predição e cliente de rede |
| `server/` | Servidor autoritativo (Colyseus) |
| `docs/` | GDD, planos, pesquisa e plantas dos mapas (`docs/maps/*.svg`) |

## Contribuir

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md). Falhas de segurança: [`SECURITY.md`](SECURITY.md).

## Licença

[MIT](LICENSE): use, modifique e distribua como quiser, inclusive em projetos comerciais, mantendo
o aviso de copyright. Assets de terceiros (CC0 e OFL) mantêm a licença deles; detalhes por pasta
em [`LICENSE-ASSETS.md`](LICENSE-ASSETS.md).
