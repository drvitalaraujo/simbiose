# Benchmark de concorrentes: armas, jogabilidade e diferenciais

- **Data:** 2026-10-02 · **Autor:** agente analista (Claude) · **Para:** Vital (decide), coordenador (integra)
- **Complementa** a seção 1 de `docs/plans/2026-10-02-pivo-competitivo.md` (não repete o que já está lá).
- **Como ler:** "TTK" (*time to kill*) é o tempo entre o 1º tiro que acerta e a morte do alvo.
  Fórmula usada aqui: `TTK = (tiros necessários − 1) × intervalo entre tiros`. "~" indica estimativa.
- **Nosso ponto de partida (código de hoje):** 100 de vida, recuperação de 25/s depois de 4 s sem dano
  (`src/sim/player.ts`); a Gambiarra MK-2 dispara 9 tiros/s (540 por minuto, `src/sim/weapon.ts`,
  ritmo aprovado pelo dono); multiplicador **global** cabeça ×4, pernas ×0,75
  (`src/game/characters/hitbox.ts`); andar 7 m/s, correr 11 m/s, pulo 9 m/s com gravidade 26 (pulo
  sobe ~1,56 m); degrau automático de 0,45 m.

---

## 0. Os 3 maiores aprendizados (resumo para o dono)

1. **Cabeça ×4 só funciona em arma lenta.** CS2 e Valorant usam ~×4 em fuzis de cadência controlada
   (AK: 36 de dano → 144 na cabeça; Vandal: 40 → 160), e quem dá ×4 tem vida alta ou colete. Jogos de
   ritmo rápido usam ×1,5 a ×2 (Krunker ×1,5; Overwatch ×2; Deadlock ×1,65, depois de cortar de ×1,8).
   Com 100 de vida e ×4 global, **uma submetralhadora de 540 tiros/min mata com 1 ou 2 tiros na cabeça**,
   e as outras armas deixam de ter motivo de existir. Recomendação: **multiplicador por arma**; o ×4 fica
   como a marca do fuzil "one-tap".
2. **Identidade vence volume, e monetizar cedo mata.** O Splitgate 2 caiu 84% em menos de um mês (pacote de
   skin de US$ 80 no lançamento, facções genéricas) e relançou *sem* habilidades. O FragPunk teve pico de
   113.946 jogadores com 169 cartas de regra e caiu para ~1.700. O ARC Raiders e o Deadlock crescem com
   **uma** ideia forte e bem lida (chat de proximidade e mobilidade, respectivamente). Para nós: poucas
   armas, cada uma com uma piada/mecânica própria, e zero loja até haver público.
3. **Clipe nasce de três coisas:** (a) uma morte "impossível" de habilidade (one-tap, flick, movimento),
   (b) humor humano (o ARC Raiders viralizou pelo chat de proximidade, o Shell Shockers por ser ovo) e
   (c) caos sistêmico (destruição no The Finals, foguete no Splitgate). O SIMBIOSE tem os três ao alcance:
   one-tap do fuzil, **chinelada** e o **rojão**, mais o roubo de drones hackeados.

---

## 1. Tabela comparativa

| Jogo (ano) | Armas e assinatura | TTK e cabeça | Movimento | Habilidades | Economia | Partida | Monetização |
|---|---|---|---|---|---|---|---|
| **CS2** | ~34 armas de fogo em 5 grupos; **AK-47** (one-tap na cabeça mesmo de capacete até ~69 m) | 100 HP + colete; AK 36 → 144 cabeça (×4), 600/min | Lento e preciso; *counter-strafe*; sem slide | Só granadas | Por rodada (dinheiro) | MR12, ~35–45 min | Caixas e mercado de skins |
| **Valorant** | 18–21 armas em 6 grupos; **Vandal** (160 na cabeça a qualquer distância) | 100 HP + até 50 de colete; Vandal 40/160 | Andar/correr, sem slide; mobilidade vem de agentes | 4 por agente | Por rodada (créditos) | 13 vitórias, ~35–45 min; Swiftplay ~15 | Pacotes de skin e passe |
| **Overwatch** (relançado 02/2026) | 1 arma por herói (~45 heróis) | ~225–250 HP (dano); cabeça ×2 padrão | Por herói (jetpack, gancho, escalar parede) | Centro do jogo; *perks* no meio da partida | Nenhuma (Stadium compra entre rodadas) | ~10–20 min | Skins e passe |
| **Apex Legends** | ~30 armas no chão (loot); varia por temporada | 100 HP + escudo até 100–125; S24 deu buff em **todas** as armas e tirou os capacetes | Slide, slide-pulo, *tap-strafe*, escalar | 3 por lenda | Loot na partida | ~20 min (BR) | Passe e "gacha" de relíquias |
| **The Finals** | ~40 armas presas à classe (Leve/Média/Pesada) | Vida 150/250/350; M11 mata Leve em 0,54 s | Slide, escalar, gancho, destruição como rota | Gadgets por classe | Nenhuma; dinheiro do objetivo | ~10–15 min | Skins e passe |
| **Deadlock** (recorde 09/2026) | 1 arma por herói + itens | Cabeça ×1,65 (era ×1,8 até 11/2025) | Slide, *dash*, *dash-jump*, pulo na parede, tirolesa | 4 por herói | Ouro/itens por partida (MOBA) | ~30–45 min | Ainda nenhuma (acesso antecipado) |
| **Marvel Rivals** | 1 arma por herói (40+) | Cabeça ~×2 em *hitscan*; perda de dano com distância | Por herói (voo, balanço) | Centro do jogo; *team-ups* | Nenhuma | ~10–15 min | Skins; passe que não expira |
| **Strinova** | Arma fixa por agente + secundária | 130 HP + colete; cabeça ×1,5–×1,75 | Vira "papel" (2D): grudar na parede, planar | 2–3 por agente | Por rodada (modo bomba) | ~30 min (bomba) | Gacha de cosméticos |
| **Splitgate: Arena Reloaded** | Arsenal fixo + **Railgun** como arma de poder no mapa | Arena clássica, TTK médio | **Portais**, *jetpack* leve | Removidas no relançamento (12/2025) | Nenhuma | ~10 min | Cosméticos ganhos jogando |
| **Krunker.io** | 1 arma por classe (~11 classes) | 100 HP; SMG 18 corpo/27 cabeça (×1,5) | **Slide-hop**, pulo na parede (algumas classes), pulo com coice | Nenhuma | Nenhuma | ~4 min | Moeda KR, roletas, mercado |
| **Shell Shockers** | 7 armas = 7 "classes" de ovo; **Crackshot** (sniper de 1 tiro) | Ovo racha; Crackshot até 180 no centro | Simples, pulo | Nenhuma | Nenhuma | Contínua | Cosméticos (moeda "Eggs") e anúncios |
| **Fortnite Reload/Zero Build** | Pool rotativo de armas clássicas "desengavetadas" | 100 HP + 100 escudo; cabeça ×1,5–×2 por arma | Slide, escalar (*mantle*), correr | Itens | Loot | ~15 min, 40 jogadores, renasce enquanto o time vive | V-Bucks, skins |
| **ARC Raiders** (surpresa) | Loot de extração | TTK médio-alto (PvPvE) | Escalar, rolar | Gadgets | Extração (perde o que leva) | ~30 min | Jogo pago + cosméticos |
| **FragPunk** (surpresa, lição) | 19 armas + 2 corpo a corpo | Estilo Valorant | Padrão | Por *lancer* + **169 cartas de regra** | Por rodada | ~30 min | F2P; relançamento em 2026 |

---

## 2. Fichas por jogo

> Cada ficha: arsenal, TTK, movimento, habilidades, economia, ritmo, onboarding, clipes,
> monetização e **ideia roubável** (o que cabe no SIMBIOSE).

### CS2
- **Arsenal:** ~34 armas (pistolas, SMGs, fuzis, pesadas, snipers) + faca e Zeus. Assinatura: **AK-47**,
  porque é a mais barata que mata com 1 tiro na cabeça a qualquer distância (36 × 4 = 144; ainda 111 com
  capacete), 600 tiros/min, pente de 30.
- **Movimento:** lento e preciso; parar o personagem (*counter-strafe*) é o que deixa o tiro preciso.
- **Economia:** dinheiro por rodada; preço também é balanceamento (em 01/2025 o M4A4 caiu para US$ 2.900,
  igual ao M4A1-S, e a FAMAS foi para US$ 1.950).
- **Onboarding:** fraco; aprende-se no mata-mata e em mapas da comunidade. **Clipes:** ace, clutch 1v5,
  flick de AWP. **Monetização:** caixas e mercado de skins (a atualização de 10/2025 que permitiu trocar
  facas derrubou o preço de várias pela metade em horas).
- **Ideia roubável:** **precisão do 1º tiro ao parar.** Tiro perfeito só parado vira habilidade aprendível
  sem precisar de habilidade especial. Entra no nosso fuzil ("Pose para a foto", seção 3).

### Valorant
- **Arsenal:** 18–21 armas (conta varia por fonte em 2026), 6 grupos. Assinatura: **Vandal** (40 corpo /
  160 cabeça / 34 pernas; one-tap a qualquer distância). A Phantom é mais rápida, mas só faz one-tap até 20 m.
- **Economia:** 800 créditos no início do tempo; vitória 3.000; derrota 1.900 → 2.400 → 2.900; 200 por
  abate; teto de 9.000.
- **Habilidades:** 4 por agente; habilidade prepara, arma mata.
- **Onboarding:** ranqueado só a partir do nível 20; modo Swiftplay (~15 min) para iniciante.
- **Clipes:** Operator, aces, combos de habilidade. **Monetização:** pacotes de skin caros, passe.
- **Ideia roubável:** **par de fuzis com escolha clara:** um fuzil "one-tap sempre" e outro mais rápido
  e mais fácil. Entre nós: SR-5 Estrelas (precisão) × Gambiarra MK-2 (perdão).

### Overwatch (sem o "2" desde 10/02/2026)
- **Arsenal:** 1 arma por herói; cabeça ×2 padrão (Kiriko ×3). Relançamento com 5 heróis novos e pico de
  165.651 jogadores na Steam.
- **Habilidades:** centro do jogo; desde 2025, **perks** (escolher 1 de 2 melhorias no meio da partida) e o
  modo **Stadium** (melhor de 7, compra de poderes entre rodadas). Profissionais reclamaram que
  habilidade passou a pesar mais que mira.
- **Onboarding:** treinos contra bots e filas sem ranque. **Clipes:** *ultimates* combinados, "play of the game".
- **Ideia roubável:** **"Play of the Game".** No fim da partida, o servidor escolhe a melhor sequência e
  passa como replay. Para nós: o "**Momento Otimizado**" narrado pela OTIMIZA (diferencial nº 5).

### Apex Legends
- **Arsenal:** ~30 armas de loot; a temporada 24 (02/2025) deu buff em **todas**, reformulou o dano na
  cabeça e tirou os capacetes, para baixar o TTK e evitar o "terceiro time" chegando no fim da briga.
- **Movimento:** slide, slide-pulo, ricochete na parede e *tap-strafe*. Em 2025 a Respawn limitou o
  tap-strafe e **reverteu** dias depois por causa da revolta: "há expressão de habilidade legítima que
  queremos preservar".
- **Clipes:** movimento + limpar esquadrão. **Monetização:** passe + gacha de relíquias.
- **Ideia roubável:** **slide com pulo que mantém a velocidade.** É a técnica mais simples que dá teto de
  habilidade sem precisar de parkour (adaptado para ladeira na seção 4).

### The Finals
- **Arsenal:** ~40 armas presas à classe; vida 150/250/350. TTK de referência (patch 11.11, 26/09/2026):
  M11 mata Leve em 0,54 s e Média em 0,90 s; FCAR mata Média em 1,13 s.
- **Diferencial:** destruição (C4 tira 155 do inimigo e mais de 2.000 do cenário). No modo Cashout, a
  equipe rouba o cofre da outra e perde 15% do dinheiro se for eliminada inteira.
- **Ritmo:** depois do lançamento, caiu muito (está na seção 1 do pivô); a temporada 8 (09/2025) chegou
  a 28.320 simultâneos. **Monetização:** skins e passe.
- **Ideia roubável:** **objetivo roubável no meio do caminho** (o cofre). É o "Hackeia e Segura": o drone
  hackeado é o cofre, e roubar o do rival é o clímax.

### Deadlock (Valve) — também uma "surpresa em alta"
- **Estado:** em 29/09/2026 a atualização *City Never Sleeps* (6 heróis, mapa refeito) levou o jogo ao
  recorde de **228.086** simultâneos (em 2025 ele nunca passou de 70 mil).
- **Arsenal:** 1 arma por herói + itens; cabeça ×1,65 (cortada de ×1,8 em 11/2025).
- **Movimento:** slide, *dash*, *dash-jump* (+30% de controle no ar por 0,25 s), pulo na parede sem
  custo de estamina (12/2025), **tirolesas e ventiladores** que lançam o jogador.
- **Ideia roubável:** **tirolesa e jato de ar como mobilidade do mapa, não do personagem.** Funciona com
  colisão AABB (trajetória fixa), é fácil de validar no servidor e combina com fiação e bueiro do Pelourinho.

### Marvel Rivals
- **Arsenal:** 40+ heróis; *hitscan* com cabeça ~×2 e perda de dano com a distância.
- **Balanceamento:** Hela (*hitscan* de longe + mobilidade aérea) ficou entre os mais banidos por várias
  temporadas; levou corte de vida (275 → 250) e, em 19/02/2026, perda de dano maior a 30 m (80% → 70%).
- **Público:** pico de 664.815 em 01/2025; ~80% de queda até meados de 2025.
- **Ideia roubável:** **team-up**: dois personagens juntos ganham um bônus. Para nós: dois jogadores da
  Resistência perto de um drone hackeado o hackeiam mais rápido (incentiva jogar junto, pilar 4).

### Strinova
- **Arsenal:** arma fixa por agente + secundária e granadas trocáveis. Vida 130 (subiu de 100 para
  alongar o TTK) + colete; cabeça ×1,5–×1,75 conforme a arma (cortes para ×1,5 e até ×1,0).
- **Diferencial:** virar "papel" (2D): hitbox muito menor e menos dano, mas sem atirar.
- **Público:** Steam com média de ~1.500–2.000 jogadores em 2026 (forte na China). "Sobrevive", mas pequeno.
- **Monetização:** gacha de cosméticos e "dormitório" com afinidade. Fica de alerta: anime + gacha afasta
  parte do público ocidental.
- **Ideia roubável:** **troca de estado com custo claro** (menor hitbox ⇄ não atira). É o nosso slide:
  abaixa a hitbox, mas piora a mira do fuzil e do sniper.

### Splitgate 2 → Splitgate: Arena Reloaded
- **História:** lançou em 06/06/2025 (pico de 25.785), perdeu 84% em menos de um mês, voltou para beta e
  relançou em 17/12/2025 **sem facções e sem habilidades**, com mais portais e uma arma de poder (Railgun).
  O relançamento ficou em ~1.000 simultâneos.
- **Ideia roubável:** **arma de poder que nasce no mapa.** Um ponto disputado onde aparece uma arma
  absurda a cada X segundos organiza a partida sem economia. Para nós: o **Rojão** no largo da igreja.

### Krunker.io
- **Arsenal:** ~11 classes, cada uma com sua arma. SMG: 18 corpo / 27 cabeça / 9 membros (×1,5), ~650
  tiros/min, pente 30, recarga 1 s. 100 HP.
- **Movimento:** **slide-hop** (abaixar ao tocar o chão mantém e soma velocidade), pulo na parede em algumas
  classes, pulo com o coice da escopeta e do foguete.
- **Onboarding:** em segundos, sem cadastro. **Monetização:** moeda KR, roletas, mercado.
- **Ideia roubável:** **classe = arma, escolhida em 1 clique antes de renascer.** Dispensa economia nos modos
  rápidos. (Não roubar o slide-hop *ilimitado*: afasta quem chega pela live.)

### Shell Shockers
- **Arsenal:** 7 armas = 7 classes de ovo; Crackshot causa até 180 no centro (1 tiro) e ~60 na borda.
  200 milhões de jogadores até o fim de 2025.
- **Clipes/tom:** absurdo e nome trocadilho (EggK-47, Scrambler). **Monetização:** cosméticos com moeda
  "Eggs", sem vantagem paga, e anúncios.
- **Ideia roubável:** **nome de arma que é piada local.** Arma brasileira com nome brasileiro vira meme
  sozinha (Pipoqueira, Trinta-e-Oitão, Chinelo).

### Fortnite Reload / Zero Build
- **Formato:** 40 jogadores, mapa pequeno, renasce enquanto o time tiver alguém vivo; cabeça ×1,5–×2
  conforme a arma. A Epic "desengaveta" armas clássicas a cada atualização (06/2025, 08/2025, 09/2025).
- **Ideia roubável:** **rodízio de arsenal.** Com 7 armas, uma "arma da temporada" entra e sai sem custo
  de código novo e mantém o modo fresco.

### ARC Raiders (surpresa 2025–2026)
- **Números:** 12,4 milhões de cópias desde 10/2025; ~960 mil simultâneos no começo de 2026.
- **Clipes:** o **chat de voz por proximidade** (negociar, enganar, implorar) gera vídeos no TikTok sem
  esforço do estúdio.
- **Ideia roubável (segura):** **"roda de frases" para o inimigo ouvir de perto**, sem voz aberta (evita
  moderação): "Paz?", "Foi mal!", "Chinelada não vale!". Frases pré-gravadas, engraçadas e em pt-BR.

### FragPunk (surpresa como lição)
- **Números:** pico de 113.946 em 03/2025; ~12 mil em abril; média de ~1.700 depois. Reestruturado para
  um relançamento em 2026.
- **Mecânica:** 169 cartas que mudam as regras da rodada (ex.: casco que bloqueia tiro pelas costas, neve
  que faz todos escorregarem).
- **Ideia roubável (com freio):** **regra votada pelo chat**, mas com 6–8 cartas curadas, não 169.

---

## 3. Arsenal recomendado para o SIMBIOSE (lançamento)

### Regras de base
- **Vida 100**, sem colete nos modos rápidos (FFA, Duelo, TDM). Mantém a recuperação atual.
- **Multiplicador de cabeça por arma** (substitui o ×4 global de `hitbox.ts`); pernas ×0,75 para todas.
- **Faixa de TTK alvo** (corpo, alcance ideal): **0,45–0,55 s** para automáticas. É mais lento que o CS2
  (dá tempo de reagir, bom para quem chega pela live) e bem mais rápido que Overwatch/The Finals (atirar é
  gostoso, pilar 1). A cabeça corta o TTK pela metade ou mata na hora: é o teto de habilidade.
- **Loadout sem economia** nos modos rápidos: escolhe 1 primária antes de renascer (estilo Krunker) +
  Trinta-e-Oitão + Chinelo + ferramenta Gato. A economia por rodada fica para o modo bomba 5v5.

### As armas

| # | Arma (facção) | Papel | Corpo / cabeça (×) / pernas | Cadência | TTK corpo · cabeça | Alcance ideal | Mecânica com a nossa cara |
|---|---|---|---|---|---|---|---|
| 1 | **Gambiarra MK-2** (Resistência) — SMG | Curta-média, em movimento, perdoa erro | 20 / 40 (×2) / 15 | 9/s (540/min, já aprovada) | 0,44 s · 0,22 s | 0–18 m (cai para 14 em 30 m) | **"Tapa na gambiarra":** em vez de recarga lenta, ela superaquece; apertar R na hora certa (faixa amarela na barra) esfria na hora com um tapa e o som "PÁ!". Errou: 1,6 s de fumaça. Skill + humor. |
| 2 | **SR-5 Estrelas** (Sorridentes, "arma oficial") — fuzil | Média-longa, precisão; a "Vandal" | 25 / 100 (×4) / 19 | 6,5/s (390/min) | 0,46 s · **one-tap** | 0–60 m, sem perda | **"Pose para a foto":** o 1º tiro depois de 0,35 s parado tem espalhamento zero e faz "clique!" de câmera. Correndo, espalha ×4. Abate toca risada enlatada e mostra "Avalie: ⭐⭐⭐⭐⭐". |
| 3 | **Pipoqueira** (Resistência) — escopeta | Curtíssima, emboscada em beco e escada | 10 bagos × 11 / ×1,5 por bago / ×0,75 | 1 tiro/s | 1 tiro ≤ 6 m (≥ 9 bagos) · 1 tiro | 0–7 m (cai para 3/bago em 20 m) | **"Coice-pulo":** atirar no chão em pleno ar empurra você 5 m/s para cima (1× por pulo). Abre rotas por sacadas. Os bagos estouram como pipoca ("PIPOCA!"). |
| 4 | **Olho da OTIMIZA** (lente de vigilância hackeada) — sniper | Longa, controle de corredor | 110 / 220 (×2) / 80 | 1 tiro a cada 1,5 s; carga de 0,6 s | 1 tiro (tórax/cabeça) | 40 m+ | **Carga com laser visível:** segurar carrega e mostra o laser (na cor do time) para todos; soltar antes da carga tira só 50%. É o contra-jogo embutido. Ao matar, a vítima ouve "Você foi selecionado para uma pesquisa de satisfação". |
| 5 | **Trinta-e-Oitão** (todos) — revólver secundário | Plano B; one-tap de perto | 40 / 100 (×2,5) / 30 | 2,5/s; tambor de 6 | 0,8 s · one-tap até 20 m | 0–20 m (cai para 30/75) | **"Leque":** o botão direito descarrega o que sobrou no tambor a 8/s, com muito espalhamento. Pânico de perto, clipe de faroeste. |
| 6 | **Chinelo** (todos) — corpo a corpo | Finalização, humor, *flank* | Golpe 50 frente / **100 costas**; arremesso 60 corpo / 100 cabeça | Golpe a cada 0,5 s; 1 arremesso por vida | 0,5 s (2 golpes) · na hora pelas costas ou na cabeça (arremesso) | 2 m (golpe); arremesso em arco a 30 m/s | **"Chinelada":** arremesso único que precisa ser recolhido no chão. Abate mostra o ícone de chinelo, "PLAFT!" e a OTIMIZA: "Disciplina materna detectada". Meme garantido na live. |
| 7 | **Rojão** (arma de poder, nasce no mapa) | Área, verticalidade, virada de jogo | Impacto direto 100; explosão 70 → 15 em 4 m; dano próprio 30 | 1 tiro/s; 4 tiros por coleta | Direto: na hora; explosão: 2 tiros | 5–40 m (projétil a 35 m/s) | **Fogos de festa:** a explosão solta cores da paleta e "PÁ-PÁ-PUM!". Permite *rocket jump*. Nasce a cada 60 s no largo da igreja, com aviso no HUD. |
| — | **Gato** (todos) — ferramenta de hack, não é arma | Modo "Hackeia e Segura" e treino | 0 de dano | Segurar 1,2 s (drone livre) / 2,0 s (drone do rival) | — | ≤ 12 m | "Gato" é a ligação clandestina de luz. O fio puxado até o drone é visível, então quem hackeia fica exposto (risco ⇄ recompensa). |

### Como cada uma cobre um papel sem sobrepor

| Distância → | 0–7 m | 7–20 m | 20–40 m | 40 m+ | Exige mira? |
|---|---|---|---|---|---|
| Gambiarra MK-2 | forte | **melhor** | fraca (dano cai) | inútil | baixa (perdoa) |
| SR-5 Estrelas | fraca correndo | boa | **melhor** | boa | alta (parado + cabeça) |
| Pipoqueira | **melhor** | inútil | — | — | média (chegar perto) |
| Olho da OTIMIZA | péssima (carga) | ok | boa | **melhor** | muito alta |
| Trinta-e-Oitão | boa (leque) | boa (cabeça) | fraca | — | alta |
| Chinelo | finalização/costas | arremesso | — | — | média |
| Rojão | perigosa (dano próprio) | **área** | boa | — | baixa (área) |

- **Gambiarra × SR-5 no corpo a corpo:** quase o mesmo TTK de corpo (0,44 × 0,46 s), mas a Gambiarra
  acerta correndo e o fuzil não; a 30 m, o fuzil mata em 0,46 s e a Gambiarra em ~0,78 s. É assim que a
  SMG não vira a "arma de tudo" (o erro do Battlefield 6, seção 6).
- O *teto* é a cabeça: one-tap só no fuzil (qualquer distância), no revólver (até 20 m) e no sniper.

---

## 4. Movimento recomendado

**Restrições:** colisão só AABB (sem rampas reais), degraus de até 0,4 m e servidor autoritativo (todo
movimento vive em `src/sim/` e precisa ser determinístico para a predição; `PlayerCommand` já tem `crouch`).

| Técnica | Decisão | Por quê |
|---|---|---|
| **Slide** | **Adotar (v1)** | Padrão do gênero (Apex, Deadlock, Fortnite, The Finals). Simples de validar: é só velocidade + hitbox agachada (já existe). |
| **Deslizar na ladeira** | **Adotar (v1)** — assinatura do Pelourinho | Ladeira é feita de degraus de ≤ 0,4 m. Deslizando, cada degrau descido soma velocidade. Nenhum outro jogo tem "ladeira de Salvador" como mecânica. |
| **Pulo saindo do slide** | Adotar, com teto | Mantém a velocidade (Apex/Deadlock), mas não acumula (evita o slide-hop infinito do Krunker). |
| **Escalar sacada (mantle)** | **Adotar (v1)** | Cabe em AABB: só verifica o topo da caixa à frente. Dá verticalidade aos casarões. |
| **Bueiro de vapor (jump pad)** e **tirolesa na fiação** | Adotar na v2 | Mobilidade do mapa (Deadlock). Trajetória fixa e fácil de validar no servidor. |
| Pulo duplo | Não (talvez em evento) | Deixa a hitbox imprevisível no ar e esvazia o valor das sacadas. |
| Corrida na parede | Não | Exige câmera e colisão de parede finas, quebra a leitura de linhas de tiro e custa caro em rede. |
| Bhop / strafe-jump | Não somar velocidade no ar | Afasta novatos; o controle aéreo atual (aceleração 18) já limita. |
| Dash | Só como hack de facção | Mobilidade instantânea é forte demais como item base. |

**Números iniciais (para `src/sim/player.ts`):**
- **Slide:** abaixar correndo a ≥ 9 m/s no chão → impulso para 13 m/s; desacelera 8 m/s²; termina abaixo
  de 6 m/s ou depois de 1,0 s; recarga de 0,8 s. Hitbox agachada durante o slide.
- **Ladeira:** durante o slide, cada queda de 0,1–0,45 m (degrau descido) soma +1 m/s (teto de 15 m/s) e
  zera a desaceleração por 0,15 s. Subindo, o slide acaba. A descida do largo vira uma "pista".
- **Pulo do slide:** mantém a velocidade horizontal até 13 m/s. Um slide começado até 0,2 s depois de
  aterrissar não ganha impulso (sem slide-hop infinito).
- **Mantle:** no ar, andando para a frente contra uma caixa cujo topo esteja entre 0,45 m e 1,3 m acima dos
  pés, com 1,8 m livres em cima → sobe em 0,35 s, sem atirar. Com o pulo atual (sobe ~1,56 m), alcança
  bordas até **~2,8 m**. **Regra para o mapa:** sacada escalável a 2,6–2,8 m; acima de 3,2 m, não.
- **Mira e movimento:** Gambiarra e Pipoqueira sem penalidade correndo; SR-5 ×4 de espalhamento correndo e
  ×2 no slide; sniper sem carga durante o slide.

---

## 5. Hacks por facção (2–4 exemplos equilibráveis)

**Regra de ouro:** hack **prepara**, arma **mata** (lição de Valorant e das críticas aos *perks* do
Overwatch). Nenhum hack causa dano direto. Uma carga só, recarga de 30–45 s. Nos modos FFA/Duelo, hacks
desligados por padrão (o tiro brilha sozinho).

| Facção | Hack | Efeito | Contra-jogo | Números |
|---|---|---|---|---|
| **Resistência** | **Drone Pirata** | Lança um mini-drone hackeado que marca inimigos num raio de 10 m por 3 s (silhueta rosa para o time). | O drone tem 20 de vida e faz barulho; dá para derrubar. | Recarga 40 s; voa 2 s até o ponto |
| **Sorridentes** | **Sorria!** | Holograma de sorriso gigante: quem olha fica com a tela rosa a 60% por 1,2 s (meio-cegueira, não total). | Virar o rosto anula; o aviso ("Sorria! ✨") toca 0,4 s antes. | Recarga 35 s; alcance 15 m |
| **Enxame** | **Nuvem de Bolso** | Enxame de micro-drones que bloqueia a visão (fumaça) num raio de 4 m por 6 s. | O **Gato** dispersa a nuvem em 1 s (hack contra hack). | Recarga 45 s |
| **Premium** | **Escudo Assinatura** | Parede dourada de 2 m de largura, 250 de vida, por 8 s. | Rojão quebra em 2 tiros; dá para contornar. | Recarga 40 s |

Teste de equilíbrio: com o robô de teste, nenhum hack pode mudar a taxa de vitória de um duelo 1v1 de
mira igual em mais de ~10 pontos percentuais.

---

## 6. Top 10 diferenciais (ordem de impacto ÷ custo)

| # | Diferencial | Impacto | Custo | Comentário |
|---|---|---|---|---|
| 1 | **Chinelo arremessável** ("Chinelada") | Alto (meme, clipe, humor BR) | Baixo | Um projétil simples. A morte mais compartilhável do jogo. |
| 2 | **Slide na ladeira do Pelourinho** | Alto (sensação única de mapa) | Baixo | ~1 dia de sim + teste; usa os degraus que já existem. |
| 3 | **Streamer × Chat com regra votada** ("Atualização da OTIMIZA") | Muito alto (motor das lives) | Médio | A cada 2 min, o chat vota numa página do nosso servidor uma regra entre 3: gravidade baixa, só chinelo, cabeça ×10, rojão para todos. 6–8 cartas curadas (lição do FragPunk). Sem API da Twitch. |
| 4 | **Narradora OTIMIZA de marketing** | Alto (tom, identidade) | Baixo | Falas em texto/voz curta nas mortes: "Cliente insatisfeito removido. Avalie sua experiência ⭐⭐⭐⭐⭐". |
| 5 | **"Momento Otimizado"** (replay do melhor lance em estilo mangá + link) | Alto (viral) | Médio | Replay pelos eventos do servidor (já temos `events`), com quadros de impacto P&B e onomatopeias. Botão "copiar link do lance". |
| 6 | **Hackeia e Segura** (roubar o drone do rival) | Muito alto (modo-assinatura) | Alto | O "cofre" do The Finals, só que vivo e atirando. Já temos hack e drones no treino. |
| 7 | **Bots com o nome de quem está no chat** | Médio-alto (pertencimento) | Baixo | Partida incompleta? Os bots (com etiqueta BOT) usam apelidos do chat que pediu para entrar. |
| 8 | **Armas com piada brasileira** (Pipoqueira, Trinta-e-Oitão, Rojão) | Médio-alto | Baixo-médio | O truque do Shell Shockers, em pt-BR. |
| 9 | **"Tapa na gambiarra"** (recarga ativa) | Médio (teto de habilidade + humor) | Baixo | Mecânica pequena e diária, sentida em todo combate. |
| 10 | **Mapas de lugares do Brasil** | Muito alto a longo prazo | Muito alto | Já é a marca; o custo é arte (E1–E2, G2). |

Extras que não entraram no top 10: roda de frases para o inimigo (ARC Raiders sem voz aberta), "arma da
temporada" em rodízio (Fortnite Reload) e eventos sazonais (Festa Junina: Rojão para todos).

---

## 7. Armadilhas a evitar (com exemplos reais)

1. **SMG que funciona a qualquer distância.** No Battlefield 6 (2025), jogadores reclamaram que as SMGs
   davam tanto dano quanto metralhadoras e eram precisas demais de longe; o "meta SMG" atravessou
   temporadas. **Para nós:** dano da Gambiarra cai depois de 18 m; ela é a única arma de hoje, então o risco é real.
2. **Hitscan de longe com mobilidade e sem perda de dano.** Hela (Marvel Rivals) passou temporadas entre os
   mais banidos e levou corte de vida e de alcance (80% → 70% a 30 m, 02/2026). **Para nós:** o sniper tem
   laser visível e carga; o fuzil exige ficar parado.
3. **Multiplicador de cabeça alto demais.** O Deadlock cortou de ×1,8 para ×1,65 (11/2025); o Strinova
   cortou armas de ×1,75 para ×1,5 e subiu a vida de 100 para 130 para alongar o TTK. **Para nós:** abandonar o ×4 global.
4. **Arma nova que quebra o equilíbrio.** A Outlaw do Valorant (2024) entrou entre Marshal e Operator e
   gerou consenso de que "não podia continuar assim". **Para nós:** cada arma nova precisa de uma linha
   vazia na matriz de distância (seção 3) antes de entrar.
5. **Mexer em movimento sem avisar.** A Respawn limitou o tap-strafe no Apex e voltou atrás após a
   revolta. **Para nós:** decidir agora o que é técnica "oficial" (slide, ladeira, mantle) e o que não é.
6. **Regras demais.** FragPunk: 169 cartas, pico de 113.946 → ~1.700. **Para nós:** votação do chat com
   poucas cartas, legíveis em 2 segundos.
7. **Monetização agressiva no lançamento.** Splitgate 2: pacote de US$ 80 no dia 1, queda de 84% e relançamento
   sem as facções/habilidades. **Para nós:** o GDD já adia a loja; manter.
8. **Mudar tudo de uma vez (TTK oscilando).** No Battlefield 6, o TTK "balançava" de patch em patch, e o
   jogo ficava frustrante. **Para nós:** mudar 1 número por vez, medido com o robô de teste e confirmado por quem joga.
9. **Habilidade valendo mais que mira.** Profissionais criticaram os *perks* do Overwatch por isso.
   **Para nós:** hack não mata (seção 5).
10. **Ser genérico.** Concord, XDefiant (já na seção 1 do pivô) e o próprio Splitgate 2 com facções sem
    personalidade. **Para nós:** toda arma e todo hack carregam Brasil + OTIMIZA.

---

## 8. Plano de armas v1 (implementar primeiro)

**Escolha:** Gambiarra MK-2 (retunada) + **SR-5 Estrelas** + **Chinelo**.
- **Por quê:** cobre perto (SMG), longe (fuzil) e o meme (chinelo) com o menor custo. A escopeta duplicaria
  o papel da SMG agora, e o sniper precisa de carga, laser e mapa com corredores longos.
- **Pré-requisito técnico:** tabela de armas em `src/sim/` (dados puros, com teste), multiplicador de cabeça
  e queda de dano **por arma**. Não mexer em `FIRE_INTERVAL`, `SPREAD` e `RECOIL_KICK` da Gambiarra
  (ajuste aprovado e protegido por `feel.test.ts`).

| Número | Gambiarra MK-2 | SR-5 Estrelas | Chinelo |
|---|---|---|---|
| Dano corpo | 20 | 25 | 50 (golpe) · 60 (arremesso) |
| Cabeça | ×2 → 40 | ×4 → 100 | golpe nas costas 100 · arremesso na cabeça 100 |
| Pernas | ×0,75 → 15 | ×0,75 → 19 | — |
| Cadência | 9/s (atual) | 6,5/s | 1 golpe a cada 0,5 s · 1 arremesso por vida |
| Pente | 30 (calor) | 20 | — |
| Recarga | Tapa: na hora (acerto) / 1,6 s (erro) | 2,0 s | Recolher no chão |
| Queda de dano | 20 até 18 m → 14 a partir de 30 m | nenhuma | arremesso: arco, 30 m/s, gravidade 12 |
| Espalhamento | atual (0,012) | 0 no 1º tiro parado ≥ 0,35 s; 0,008 parado; ×4 correndo | — |
| TTK corpo / cabeça | 0,44 s / 0,22 s | 0,46 s / one-tap | 0,5 s (2 golpes) / na hora |
| Velocidade de quem carrega | 100% | 92% | 105% com o chinelo na mão |

**Como provar que está bom (Definição de pronto + balanceamento):**
1. Testes puros: tiros para matar e TTK de cada arma em 5, 15, 30 e 50 m batem com a tabela.
2. Robô de teste no `?debug`: duelo Gambiarra × SR-5 a 10 m (a Gambiarra deve vencer ~55–65% correndo) e a
   35 m (o SR-5 deve vencer ~65–75%). Se uma arma vencer nas duas distâncias, está forte demais.
3. O dono joga 3 partidas de FFA com bots e diz qual arma "dá mais vontade" de usar. A palavra final é dele.

---

## Fontes (2024–2026)

- Valorant — Vandal × Phantom: [Dignitas 2025](https://dignitas.gg/articles/valorant-vandal-vs-phantom-2025-overview), [Riot Data Drop](https://playvalorant.com/en-us/news/dev/valorant-data-drop-phantom-vs-vandal/), [Esports.gg](https://esports.gg/guides/valorant/guns-in-valorant-explained/)
- Valorant — economia: [Dignitas Economy 101](https://dignitas.gg/articles/valorant-economy-101-a-guide-to-manage-your-credits), [TurboSmurfs patch 13.06](https://turbosmurfs.gg/article/valorant-economy-guide)
- Valorant — arsenal e nível 20: [Beebom 2026](https://beebom.com/valorant-guns-tier-list/), [Dot Esports](https://dotesports.com/valorant/news/all-weapons-in-valorant-so-far), [1ne Media](https://1nemedia.substack.com/p/new-valorant-players-will-need-to-grind-before-they-can-play-competitive-games)
- Valorant — Outlaw: [bo3.gg](https://bo3.gg/valorant/news/rumors-outlaw-will-receive-a-significant-nerf-in-patch-1301), [Strafe](https://www.strafe.com/news/read/is-valorant-latest-weapon-outlaw-broken/)
- CS2 — AK-47: [cs2damage.com](https://cs2damage.com/weapon/ak-47/), [SteamAnalyst](https://www.steamanalyst.com/weapons/stats/ak-47), [Game Stat Lab 2025](https://gamestatlab.com/2025/08/26/cs2-rifle-guide-prices-damage-impact-2025/)
- CS2 — preços 01/2025 e trocas de faca 10/2025: [Sportskeeda](https://www.sportskeeda.com/esports/cs2-patch-notes-january-29-2025-premier-season-2-train-updates-m4a4-changes), [Pley.gg](https://pley.gg/cs2/m4a4-price-cut-famas-buffed-and-smgs-nerfed-in-new-cs2-update/), [CS-Resource](https://cs-resource.com/en/cs2-update-knives-and-gloves-trade-ups/)
- Overwatch — relançamento 2026: [Game8](https://game8.co/articles/latest/overwatch-player-numbers-reach-peak-after-spotlight-event-and-rebrand), [Wikipedia](https://en.wikipedia.org/wiki/Overwatch_2); Stadium/perks: [PC Gamer](https://www.pcgamer.com/games/fps/overwatch-2-stadium/), [Flagship Eclipse](https://www.theflagshipeclipse.com/2025/02/12/overwatch-2-devs-break-down-2025s-perks-stadium-mode-and-new-heroes/); cabeça: [Overwatch Wiki](https://overwatch.fandom.com/wiki/Critical_hit)
- Apex — temporada 24: [GameSpot](https://www.gamespot.com/gallery/apex-legends-season-24-patch-notes-feature-major-buffs-for-ash-ballistic-serious-armor-changes-and-new-class-perks/2900-6254/), [Game Rant](https://gamerant.com/apex-legends-season-24-takeover-interview-buffs-ttk-arsenal/); tap-strafe revertido: [Dexerto](https://www.dexerto.com/apex-legends/apex-legends-devs-quickly-revert-tap-strafing-nerf-amid-wave-of-backlash-3025874/), [Game Rant](https://gamerant.com/apex-legends-tap-strafe-nerf-reverted-season-23/)
- The Finals — TTK: [thefinalsloadout.com](https://thefinalsloadout.com/ttk); público: [Insider Gaming](https://insider-gaming.com/the-finals-player-count-10-month-high-season-11/); destrução/C4: [The Finals Wiki](https://www.thefinals.wiki/wiki/C4), [Wikipedia](https://en.wikipedia.org/wiki/The_Finals)
- Deadlock — recorde e City Never Sleeps: [Forbes 30/09/2026](https://www.forbes.com/sites/mikestubbs/2026/09/30/deadlock-hits-highest-player-count-ever-following-major-patch/), [Tech Times](https://www.techtimes.com/articles/328314/20260930/deadlock-hits-all-time-peak-228086-players-biggest-update-yet.htm), [Shacknews](https://www.shacknews.com/article/150865/deadlock-city-never-sleeps-major-update); movimento: [PC Gamer](https://www.pcgamer.com/games/moba/deadlocks-latest-update-brings-some-huge-movement-buffs-like-jumping-mid-slide-and-30-percent-increased-air-control-its-a-lot-cooler-than-it-sounds/), [patch 16/12/2025](https://forums.playdeadlock.com/threads/12-16-2025-update.93983/); cabeça: [steamdb mechanics](https://steamdb.com/en/deadlock/mechanics/headshots)
- Marvel Rivals — Hela: [All Things How](https://allthings.how/helas-damage-falloff-nerf-in-marvel-rivals-explained/), [PC Gamer](https://www.pcgamer.com/games/third-person-shooter/marvel-rivals-patch-has-way-more-nerfs-and-buffs-than-we-thought-a-whopping-24-heroes-are-changing-this-week/); público: [VideoGamer](https://www.videogamer.com/news/marvel-rivals-player-count-decrease/), [Game Rant](https://gamerant.com/marvel-rivals-player-count-down-dropping-steam-charts/); falloff: [Mobalytics](https://mobalytics.gg/marvel-rivals/the-punisher-guide)
- Strinova: [Engadget](https://www.engadget.com/gaming/pc/strinovas-2d-stringify-mechanic-breathes-some-new-life-into-hero-shooters-140043155.html), [Wiki Stringification](https://strinova.org/wiki/Stringification), [Steam Charts](https://steamcharts.com/app/1282270), [notas de patch (Steam)](https://steamcommunity.com/app/1282270/allnews/), [Wikipedia](https://en.wikipedia.org/wiki/Strinova)
- Splitgate: [Dexerto (−80%)](https://www.dexerto.com/gaming/splitgate-2-player-steam-count-drops-over-80-in-under-a-month-3222030/), [PC Gamer (Arena Reloaded)](https://www.pcgamer.com/gaming-industry/events-conferences/splitgate-2-is-dead-long-live-splitgate-arena-reloaded-the-shooters-back-to-the-basics-relaunch-is-coming-december-17/), [Hitmarker](https://hitmarker.net/news/splitgate-2-reboot-arena-reloaded-launches-with-underwhelming-player-numbers-1610517), [AllThings.how](https://allthings.how/splitgate-arena-reloaded-is-a-full-relaunch-built-around-classic-arena-gunfights/)
- Krunker: [Wiki SMG](https://krunkerio.fandom.com/wiki/Submachine_Gun), [movimento](https://shapes.inc/fandom/krunker/movement-mechanics), [guia 2026](https://financetimez.com/pro-tips-every-krunker-io-player-should-know/)
- Shell Shockers: [Wikipedia](https://en.wikipedia.org/wiki/Shell_Shockers), [Wiki Crackshot](https://shellshockers.fandom.com/wiki/Crackshot)
- Fortnite Reload: [Fortnite Wiki](https://fortnite.fandom.com/wiki/Fortnite:_Reload), [Dexerto](https://www.dexerto.com/fortnite/all-new-vaulted-and-unvaulted-weapons-in-fortnite-og-reload-mode-2792009/); cabeça: [Game8](https://game8.co/games/Fortnite/archives/488079)
- ARC Raiders: [Push Square (12 mi)](https://www.pushsquare.com/news/2026/01/arc-raiders-now-a-huge-multiplayer-success-story-at-12-million-sales), [ComicBook (proximidade)](https://comicbook.com/gaming/feature/arc-raiders-proves-why-multiplayer-games-are-better-with-this-feature/), [Wikipedia](https://en.wikipedia.org/wiki/ARC_Raiders)
- FragPunk: [Wikipedia](https://en.wikipedia.org/wiki/FragPunk), [Dexerto](https://www.dexerto.com/gaming/fragpunk-player-count-3158221/), [Dot Esports (relançamento)](https://dotesports.com/fragpunk/news/fragpunk-soft-relaunch-interview)
- Battlefield 6 — meta SMG/TTK: [Fórum EA](https://forums.ea.com/discussions/battlefield-6-general-discussion-en/bf6s-gun-balance-is-a-mess/12810457), [Steam](https://steamcommunity.com/app/2807960/discussions/0/834999789639702971/)

> Números de fóruns e wikis de fãs mudam a cada patch; os valores acima refletem as páginas na data deste
> documento. Contagens de armas e duração de partida marcadas com "~" são estimativas do analista.
