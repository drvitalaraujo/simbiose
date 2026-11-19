# Como contribuir

Obrigado pelo interesse! O SIMBIOSE é feito por um dono que não programa, com o código escrito
por agentes de IA. Contribuições de gente e de agentes são bem-vindas.

## Antes de começar

- Leia o [`AGENTS.md`](AGENTS.md): é a fonte única de convenções e armadilhas do projeto
  (vale para pessoas também). Conceito e pilares do jogo: [`docs/GDD.md`](docs/GDD.md).
- Para mudança grande (sistema novo, mapa, arma, balanceamento), abra uma issue ou discussão
  antes: a sensação aprovada (`src/sim/feel.test.ts`) só muda com aprovação do dono.

## Fluxo

1. Faça um fork e uma branch a partir de `main`.
2. Rode `npm install` e `npm run dev` (`http://localhost:5173`; `?debug` pula o menu).
3. Commits em pt-BR no padrão Conventional Commits (`feat:`, `fix:`, `docs:`...), assinados
   com `git commit -s` (ver DCO abaixo). Nomes no código em inglês.
4. Antes do PR: `npm run check` passando. Mudou jogabilidade? Teste no navegador e conte no PR
   o que verificou.
5. Abra o PR explicando o quê e o porquê. Toda entrega passa por revisão antes do merge.

## Assets

- Só licença livre, de preferência CC0. Nada de Synty, Mixamo bruto ou trilha gerada por IA
  sem aprovação. Registre origem, autor, licença e data em `docs/assets.md` e a pasta em
  `LICENSE-ASSETS.md`.
- Fontes novas: só OFL/CC0, em `public/fonts`.

## Licença das contribuições (DCO)

Ao contribuir, você declara que tem o direito de enviar o trabalho e concorda que ele seja
distribuído sob a licença da parte que alterou (código: AGPL-3.0-only; conteúdo: CC BY-NC-SA 4.0;
ver `LICENSE-ASSETS.md`). A assinatura `Signed-off-by` (gerada por `git commit -s`) confirma o
[Developer Certificate of Origin 1.1](https://developercertificate.org/).

Código gerado por IA é bem-vindo: você continua responsável por ele, e ele não pode copiar
código de terceiros com licença incompatível.
