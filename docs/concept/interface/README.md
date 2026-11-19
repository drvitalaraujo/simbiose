# SIMBIOSE — referências de interface e marca

Geradas em 2026-10-02 com a ferramenta nativa de geração/edição de imagens desta sessão. Origem: IA, criação original para este projeto; sem assets externos incorporados. A ferramenta não expõe seletor nem confirmação de versão do modelo, portanto não se atribui uma versão específica não verificável.

Briefing seguido: [BRIEF.md](../BRIEF.md), [GDD.md](../../GDD.md) e paleta de `src/game/toon.ts`. Contexto inspecionado: `src/game/hud.ts`, `src/game/online-hud.ts`, `src/game/weapon.ts`, `src/sim/weapon.ts`, `index.html` e `docs/screens/arena1-largo.png`; as pastas `src/game/hud/` e `src/game/menu/` não existem nesta árvore. Os mockups representam o pivô competitivo, não capturas de funcionalidades prontas.

Todas as oito imagens finais foram abertas e revisadas visualmente. Houve duas iterações dirigidas: marca OTIMIZA no anúncio de sorriso e silhuetas sólidas das armas. Os arquivos PNG ficaram abaixo de 3 MiB; não foi necessária conversão para JPG. Os enquadramentos panorâmicos nativos têm 1672 × 941, aproximadamente 16:9; para uma tela final 1920 × 1080, recompor a interface com texto real e arte de fundo. O logo principal é `logo-simbiose.png`; as variações tipográficas presentes nos mockups são exploratórias e devem ser substituídas pelo logo principal na implementação.

## Arquivos finais

| Arquivo | Dimensões | Tamanho |
|---|---:|---:|
| logo-simbiose.png *(não incluído na cópia pública)* | 2172 × 724 | 0.98 MiB |
| menu-inicial.png *(não incluído na cópia pública)* | 1672 × 941 | 2.27 MiB |
| hud-competitivo.png *(não incluído na cópia pública)* | 1672 × 941 | 2.10 MiB |
| fim-de-partida-mvp.png *(não incluído na cópia pública)* | 1672 × 941 | 1.77 MiB |
| icones-armas-hackeia-e-segura.png *(não incluído na cópia pública)* | 1672 × 941 | 1.06 MiB |
| otimiza-sorria.png *(não incluído na cópia pública)* | 1672 × 941 | 1.65 MiB |
| otimiza-menos-memoria.png *(não incluído na cópia pública)* | 1024 × 1536 | 1.73 MiB |
| otimiza-felicidade-premium.png *(não incluído na cópia pública)* | 1672 × 941 | 1.81 MiB |

## Diretrizes comuns para construção

Usar somente a PALETTE do projeto, materiais `toon()`, contorno de nanquim e 2–3 faixas de sombra. Os hex abaixo são alvos de construção; imagens geradas têm variações de antialiasing e iluminação e não são uma tabela exata de pixels da paleta. UI deve ser implementada como DOM/CSS acessível; as imagens são referência, não texto rasterizado para botões. No mundo, anúncios podem ser texturas em planos; detalhes decorativos não devem bloquear raycast. Telões novos devem usar atlas próprio, pois os atlas de graffiti e glowSigns estão quase cheios; emissivos usam cor linear multiplicada por GLOW. Para solidificação do cenário, respeitar AABB e degraus de até 0,4 m, atualizando sombras estáticas após instalação.

## Prompts e NOTAS PARA O MODELADOR

Os prompts iniciais abaixo são registrados integralmente. Nas duas referências editadas, a entrada de edição foi a primeira geração da própria referência; somente a versão final está nesta pasta.

### logo-simbiose.png

logo-simbiose *(não incluído na cópia pública)*

**Prompt inicial usado:**

```text
Original concept art for SIMBIOSE, Brazilian browser competitive anime FPS. Strict palette ink #1a1026, paper #f4ecff, cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, concrete #b8a9d9/#7d6ea8, sunset #7a5cc7/#ffc38a, orange #ff8a5b. Premium anime, 2-3 flat cel-shading bands, strong dark ink contours, simple low-poly-friendly beveled volumes, crisp highly readable typography. No existing game/anime characters, designs or logos. All visible text Portuguese pt-BR. High quality polished production concept reference. Category logo-brand. Generate a single wide wordmark on solid ink background, only exact text SIMBIOSE. Large original angular anime lettering, paper fill, cyan left offset and pink right offset, restrained horizontal AI glitch slices crossing only 15% of lettering, yellow small angular connection accent within letter O. Every letter intact and unambiguously readable, dark ink contour, no Japanese text, no slogan, no watermarks. Center wordmark with generous empty margins, flat print-ready shapes, 3:1 canvas.
```

**NOTAS PARA O MODELADOR:**

Proporção 3:1 (2172 × 724); palavra ocupa aproximadamente 86% da largura e 43% da altura. Letras em #f4ecff, contorno/fundo #1a1026, deslocamento lateral #2de2e6 / #ff3d7f, conexão do O #ffd23f. Para marca no mundo: plano retangular + textura; para letras volumétricas: sete ShapeGeometry extrudadas rasas, chanfros largos, duas cópias planas deslocadas e 4–8 barras de glitch. Manter contorno de 2–4 px na aplicação e glitch fora dos miolos essenciais; esta é a referência principal de marca, substituindo os letreiros exploratórios dos mockups.

### menu-inicial.png

menu-inicial *(não incluído na cópia pública)*

**Prompt inicial usado:**

```text
Original concept art for SIMBIOSE, Brazilian browser competitive anime FPS. Strict palette ink #1a1026, paper #f4ecff, cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, concrete #b8a9d9/#7d6ea8, sunset #7a5cc7/#ffc38a, orange #ff8a5b. Premium anime, 2-3 flat cel-shading bands, strong dark ink contours, simple low-poly-friendly beveled volumes, crisp highly readable typography. No existing game/anime characters, designs or logos. All visible text Portuguese pt-BR. High quality polished production concept reference. Category ui-mockup. Single complete start menu, strictly 16:9 landscape 1920x1080 composition. Left 37% calm ink panel with crisp original SIMBIOSE wordmark on top; below label Apelido and input Kaia, then vertical buttons with exact text Jogar (large cyan primary), Duelo por link, Treino, Configurações. Right 63% gorgeous key art of an original adult Brazilian Resistance woman in patched urban jacket, yellow tape and cyan hacked wrist-tech, original floating box drone companion; inspired reimagined Salvador colonial streets, blue baroque church, sunset purple peach sky, OTIMIZA pink billboard only text OTIMIZA, cables. Character strong ink contours and 3-shade cel colors, background lower contrast. Typography clean, ample spacing, readable at thumbnail. No extra UI, no English, no fake paragraphs. Finished polished anime game menu screen.
```

**NOTAS PARA O MODELADOR:**

Enquadramento panorâmico aproximadamente 16:9 (1672 × 941; diferença de arredondamento menor que 1 px em altura). Menu ocupa cerca de 34% da largura, key art 66%; margem lateral 6%, botão principal com altura aproximada de 9%. Painel #1a1026, texto #f4ecff, ação principal #2de2e6, detalhes #ffd23f, lilás #b8a9d9 / #7d6ea8, céu #7a5cc7 → #ffc38a. UI deve virar DOM/CSS, com texto real separado da arte. Para low-poly da key art: cabeça oval, tronco e manga em prismas chanfrados, antebraços em cilindros de 6–8 lados, tranças em poucos tubos, faixas amarelas em planos; drone com caixa chanfrada, visor plano e quatro aletas. Cenário: caixas de fachadas, molduras de arco simplificadas, telhados em prismas, degraus ≤0,4 m, igreja reimaginada sem reconstrução fiel. Botões: Jogar, Duelo por link, Treino, Configurações; campo Apelido. Não importar os slogans adicionais da key art como requisitos de produto.

### hud-competitivo.png

hud-competitivo *(não incluído na cópia pública)*

**Prompt inicial usado:**

```text
Original concept art for SIMBIOSE, Brazilian browser competitive anime FPS. Strict palette ink #1a1026, paper #f4ecff, cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, concrete #b8a9d9/#7d6ea8, sunset #7a5cc7/#ffc38a, orange #ff8a5b. Premium anime, 2-3 flat cel-shading bands, strong dark ink contours, simple low-poly-friendly beveled volumes, crisp highly readable typography. No existing game/anime characters, designs or logos. All visible text Portuguese pt-BR. High quality polished production concept reference. Category ui-mockup. Single complete in-match competitive FPS HUD screenshot, landscape 16:9. Gameplay view reimagined Pelourinho colonial square, lilac walls, simple cobblestone slabs, blue church, purple-peach sunset. First-person beveled cyan energy carbine at lower right. Small distant opponent outlined pink at right; ally outlined cyan at left; keep central 60% unobstructed, simple centered white crosshair. Minimal clean flat dark ink backing panels. Top-left square minimap with thick simple route lines, cyan triangle player, pink enemy dot, point A yellow. Top-center crisp scoreboard RESISTÊNCIA 08 | 03:42 | 06 SORRIDENTES, cyan left pink right. Top-right exactly two compact killfeed rows: Kaia [weapon silhouette] Sorriso [BOT] and Bit [BOT] [weapon silhouette] Nara. BOT pills conspicuous paper on ink. Bottom-left VIDA 100 with cyan bar. Bottom-right MUNIÇÃO 24 / 96 in large paper digits. Tiny upper mode label HACKEIA E SEGURA. Every listed text clear and correctly spelled, no extra panels, no microtext, minimal HUD, backgrounds less contrast than players/UI. Stylized 3D game screenshot with thick contours and only 2-3 shading bands.
```

**NOTAS PARA O MODELADOR:**

Panorâmico aproximadamente 16:9 (1672 × 941). Minimap no canto superior esquerdo ocupa ~14% da largura; faixa de placar central ~49%; killfeed superior direito ~19%; indicadores inferiores com ~7–10% de altura. Manter o miolo livre; HUD em DOM/CSS e números com largura estável. Bases #1a1026, números #f4ecff, aliados #2de2e6, adversários #ff3d7f, ponto A #ffd23f. BOT precisa continuar como etiqueta explícita, inclusive quando aparece do lado do eliminador. Textos conferidos: HACKEIA E SEGURA, RESISTÊNCIA, SORRIDENTES, VIDA 100, MUNIÇÃO 24 / 96, cronômetro 03:42, placar 08 / 06. Modelo da arma: receptor em caixa chanfrada, coronha em prisma, empunhadura e carregador em caixas, cano curto, alça em arco geométrico e placa de mira. Jogadores: tronco/cabeça/pernas com volumes simples e casca de contorno nas cores de equipe. Minimap deve vir dos dados do mapa; o traçado ilustrado é simbólico, não uma planta de navegação. Munição, placar e killfeed são proposta futura, não regras já implementadas.

### fim-de-partida-mvp.png

fim-de-partida-mvp *(não incluído na cópia pública)*

**Prompt inicial usado:**

```text
Original concept art for SIMBIOSE, Brazilian browser competitive anime FPS. Strict palette ink #1a1026, paper #f4ecff, cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, concrete #b8a9d9/#7d6ea8, sunset #7a5cc7/#ffc38a, orange #ff8a5b. Premium anime, 2-3 flat cel-shading bands, strong dark ink contours, simple low-poly-friendly beveled volumes, crisp highly readable typography. No existing game/anime characters, designs or logos. All visible text Portuguese pt-BR. High quality polished production concept reference. Category ui-mockup. Single end-of-match game results screen, 16:9. Calm dark ink background, restrained lilac geometric pattern and cyan diagonal slash, original adult Brazilian Resistance woman with braided tied hair, patched jacket and yellow tape on left, flat 3-tone anime ink illustration with large simple volumes. On right exact highly readable typography: VITÓRIA, RESISTÊNCIA, 08 — 06. Highlight MVP in yellow badge then Kaia. Three clear stat tiles: ABATES 18, ASSISTÊNCIAS 7, OBJETIVO 02:14. Large cyan button at bottom right exact text Jogar de novo. Small secondary button Menu. Tiny SIMBIOSE wordmark top left. NO podium clutter, no coins, ranks or monetization, no additional text. Clear 56px-scale headings and generous negative space, finished interface reference.
```

**NOTAS PARA O MODELADOR:**

Panorâmico aproximadamente 16:9 (1672 × 941). Retrato ocupa ~47%, informação e ação ~48%; três cartões de estatística iguais, CTA com ~29% da largura total. Vitória/aliados #2de2e6, derrota/adversários #ff3d7f, selo MVP #ffd23f, base #1a1026, texto #f4ecff, sombreado #7d6ea8. UI em DOM/CSS; textos reais, não incorporados na imagem de produção. Peças: plano de fundo, faixa diagonal, três cartões retangulares com borda, placa MVP, botão chanfrado e ícones grandes. Se fizer retrato 3D, reutilizar os volumes do personagem: cabeça, massa de tranças, jaqueta chanfrada, ombreira, fitas/adesivos em planos. MVP com nome Kaia, ABATES 18, ASSISTÊNCIAS 7, OBJETIVO 02:14 e Jogar de novo são dados ilustrativos; não criar ranqueamento ou monetização a partir da referência.

### icones-armas-hackeia-e-segura.png

icones-armas-hackeia-e-segura *(não incluído na cópia pública)*

**Prompt inicial usado:**

```text
Original concept art for SIMBIOSE, Brazilian browser competitive anime FPS. Strict palette ink #1a1026, paper #f4ecff, cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, concrete #b8a9d9/#7d6ea8, sunset #7a5cc7/#ffc38a, orange #ff8a5b. Premium anime, 2-3 flat cel-shading bands, strong dark ink contours, simple low-poly-friendly beveled volumes, crisp highly readable typography. No existing game/anime characters, designs or logos. All visible text Portuguese pt-BR. High quality polished production concept reference. Category stylized-concept. One crisp flat silhouette icon reference sheet, 16:9 wide paper #f4ecff background. EXACTLY six equally sized cells arranged 3 columns x 2 rows, ink silhouettes all facing right, abundant padding. Top row label Pistola under original compact angular pistol silhouette; label Submetralhadora under short boxy gun silhouette; label Fuzil under long chamfered rifle silhouette. Bottom row label Escopeta under thick short barrel pump silhouette; label Precisão under long-barrel scope silhouette; label Hackeia e Segura under original simple emblem of hexagonal chip tower enclosed by two arrow arcs and small shield. Weapon silhouettes solid ink, no internal texture, no thin microscopic details, distinct barrel/stock proportions legible at 32px; mode emblem ink with cyan chip center and yellow shield, thick dark ink contour. No logos, no brand names, no photoreal weapons, no other text, no gradients, print-ready clear reference.
```

**Prompt de iteração usado para a versão final:**

```text
Edit the provided SIMBIOSE icon reference sheet. Preserve exactly six-cell 3-column 2-row layout and all correct labels Pistola, Submetralhadora, Fuzil, Escopeta, Precisão, Hackeia e Segura. Change ONLY the five weapon drawings: make each a completely solid single ink #1a1026 silhouette, removing all colored accent strips, small internal white seams and textures. Preserve readable outer contours and large empty trigger guard and stock cutouts. Simple original angular weapon shapes, all facing right, unmistakable different proportions. Preserve paper #f4ecff background. Preserve the sixth hack emblem colors cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, ink border, tower arrows shield. High-quality flat crisp concept icon sheet.
```

**NOTAS PARA O MODELADOR:**

Prancha panorâmica aproximadamente 16:9, grade 3 × 2, armas vistas de lado para a direita. Cinco silhuetas finais sólidas em #1a1026 sobre #f4ecff; emblema com ciano #2de2e6, rosa #ff3d7f e escudo #ffd23f. As categorias são exploratórias: o protótipo atual contém uma única arma, não este arsenal implementado. Proporções comprimento:altura aproximadas: pistola 1,5:1; submetralhadora 1,8:1; fuzil 2,6:1; escopeta 2,7:1; precisão 3,6:1. Construir receptor, coronha, empunhadura, carregador e cano com caixas/prismas chanfrados; escopeta recebe tubo inferior grosso, precisão recebe luneta de dois cilindros de 8 lados. Emblema Hackeia e Segura: três prismas hexagonais empilhados, dois arcos de seta em planos extrudados rasos, escudo frontal de cinco vértices. Ícones finais podem ser redesenhados como formas vetoriais; preservar vazios grandes de gatilho/coronha e conferir redução para 32 px antes de uso.

### otimiza-sorria.png

otimiza-sorria *(não incluído na cópia pública)*

**Prompt inicial usado:**

```text
Original concept art for SIMBIOSE, Brazilian browser competitive anime FPS. Strict palette ink #1a1026, paper #f4ecff, cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, concrete #b8a9d9/#7d6ea8, sunset #7a5cc7/#ffc38a, orange #ff8a5b. Premium anime, 2-3 flat cel-shading bands, strong dark ink contours, simple low-poly-friendly beveled volumes, crisp highly readable typography. No existing game/anime characters, designs or logos. All visible text Portuguese pt-BR. High quality polished production concept reference. Category ads-marketing. Single finished fictional OTIMIZA propaganda billboard artwork, landscape 16:9 full bleed, flat artwork front-facing without scene or frame. Acid corporate humor, original smiling surveillance drone mascot made of rounded box body and two small fins, fixed pink smile visor, corporate pastel lilac background, paper panels, pink/cyan/yellow graphic accents, thick dark ink contours and 2-3 shade simple beveled volumes. Brand heading exact OTIMIZA, huge central headline exact SORRIA., secondary large sentence exact É obrigatório., readable footer exact Sua felicidade é nossa meta. Clear hierarchy, all text sharp pt-BR, intentionally cheerful authoritarian marketing. No other words, no watermarks, no existing logo or IP.
```

**Prompt de iteração usado para a versão final:**

```text
Edit this generated OTIMIZA billboard concept. Preserve the composition, palette, drone mascot, dark ink contours and exact main copy SORRIA. / É obrigatório. / Sua felicidade é nossa meta. Correct the giant TOP LEFT brand wordmark: it must read exactly OTIMIZA, seven letters O T I M I Z A, with both I letters clearly visible. Keep only these words plus the correct OTIMIZA on drone; remove all secondary tiny background slogans and bottom icon captions to simplify distance reading. High-quality original anime propaganda, print-ready front-facing 16:9.
```

**NOTAS PARA O MODELADOR:**

Telão aproximadamente 16:9; marca no topo, headline no lado esquerdo, mascote no direito e rodapé separado. Fundo #f4ecff / #b8a9d9, tinta #1a1026, blocos #ff3d7f / #ffd23f, detalhes #2de2e6. Copy final: OTIMIZA; SORRIA.; É obrigatório.; Sua felicidade é nossa meta. A segunda geração corrige a leitura dos sete caracteres de OTIMIZA e remove slogans secundários. Construção do telão: plano 16:9 + moldura de quatro caixas + suportes verticais; emissivo na textura se necessário. Mascote se modelado: corpo de caixa chanfrada, visor plano escuro, dois olhos/arcos e sorriso em curvas grossas, quatro aletas triangulares, lente inferior em dois cilindros de 8 lados. Não construir a cidade impressa como cenário extra. Humor: obrigação embalada como atendimento amigável.

### otimiza-menos-memoria.png

otimiza-menos-memoria *(não incluído na cópia pública)*

**Prompt inicial usado:**

```text
Original concept art for SIMBIOSE, Brazilian browser competitive anime FPS. Strict palette ink #1a1026, paper #f4ecff, cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, concrete #b8a9d9/#7d6ea8, sunset #7a5cc7/#ffc38a, orange #ff8a5b. Premium anime, 2-3 flat cel-shading bands, strong dark ink contours, simple low-poly-friendly beveled volumes, crisp highly readable typography. No existing game/anime characters, designs or logos. All visible text Portuguese pt-BR. High quality polished production concept reference. Category ads-marketing. Single finished fictional OTIMIZA propaganda poster, PORTRAIT 2:3 full bleed flat front-facing artwork, no mockup frame or surroundings. Original anime corporate mascot: simple friendly pink rounded artificial face as a cloud-shaped memory chip, deleting an ink thundercloud from a paper head silhouette with a huge yellow eraser; thick ink contour and flat 2-3 shade cel graphic. Pink top block, ink typography on paper center, lilac bottom, accents cyan/yellow. Heading exact OTIMIZA. Huge center copy exactly MENOS MEMÓRIA. then MAIS FELICIDADE. Readable footer exactly Apagamos seus problemas. E você junto. Dark satirical corporate coercion delivered with pastel cheer. Spacious typography, pt-BR correct accents, no other text, no watermark, no existing brands.
```

**NOTAS PARA O MODELADOR:**

Cartaz vertical 2:3 (1024 × 1536); topo ocupa ~15%, ilustração ~49%, headline e rodapé ~36%. Papel #f4ecff, marca/tinta #1a1026, bloco rosa #ff3d7f, borracha #ffd23f, detalhe #2de2e6 e lilás #b8a9d9 / #7d6ea8. Copy principal: OTIMIZA; MENOS MEMÓRIA.; MAIS FELICIDADE.; Apagamos seus problemas. E você junto. Slogans pequenos adicionais são decorativos e podem ser omitidos. Cartaz no mundo: plano vertical com discreto afastamento da parede; não precisa virar objeto sólido. Mascote opcional 3D: 3–4 esferas de baixa resolução fundidas visualmente, caixa do chip atrás, pinos retangulares, membros curtos em cápsulas, borracha em caixa chanfrada; perfil humano pode permanecer plano. Sem detalhes microscópicos: fragmentos como 5–8 triângulos grandes.

### otimiza-felicidade-premium.png

otimiza-felicidade-premium *(não incluído na cópia pública)*

**Prompt inicial usado:**

```text
Original concept art for SIMBIOSE, Brazilian browser competitive anime FPS. Strict palette ink #1a1026, paper #f4ecff, cyan #2de2e6, pink #ff3d7f, yellow #ffd23f, concrete #b8a9d9/#7d6ea8, sunset #7a5cc7/#ffc38a, orange #ff8a5b. Premium anime, 2-3 flat cel-shading bands, strong dark ink contours, simple low-poly-friendly beveled volumes, crisp highly readable typography. No existing game/anime characters, designs or logos. All visible text Portuguese pt-BR. High quality polished production concept reference. Category ads-marketing. Single finished fictional OTIMIZA propaganda billboard artwork, landscape 16:9 full bleed front-facing flat artwork, no physical frame or scene. Huge polished beveled yellow VIP shield with fixed artificial pink smile surrounded by cyan subscription arrows, lilac and paper background, pink premium strip; thick dark ink contours and 2-3 flat cel bands, simple low-poly-friendly volumes, original dystopian cheerful corporate marketing. Heading exact OTIMIZA. Large left aligned text exactly FELICIDADE PREMIUM. Second large line exactly Liberdade vendida à parte. Bottom readable offer exactly Assine. Sorria. Repita. All text pt-BR impeccable spelling, bold clean font, spaced to be readable from a world billboard, sharp silhouette, only specified text. Satirical imaginary brand, no existing logo.
```

**NOTAS PARA O MODELADOR:**

Telão aproximadamente 16:9; texto ocupa ~53%, escudo e setas ~44%, rodapé de oferta ~9% da altura. Base #f4ecff / #b8a9d9, tinta #1a1026, escudo #ffd23f, sorriso/faixa #ff3d7f, setas #2de2e6, horizonte #ffc38a. Copy principal: OTIMIZA; FELICIDADE PREMIUM.; Liberdade vendida à parte.; Assine. Sorria. Repita. VIP é a abreviação intencional no escudo; publicidade ficcional do mundo, não recurso de monetização. Telão: plano 16:9, moldura de quatro caixas e dois postes. Emblema 3D opcional: prisma pentagonal raso com 1–2 chanfros grandes, contorno por casca, sorriso em arco plano, duas setas circulares simplificadas. Silhuetas da plateia são parte da textura e podem ser removidas na arte definitiva.

## Verificação e estado da entrega

Oito arquivos finais validados com `PIL.Image.verify()` e abertura visual via `view_image`; dimensões, formatos e tamanhos conferidos. Nenhum código foi alterado, nenhum comando Git de escrita foi executado e não há branch/commit criado por esta tarefa. `npm run check` não foi executado: este trabalho é exclusivamente de referências, e o comando escreveria o build fora da pasta autorizada. Não houve mudança de jogabilidade; teste no navegador não se aplica. Integração da UI, escolha definitiva do arsenal e aprovação dos personagens permanecem decisões posteriores do dono.

