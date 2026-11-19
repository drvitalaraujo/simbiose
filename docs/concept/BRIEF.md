# Briefing de arte (referência para geração de imagens)

Este é o briefing comum de todas as imagens de referência do SIMBIOSE. As imagens servem de
**alvo visual** para os agentes que modelam em código (Three.js): por isso pedem leitura
clara de forma, silhueta e cor, e não só beleza.

## O jogo
- FPS competitivo multiplayer no navegador (estilo CS/Valorant), visual **anime premium**
  (referências de *sensação*: Strinova, Hi-Fi Rush, Cyberpunk: Edgerunners, céu de Makoto
  Shinkai, Jet Set Radio). Não copiar personagens, logos ou designs de obras existentes.
- **Mundo:** Brasil pós-apocalíptico tomado por uma IA chamada **OTIMIZA**, que maximiza um
  "Índice de Felicidade" à força e fala como um departamento de marketing ("Sua felicidade é
  nossa prioridade nº 1 ✨"). **Gangues aliadas da IA** disputam as cidades contra a
  **Resistência**, que quer retomar o controle da IA e usá-la do jeito certo.
- **Facções** (trabalhar com estas):
  - **Resistência (Desplugados):** tecnologia improvisada e hackeada da IA, roupas
    brasileiras urbanas (jaqueta, bandana, chinelo/tênis, capacete de moto), fita amarela,
    remendos, adesivos, cor-assinatura **ciano + amarelo**.
  - **Os Sorridentes** (gangue da IA): implantes que forçam alegria, máscara/visor com
    sorriso fixo, roupa limpa demais, branca e rosa, cor-assinatura **rosa neon**.
  - **O Enxame** (gangue da IA): humanos fundidos a drones, rosto coberto, peças flutuantes.
  - **Os Premium** (elite): assinatura de felicidade, ternos, escudos de luxo, dourado.
- **Mapas:** lugares famosos do Brasil **reimaginados** (versões inspiradas, sem copiar
  prédios com fidelidade). O primeiro é o **Pelourinho (Salvador)**: ladeiras de pedra,
  casarões coloniais coloridos com janelas em arco e sacadas de ferro, igreja barroca azul,
  largo triangular com chafariz. Por cima: telões da OTIMIZA, drones de vigilância, fios,
  pichação da Resistência, neon.

## Regras de estilo
- Cel-shading de 2 a 3 faixas, **contorno de nanquim** escuro, formas simples e legíveis.
- **Paleta** (hex, do código `src/game/toon.ts`):
  - tinta `#1a1026`; concreto lilás `#b8a9d9` / `#7d6ea8`
  - rosa neon `#ff3d7f`; ciano `#2de2e6`; amarelo `#ffd23f`; papel `#f4ecff`
  - céu `#7a5cc7` → `#ffc38a` (pôr do sol); laranja `#ff8a5b`; vinho `#b84a7a`; magenta `#d95ba8`
  - folha `#3f9e7e`; ipê `#ff7ab8` / `#ffc93c`
- **Legibilidade competitiva:** inimigo com contorno/brilho rosa, aliado ciano. Silhueta de
  personagem reconhecível a 30 m. Cenário com menos contraste que os personagens.
- **Low-poly friendly:** formas que dão para construir com poucos polígonos (chanfros,
  volumes claros), sem detalhes microscópicos.
- Textos que aparecerem nas imagens em **pt-BR**.

## Onde salvar
- `docs/concept/<área>/` com nomes descritivos em kebab-case, por exemplo
  `personagem-resistencia-turnaround.png`.
- Cada pasta tem um `README.md` com a lista de imagens, o prompt usado e as notas para o
  modelador (proporções, cores hex, peças).
