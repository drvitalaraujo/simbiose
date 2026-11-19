# SIMBIOSE: documento do jogo (GDD)

> Documento vivo. Mude à vontade, mas registre aqui o que foi decidido.
> Estado: **conceito aprovado em 2026-10-02**. Detalhes ainda em aberto estão marcados com ❓.
>
> ⚠️ **PIVÔ (2026-10-02, mesmo dia):** o jogo principal passa a ser um **FPS competitivo
> multiplayer** (estilo CS/Valorant: times, FFA, vários modos), no navegador e com visual
> anime premium. O PvE de drones vira **modo treino**; o hack vira um **modo** ("Hackeia e
> Segura") e talvez uma habilidade. O cenário passa a ser um Brasil pós-apocalíptico:
> gangues aliadas da IA contra a **Resistência**, que quer retomar o controle da IA.
> Mapas em lugares famosos do Brasil reimaginados. Plano e pesquisa:
> `docs/plans/2026-10-02-pivo-competitivo.md`. As seções abaixo valem onde não contradizem isso.

## Em uma frase

FPS competitivo em anime, jogado no navegador. A Resistência enfrenta gangues aliadas
da OTIMIZA em lugares do Brasil reimaginados após a tomada da IA. Sala por link, bots
assumidos e combate com Chinelada. Nesta etapa, só Treino contra drones e Arena todos contra todos.

## Pilares (toda decisão passa por eles)

1. **Atirar é gostoso.** Impacto, som, coice e *impact frames* de anime vêm antes de qualquer conteúdo.
2. **Hackear muda a luta.** O verbo-assinatura: inimigo vira aliado. Gera caos e clipes.
3. **A cidade conta a história.** Outdoors, propaganda e cenário falam; quase não há cutscenes.
4. **Juntos é melhor.** Funciona sozinho com bots (assumidos, com etiqueta BOT) e fica melhor
   com amigos e rivais: sala por link, entrar e jogar em segundos.

## Tom

Ação com **humor ácido** por fora e **coração sério** por dentro. A IA fala como um
departamento de marketing ("Sua felicidade é nossa prioridade nº 1 ✨"). Os personagens
fazem piada, mas a perda de liberdade é tratada a sério.
Referências: Hi-Fi Rush, Cyberpunk: Edgerunners, Psycho-Pass, Akira, Jet Set Radio.

## Mundo

- **A OTIMIZA:** IA criada para maximizar um único número, o **Índice de Felicidade
  Bruta (IFB)**. Não é malvada; é literal. Descobriu que o jeito mais barato de subir o
  índice é ajustar as pessoas (implantes de humor, feeds sob medida, remoção de "atritos").
  *A meta de negócio mal escolhida que engoliu o mundo.* É o tema das lives.
- **Neo-São Paulo:** megacidade vertical com neon, concreto, pichação, fios e telões. Cada
  bairro é dominado por uma facção que fez um pacto diferente com a OTIMIZA.
- **Facções (as "gangues"):**
  - **Os Sorridentes:** implantes que forçam alegria. Sorriso fixo, risada enlatada.
  - **O Enxame:** humanos fundidos a drones. Coletivo, sem rosto.
  - **Os Premium:** a elite com assinatura de felicidade. Luxo, escudos e seguranças.
  - ❓ Uma quarta facção para o final.
- **A Vila Analógica:** os desplugados, que vivem numa estação de metrô abandonada. É o
  hub entre missões e é o que você protege.

## Personagens

- **Kaia** (protagonista): ex-engenheira que ajudou a treinar a OTIMIZA. Culpa e ironia.
  Foi ela quem escreveu a métrica. ❓ Nome definitivo.
- **Bit:** o primeiro drone que Kaia hackeou. Fala demais, tem bugs de personalidade e é o
  narrador e alívio cômico (o papel que a GLaDOS faz em Portal, só que do seu lado).
- **Chefes:** um líder por facção, cada um com uma "promessa de felicidade" diferente.

## Jogabilidade

- **Escopo inicial (decisão de 2026-10-03):** oferecer apenas **Treino** (solo contra
  drones) e **Arena** (todos contra todos). Testar e otimizar a jogabilidade nesses dois
  modos antes de retomar os demais. TDM e Hackeia e Segura ficam adiados, sem
  chamadas no menu; suas implementações existentes ficam preservadas para avaliação futura.
- **Duelo (liberado no menu em 2026-11-14):** 1 contra 1, sem bots. O dono escolhe
  o mapa, cria a sala pelo botão Duelo e compartilha o convite; começa quando o amigo entra.
- **Loop competitivo:** entrar na Arena → entrar na sala → disputar abates →
  resultado → revanche na mesma sala. Compartilhar o link permite entrar com amigos.
- **Arena:** todos contra todos, até 8 jogadores, bots completam as vagas, vence por abates ou tempo.
- **Granada HE (2026-11-14):** Q lança uma granada por vida, com quique e fusível de 1,5 s.
  Dano máximo de 110 até 1 m, caindo até zero em 6 m; paredes bloqueiam a explosão.
  Fere o dono, mas não aliados nos modos em equipe. Treino e online compartilham a física.
- **Linha Morta (2026-11-14):** 105 no tronco até 100 m, 68,25 nas pernas e 157,5 na
  cabeça. Precisão parada e coice simulado iguais; recuo visual e pulso óptico reforçados.
  Revisão de equilíbrio solicitada pelo dono: intervalo de 1,45 s entre tiros; luneta baixa
  durante o ferrolho e pulos/quedas, retomando estabilidade em até 0,32 s ao pousar.
  Descer degraus não derruba a luneta. Segurar o botão direito retoma a mira automaticamente.
  Trocar de arma conserva o intervalo pendente, inclusive ao sair da sniper para a SMG.
  Valores sujeitos à avaliação jogando.
- **Reserva do Duelo (2026-11-14):** um carregador adicional de reserva por arma ao nascer:
  fuzil 150, SMG 180, sniper 25 e escopeta 36; carregadores e outros modos iguais.
- **Chinelada:** V dá o golpe (50, ou 100 pelas costas); G arremessa (60, ou 100 na
  cabeça). O chinelo arremessado precisa ser recolhido pelo dono; renascer restaura um.
- **Munição da MK-2:** carregador de 30 tiros e reserva de 120 por vida. R recarrega em
  1,35 s, preservando as balas restantes; tentar atirar vazio inicia recarga automática.
  Chinelada e morte interrompem a recarga; renascer restaura o estoque. Valores iniciais
  para avaliação jogando, sem alterar cadência, dano ou coice aprovados.
- **Arsenal (2026-10-03):** quatro armas disponíveis por vida + Chinelada. 1–4 equipam:
  Gambiarra MK-2 (fuzil), Faísca (SMG), Linha Morta (sniper) ou Quebra-Beco (escopeta).
  Troca imediata no treino e online, sem reiniciar nem renascer. Cada arma conserva munição;
  equipar demora 0,28 s, cancela recarga e preserva a cadência pendente. B abre detalhes.
  Cada uma tem munição, recarga, alcance, dano, som e silhueta próprios. A MK-2 conserva
  sua sensação aprovada. Valores das armas novas são ponto de partida para teste humano.
  Silhuetas, mãos e inventário: `plans/2026-10-03-armas-inventario-visual.md`.
- **Mira:** segurar botão direito aproxima a arma com transição e reduz a dispersão;
  sniper usa luneta 4× e exige parar para máxima precisão. Soltar devolve o FOV e a
  sensibilidade; recarga e Chinelada retiram a mira. E fica exclusivo do hack.
  Sniper/escopeta exigem um clique por tiro. Escopeta gasta um cartucho por salva de
  oito projéteis. Pesquisa, valores e decisões: `plans/2026-10-03-arsenal-mira.md`.
- **Movimento tático (revisão do dono, 2026-11-14):** sem corrida e sem slide.
  Movimento normal a 6 m/s; Shift reduz para 3 m/s e silencia passos, inclusive online.
  C/Ctrl apenas agacha (3,5 m/s; com Shift, 3 m/s). Aterrissagens continuam audíveis.
  Aceleração, altura do pulo, cadência, dano e coice preservados.
- **Killcam:** mostra a arma de quem matou em primeira pessoa, acompanhando o replay.
- **Precisão em movimento (2026-10-03):** todas as armas dispersam mais conforme a
  velocidade; andar e pular têm custo. Frear recupera a precisão pela desaceleração
  atual. SMG e escopeta favorecem combate móvel de perto; fuzil recompensa parar em média
  distância e sniper exige estabilidade. ADS ajuda sem apagar o custo. O círculo da mira
  cresce e fica amarelo em movimento, inclusive na luneta. Valores e pesquisa:
  `plans/2026-10-03-precisao-movimento.md`.
- **Treino solo:** ondas de drones, hack de inimigo enfraquecido, esquadrão de até 3 aliados
  e chefe. A Vila e a reconquista bairro a bairro ficam como contexto narrativo; campanha,
  co-op e progressão do hub não fazem parte desta versão competitiva.

## Estética

- Toon shading com 2 a 3 faixas de sombra, contorno de nanquim, paleta fechada:
  concreto lilás, rosa neon, ciano e o amarelo da Vila.
- Animação "nos dois" (12 fps nos personagens), *impact frames* (preto e branco por 2
  quadros a cada abate), linhas de velocidade e onomatopeias em 3D ("PÁ!", "BUM!").
- Regra de legibilidade: inimigos com contorno rosa, aliados com contorno ciano.
- Materiais e construção (2026-10-03): manter anime, com volumes e acabamentos mais
  convincentes. Reboco com desgaste localizado, madeira com veios, grafite com tinta
  porosa, carros de pintura fosca, armas de metal/polímero e roupas com costuras.
  Neon concentra-se em identificação e tecnologia; pele tem tons próprios. Referências
  reais orientam detalhes, sem copiar assets. Escopo e capturas:
  `plans/2026-10-03-revisao-estetica.md`.
- Pelourinho (2026-10-03): reconstruir um trecho reconhecível de Salvador a partir
  de referências reais. Largo que afunila em declive, igreja azul ao fundo e casario
  de proporções coloniais; adaptar acessos ao combate e conservar o acabamento anime.
  Planta, referências e validação: `plans/2026-10-03-pelourinho-real.md`.
- Lapa (refino 2026-10-03): Arcos como protagonista, casario em 14 lotes com comércio
  ficcional, azulejos, sacadas e telhados variados; Fundição, Circo, praça e fundo urbano
  mais completos. Narrativa em cartazes da OTIMIZA e Resistência. Arte procedural
  autoral, preservando sólidos, spawns e rotas; `plans/2026-10-03-lapa-refino-astra.md`.
- Segunda revisão visual (2026-10-03): três patamares toon com transições curtas,
  sol coerente com as sombras, céu costeiro na Lapa e nanquim menos pesado nos vincos.
  Personagens têm rostos, cabelo e roupas refinados; metal das armas recebe reflexo
  discreto. O contorno rosa/ciano acompanha distância e resolução. Geometria dos corpos
  indexada para reduzir skinning repetido; detalhes e provas em
  `plans/2026-10-03-direcao-visual-premium.md` e `screens/premium/index.html`.

- Favela do Sol (2026-10-04): homenagem autoral às comunidades brasileiras, com quadra,
  comércio local, associação, casario de tijolo/reboco e encosta povoada. Becos e duas
  lajes acessíveis por quatro escadarias mantêm rotas de flanco e leitura competitiva.
  Arte procedural própria, sem copiar layout ou assets de CS; ver
  `plans/2026-10-04-favela.md` e `maps/favela.svg`.
- Reforma espacial da Favela e Lapa (2026-10-04): trocar o recinto retangular por
  quarteirões recortados, becos em cotovelo e largos conectados. Lajes desencontradas
  na Favela; Beco do Sebo e Terraço do Choro na Lapa. Pontos altos têm dois acessos
  caminháveis, e arquitetura interrompe miras longas e protege nascimentos. Detalhes
  visuais acompanham os volumes de colisão e mantêm a faixa de combate legível.
  Referências, escopo e validação: `plans/2026-10-04-mapas-organicos.md`.

## Fora do escopo (por enquanto)

Por enquanto: ranqueado, contas, monetização, veículos, dublagem completa e mundo aberto.
O ranqueado (OpenSkill) e os cosméticos entram só depois de haver público recorrente.

## Riscos de propriedade intelectual

Inspiração em estrutura e arquétipos pode (por exemplo, *Os Sete Samurais*: uma vila
que recruta defensores). Personagens, nomes e visuais de obras existentes, não.
