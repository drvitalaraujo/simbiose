# Revisão estética: materiais, armas e personagens

Responsável: Codex. Branch: `feat/estetica-materiais`.
Estado: concluído, com revisão independente GPT-6 Astra (esforço médio).

## Direção aprovada

Anime com construção e materiais convincentes: o dono pediu mais realismo em carros,
arquitetura, grafites, armas e personagens. Preservar movimento, hitboxes, dano, mira,
layout competitivo e identidade das facções. Geometria e pinturas originais em código.

## Escopo e dependências

- Mapas: reboco descascado, umidade, marcas de chuva e concreto menos uniforme;
  grafite com tinta, escorridos e porosidade; carros com painéis e cabine detalhados.
- Armas: construção mecânica, contraste entre metal e polímero, pequenos acentos de
  facção, controles e acabamento. Referência de leitura: Counter-Strike, sem copiar assets.
- Personagens: tons de pele próprios, olhos e volume facial, costuras, bolsos e dobras
  discretas. Esqueleto e dimensões do manequim continuam como referência de hitbox.
- Validação: `npm run check`, mapas com atualização das plantas, inspeção no navegador
  de Pelourinho, Bairro, quatro armas e três skins; revisão independente conforme AGENTS.md.

## Referências

- Fotos locais e créditos: `docs/concept/referencias-pelourinho/README.md`, especialmente
  06 (fachadas e desgaste), 07 (pedras) e 19 (cantaria).
- [Pelourinho com reboco exposto](https://www.bnews.com.br/noticias/infraestrutura/59895-pelourinho-decadente-conheca-a-realidade-longe-dos-olhos-de-turistas-em-salvador.html):
  somente observação; nenhuma foto copiada para o jogo.
- [Arte urbana no Rio](https://luciwest.com/photos-of-street-art-in-rio-brazil/): somente
  referência de tinta integrada à superfície, nunca textura incorporada.
- [Counter-Strike 2](https://www.counter-strike.net/cs2): referência de proporção,
  leitura por categoria e acabamento. Armas originais da Resistência.
- Folhas próprias em `docs/concept/personagens/` e `docs/concept/armas/`: identidades
  preservadas. Nenhum asset externo ou geração paga necessária nesta passada.

## Estado das tarefas

1. Auditoria e direção — concluídas.
2. Materiais, grafites e carros — concluídos.
3. Armas e personagens — concluídos.
4. Validação visual, técnica e revisão independente — concluídas; relatório em
   `docs/reviews/2026-10-03-revisao-estetica.md` e capturas em `docs/screens/estetica/`.

## Reprodução

`npm.cmd run dev` e `http://localhost:5173/visual-review.html?map=pelourinho`
oferecem enquadramentos, troca de arma, mira, captura do canvas e medição de GPU.
`?map=bairro` mostra carros/prédios; `?characters` captura as três skins. Vitrine
exclusiva de desenvolvimento, em HTML separado do jogo; não entra no build publicado.
