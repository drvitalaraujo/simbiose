# SIMBIOSE — agentes jogáveis

Referências originais de personagem para modelagem em Three.js, criadas em 02/10/2026 a partir de [BRIEF.md](../BRIEF.md) e [GDD.md](../../GDD.md). Três folhas completas, uma por agente; cada PNG reúne turnaround frente/lado/costas, expressões, luvas/acessórios e pose de ação. A pose de ação mostra por fora a postura usada ao mirar em primeira pessoa, com arma apoiada no ombro e duas mãos na empunhadura.

| Agente | Facção | Arquivo | Personalidade |
| --- | --- | --- | --- |
| Caio Remendo | Resistência / Desplugados | resistencia-caio-remendo-folha.png *(não incluído na cópia pública)* | Conserta o impossível e disfarça o medo com uma piada ruim. |
| Lia Estalo | Resistência / Desplugados | resistencia-lia-estalo-folha.png *(não incluído na cópia pública)* | Descobre a falha antes de ouvir a desculpa e corre para proteger os seus. |
| Ivo Riso | Os Sorridentes | sorridentes-ivo-riso-folha.png *(não incluído na cópia pública)* | Repete frases felizes enquanto seus olhos pedem para ser desligado. |

## Origem e revisão

Geradas pela ferramenta nativa de imagem disponível nesta sessão; sem assets externos, personagens existentes ou marcas. A interface não expõe um seletor ou metadado verificável do modelo; não há confirmação técnica do nome comercial “GPT Image 2.5”. Nenhuma API paga externa foi acionada.

Todas as folhas têm 1536 × 1024 pixels, fundo neutro, contorno de nanquim e 2–3 faixas de cel-shading. PNGs preservados porque cada um ficou abaixo de 3 MB. Inspeção visual conferiu vistas completas na mesma escala, rótulos em pt-BR, expressões, acessórios e arma; Lia teve uma segunda geração para remover uma régua anatômica incorreta. As imagens são concept art: medidas, lateralidade e materiais abaixo são a referência técnica para resolver pequenas diferenças entre vistas.

## Notas comuns para o modelador

- Escala: 1 unidade = 1 m; altura corporal de 1,80 m, sem contar saliências de cabelo. Proporção-alvo de 7 cabeças; uma cabeça mede aproximadamente 0,257 m. Topo em 1,80 m, queixo em 1,54 m, ombros em 1,47 m, cintura em 1,03 m, virilha em 0,90 m e joelhos em 0,49 m. Estes pontos são alvos iniciais para o bloqueio, não medidas extraídas de pixels.
- Base compartilhada: pescoço curto, torso em prisma chanfrado, pelve em caixa trapezoidal, braços e pernas em prismas/cilindros de 6–8 lados; mãos com palma em bloco e cinco dedos simplificados. Braços em pose A a aproximadamente 45° abaixo da horizontal; pernas afastadas e pés paralelos. Frente e costas definem a abertura; o perfil é sua projeção lateral.
- Materiais via `toon()` e cores da `PALETTE`; contorno `#1a1026`. Cor base, sombra principal e pequeno destaque plano; não converter os degradês residuais da imagem em textura fotográfica. Fundo `#f4ecff` não é parte do personagem.
- Construir primeiro a silhueta sem textura e conferir em distância equivalente a 30 m. Bandana/gola/ombros/máscara distinguem os três agentes; bolsos e cabos têm poucos volumes grandes. As proporções são visuais; a hitbox competitiva vem dos dados de `characters/hitbox.ts`.
- Cabeça e roupa sem microcostura. Olhos, sobrancelhas e sorriso podem usar planos/decalques com poucos traços. Decalques/partículas transparentes usam `depthWrite: false`; decoração presa a malha atingível não pode bloquear tiro (`mesh.raycast = () => {}`).
- Arma ilustrada é referência de empunhadura e volumes, não uma nova especificação de arma/jogabilidade. Em primeira pessoa, modelar mãos e antebraços separadamente, mantendo luvas e punhos reconhecíveis; mão direita no gatilho e esquerda sob o guarda-mão.

### Regra das cores de time

A assinatura de facção fica no figurino: Resistência em ciano `#2de2e6` + amarelo `#ffd23f`; Sorridentes em papel `#f4ecff` + rosa neon `#ff3d7f`. A identificação competitiva depende da relação com o jogador: **aliado recebe contorno/brilho ciano; inimigo recebe contorno/brilho rosa**, inclusive quando a facção do figurino for diferente. Contorno-base de nanquim `#1a1026` continua definindo as formas. O brilho deve formar uma leitura externa consistente; não usar somente um acessório pequeno para identificar o time. Para bloom, usar a cor linear multiplicada por GLOW acima do limiar do pipeline (~1,05), conforme AGENTS.md. Não aplicar o sublinhado rosa decorativo do título de Caio ao seu modelo.

## Caio Remendo — notas para o modelador

Arquivo: `resistencia-caio-remendo-folha.png`.

Proporções: 1,80 m / 7 cabeças; largura de ombros ~0,46 m, pelve ~0,33 m; jaqueta curta até a cintura, pernas afuniladas com volume nas coxas. Cabelo forma três massas angulares; bandana tem duas pontas curtas. Expressões: sorriso torto, concentração e preocupação.

Cores: pele estilizada laranja `#ff8a5b` com sombra vinho `#b84a7a`; cabelo/calça/luvas/cano `#1a1026`; jaqueta/tênis `#b8a9d9`, sombras `#7d6ea8`; camiseta `#b84a7a`; ombreiras/joelheiras/telas `#2de2e6`; bandana/fitas/solado/carregador `#ffd23f`.

Peças/volumes para construir:

1. Cabeça chanfrada, olhos/sobrancelhas em planos, cabelo em três cunhas e bandana em faixa com duas pontas.
2. Torso/camiseta, dois painéis frontais e painel traseiro da jaqueta, gola, duas mangas curtas e duas placas de ombro.
3. Pelve/cinto, duas coxas largas e duas canelas afuniladas, bolsos grandes, duas joelheiras chanfradas.
4. Dois tênis em caixas chanfradas com solado grosso e uma faixa larga sobre o peito do pé.
5. Dois braços articulados; duas luvas **sem dedos** com palma escura, placa dorsal ciano e segmentos expostos dos cinco dedos.
6. Bateria dorsal em caixa (~0,20 × 0,26 × 0,08 m), faixa amarela central, um cabo grosso e bracelete cilíndrico no antebraço esquerdo com tela ciano e trava amarela.
7. Duas fitas amarelas na coxa esquerda e remendo no ombro direito; “esquerda/direita” é sempre do personagem, nunca de quem vê a folha.
8. Arma: receptor chanfrado, coronha, cabo, guarda-mão, cano cilíndrico, carregador amarelo e faixa ciano.

Resolver a variação do detalhe isolado de palma mantendo ambas as luvas sem dedos, como no corpo e na pose de ação. Cabo sempre liga bateria ao bracelete esquerdo; não criar braceletes extras a partir da vista de perfil.

### Prompt usado — Caio

```text
Create a high-quality landscape production character concept sheet for original Brazilian anime browser competitive FPS SIMBIOSE, stylized-concept. Crisp dark ink #1a1026 outlines, cel shading only 2-3 flat color bands, clean readable low-poly-friendly beveled volumes, no photorealism, no complex textures, no existing characters or logos. Neutral paper #f4ecff background. Closed palette: ink #1a1026, lilac #b8a9d9 and #7d6ea8, neon pink #ff3d7f, cyan #2de2e6, yellow #ffd23f, paper #f4ecff, orange #ff8a5b, wine #b84a7a. Broad distinct silhouette visible at 30m. Layout: upper two thirds THREE complete full-body orthographic views FRONT, SIDE PROFILE, BACK same scale feet on a shared baseline, 7-head anime proportion adult height 1.80m. Strict A-pose: both straight arms angled DOWN 45 degrees from horizontal in front/back, hands open, no weapon in turnaround, no perspective or cropped feet. Lower third: three close-up facial expressions, separate dorsal/palm gloved-hand detail with five fingers, one accessory detail, and one external three-quarter upper-body action pose depicting the actual first-person aiming stance from outside: character shoulders compact rifle with right trigger hand and left supporting hand, eyes align sights, muzzle points diagonally away, rifle and both hands clearly visible. Distinguish detail region from orthographic region with spacing. Use only short EXACT Brazilian Portuguese labels 'FRENTE', 'LADO', 'COSTAS', 'EXPRESSÕES', 'DETALHES', 'AÇÃO'; character title as given. No other lettering, no English, no pseudotext, no company marks. Render large and sharp with generous spacing.
Character title 'CAIO REMENDO'. Resistance male adult Brazilian mechanic, athletic build not bulky, angular shoulders, medium warm orange stylized skin, short dark ink hair in THREE chunky tufts, one yellow bandana tied over forehead. Short sleeved cropped lilac patched motorcycle jacket with large cyan shoulder panels, dark wine undershirt, wide dark ink work trousers tapering at ankle, cyan knee guards, chunky lilac sneakers with yellow soles, ink fingerless gloves with cyan dorsal plates. Two broad yellow tape repairs on left thigh and one on right shoulder, no tiny stitching or microdetails. Back small rectangular hacked battery with cyan center and yellow strap, one thick cable to left forearm hacking cuff. Recognizable asymmetry remains the character's left side across views. Expressions: crooked amused smile, focused, worried. Detail show forearm cuff as simple cylinder with beveled cyan screen and yellow latch. Rifle is original simple blocky hacked lilac receiver, cyan energy strip, yellow magazine, dark ink barrel and stock. Colors signature cyan+yellow. All pieces invariant across views and pose.
```

## Lia Estalo — notas para o modelador

Arquivo: `resistencia-lia-estalo-folha.png`.

Proporções: 1,80 m / 7 cabeças; largura de ombros com placas ~0,44 m, pelve ~0,35 m; calça reta e botas altas até o tornozelo. Gola triangular elevada e cabelo curto assimétrico distinguem a silhueta de Caio. Expressões: alegria, determinação e desconfiança.

Cores: pele estilizada vinho `#b84a7a`, destaques `#ff8a5b`; cabelo/camiseta/luvas/estrutura do rádio `#1a1026`; jaqueta/gola/presilha/telas `#2de2e6`; placas/botas/unidade dorsal `#b8a9d9` com sombra `#7d6ea8`; calça `#b84a7a`; alça/fitas/nós dos dedos/biqueira/carregador `#ffd23f`.

Peças/volumes para construir:

1. Cabeça, cabelo bob em quatro massas chanfradas com lateral curta, presilha triangular ciano.
2. Torso escuro, jaqueta em painéis grandes, gola em duas cunhas, duas mangas e ombreiras retangulares.
3. Pelve/cinto, duas coxas e canelas retas, dois bolsos grandes de carga.
4. Duas botas chanfradas, cano curto, biqueira amarela e solado escuro.
5. Braços articulados; duas luvas inteiras, cinco dedos segmentados, placa amarela dorsal e pequenos blocos amarelos nos nós dos dedos.
6. Alça diagonal amarela atravessando torso e costas; rádio no quadril direito (~0,13 × 0,20 × 0,07 m), antena grossa e tela ciano.
7. Bracelete com tela no antebraço direito; três remendos amarelos na manga esquerda; placa dorsal lilás sob a gola (~0,18 × 0,22 × 0,05 m).
8. Arma em receptor lilás, estrutura escura, faixa ciano, carregador amarelo, cano, cabo, guarda-mão e coronha.

Priorizar frente/costas para a lateralidade dos remendos: manga esquerda, bracelete e rádio à direita. Manter esses lados no perfil e em todas as animações.

### Prompt usado — geração inicial de Lia

```text
Create a high-quality landscape production character concept sheet for original Brazilian anime browser competitive FPS SIMBIOSE, stylized-concept. Crisp dark ink #1a1026 outlines, cel shading only 2-3 flat color bands, clean readable low-poly-friendly beveled volumes, no photorealism, no complex textures, no existing characters or logos. Neutral paper #f4ecff background. Closed palette: ink #1a1026, lilac #b8a9d9 and #7d6ea8, neon pink #ff3d7f, cyan #2de2e6, yellow #ffd23f, paper #f4ecff, orange #ff8a5b, wine #b84a7a. Broad distinct silhouette visible at 30m. Layout: upper two thirds THREE complete full-body orthographic views FRONT, SIDE PROFILE, BACK same scale feet on a shared baseline, 7-head anime proportion adult height 1.80m. Strict A-pose: both straight arms angled DOWN 45 degrees from horizontal in front/back, hands open, no weapon in turnaround, no perspective or cropped feet. Lower third: three close-up facial expressions, separate dorsal/palm gloved-hand detail with five fingers, one accessory detail, and one external three-quarter upper-body action pose depicting the actual first-person aiming stance from outside: character shoulders compact rifle with right trigger hand and left supporting hand, eyes align sights, muzzle points diagonally away, rifle and both hands clearly visible. Distinguish detail region from orthographic region with spacing. Use only short EXACT Brazilian Portuguese labels 'FRENTE', 'LADO', 'COSTAS', 'EXPRESSÕES', 'DETALHES', 'AÇÃO'; character title as given. No other lettering, no English, no pseudotext, no company marks. Render large and sharp with generous spacing.
Character title 'LIA ESTALO'. Resistance female adult Brazilian electronics courier, athletic practical build, 1.80m and 7-head proportion same as male reference, fully clothed nonsexualized, confident stance. Warm wine/terracotta stylized skin restricted to #b84a7a with #ff8a5b highlights. Dark ink angular bob haircut with shaved side and a single chunky cyan triangular hair clip, no ponytail. Broad short cyan jacket with high folded collar and square lilac shoulder panels, dark ink shirt, straight wine cargo trousers, lilac chunky ankle boots with yellow toe bumper, full ink gloves with large yellow knuckle plates. Yellow diagonal chest strap holding one large beveled radio box at right hip, three thick yellow tape patches across left sleeve, cyan rectangular forearm hacking unit on right forearm, flat rectangular lilac backplate under jacket collar; no small belts or detailed stitching. Strong distinctive silhouette: bob hair, triangular raised collar, shoulder pads and straight trousers, different from Caio. Expressions playful grin, determined, skeptical raised eyebrow. Show complete full gloves dorsal and palm, and separate beveled hip radio accessory with a thick antenna and cyan screen, no letters. Original compact blocky rifle with ink stock, lilac receiver, cyan energy strip and yellow magazine. Invariance across front side back and action pose. Signature cyan+yellow. Avoid pink decorative accent in title. Use A-pose 45 degrees DOWN arm spread in front/back; side camera shows same A-pose projected side.
```

### Prompt usado — correção final de Lia

Edição da geração inicial, incluída como única referência de imagem:

```text
Edit this original LIA ESTALO SIMBIOSE model sheet. Remove completely the incorrect decorative head-count ruler and '1.80 m' text on the left; leave plain neutral paper background there. Preserve the title, all Portuguese labels, character identity, cyan/yellow palette, thick ink outlines, expressions, glove/radio details and external aiming pose. Ensure the THREE front/profile/back views each depict precisely the same adult female of height 1.80m with approximately SEVEN anatomical head heights (from chin to crown, excluding hair), same scale and shared floor. A-pose arms slope 45 degrees down. No ruler, no anatomical silhouettes, no additional typography. Keep all existing accessories and clothes, correct left sleeve patches in profile to character LEFT, and right forearm cyan cuff and right-hip radio across views. High quality clean flat cel shading 2-3 bands, low-poly modeling sheet.
```

## Ivo Riso — notas para o modelador

Arquivo: `sorridentes-ivo-riso-folha.png`.

Proporções: 1,80 m / 7 cabeças; largura de ombros ~0,45 m, pelve ~0,32 m. Silhueta simétrica, ombros arredondados e uniforme limpo. Máscara fica rígida: olhos/sobrancelhas mostram alegria, medo e raiva; o sorriso não acompanha a expressão.

Cores: jaqueta/calça/botas/dorso das luvas/máscara `#f4ecff`; sombras e pele estilizada `#b8a9d9` / `#7d6ea8`; cabelo/roupa interna/articulações/palma das luvas/cano `#1a1026`; ombros/cintura/canelas/solados/implantes/sorriso/carregador `#ff3d7f`. Sem ciano ou amarelo no figurino-base.

Peças/volumes para construir:

1. Cabeça chanfrada e cabelo em uma calota curta; olhos e sobrancelhas em planos.
2. Máscara cobrindo nariz inferior, boca e queixo (~0,17 × 0,13 × 0,06 m), com duas bordas laterais chanfradas e uma única faixa de sorriso rosa.
3. Dois discos de implante nas têmporas (~0,045 m de diâmetro); anéis de 8 segmentos.
4. Torso/jaqueta com gola curta rígida, dois painéis frontais, duas ombreiras arredondadas de poucos segmentos e faixa larga na cintura.
5. Braços/pernas em prismas, cotovelos e joelhos escuros visíveis, placas largas rosa nas canelas.
6. Duas botas brancas em caixas chanfradas com solado rosa; luvas inteiras, palma escura e cinco dedos com placas rosa nos nós.
7. Unidade dorsal (~0,18 × 0,24 × 0,055 m) em caixa chanfrada branca com faixa rosa central.
8. Arma branca em blocos: coronha, receptor, empunhadura, guarda-mão, cano escuro, carregador rosa e faixa rosa larga.

Sorriso é parte da máscara, não boca humana nem logo externo. Priorizar quatro placas dorsais rosa grandes nas luvas; marcas menores podem virar decalque. Não adicionar tecido sujo, remendos ou cabos da Resistência.

### Prompt usado — Ivo

```text
Create a high-quality landscape production character concept sheet for original Brazilian anime browser competitive FPS SIMBIOSE, stylized-concept. Crisp dark ink #1a1026 outlines, cel shading only 2-3 flat color bands, clean readable low-poly-friendly beveled volumes, no photorealism, no complex textures, no existing characters or logos. Neutral paper #f4ecff background. Closed palette: ink #1a1026, lilac #b8a9d9 and #7d6ea8, neon pink #ff3d7f, cyan #2de2e6, yellow #ffd23f, paper #f4ecff, orange #ff8a5b, wine #b84a7a. Broad distinct silhouette visible at 30m. Layout: upper two thirds THREE complete full-body orthographic views FRONT, SIDE PROFILE, BACK same scale feet on a shared baseline, 7-head anime proportion adult height 1.80m. Strict A-pose: both straight arms angled DOWN 45 degrees from horizontal in front/back, hands open, no weapon in turnaround, no perspective or cropped feet. Lower third: three close-up facial expressions, separate dorsal/palm gloved-hand detail with five fingers, one accessory detail, and one external three-quarter upper-body action pose depicting the actual first-person aiming stance from outside: character shoulders compact rifle with right trigger hand and left supporting hand, eyes align sights, muzzle points diagonally away, rifle and both hands clearly visible. Distinguish detail region from orthographic region with spacing. Use only short EXACT Brazilian Portuguese labels 'FRENTE', 'LADO', 'COSTAS', 'EXPRESSÕES', 'DETALHES', 'AÇÃO'; character title as given. No other lettering, no English, no pseudotext, no company marks. Render large and sharp with generous spacing.
Character title 'IVO RISO'. Os Sorridentes adult Brazilian male agent with a lean adult 7-head 1.80m body, smooth round short ink hair cap and broad WHITE/PAPER #f4ecff crescent half-mask covering nose/mouth/jaw. ONE bold rigid neon pink #ff3d7f smile incision spans the mask, two simple pink mood implant disks at the temples. Eyes above mask remain expressive; exposed skin stylized lilac #b8a9d9. Immaculately clean white/paper fitted high collar jacket with large pink shoulder panels, pink waist band and pink shin strips, ink undersuit and elbow/knee breaks, white tapered trousers, white chunky boots with pink soles. Full WHITE gloves with pink knuckle pads and ink palms. Torso silhouette has rounded semicircular shoulder caps and very clean symmetrical jacket; no straps, tails, intricate motifs, belts or insignia. Small beveled white implant power pack at upper back with single wide pink center strip. Expressions portraits ALL keep rigid same smiling lower-face mask: cheerful eyes, tense frightened eyes, angry narrowed eyes; smile never moves. Glove detail front/back five fingers, accessory detail mask and one temple implant. Action stance shouldered compact original blocky white rifle with pink energy strip, ink barrel and pink magazine, both full white gloves visible. Front/back A-pose 45 degrees down same scale. Side view mask protrusion and implant clear, no occluded lower body. Only pink neon highlights, absolutely no cyan or yellow on character or weapon. No ruler or head-count diagrams, no numbers, only specified Portuguese labels and title. Invariance across all views.
```

## Verificação e limites

Verificação de arquivo: Pillow abriu os três PNGs e confirmou 1536 × 1024; tamanhos de 1.860.891, 1.743.283 e 1.714.181 bytes, respectivamente. `npm run check` passou: TypeScript cliente/servidor, 15 arquivos de testes / 107 testes e build Vite. Não houve mudança de jogabilidade que exigisse teste jogando no navegador.

Somente esta pasta contém as entregas; código, branches e commits não foram alterados por esta tarefa. As três imagens foram inspecionadas visualmente; a régua de Lia foi removida na iteração final. Não há promessa de medidas ortográficas exatas na ilustração: o bloqueio 3D deve seguir os números e a lateralidade deste README. Não foram criados novos sistemas de gameplay.
