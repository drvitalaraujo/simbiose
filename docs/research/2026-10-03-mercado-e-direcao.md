# Estado do SIMBIOSE e direção de mercado

Data da pesquisa: 3 de outubro de 2026. Responsável: Codex. Destinatário: Vital.
Estado: diagnóstico e propostas; não altera as decisões aprovadas do GDD.

O SIMBIOSE já possui a base de um FPS online jogável. A oportunidade que recomendo explorar é uma Arena de anime situada no Brasil, fácil de abrir com amigos, com armas convincentes e uma interação de hack que produza jogadas reconhecíveis. O próximo salto deve aprofundar a experiência atual: personagens com presença, Pelourinho com história e combate compreensível. Expandir conteúdo depois de observar pessoas querendo repetir a partida.

Esta pesquisa compara funcionalidades e experiência, examina relatos de desenvolvimento solo e circulação no X e propõe critérios para evolução. Não há fórmula comprovada para viralizar. As recomendações abaixo são hipóteses de produto derivadas das evidências, e não previsão de vendas.

## Método e limites da pesquisa

Foram lidos o GDD, código de menu, armas, rede, skins, partidas e configurações, pesquisas anteriores e revisões. Inspecionei capturas reais do Pelourinho e dos personagens em `docs/screens/estetica/`. A captura `hud-partida.jpg` é uma demonstração antiga de interface, com TDM e armas ilustrativas; não foi usada como prova dos modos ou armas oferecidos hoje.

O HEAD consultado foi `3830c27`, na branch `fix/alinhamento-armas`. Havia alterações locais em andamento, incluindo alinhamento, precisão e sonorização. Este é um retrato da sessão, não uma auditoria de versão publicada. Planos antigos foram tratados como histórico: suas sugestões não substituem decisões posteriores no GDD.

As fontes externas incluem documentação dos próprios jogos, lojas oficiais, postmortems dos autores, comunidades de jogadores, GDC, Newzoo e posts indexados do X. Posts de Pieter Levels também puderam ser lidos nas republicações do próprio autor em seu site, identificadas como originalmente publicadas no X.

O X bloqueou diversas aberturas diretas com 403 ou falha de cache. Portanto, a pesquisa **não equivale a ler o feed completo em tempo real**, respostas indisponíveis ou uma amostra representativa do Twitter. Conteúdo indexado pode estar atrasado. Resumos automáticos de tendências do X não foram tratados como confirmação de receita ou sucesso. As métricas das lojas podem variar por idioma, filtro e momento de consulta.

Não fiz uma nova sessão manual de gameplay nem um teste de carga público. As observações visuais vêm das capturas existentes; sensação de tiro, mixagem, rede real e diversão precisam de avaliação humana. Rodei `npm.cmd run check`: TypeScript cliente/servidor, 56 arquivos e 377 testes passaram, e o build concluiu. Permanece o aviso de chunk principal acima de 800 kB. Arquivos locais continuaram evoluindo durante a pesquisa; esse resultado corresponde à execução desta sessão.

Legenda usada: **fato local** é observado no projeto; **evidência externa** é sustentada pela fonte; **interpretação** é minha leitura; **proposta** ainda depende de validação e escolha do dono.

## O que existe no jogo hoje

| Área | Fato local | O que isso entrega ao jogador | Lacuna ou questão a validar |
|---|---|---|---|
| Oferta principal | O menu lista Arena FFA e Treino | Entender rapidamente onde jogar | Medir se a pessoa começa sem explicação do autor |
| Arena | Até 8 jogadores, bots identificados, abates/tempo, renascimento e revanche | Jogar mesmo com poucos humanos | Não há evidência de público recorrente ou salas humanas sustentadas |
| Armas | MK-2, Faísca, Linha Morta e Quebra-Beco; slots 1–4 | Quatro papéis, troca em vida, munição independente | Clareza de cada papel e equilíbrio precisam de partidas humanas |
| Mira e recarga | ADS, luneta 4×, dispersão, recarga e reservas | Mais escolhas durante o confronto | Ensinar quando parar, mirar, recarregar e trocar |
| Movimento | Corrida, pulo, agachamento e slide na ladeira | Uma técnica ligada ao próprio cenário | Não confundir profundidade com acrescentar toda mobilidade de outros FPS |
| Chinelada | Golpe, arremesso e recolha do chinelo | Humor e risco com identidade brasileira | Descoberta espontânea e utilidade em partidas reais |
| Hack | Drones enfraquecidos convertidos no Treino; esquadrão e chefe | Um verbo próprio já demonstrável | A Arena FFA oferecida não entrega esse pilar |
| Modos preservados | Duelo, TDM e Hack possuem implementação e links diretos | Material para experimentos futuros | Estão adiados no GDD e não devem ser apresentados como oferta atual |
| Cenários | Bairro no treino e Pelourinho; arena simples de teste na rede | Contexto brasileiro e verticalidade | Bairro não equivale a um segundo mapa competitivo pronto |
| Personagens | Lia, Caio e Ivo com skins e animação compartilhada | Aparências distintas | Skin online é derivada do nome; não há kit individual de habilidade observado |
| Narrativa | OTIMIZA, Kaia, Bit, facções, falas e propaganda | Uma premissa com humor e conflito | A ligação entre Kaia e o elenco competitivo precisa ficar clara |
| Rede | Simulação 60 Hz, servidor autoritativo, predição, rewind e limites | Base técnica para confronto online | Não comprova resistência completa a trapaça, escala ou boa experiência em qualquer conexão |
| Convites | Entrada por `sala`, URL de convite e revanche na mesma sala | Reunir amigos | O HUD apresenta campo de link selecionável; simplificar o convite pode ajudar |
| Configurações | Sensibilidade, FOV e qualidade; preferências persistidas | Ajustes básicos de conforto | Volume estava salvo sem ligação indicada no menu consultado; sonorização está em andamento |
| Continuidade | Reserva de reconexão no servidor; SDK e aviso de desconexão | Parte da infraestrutura já existe | Não classificar reconexão como ausente; testar e polir o fluxo percebido pelo jogador |
| Retenção | Resultado e revanche | Repetição dentro da sessão | Não identifiquei instrumentação de funil/retorno, progressão persistente ou replay exportável |

Fontes locais principais: [GDD](../GDD.md), [menu](../../src/game/menu/modes.ts), [arsenal](../../src/sim/weapons.ts), [partida](../../src/net/match.ts), [mapas de rede](../../src/net/maps.ts), [skins](../../src/game/characters/skins/index.ts), [cliente](../../src/net/client.ts), [HUD online](../../src/game/online-hud.ts), [servidor](../../server/arena-room.ts), [sonorização](../plans/2026-10-03-sonorizacao.md).

**Interpretação:** o projeto tem mais infraestrutura que identidade experimentada pelo público. As lacunas de maior valor parecem estar na primeira partida, na apresentação dos personagens e na presença do hack no competitivo. Isso é diferente de concluir que faltam armas ou modos: precisamos medir o uso do que já existe.

## O mercado com que realmente competimos

Newzoo descreve o crescimento recente de PC/console como cada vez mais dependente de monetização e economia de plataformas, sem expansão equivalente do tempo do jogador. No ranking de julho de 2026, publicado em 2 de setembro, CS2, Minecraft, Roblox e Fortnite mantiveram as quatro primeiras posições de usuários ativos mensais no PC da cobertura do relatório. São dados de PC/console, não uma medição do público de browser. [Relatório 2026](https://newzoo.com/reports/pc-console-gaming-report-2026), [ranking de julho](https://newzoo.com/articles/july-2026-pc-console-rankings).

**Interpretação:** um jogador já tem onde competir, amigos e hábitos. Nossa oportunidade inicial é oferecer uma sessão que ele consiga experimentar e compartilhar com baixo compromisso. A frase de aquisição proposta é: **“Chame seus amigos para uma Arena de anime no Brasil, com Chinelada e hack.”** O hack competitivo é uma promessa futura; até estar validado, a comunicação externa deve anunciar apenas o que está jogável.

| Referência e relação com SIMBIOSE | Funcionalidades e experiência sustentadas pela fonte | Habilidade ou assinatura | O que aprender, como proposta |
|---|---|---|---|
| [Krunker](https://krunker.io/guides/) — concorrente direto no browser | Entrada rápida, modos, classes, cosméticos e sistemas sociais descritos no guia | Movimento e domínio do confronto como referência de observação | Poucos passos entre abrir e jogar; medir loading e convite |
| [Shell Shockers](https://bluewizard.com/shell-shockers-king-of-the-coop-eggsclusive/) — concorrente direto de FPS leve | Ovos armados, humor integrado, modos simples; o relato mostra expansão gradual e ajuste de equipes | Tema reconhecível e objetivo compreensível | Fazer Chinelada aparecer no combate e nos resultados; expandir modos com base em uso |
| [CS2](https://store.steampowered.com/app/730/CounterStrike_2/?l=english) — referência de exigência competitiva | Objetivos, Premier, rankings, workshop, fumaça dinâmica e audiovisual revisado | Profundidade nas regras do combate e do mapa | Clareza de morte, posição, áudio e cobertura; não confundir nosso FFA com seu loop tático |
| [Valorant](https://playvalorant.com/en-us/) — referência de personagens e habilidades | Tático 5v5, agentes com habilidades, uma vida por rodada e vários modos | Agentes criam oportunidades para o tiro | Dar identidade a poucos personagens e limitar inicialmente as interações de utilidade |
| [Strinova](https://store.steampowered.com/app/1282270/Strinova/?l=english) — referência de anime competitivo | TPS, alternância 2D/3D, mapas em camadas, habilidades e armas por personagem | Transformação muda rotas e combate | Anime tem mais valor quando acompanha um verbo distinguível; testar hack antes de ampliar elenco |
| [The Finals](https://store.steampowered.com/app/2073850/THE_FINALS/?l=english) — referência de espetáculo e cenário | Arenas inspiradas em locais reais, destruição, tipos de corpo, armas e gadgets | O ambiente altera o confronto | Introduzir uma mudança controlada de estado no cenário; destruição integral teria alto custo para nossa arquitetura |
| [FragPunk](https://store.steampowered.com/app/2943650/FragPunk/) — referência de variação | Hero shooter 5v5; cartas modificam regras e interagem | A partida varia por combinações | Experimentar uma regra legível por evento; a fonte não prova que mais cartas aumentam retenção |
| [Splitgate Arena Reloaded](https://www.splitgate.com/de/news/introducing-splitgate-arena-reloaded/) — contraponto recente | Relançamento anunciado em dezembro de 2025 após feedback, retirando facções e habilidades e recentrando Arena | Portais permanecem centrais | Aprofundar a assinatura precisa preservar o prazer do confronto; mais sistemas podem exigir revisão |

As células de aprendizado são interpretações e propostas. Não são conclusões declaradas pelos estúdios. Não estimei receita, contagem global de jogadores nem desempenho dos concorrentes a partir desses recursos.

O SIMBIOSE oferece todas as quatro armas por vida e troca em slots; não tem a mesma decisão de compra de CS/Valorant ou arma exclusiva por herói. **Proposta:** explorar essa liberdade como uma identidade de Arsenal, avaliando se a troca resolve situações de combate, antes de acrescentar economia ou restrições de classe.

## O que os jogadores e desenvolvedores estão dizendo

### Primeira partida precisa ser acolhedora e compreensível

Em 2 de setembro de 2026, um novato de The Finals relatou gostar das combinações de equipamento, mas questionou continuar após partidas contra jogadores muito experientes. Uma discussão de janeiro trazia preocupação semelhante ao convidar amigos. Há respostas discordantes e relatos de boas partidas na mesma comunidade; nível da conta também não equivale a habilidade. Esses tópicos mostram fricção percebida, não demonstram como funciona o algoritmo nem a incidência do problema. [Relato de setembro](https://www.reddit.com/r/thefinals/comments/1w516gw/why_is_a_new_player_being_put_against_seasoned/), [discussão de janeiro](https://www.reddit.com/r/thefinals/comments/1q3iehr/its_hard_to_keep_new_players_actually_playing/).

**Proposta:** observar os três primeiros minutos do SIMBIOSE sem explicar os controles. Dar ao novato uma sequência curta e opcional: acertar um alvo, mirar, trocar arma e arremessar o chinelo. Bots com dificuldade selecionável no Treino podem oferecer aprendizado explícito. Não ajustar dificuldade competitiva secretamente durante o confronto.

### Publicar sobre tecnologia e vender diversão são atividades diferentes

O autor de Yet Another Incremental Game relatou 4.313 wishlists em sete meses, concentradas em dois eventos: comunidade específica do gênero e Next Fest. Posts em comunidades de desenvolvimento tiveram pouco efeito mensurável em seu caso. Já o autor de Everfront relatou que um post em r/godot gerou a maior parte das wishlists rastreáveis da estreia da página. São relatos individuais com resultados diferentes; eles não sustentam “devs nunca convertem”. [Relato do incremental](https://www.reddit.com/r/SoloDevelopment/comments/1sy7911/postmortem_i_tracked_every_marketing_action/), [postmortem de Everfront](https://everfrontgame.com/blog/launch-postmortem).

**Proposta:** manter duas mensagens. Nas lives de IA, mostrar processo, decisões e correções. Para jogadores, abrir com uma jogada real e a experiência que eles terão. Medir sessões começadas e partidas repetidas por origem. O público que assiste agentes programarem não deve ser contado automaticamente como público que volta ao FPS.

### A conversa sobre IA não é unanimemente favorável

A pesquisa GDC 2026, com mais de 2.300 profissionais, encontrou 52% considerando negativo o impacto da IA generativa na indústria e 36% usando ferramentas generativas no trabalho. A amostra e as perguntas mudaram; esses números são de profissionais respondentes, não de todos os jogadores. [GDC 2026](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/).

**Interpretação e proposta:** o processo com agentes pode ser um bom assunto para lives, mas a promessa do produto deve ser a diversão. Mostrar curadoria, autoria, consistência e origem dos assets. Isso preserva transparência e permite que a pessoa avalie o resultado jogando.

### Evidência específica do X

| Fonte e data do conteúdo | O que foi possível consultar | O que sustenta | Limite |
|---|---|---|---|
| Pieter Levels, [Vibe Jam 2026](https://levels.io/vibe-jam-2026-winners-quality), 17/06/2026 | Republicação do próprio autor de post do X | Vencedores: capivaras entregando comida, Fanto’s Mega-Mart e WenWare; categorias destacam conceito, humor, atmosfera e polimento | Premiação e avaliação do júri não medem retorno dos jogadores |
| Pieter Levels, [jam 2025](https://levels.io/winners-of-the-2025-vibe-code-game-jam), 23/04/2025 | Post republicado com comentários atribuídos ao júri | Comentários valorizam diversão imediata, execução, música e controles; há críticas a acabamento | Amostra selecionada de finalistas e opiniões do júri |
| Pieter Levels, [avião no browser](https://levels.io/fly-pieter-com-vibecoded-flight-simulator), início em 22/02/2025 | Relato do próprio autor | Objetivo declarado de reduzir espera até jogar; desenvolvimento público e receita anualizada declarada | Não é auditoria financeira nem demonstra receita mantida por um ano |
| [Road to Vostok no X](https://x.com/roadtovostok/status/2040824853347860760), 05/04/2026 | Texto indexado do post oficial | Comunicação de build e changelog dois dias antes do Early Access | Abertura direta bloqueada; não foram lidas todas as respostas |
| [Splitgate no X](https://x.com/Splitgate/with_replies), perfil indexado | Posicionamento oficial indexado, conferido no site do jogo | Comunicação do relançamento prioriza Arena sem heróis/habilidades | Perfil e métricas indexadas não são retrato em tempo real |
| [Iron Meat no X](https://x.com/IvanMeat), posts de 2023–2024 | Perfil indexado com vídeos/anúncios, demo e wishlist | Divulgação de cenas, chefes e atualizações ligada a um destino jogável | Não atribui vendas aos posts nem comprova trabalho sem colaboradores |
| Tangy TD, tendências automáticas do X | Resumos encontrados durante a busca | Serviram para localizar o jogo e o criador Cakez | Alegações de US$ 250 mil e picos foram excluídas das conclusões por falta de confirmação suficiente nesta pesquisa |

**Interpretação:** as manifestações verificáveis combinam cenas que se entendem, atualização demonstrável e caminho para jogar. “Feito por IA” dá assunto à descoberta, mas não comprova qualidade comercial. O caso do avião também tinha distribuição do próprio criador; nossa audiência deve ser medida separadamente.

## O que podemos aprender dos casos de desenvolvimento solo

| Caso | Evidência | Aplicação proposta ao SIMBIOSE |
|---|---|---|
| [Balatro e LocalThunk](https://localthunk.com/blog/balatro-timeline-3aarh) | O autor descreve testes com amigos, demo, cobertura de streamers e colaboração com Playstack; passou de 48 wishlists no fim de maio de 2023 para 2.440 no fim de junho | Procurar comportamento real de repetição antes de inflar escopo; botar uma versão demonstrável nas mãos de pessoas |
| [Lethal Company e Zeekerss](https://store.steampowered.com/app/1966720/Lethal_Company/?l=english) | A descrição reúne coleta, quota, equipe, perigos e ferramentas; o autor declara usar feedback e vídeos de gameplay | Sistemas pequenos podem criar histórias entre pessoas; medir os momentos contados após a partida |
| [Road to Vostok e Antti](https://roadtovostok.com/) | O criador informa ser o único desenvolvedor integral, com prestadores ocasionais; optou pelo solo por custo e risco do multiplayer | “Solo” não significa ausência de ajuda. Nosso multiplayer já existe, mas toda expansão traz operação e manutenção |
| [Tangy TD e Cakez](https://store.steampowered.com/app/2245620/Tangy_TD/?l=english) | O jogo, lançado em 09/03/2026, lista Cakez como desenvolvedor/editor e apresenta combinações, atributos e árvore de habilidades | Profundidade pode nascer de combinações. No PvP, preferir domínio e alternativas às vantagens permanentes de dano |
| [Everfront](https://everfrontgame.com/blog/launch-postmortem) | O autor distingue wishlists totais das rastreáveis e registra pouca contribuição do X a partir de zero seguidores | Instrumentar origem; não escolher rede social por reputação ou promessa genérica |
| [PEAK](https://landfall.se/peak) — comparação social, não exemplo solo | Feito em colaboração com Aggro Crab; ajuda entre amigos, obstáculos, itens e mapa diário | Dar condições para lances compartilháveis; não concluir que nossa produção cabe no prazo de uma equipe experiente |
| [Schedule I](https://store.steampowered.com/app/3164500/Schedule_I/?l=english) — comparação de produto | Demo gratuita, co-op e expansão/automação descritos pelo desenvolvedor | O jogador precisa ver o próximo objetivo; isso pode ser aprender uma arma ou completar desafio sem abrir uma campanha |

Não usei estimativas de vendas de Lethal Company, PEAK ou Schedule I para prever receita do SIMBIOSE. Jogos pagos de Steam, browser e serviços gratuitos têm condições distintas. Os casos foram escolhidos para examinar mecanismos, incluindo dificuldades, e não constituem amostra estatística de todos os indies.

## Viralizar crescer e sustentar são resultados diferentes

Um vídeo pode circular muito e levar pouca gente a jogar. Uma demo pode atrair jogadores que não voltam. Um jogo pequeno pode ser sustentável com uma comunidade modesta. A documentação Steamworks afirma que não existe fórmula precisa para prever vendas a partir de wishlists nem mínimo universal de wishlists para começar a exibir um jogo. [Wishlists no Steamworks](https://partner.steamgames.com/doc/marketing/wishlist).

**Síntese interpretativa dos casos:** as características a testar são as seguintes.

| Característica | Como aparece nas referências | Experimento proposto para SIMBIOSE |
|---|---|---|
| Premissa visual legível | Ovos armados, escalada, transformação 2D/3D, taxi | Clipe de Chinelada na ladeira; pessoa explica o que aconteceu sem legenda longa |
| Ação com consequência | Quota e perigo em Lethal Company; ajuda e queda em PEAK | Recuperar o chinelo ou disputar um drone muda a escolha seguinte |
| Participação social | Cooperação e convite entre amigos | Convidar pelo link, cair na mesma sala, repetir sem reconstruir o grupo |
| Domínio observável | Ferramentas, combinações e posições | Mostrar melhora no slide, precisão e uso de cobertura |
| Humor que nasce da ação | Tema de Shell e acidentes em jogos sociais | Acerto improvável, chinelo perdido, anúncio curto da OTIMIZA |
| Pequeno atrito até jogar | Browser e demos acessíveis | Medir clique até controle e primeiro confronto em uma conexão comum |
| Motivo de repetir | Variações, objetivos e aprendizado | Revanche, desafio de arma e novidade pontual no mesmo mapa |
| Curadoria e acabamento | Execução, áudio e controles nas avaliações das jams | Uma sequência final coerente, observada na partida inteira |

Para browser, CrazyGames recomenda introdução jogável, curta, pulável e focada nas ações centrais. Seus requisitos também exigem localização em inglês e limitam tamanho inicial para submissão. Não estou recomendando publicação agora: são critérios concretos de produto caso esse canal seja escolhido. [Qualidade](https://docs.crazygames.com/requirements/quality/), [gameplay](https://docs.crazygames.com/requirements/gameplay/), [técnica](https://docs.crazygames.com/requirements/technical/).

## Como trazer mais realidade e complexidade

Todas as ideias nesta seção são propostas originais. Não são funcionalidades já presentes nem alterações autorizadas nos valores aprovados de movimento e tiro.

### Personagens com presença e conflito

Nas capturas atuais, Lia, Caio e Ivo possuem figurinos reconhecíveis, mas compartilham proporções e postura. Detalhes pequenos não bastam para comunicar personalidade à distância. A melhoria prioritária seria trabalhar rosto, cabelo, massas do figurino, pose de descanso e gestos; depois costuras e acessórios. Manter hitboxes justas e legibilidade do inimigo.

| Personagem existente | Profundidade narrativa proposta | Presença visual proposta | Interação futura candidata, sem aprovar kit |
|---|---|---|---|
| Lia Estalo | Protege pessoas, mas precisa aprender a confiar em tecnologia que combate | Postura alerta, movimento decidido e reconhecimento rápido da ameaça | Drone observador destruível, que informa uma área por pouco tempo |
| Caio Remendo | Mantém a comunidade funcionando; esconde o medo atrás de piadas | Equipamento reparado de forma funcional, gesto próprio de preparação | Interferência que neutraliza um dispositivo do cenário |
| Ivo Riso | Repete a promessa da OTIMIZA enquanto luta para recuperar autonomia | Sorriso rígido em contraste com olhos e gestos tensos | Isca audiovisual com sinal e som que podem ser reconhecidos |

**Ordem proposta:** seleção consciente de personagem com mesmas regras de combate; uma animação característica; pequenas falas; só depois avaliar kit individual. O GDD traz Kaia como protagonista do Treino, enquanto o online usa Lia/Caio/Ivo: definir a relação entre eles em uma página evita expandir uma narrativa contraditória.

Uma expressão de medo em Ivo ou o equipamento consertado de Caio pode comunicar conflito com poucos assets. Facções ficam mais interessantes quando oferecem uma vantagem tentadora e cobram um preço: segurança em troca de autonomia, felicidade em troca de autenticidade, pertencimento em troca de individualidade. A Vila deve mostrar algo que vale proteger.

### Cenário com vida e função

O Pelourinho já tem céu, fachadas, calçamento, volumes e cores próprias. Na captura, a placa grande “MEIO” ajuda a localização, mas conserva linguagem de teste de mapa. **Proposta:** integrar a orientação a letreiros ou marcas do mundo, preservando o nome usado nos callouts.

Escolher três pontos para um passe concentrado: largo, ladeira e igreja. Em cada ponto, trabalhar história de uso, contraste e um detalhe que só esse lugar teria: comércio fechado às pressas, religiosidade e resistência convivendo, cabeamento da OTIMIZA invadindo a construção antiga. Pesquisar referências e contexto cultural antes de decidir símbolos; Salvador não precisa virar apenas cenário de violência ou piada.

Mais presença pode vir de profundidade nas janelas, objetos agrupados com propósito, desgaste perto de passagens, panos/fios movendo levemente e som ambiente localizado. Manter fundos simples atrás dos personagens. Não espalhar neon e sujeira igualmente: a tecnologia deve ter função e o desgaste deve sugerir uma causa.

Para complexidade tática, **testar um único dispositivo neutro** em uma cópia experimental do mapa: terminal que altera um estado previsível, sinalizado e reversível. Porta, visão, energia ou controle de drone são alternativas, não uma lista para implementar inteira. Um novo estado precisa de validação de servidor, bots, bloqueio de tiro e linhas de visão. Começar por um dispositivo sem mudança estrutural de colisão reduz dependências.

Sistemas de moradores com IA, interiores completos, multidões, destruição ampla e física livre possuem custo alto para simulação, rede, arte e desempenho. Eles podem entrar no horizonte, mas precisam mostrar benefício maior que o de aperfeiçoar esses três pontos atuais.

### Combate com peso e leitura

Realidade no tiro é percebida pela coincidência entre ação, imagem e som. Priorizar encaixe das mãos, contato da arma, trajetória visível da recarga, retorno da mira, transição entre movimento e parada e reação do alvo. A sensação aprovada permanece protegida: polimento de apresentação e propostas de tuning são assuntos separados.

Há trabalho de áudio e precisão em andamento. Consolidá-lo antes de propor outra implementação. Verificar com fones se o jogador distingue tiro próprio, inimigo, passo, acerto e abate. Ambiência e falas precisam dar espaço à ameaça. Uma fumaça visual não deve sugerir bloqueio de visão se bots ou regras enxergam através dela sem explicação.

| Arma atual | Decisão que deveria ensinar | Verificação proposta |
|---|---|---|
| MK-2 | Rajada, cobertura e média distância | Novato identifica por que errou enquanto corria |
| Faísca | Aproximação e pressão curta | Tem vantagem situacional, sem dominar também o alcance longo |
| Linha Morta | Parar, mirar e assumir o risco do erro | Visão e animação tornam a janela de vulnerabilidade compreensível |
| Quebra-Beco | Distância e quantidade de projéteis atingidos | Resultado não parece aleatório quando parte da salva erra |
| Chinelada | Flanco, arremesso e recolha | O dono entende onde está seu chinelo e o rival percebe a ameaça |

Não recomendo agora acrescentar armas para preencher uma vitrine. Recomendo obter pelo menos dois usos distintos e desejados de cada arma nas partidas observadas. Dano, cadência e recuo só seriam alterados numa tarefa de balanceamento específica aprovada pelo dono.

### Habilidades que aprofundam o hack

A referência de Valorant mostra habilidades criando oportunidades, mas nem toda habilidade de mercado é indireta ou sem dano. Para o SIMBIOSE, a preferência por utilidade inicialmente sem dano é **uma escolha proposta de design**, com o objetivo de proteger o tiro e limitar o custo de balanceamento.

O primeiro experimento seria a disputa por **um drone neutro hackeável**, sem controlar a entrada, o personagem ou a câmera de um rival humano. Hackear exige exposição, tem sinais visuais/sonoros e pode ser interrompido. O rival pode destruir o dispositivo, disputar seu controle ou mudar de posição. A finalidade inicial pode ser informação ou distração; dano automático é uma expansão posterior a avaliar.

Testar no Treino ou em sessão experimental fechada. Comparar uma partida com a mesma partida-base em mapa, arma e jogadores. Avaliar: perceberam o hack, usaram intencionalmente, entenderam a resposta e ainda queriam atirar? Se o dispositivo monopolizar a atenção, reduzir sua presença. O modo Hack existente pode ser avaliado separadamente, sem recolocá-lo automaticamente no menu.

O risco de três personagens com três gadgets, passivas, ultimates e diferentes armas é multiplicar combinações, animações e explicações antes de saber qual interação vale manter. Na Arena inicial, personagens podem expressar identidade sem vantagens de dano. A profundidade também vem de decidir quando expor-se, trocar de arma ou recuperar o chinelo.

### Narrativa presente na partida

Proposta de tensão central: **a OTIMIZA pode manter a cidade funcionando, mas tenta eliminar a liberdade de sentir e escolher.** Personagens discordam sobre quais partes dessa tecnologia ainda devem ser usadas. Isso aproveita a métrica de felicidade já escrita no GDD.

Construir um episódio ambiental do Pelourinho: propaganda oficial promete recuperação; sinais dos moradores revelam o custo; um pequeno gesto de resistência contradiz a versão da IA. O jogador reconhece a contradição sem parar para ler um livro.

Falas propostas, ainda sem aprovação de canon:

- OTIMIZA, após uma derrota: “Sua experiência foi registrada como satisfatória.”
- Caio, após recuperar o chinelo: “Sustentabilidade. Usa, busca, usa de novo.”
- Bit, ao assumir um drone: “Troquei o gerente. Mantive o Wi-Fi.”
- Um cartaz apagado parcialmente: “A cidade sorri. Quem não sorri sai.”

Limitar repetição, permitir reduzir falas e manter indicadores essenciais legíveis sem áudio. O humor deve expor a contradição da IA; o sofrimento dos moradores sustenta o coração sério previsto no GDD.

Para a Arena FFA, a justificativa narrativa ainda precisa ser decidida. Um campo de teste ou disputa mediada pela OTIMIZA seria uma opção; não estou canonizando essa solução. Não forçar uma justificativa extensa antes de o jogador poder começar.

## Direção de produto recomendada

Minha prioridade seria **Arena social com profundidade competitiva**, usando Treino para entrada e experimentação. Ela aproveita rede, arsenal, bots, convite e cenário existentes e conversa com as lives. Proponho avaliar três direções com evidência, sem pivô imediato:

| Direção | Compatibilidade atual | O que precisaria provar | Principal custo |
|---|---|---|---|
| Arena social com hack pontual | Alta | Grupos repetem partidas e contam lances | Polimento, entrada, servidores e interação distintiva |
| Competitivo tático centrado em equipes | Parcial; TDM/Duelo/Hack preservados | Jogadores pedem estratégia por equipes, horários e competição recorrente | Balanceamento, população, integridade e aprendizagem |
| PvE/co-op narrativo | Treino fornece elementos, mas não campanha | Pessoas preferem enfrentar drones juntas e explorar o mundo | IA, encontros, missões, rede de entidades e conteúdo |

O primeiro caminho não impede os demais. Produz informação para escolher. Se o público tiver prazer consistente no hack e nos drones e pouco interesse em FFA, isso é evidência para reconsiderar cooperação; não precisamos assumir que todo FPS deve virar esport.

Evitar fragmentar uma audiência inicial. Como ilustração, 24 pessoas simultâneas distribuídas igualmente entre seis combinações de modo/mapa dariam quatro por combinação, antes de considerar regiões, horários e habilidade. É uma conta hipotética, não previsão. Bots mitigam salas vazias, mas não substituem rivais humanos para quem veio competir.

## Próximas etapas e critérios para decidir

As janelas de 30/60/90 dias abaixo são uma sequência proposta, não estimativa técnica garantida. Dependem do ritmo de sessões, tempo de arte, correções e acesso a jogadores. O plano operacional correspondente está em [próximos passos](../plans/2026-10-03-direcao-de-mercado.md).

| Janela proposta | Entrega | Decisão que deve resolver |
|---|---|---|
| Primeiros 30 dias | Consolidar combate/áudio; entrada observável; uma escolha visual de personagem; passe em três pontos do Pelourinho; sessões com novatos | Entendem, acertam, encontram amigos e querem revanche? |
| Dias 31–60 | Um protótipo de hack; pequenos conflitos/falas de personagens; desafio de domínio; teste de clipes | Qual interação e qual personagem são lembrados espontaneamente? |
| Dias 61–90 | Repetir sessões; corrigir retenção; escolher expansão conforme comportamento | Vale segundo mapa, modo de equipes ou mais PvE? |

O esforço inicial poderia ser dividido aproximadamente em 50% combate/entrada/desempenho, 25% personagens/cenário/narrativa e 25% observação/distribuição. É uma proposta de capacidade, não pesquisa sobre divisão ideal do mercado. Rever após duas semanas de trabalho.

### Pesquisa com pessoas

Propor duas rodadas de 12–20 pessoas: jogadores habituais de FPS e pessoas atraídas pelo visual/lives. Separar conhecidos próximos de convidados sem vínculo. Esses tamanhos servem para descobrir fricções qualitativas; não bastam para afirmar retenção estatisticamente estável. Reservar sessões de grupo para observar convite e revanche.

Observar entrada, primeira morte, primeira troca de arma, uso de slide/Chinelada, convite, fim e retorno. Perguntar depois: “O que você mais gostou?”, “O que pareceu injusto?”, “O que contaria para um amigo?” e “O que faria você abrir de novo?”. Registrar também quem sai e por quê, sem converter silêncio em aprovação.

### Medidas e metas experimentais

Todas as metas abaixo são propostas iniciais; não são benchmarks de mercado nem resultados atuais.

| Medida | Definição | Meta inicial proposta |
|---|---|---|
| Entrada | Clique no link até assumir controle, distinguindo primeiro carregamento e cache | Mediana ≤ 15 s no perfil de máquina/conexão escolhido; medir também o pior décimo |
| Primeiro contato | Tempo até um confronto e um acerto confirmado, sem dica do autor | Investigar sessões sem acerto nos primeiros 90 s; não forçar vitória |
| Aprendizagem | Convidado demonstra ação após introdução | Pelo menos 8 de 10 acertam, trocam arma e usam Chinelada sem explicação oral |
| Revanche | Humanos iniciam outra partida / humanos que chegaram ao fim | Procurar ≥ 50% na rodada inicial, exibindo numerador e denominador |
| Retorno | Pessoas da coorte que voltam a jogar no dia 1 e no dia 7 | Estabelecer baseline; ampliar amostra antes de definir corte |
| Convite | Convidado chega à mesma sala / convites tentados | ≥ 90% em teste acompanhado; registrar falhas e motivo |
| Assinatura | Jogador menciona espontaneamente uma ação própria do jogo | ≥ 7 de 10 lembram uma ação, personagem ou lugar específico |
| Desempenho | Tempo de quadro em máquinas nomeadas, conexão real e grupo | Buscar 60 fps no notebook-alvo; registrar quedas e qualidade usada |
| Hack | Jogador percebe execução e resposta possível | ≥ 8 de 10 descrevem como responder após experimentá-lo |

Eventos candidatos para uma tarefa futura de instrumentação: abertura, início de carregamento, controle disponível, modo, entrada/falha de sala, primeiro disparo/acerto, abate/morte, convite, fim, revanche e saída. Evitar usar a palavra `rank` do placar como prova de ranqueado. Retorno exige identificação consistente e escolha de armazenamento; não prometer D1/D7 com contagem de abas ou bots.

O registro deve distinguir humanos/bots, fonte de aquisição, máquina, primeira visita/retorno e duração da sessão. Replays de eventos e vídeo são entregas diferentes: um replay precisa guardar estado, tempos e versão; exportar clipe precisa verificar memória, taxa de quadros e compatibilidade. Começar por capturar os lances manualmente nas sessões já pode validar se há algo compartilhável.

## Divulgação que ajuda a avaliar o produto

Proposta para um mês: três tipos de material com tempo semelhante de produção e links identificados por origem. Chinelada/slide, personagem/conflito e bastidor com IA. Mostrar gameplay real e oferecer apenas funcionalidades disponíveis. Comparar visitas que viram sessão e sessões que viram revanche; usar visualizações como descoberta, sem somá-las a jogadores.

O conteúdo de mercado pode ser algo como “Desci o Pelourinho de chinelo e acertei o rival”, com a jogada em primeiro plano. A live pode mostrar por que o braço estava desalinhado, como o bot foi corrigido ou como o som passou a ajudar. O primeiro atrai pela experiência; o segundo constrói confiança e audiência no processo.

Testar X junto de comunidades brasileiras de FPS/anime e formatos curtos em outros canais. Evitar inferir que Instagram, TikTok ou X são melhores para este jogo sem medir. Uma versão em inglês da comunicação e interface pode ampliar alcance; para submissão em CrazyGames, inglês é requisito atual citado acima. Isso não exige apagar a identidade brasileira.

Se houver uma versão Steam no futuro, UTM Analytics permite examinar tráfego e ações, com limitações de atribuição descritas pela Valve. Para o browser atual, seria necessário implementar a medição própria. [Steamworks UTM](https://partner.steamgames.com/doc/marketing/utm_analytics).

Sustentação financeira e monetização ficam para uma decisão posterior: primeiro estimar custo real por sala/hora, observar quanto tempo grupos ficam e confirmar retorno. Loja, contas e ranqueado continuam fora do escopo aprovado. Não há projeção de receita neste documento.

## Decisões que recomendo ao dono

1. Adotar como prioridade a experiência de Arena com amigos, mantendo Treino e o escopo atual do menu.
2. Concentrar o próximo passe de conteúdo em Pelourinho, Lia/Caio/Ivo e OTIMIZA, com limites claros de produção.
3. Aprovar conceitualmente um experimento de hack antes de decidir kits individuais ou reabrir modos.
4. Julgar expansão pelos testes e pela vontade de repetir: segundo mapa para variedade pedida; equipes para estratégia pedida; PvE para cooperação pedida.
5. Manter o prazer do tiro e a facilidade de acesso como critérios de corte para cada ideia.

Nenhuma publicação, API paga, push, merge ou mudança de regra foi executada por esta pesquisa. Ela entrega uma direção revisável; não substitui a avaliação do dono jogando.

## Índice de fontes externas

Consultadas nesta sessão em 03/10/2026; datas entre parênteses são do conteúdo quando verificadas. Os links citados no corpo sustentam as respectivas alegações. A lista facilita revisitar fontes; números dinâmicos devem ser consultados novamente antes de reutilizar.

1. [Newzoo PC and Console Report 2026](https://newzoo.com/reports/pc-console-gaming-report-2026) — panorama, 12/03/2026.
2. [Newzoo rankings de julho de 2026](https://newzoo.com/articles/july-2026-pc-console-rankings) — atenção, publicado em 02/09/2026.
3. [GDC State of the Industry 2026](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/) — profissionais e IA.
4. [Krunker guia oficial](https://krunker.io/guides/) — funcionalidades.
5. [Shell Shockers relato de King of the Coop](https://bluewizard.com/shell-shockers-king-of-the-coop-eggsclusive/) — desenvolvimento do modo, 08/12/2021.
6. [Shell Shockers atualização de equilíbrio](https://bluewizard.com/were-so-back/) — papéis das armas, 15/01/2025.
7. [CS2 Steam](https://store.steampowered.com/app/730/CounterStrike_2/?l=english) — oferta e recursos.
8. [Valorant site oficial](https://playvalorant.com/en-us/) — loop e agentes.
9. [Valorant agentes](https://playvalorant.com/en-us/agents/brimstone/) — exemplo de habilidade com dano; evita generalização sobre toda utilidade.
10. [Strinova Steam](https://store.steampowered.com/app/1282270/Strinova/?l=english) — transformação e experiência.
11. [The Finals Steam](https://store.steampowered.com/app/2073850/THE_FINALS/?l=english) — ambiente e ferramentas.
12. [FragPunk Steam](https://store.steampowered.com/app/2943650/FragPunk/) — cartas e combate.
13. [Splitgate relançamento](https://www.splitgate.com/de/news/introducing-splitgate-arena-reloaded/) — decisão de foco, 04/12/2025.
14. [Splitgate FAQ](https://support.splitgate.com/hc/en-us/articles/32048091883031-SPLITGATE-Arena-Reloaded-FAQ) — oferta após relançamento.
15. [Balatro timeline de LocalThunk](https://localthunk.com/blog/balatro-timeline-3aarh) — trajetória em primeira pessoa.
16. [Lethal Company Steam](https://store.steampowered.com/app/1966720/Lethal_Company/?l=english) — loop e declaração do autor.
17. [Road to Vostok](https://roadtovostok.com/) — escopo e trabalho solo.
18. [Road to Vostok roadmap](https://www.roadtovostok.com/roadmap) — demos e desenvolvimento.
19. [Tangy TD Steam](https://store.steampowered.com/app/2245620/Tangy_TD/?l=english) — produto de Cakez, lançamento em 09/03/2026.
20. [PEAK Landfall](https://landfall.se/peak) — colaboração e ajuda entre amigos.
21. [PEAK Steam](https://store.steampowered.com/app/3527290/PEAK/?l=english) — recursos e recepção observável.
22. [Schedule I Steam](https://store.steampowered.com/app/3164500/Schedule_I/?l=english) — demo e loop.
23. [Everfront postmortem](https://everfrontgame.com/blog/launch-postmortem) — aquisição declarada pelo autor; estreia da página, não vendas do jogo.
24. [Incremental postmortem](https://www.reddit.com/r/SoloDevelopment/comments/1sy7911/postmortem_i_tracked_every_marketing_action/) — relato de sete meses.
25. [The Finals novato em setembro](https://www.reddit.com/r/thefinals/comments/1w516gw/why_is_a_new_player_being_put_against_seasoned/) — percepção, 02/09/2026.
26. [The Finals convidar novatos](https://www.reddit.com/r/thefinals/comments/1q3iehr/its_hard_to_keep_new_players_actually_playing/) — percepção, 04/01/2026.
27. [Vibe Jam 2026 no site do organizador](https://levels.io/vibe-jam-2026-winners-quality) — republicação do X, 17/06/2026.
28. [Vibe Jam 2025 no site do organizador](https://levels.io/winners-of-the-2025-vibe-code-game-jam) — republicação do X, 23/04/2025.
29. [Avião de Pieter Levels](https://levels.io/fly-pieter-com-vibecoded-flight-simulator) — relato autoral e métricas declaradas.
30. [Road to Vostok post no X](https://x.com/roadtovostok/status/2040824853347860760) — texto indexado, 05/04/2026.
31. [Splitgate perfil no X](https://x.com/Splitgate/with_replies) — posicionamento indexado.
32. [Iron Meat perfil no X](https://x.com/IvanMeat) — exemplos indexados de divulgação.
33. [Steamworks wishlists](https://partner.steamgames.com/doc/marketing/wishlist) — limites de previsão.
34. [Steamworks UTM](https://partner.steamgames.com/doc/marketing/utm_analytics) — atribuição.
35. [CrazyGames qualidade](https://docs.crazygames.com/requirements/quality/) — entrada e experiência.
36. [CrazyGames gameplay](https://docs.crazygames.com/requirements/gameplay/) — localização e apresentação.
37. [CrazyGames requisitos técnicos](https://docs.crazygames.com/requirements/technical/) — carregamento.
