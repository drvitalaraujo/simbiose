# Favela do Sol: quarteirões e largos

Responsável: agente Codex `favela_redesign`, branch `feat/favela-organica`.
Escopo: planta, roupa procedural e testes da Favela. Integração, câmeras de benchmark,
capturas e teste jogando ficam com o coordenador; movimento/armas não mudam.

## Direção e referências

- [Riot: The Art of VALORANT Map Environments](https://playvalorant.com/en-gb/news/dev/the-art-of-valorant-map-environments/):
  volumes de jogo antes da arte, leitura do personagem, contraste controlado, marcos com nomes curtos.
- [Valve: Reintroducing Train](https://www.counter-strike.net/reintroducing_train):
  rotas que permitem conferir ângulos progressivamente, espaços de preparo protegidos e detalhes acima da mira.

A aplicação aqui é autoral: casario recorta os quatro cantos e interrompe a antiga volta
retangular. Os quarteirões da Oficina, Mercearia, Ateliê, Bica e Barbearia criam cotovelos;
Feira, Quadra e Associação são clareiras de encontro. Dois circuitos laterais continuam
ligando os times quando o miolo está fechado. Casas possuem pavimentos recuados,
telhados de duas águas, reservatórios e fachadas variadas. Pintura da quadra, placas,
mural comunitário e calçamento reforçam os nomes dos lugares.

## Decisões de jogo

- Caixa a oeste: laje de 2,4 m; subida norte e oeste. Varal a sudeste: laje de 3,2 m;
  subida sul e leste. Acesso largo de 4 m, degraus de 0,4 m e piso de 1 m.
- Peitoris de 0,95 m e cobertura parcial deixam ler a silhueta e permitem contestar cada laje.
- A quadra conserva duelo aberto; feira e mural maciço lateral interrompem diagonais.
- Nascimentos de times têm proteção arquitetônica. FFA distribui jogadores pelos circuitos
  e pelas lajes; a seleção dinâmica de spawn do jogo continua ativa.
- O mapa conserva uma linha máxima de aproximadamente 53 m para armas de alcance;
  isso é uma exceção entre cotovelos, não uma pista contínua no perímetro.

## Medição e validação

Grade caminhável de 1 m, somente nós alcançáveis; raios horizontais em 32 direções,
olho a 1,5 m do piso, bloqueadores AABB reais. Esta amostragem descreve a distribuição
de distâncias visíveis, não o tempo de encontro entre jogadores humanos.

| Medida | Antes, baseline do coordenador | Depois |
| --- | ---: | ---: |
| Área caminhável | 3080 m² | 2288 m² |
| Área elevada | 326 m² | 252 m² |
| p90 dos raios | 33,5 m | 23,45 m |
| Raios acima de 40 m | 6,1% | 1,23% |
| Pares FFA com visão direta | 9/45 | 5/45 |

- [x] Apoio real e corpo livre dos nascimentos, ida e volta por navegação.
- [x] Quatro escadas alcançam o topo andando, em ambos os sentidos.
- [x] Circuitos oeste e leste ligam os times mesmo fechando a quadra.
- [x] Casas bloqueiam retas periféricas; nenhum par dos times tem visão direta ao nascer.
- [x] Dados/proxies de tiro preservados entre greybox e vestido, sem atlas cheio.
- [x] `npx vitest run src/game/maps -u`: 37 testes de mapas passam e planta regenerada.
- [x] `npm run check`: TypeScript cliente/servidor, 416 testes e build aprovados.
- [ ] Coordenador: jogo no navegador, revisão visual, novos enquadramentos e benchmark.

## Pontos para QA

As coordenadas abaixo são dos pés. `FAVELA_STAIRWAYS` exporta os mesmos pontos.

| Subida | Base | Topo |
| --- | --- | --- |
| Feira → Caixa | (-18, 0, -11) | (-18, 2,4, -3) |
| Bica → Caixa | (-29, 0, 5) | (-21, 2,4, 5) |
| Praça → Varal | (16, 0, 24) | (16, 3,2, 14) |
| Samba → Varal | (29, 0, 8) | (19, 3,2, 8) |

Tiro livre na quadra: (0, 1,5, 7) → (0, 1,5, 1). Tiro bloqueado pela Barbearia:
(5, 1,5, 24) → (5, 1,5, 12). Spawn de treino: (-6, 0, 22).

Câmeras sugeridas (posição → alvo; ponto decimal): Quadra (-6,4,18) → (0,2,-4);
Associação (-7,3.8,13) → (-6,4,25); Feira (0,2.8,-8) → (-18,4,-13);
Bica (-29,2.5,10) → (-23,4,-3); Varal (25,4,14) → (15,4,7).

Nenhum asset externo, API paga ou constante aprovada de sensação foi alterado.
Sem nova armadilha de projeto: as regras existentes de AABB, decoração e escadas bastam.
