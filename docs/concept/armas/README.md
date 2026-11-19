# SIMBIOSE — referências de armas

Geradas em 2026-10-02 com a ferramenta nativa de imagem do Codex, conforme `docs/concept/BRIEF.md` e `docs/GDD.md`. O pedido nomeia GPT Image 2.5; a interface nativa disponível não expõe seleção nem confirmação da versão do modelo, portanto não foi usada API paga externa nem é afirmada uma versão verificável.

## Entrega e pendência

Cinco PNGs finais revisados visualmente: MK-2, pistola, escopeta, arma dos Sorridentes e luvas/mangas em primeira pessoa. **Falta a folha do fuzil de precisão**, bloqueada pelo filtro automático de saída; sua proposta textual está registrada abaixo. As quatro folhas de armas entregues mostram lateral, 3/4 e superior, com escala em cm; o viewmodel mostra a perspectiva do jogador e detalhes da luva.

Todas as imagens ficaram abaixo de 3 MB, preservadas em PNG. Código não foi alterado, não houve commit/merge, e nenhum arquivo fora desta pasta foi escrito por comandos de edição do projeto; os originais do gerador ficam na pasta padrão da ferramenta.

## Convenção de modelagem

As medidas abaixo são alvos de **proporção artística da malha externa**, aproximados e com sobreposições entre volumes, sem função mecânica. Em caixas, a ordem é comprimento longitudinal × largura × altura; cilindros usam comprimento × diâmetro. Uma unidade de cena corresponde a 1 m: converter cm dividindo por 100. As dimensões externas nas artes não são CAD e as notas do README prevalecem onde a geração varia entre vistas.

Usar caixas chanfradas, cunhas e cilindros de 6–8 lados; 2–3 faixas de cel-shading e contorno escuro. Cores canônicas: tinta `#1a1026`, concreto/lilás `#b8a9d9`, lilás escuro `#7d6ea8`, ciano `#2de2e6`, amarelo `#ffd23f`, papel `#f4ecff`, rosa `#ff3d7f`. As imagens podem ter tons intermediários de sombra; modelar com a paleta canônica e materiais `toon()` do projeto. Só aplicar brilho nos pequenos volumes emissivos. Textos, fita, riscos e fixadores preferencialmente como textura/decalque.

## Gambiarra MK-2

Arquivo: gambiarra-mk-2.png *(não incluído na cópia pública)*.

NOTAS PARA O MODELADOR:

- Silhueta: submetralhadora compacta de energia com corpo largo, frente curta e coronha vazada; proporção externa C:A:L = 62:27:9 cm. Tomar a vista lateral como referência da silhueta e a superior para largura.
- Corpo: caixa chanfrada de 23 × 9 × 8 cm, ciano `#2de2e6`; base estrutural tinta `#1a1026`. Chanfros visuais de 0,5–1 cm.
- Guarda-mão: caixa de 12 × 7 × 7 cm, tinta; três faixas amarelas `#ffd23f` de 2–3 cm de largura como tiras externas simples. Não modelar cada dobra da fita.
- Frente: cilindro octogonal amarelo, comprimento 9 cm e diâmetro externo 5 cm; tampão frontal tinta. Rebaixo escuro só como detalhe visual.
- Célula de energia: caixa de 7 × 5 × 8 cm sob o corpo, núcleo ciano com duas barras tinta e cantoneiras amarelas. Na imagem há leve diferença de facetas entre vistas; manter a caixa como volume canônico.
- Empunhadura: caixa chanfrada de 5 × 4 × 11 cm, tinta, inclinada para trás; base lilás escuro `#7d6ea8`. Arco protetor visual com três barras simples, sem detalhar mecanismo.
- Coronha: extensão de 15 cm, duas barras de aproximadamente 2 × 2 cm formando um triângulo, placa traseira 2 × 5 × 10 cm. Tinta com pequeno remendo ciano.
- Mira holográfica: moldura retangular vazada de 8 × 3 × 4 cm, borda ciano de 0,6 cm sobre base tinta. Evitar vidro opaco que esconda o alvo.
- Tela traseira: caixa chanfrada de 4 × 2 × 4 cm com plano ciano orientado ao jogador; barras de leitura são textura.
- Painel lateral: placa de 11 × 0,3 × 5 cm em `#b8a9d9`, com “OTIMIZA” e sorriso riscado em tinta. Texto/sorriso/fixadores podem ficar num decalque.
- A arte interpreta a identidade pedida como alvo futuro; não é reprodução exata do placeholder de três caixas que estava em `src/game/weapon.ts` na leitura desta sessão.

### Prompt da imagem final

```text
Create a high-quality landscape visual turnaround concept art sheet for the original Brazilian anime browser FPS SIMBIOSE. Stylized-concept, crisp dark ink outlines #1a1026, cel shading exactly 2-3 flat bands, low-poly buildable beveled boxes and 8-sided cylinders. NOT realistic metal, NOT painterly, no existing game/anime design, no logos from real brands. Closed palette: ink #1a1026, lilac #b8a9d9, dark lilac #7d6ea8, cyan #2de2e6, yellow #ffd23f, paper #f4ecff; pink #ff3d7f only for enemy official tech. Neutral paper #f4ecff background, clean spacious professional model sheet. Show ONE identical fictional weapon consistently in three views: large perfectly orthographic SIDE view at top, smaller THREE-QUARTER view bottom left, perfectly orthographic TOP view bottom right. All three fully visible, same parts and colors, no perspective in orthographic views. Sparse accurate thin dimension arrows in cm. Text exclusively Portuguese, only the specified title, view labels "LATERAL", "3/4", "SUPERIOR", and numerical cm labels. No extra gibberish or decorative tiny text. These are completely nonfunctional fantasy videogame props, like foam cosplay toys; centimeters specify only external art proportions for polygon modeling. No internal mechanisms, assembly instructions, manufacturing specifications or realistic firearm engineering.
Title "GAMBIARRA MK-2". Resistance compact improvised energy submachine gun, overall 62 cm length, 27 cm height including grip, 9 cm wide body. Broad cyan beveled receiver, ink structural frame, exposed rectangular energy cell below center, short yellow octagonal barrel shroud, yellow tape wrapped around fore-end, angular ink grip, compact skeletal stock. Cyan holographic sight as rectangular open frame on top, small rear cyan display clearly visible in 3/4, salvaged lilac side panel labeled "OTIMIZA" with a simple smile symbol aggressively crossed out in ink. All features readable and chunky. Side dimension "62 cm", top width "9 cm", height "27 cm".
```

## Pistola da Resistência

Arquivo: pistola-resistencia.png *(não incluído na cópia pública)*.

NOTAS PARA O MODELADOR:

- Silhueta: pistola curta, frente quadrada, empunhadura angular e célula externa sob a parte dianteira. Proporção C:A:L = 26:18:4 cm.
- Carenagem superior: caixa chanfrada de 20 × 4 × 5 cm em lilás `#b8a9d9`; faixa de sombra `#7d6ea8`. Frente amarela `#ffd23f`: bloco octogonal de 3 × 4 × 4 cm.
- Estrutura inferior: caixa de 14 × 3,5 × 2 cm em tinta `#1a1026`; empunhadura chanfrada de 5 × 3,5 × 10 cm, inclinada para trás, com base alargada de 6 × 4 × 2 cm.
- Célula: caixa de 7 × 3,5 × 4 cm ciano `#2de2e6` sob a frente; duas tampas tinta de aproximadamente 1 cm. A versão final moveu a célula do talão para a frente: seguir a imagem entregue.
- Fita: duas ou três tiras largas amarelas ao redor da empunhadura, espessura visual 0,1 cm, largura 1–2 cm. Não criar relevo microscópico.
- Mira: dois pequenos blocos tinta de aproximadamente 2 × 1 × 1 cm. Luz ciano lateral: plano de 10 × 0,1 × 0,7 cm.
- Guarda visual: três barras tinta formando uma abertura de cerca de 4 × 3 cm. Outros recortes podem ser decalques, não mecanismos.
- A imagem acrescentou frases legíveis em pt-BR e um emblema gráfico de punho; são decoração da folha, não uma marca aprovada do jogo. Não incorporá-los automaticamente à arma.

### Prompt da imagem final

```text
High quality original anime videogame prop art sheet for SIMBIOSE. A fanciful nonfunctional energy pistol of the Brazilian Resistência faction, obviously stylized, chunky toy-like futuristic beveled blocks. Clean paper #f4ecff background; large side orthographic view, bottom left 3/4, bottom right top orthographic, identical design. Title "PISTOLA DA RESISTÊNCIA", labels "LATERAL", "3/4", "SUPERIOR". Length arrow "26 cm", height "18 cm", width "4 cm" indicate visual art scale only. Thick ink #1a1026 outlines and exactly 2-3 flat cel shadow bands, no realistic metal. Lilac #b8a9d9 slide, dark lilac #7d6ea8 shadows, ink grip with bright yellow #ffd23f tape bands, cyan #2de2e6 fictional power pack and cyan strip, short chunky yellow tip. Simple oversized polygon shapes easy to model as videogame geometry. No real world brands, existing designs, mechanical internals or construction diagrams. Sparse large Portuguese lettering only.
```

## Fuzil de precisão da Resistência — imagem pendente

**Nenhuma imagem final foi produzida.** O filtro automático de saída rejeitou três tentativas como `illicit`, incluindo a última formulação como adereço anime não funcional. O coordenador orientou encerrar as tentativas e entregar as folhas aprovadas; não há PNG substituto nem arquivo vazio.

NOTAS PARA O MODELADOR — proposta textual, sem aprovação visual:

- Silhueta prevista: longa e estreita, C:A:L = 116:28:10 cm. Tubo de mira grande, apoio traseiro angular e remendos amarelos; deve diferir claramente da MK-2.
- Corpo: caixa chanfrada de 30 × 8 × 8 cm, lilás `#b8a9d9`, placas tinta `#1a1026`; rail luminoso ciano `#2de2e6` com 18 × 0,2 × 1 cm.
- Volume frontal decorativo: cilindro de oito lados, comprimento 48 cm, diâmetro externo 3 cm, tinta; colar amarelo `#ffd23f` com comprimento 5 cm e diâmetro 5 cm.
- Apoio traseiro: conjunto de duas caixas chanfradas compondo 30 × 7 × 10 cm; tinta e `#7d6ea8`. Apoio superior lilás de 10 × 5 × 3 cm e fita amarela de 3 cm de largura.
- Guarda-mão: caixa de 15 × 7 × 5 cm, tinta, com duas faixas amarelas largas. Pode sobrepor o volume frontal.
- Célula: caixa ciano de 8 × 5 × 6 cm abaixo do corpo. Empunhadura: caixa chanfrada de 5 × 4 × 11 cm, tinta.
- Mira: cilindro octogonal de 18 cm × diâmetro 5 cm; volume frontal de 5 cm × diâmetro 7 cm; duas bases de 3 × 3 × 2 cm. Lente é plano ciano.
- Os volumes podem se sobrepor e não devem ser somados como comprimentos de fabricação. São uma proposta de malha externa fictícia; não há peças internas nem funcionamento.

### Prompt da última tentativa bloqueada

```text
High quality original anime videogame prop art sheet for SIMBIOSE. A fanciful nonfunctional long-range energy prop of the Brazilian Resistência faction, original invented futuristic shape, oversized toy-like stylized beveled blocks. Clean paper #f4ecff background; large side orthographic view, bottom left 3/4, bottom right top orthographic, identical design. Title "FUZIL DE PRECISÃO", labels "LATERAL", "3/4", "SUPERIOR". Length arrow "116 cm", height "28 cm", width "10 cm" indicate visual art scale only. Thick ink #1a1026 outlines and exactly 2-3 flat cel shadow bands, no realistic metal. Lilac #b8a9d9 central block, dark lilac #7d6ea8 shadows, long octagonal dark front with yellow #ffd23f ring, long angular ink rear shoulder pad with yellow tape repair, cyan #2de2e6 rectangular fictional power pack. Big octagonal cyan-lensed viewing tube on top. Simple clear polygon volumes for game art, no real world brands, existing designs, mechanical internals or construction diagrams. Sparse large Portuguese lettering only.
```

## Escopeta da Resistência

Arquivo: escopeta-resistencia.png *(não incluído na cópia pública)*.

NOTAS PARA O MODELADOR:

- Silhueta: pesada, dois volumes frontais paralelos e guarda-mão amarelo largo. Proporção C:A:L = 82:25:9 cm.
- Corpo: caixa chanfrada de 24 × 8 × 9 cm, lilás `#b8a9d9`, sombras `#7d6ea8`; base tinta `#1a1026`.
- Volume frontal superior: cilindro octogonal tinta de 39 cm de comprimento e 6 cm de diâmetro. Volume inferior: cilindro octogonal de 26 cm × diâmetro 5 cm, com colar amarelo `#ffd23f`.
- Guarda-mão: caixa chanfrada de 22 × 8 × 7 cm, amarela, sobre o volume inferior. Duas faixas de fita de 3 cm cada com bordas assimétricas simples; grandes recortes podem ser textura.
- Célula lateral: caixa de 8 × 2 × 4 cm ciano `#2de2e6`, moldura tinta e trava amarela. Fita luminosa de 11 × 0,2 × 1 cm no alto do corpo.
- Coronha: duas caixas chanfradas compondo 21 × 6 × 10 cm; tinta com placa lilás e extremidade amarela. Abertura inferior pode ser um vão entre caixas, evitando booleanos pesados.
- Empunhadura: caixa de 5 × 4 × 10 cm, tinta, inclinada para trás; protetor visual em três barras.
- Mira: bloco frontal de 1 × 1 × 1,5 cm e bloco traseiro de 2 × 2 × 3 cm, ciano. Sem vidro ou acessórios longos.

### Prompt da imagem final

```text
Create a high-quality landscape visual turnaround concept art sheet for the original Brazilian anime browser FPS SIMBIOSE. Stylized-concept, crisp dark ink outlines #1a1026, cel shading exactly 2-3 flat bands, low-poly buildable beveled boxes and 8-sided cylinders. NOT realistic metal, NOT painterly, no existing game/anime design, no logos from real brands. Closed palette: ink #1a1026, lilac #b8a9d9, dark lilac #7d6ea8, cyan #2de2e6, yellow #ffd23f, paper #f4ecff; pink #ff3d7f only for enemy official tech. Neutral paper #f4ecff background, clean spacious professional model sheet. Show ONE identical fictional weapon consistently in three views: large perfectly orthographic SIDE view at top, smaller THREE-QUARTER view bottom left, perfectly orthographic TOP view bottom right. All three fully visible, same parts and colors, no perspective in orthographic views. Sparse accurate thin dimension arrows in cm. Text exclusively Portuguese, only the specified title, view labels "LATERAL", "3/4", "SUPERIOR", and numerical cm labels. No extra gibberish or decorative tiny text. These are completely nonfunctional fantasy videogame props, like foam cosplay toys; centimeters specify only external art proportions for polygon modeling. No internal mechanisms, assembly instructions, manufacturing specifications or realistic firearm engineering.
Title "ESCOPETA DA RESISTÊNCIA". Original chunky fictional energy shotgun, overall 82 cm long, 25 cm high, 9 cm wide. Thick short ink octagonal barrel above a shorter parallel energy accumulator cylinder, wide lilac box receiver, large yellow sliding fore-end with rough yellow tape, rectangular cyan side energy cell, short angular ink stock and grip. A single cyan light strip and cyan open sight. Distinct hefty shotgun silhouette, no real gun brand, no ammo diagram, no mechanical internals. Dimension labels "82 cm", "25 cm", "9 cm".
Emphasize a harmless exaggerated animated sci-fi prop aesthetic, all exterior forms are oversized solid stylized polygon shapes. This is a drawing for a videogame art team, not a real object blueprint.
```

## Arma dos Sorridentes

Arquivo: arma-sorridentes.png *(não incluído na cópia pública)*.

NOTAS PARA O MODELADOR:

- Silhueta: carabina de energia oficial da OTIMIZA, limpa demais, corpo e guarda-mão largos; proporção C:A:L = 72:24:8 cm.
- Paleta: casco papel `#f4ecff`, sombras lilás `#b8a9d9` / `#7d6ea8`, contorno tinta `#1a1026` e energia rosa `#ff3d7f`. Não colocar ciano ou fita amarela nessa arma.
- Corpo: caixa chanfrada de 22 × 8 × 8 cm. Guarda-mão: caixa de 23 × 8 × 8 cm, chanfros largos de 1–2 cm; duas linhas rosa como planos de 16 × 0,2 × 0,6 cm.
- Coronha: bloco traseiro chanfrado de 12 × 6 × 11 cm, ligado ao corpo por caixa de 10 × 4 × 4 cm. Faixa tinta na borda traseira; pequena linha rosa.
- Célula: caixa rosa de 12 × 5 × 4 cm encaixada abaixo do corpo, com moldura branca. Evitar subdivisão excessiva: núcleo único.
- Empunhadura: caixa chanfrada de 5 × 4 × 10 cm, branca; protetor visual em barras brancas/tinta.
- Frente: cilindro octogonal de 7 cm × diâmetro 5 cm, branco, três recortes rosa representados em textura ou planos. Trilho superior rosa: caixa fina de 28 × 2 × 0,6 cm.
- Mira integrada: cunha/caixa chanfrada de 6 × 3 × 3 cm, branca com detalhe rosa.
- Painel OTIMIZA: plano de 9 × 0,2 × 4 cm; sorriso circular rosa, texto tinta. Sorriso permanece intacto e perfeitamente simétrico.

### Prompt da imagem final

```text
Create a high-quality landscape visual turnaround concept art sheet for the original Brazilian anime browser FPS SIMBIOSE. Stylized-concept, crisp dark ink outlines #1a1026, cel shading exactly 2-3 flat bands, low-poly buildable beveled boxes and 8-sided cylinders. NOT realistic metal, NOT painterly, no existing game/anime design, no logos from real brands. Closed palette: ink #1a1026, lilac #b8a9d9, dark lilac #7d6ea8, cyan #2de2e6, yellow #ffd23f, paper #f4ecff; pink #ff3d7f only for enemy official tech. Neutral paper #f4ecff background, clean spacious professional model sheet. Show ONE identical fictional weapon consistently in three views: large perfectly orthographic SIDE view at top, smaller THREE-QUARTER view bottom left, perfectly orthographic TOP view bottom right. All three fully visible, same parts and colors, no perspective in orthographic views. Sparse accurate thin dimension arrows in cm. Text exclusively Portuguese, only the specified title, view labels "LATERAL", "3/4", "SUPERIOR", and numerical cm labels. No extra gibberish or decorative tiny text. These are completely nonfunctional fantasy videogame props, like foam cosplay toys; centimeters specify only external art proportions for polygon modeling. No internal mechanisms, assembly instructions, manufacturing specifications or realistic firearm engineering.
Title "ARMA DOS SORRIDENTES". Original pristine fictional official AI energy carbine, 72 cm long, 24 cm high, 8 cm wide. Unnaturally clean symmetrical sculpted beveled paper-white #f4ecff shell with lilac shadow bands, ink outlines, neon pink #ff3d7f energy core and pink rails; no cyan or yellow on weapon. Compact solid white stock, white broad receiver, integrated pink rectangular battery, white grip, closed rounded rectangular fore-end built from chamfered boxes, short octagonal pink-lined muzzle. Crisp original circular simple smiling pictogram and small label "OTIMIZA" on side. Integrated shallow pink sight. Benevolent corporate toy-like shape feels unsettling but readable and combat-ready. Dimension labels "72 cm", "24 cm", "8 cm".
```

## Luvas e mangas segurando a MK-2 em primeira pessoa

Arquivo: maos-mk-2-primeira-pessoa.png *(não incluído na cópia pública)*.

NOTAS PARA O MODELADOR:

- A imagem final foi regenerada para orientar o volume da arma para longe da câmera, com tela traseira visível e espaço vazio acima. É referência de pose e acabamento; o enquadramento final precisa ser calibrado no jogo.
- Mão direita segura a empunhadura, mão esquerda sustenta o guarda-mão. Duas mãos completas com cinco dedos; não adicionar braços ou mãos extras.
- Luva total: cerca de 20 cm do punho à ponta do dedo médio; palma como caixa chanfrada de 8 × 3 × 9 cm. Dedos como cadeias de 2–3 caixas chanfradas de 1,5–2 cm de largura, com comprimentos totais de 6–9 cm; polegar de aproximadamente 6 cm.
- Cor da luva: tinta `#1a1026`; facetas de sombra em lilás escuro `#7d6ea8`. Placas de nós dos dedos ciano `#2de2e6`: quatro caixas de aproximadamente 1,6 × 0,5 × 2 cm. Remendo amarelo `#ffd23f` de 3 × 0,2 × 2 cm no dorso.
- Mangas: cilindros de oito lados ou caixas chanfradas afuniladas, comprimento visível de 28–32 cm, diâmetro proximal 11–13 cm e punho de 8 cm; lilás escuro com faixas de luz `#b8a9d9`.
- Punhos: anel octogonal de 4 cm de comprimento, tinta/lilás; duas tiras amarelas sobre o punho esquerdo. Remendos ciano de 4 × 0,2 × 2 cm nas mangas.
- Começar pela pose em volumes rígidos, verificar dedos sem atravessar o guarda-mão e o grip, depois criar rig simples. O desenho contém facetas estilizadas: não copiar todas como costuras.
- Arma usa as medidas e volumes da folha MK-2 acima. Fixar arma e braços no espaço local da câmera; tela voltada para quem joga. Como base de ajuste visual, centro da arma próximo a 65–70% da largura e abaixo de 60% da altura do quadro; preservar alvo e retícula.
- A câmera deve enxergar a traseira e parte da lateral da arma. O contorno lateral maior que o esperado na referência pode ser reduzido aproximando o eixo da arma da direção da câmera.

### Prompt da imagem final

```text
Create a high-quality landscape anime cel-shaded videogame first-person viewmodel reference image for SIMBIOSE, original design, neutral #f4ecff backdrop. Dark ink contour #1a1026 and 2-3 flat shadow bands, chunky simple low-poly friendly forms, not realistic. Text only the Portuguese title "MK-2 — PRIMEIRA PESSOA". Player camera shows two anatomically correct fully gloved hands with jacket sleeves holding the cyan-and-yellow improvised fictional energy prop from the reference. RIGHT hand wraps the ink rear grip, LEFT hand supports the yellow taped front from below. The prop extends from lower right foreground toward upper center-left; muzzle points AWAY from camera. Keep upper half open for target visibility; no HUD and no environment. Exact same MK-2 shape as reference: cyan beveled receiver, lilac side OTIMIZA panel with crossed-out smile, short yellow octagonal shroud, yellow tape fore-end, compact cyan rectangular energy cell beneath middle, ink stock, top cyan holographic rectangular frame, small rear cyan screen clearly facing player. Jacket dark lilac #7d6ea8 with #b8a9d9 cel highlights, cyan seam patches, yellow taped cuff on left. Gloves dark ink, chunky cyan knuckle plates and yellow patch, no bare skin. Main image 75% of sheet. Below show two small isolated glove/sleeve shape references, palm and back, labeled only "PALMA" and "DORSO", dimension "20 cm" along glove length and "8 cm" across cuff. No extra arms, no floating fingers, no extra weapon, no real brands. This is nonfunctional fantasy prop concept art for external polygon art proportions only.
CRITICAL COMPOSITION CORRECTION: This must be a genuine FIRST PERSON gameplay CAMERA view, not an observer showing the gun sideways. Camera located directly behind the rear of the weapon, looking forward along its length with strong foreshortening. Stock and right hand close at bottom-right, rear screen facing camera near lower-right center, barrel recedes to near center of frame. Muzzle opening cannot be seen because it points forward away from viewer. Entire weapon/hands mostly confined to bottom-right 45% of main panel, with upper 55% empty neutral background for gameplay visibility. Left forearm comes from bottom left and supports fore-end. Side logo can be partially hidden from this angle. Keep small glove diagrams along bottom and keep same reference design.
```

Imagem de referência usada na geração: `gambiarra-mk-2.png` desta pasta. A primeira versão lateral de pose foi descartada; a versão salva é a segunda geração com correção da perspectiva.

## Verificação

- Inspeção visual de todos os cinco arquivos: silhuetas distintas, contorno de nanquim, faixas de sombra, paleta de facção, vistas e textos principais legíveis em pt-BR.
- Todas as folhas entregues têm escala em cm; o viewmodel usa 20 cm para a luva e 8 cm para o punho.
- MK-2 e viewmodel preservam fita, célula, mira, tela traseira e painel OTIMIZA riscado; Sorridentes usam branco/rosa com sorriso intacto.
- Pistola: a geração acrescentou slogans legíveis e um emblema na folha; não são assets de identidade aprovados. As notas acima separam esses adornos do modelo.
- PNGs validados com Pillow; tamanhos, dimensões e limite de 3 MB conferidos. Não foi necessário converter para JPG.
- `npm run check` e teste de jogabilidade não foram executados: escopo exclusivo de concept art, sem código ou parâmetros de jogo alterados. Verificação gráfica feita nas próprias imagens.
- Pendente: gerar posteriormente a folha do fuzil de precisão por um fluxo aprovado pelo coordenador. Não insistir nas tentativas bloqueadas desta sessão.

