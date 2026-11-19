# Relatório X: vibe coding, FPS estilizado e o que está bombando (2025–2026)

**Data:** 2026-10-02 · **Fonte:** X/Twitter em tempo real · **Escopo:** pesquisa, sem editar o projeto.

Legenda: **[E]** evidência primária (post do criador/júri, métrica citada na fonte); **[H]** hype / evidência fraca (terceiros, promo, cripto, “AI solved gamedev”).

---

## 1. Jogos vibe-coded que viralizaram

O ímã da cena continua sendo **Pieter Levels (@levelsio)** e o loop *web 3D + IA + domínio próprio + build in public*.

**fly.pieter.com.** Em 11 mar 2025, Levels anunciou **US$ 87k MRR / ~US$ 1M ARR em 17 dias** e **320 mil** jogadores. Stack: Cursor + Claude 3.5/3.7, JS + Python. Ele mesmo tratou o ARR como palpite. Em jan 2026 o modelo de voo que falhava em 2025 saiu em **2 prompts**; o fonte (~10k linhas num arquivo) já tinha virado caso interno do Cursor. **[E]** https://x.com/levelsio/status/1899596115210891751 · https://x.com/levelsio/status/2014408217414013124

**dronesim.com.** Node + JS. Bio de Levels (out/2026): **~US$ 44k/mês**. Sem thread de breakdown. **[E/H]**

**Vibe Jam 2025.** ~**1.170** submissões; ~metade não carregava. Júri: Levels, @s13k_, @karpathy, @timsoret, @mrdoob. US$ 10k / 5k / 2,5k. Vencedores: **The Great Taxi Assignment** (@TomasBencko), **Vibeware** (@mattgordonxyz), **Vector Tango** (@scobelverse). 18 meses depois o 3º (Three.js, primeiro jogo do autor) virou título **Meta Quest**. **[E]** https://x.com/levelsio/status/1915127796097290534 · https://x.com/scobelverse/status/2105794954085965962

**Vibe Jam 2026.** ≥90% código por IA, web sem login, sem loading pesado, **Three.js recomendado**, multiplayer preferido. Sponsors: Cursor, Bolt, Glif, **Tripo**. ~**945–1.000** jogos. Dia 28 (números do organizador): **210.542 jogadores**, **12,4M views**. Premiação paga: **US$ 52k** (ouro **US$ 25k**). **[E]** https://x.com/levelsio/status/2039777677435908421 · https://x.com/levelsio/status/2049986812299612460 · https://x.com/levelsio/status/2067364066193203333

Vencedores 2026: **1º A Game About Capybaras Delivering Food** (@leocooout, Claude Code + Three.js + multiplayer, estética PS1, trilha gerada) **US$ 25k**; **2º Fanto’s Mega-Mart** (@e_c_t_o, Codex) **US$ 10k**; **3º WenWare** (@underpaid_mom, Codex, “Most Played”) **US$ 5k**. Best Art Direction: **Null Range** (@taylor_sntx, Cursor) — primeira vez que o autor fez um jogo. Tim Soret: qualidade “muito acima de 2025”, perto de jogo de aluno de 3º ano, **não** do top 20% da indústria. **[E]**

**Shooters vibe-coded.** @iamarkdev / HYTOPIA: deathmatch Fortnite/CoD com cara de Minecraft em Three.js, Claude 3.5/3.7 — clipe com **~567k views**. **[E/H]** views ≠ jogadores. **Coop-Strike** (@mayfer): FPS time, Capture the Chicken, 4 mapas + NPCs IA, **100% Codex**, **WebTransport** (latência tipo UDP no Chrome). https://x.com/iamarkdev/status/1902131862421836120 · https://x.com/mayfer/status/2049908840372842508

@GamesByAI (out/2026): 266/404 jogos listados em Three.js; ranking mediano Cursor 209 / Claude Code 279 / Codex 290. Conta nova, amostra enviesada. **[H]** https://x.com/GamesByAI/status/2105385327141519571

---

## 2. Stack que indies recomendam *agora* (3D / FPS + IA)

**Código / engine**

- **Web/Three.js:** default da jam e do viral. Cursor Composer / Bolt / Claude Code. Bom para demo, live e case de IA. Física e custo de GPU no browser são o teto. **[E]** regra oficial da jam.
- **Unity 6 + Claude Code:** em set/2026 a Unity lançou **plugin oficial** (29 skills internas + CLI + **Editor MCP**). Posts de @0xDanielAI e @Stefan_3D_AI descrevem spec + Unity + Blender + skills, não “um prompt”. Para FPS com bots/netcode, é o caminho mais citado por quem já shippou. **[E]** https://x.com/0xDanielAI/status/2103897577368236473 · https://x.com/Stefan_3D_AI/status/2104558611968229776
- **Godot + Godot MCP + Claude:** protótipo em horas, mais 2D/3D leve que FPS competitivo. **[H]** relatos anedóticos.
- Templates Unity: **Netcode for GameObjects** (modular) vs **Netcode for Entities** (FPS). **[E]** https://x.com/unitygames/status/2104915538900136359

**3D / animação**

- **Tripo** (sponsor da jam), **Meshy**, **Rodin/Hyper3D** (@DeemosTech, “vibe modeling”), Hunyuan3D/Trellis. Pipeline real: gerar → **AccuRig/Mixamo** → retopologia no Blender MCP. Gerações “prontas para jogo” ainda quebram no close-up. **[E/H]**

**Áudio**

- **ElevenLabs** (voz), Suno / MozartAI (música). O capivara venceu com trilha gerada bem integrada, não com “SFX genérico”. **[E]** comentário do júri.

**Netcode / multiplayer**

- Jam: WebSocket/WebTransport, salas pequenas, bots. @mayfer mostrou WebTransport de propósito.
- Consenso: “ir multiplayer solo é corajoso; **netcode sozinho é um projeto**”. Demos de lag compensation em Three.js+Rapier existem; FPS tático (tipo Splatoon) é o ponto em que “a IA não dá conta”. **[E]** https://x.com/mayfer/status/2049908840372842508 · https://x.com/Joshua_WD/status/2106000233050390542

**Para o case (FPS cartoon + história + bots + online + lives de IA):** Three.js ganha a live e o jam; **Unity MCP + spec + bots first, netcode depois** ganha o jogo jogável. Cel shading é estilo, não engine.

---

## 3. Indies de tiro / ação estilizados que streamers clipam

O que explode em 2025–26 é silhueta legível, caos co-op e clipe de 15s.

- **Peak** (co-op climbing): **1 milhão de cópias em 1 semana**, quase sem marketing; nome + queda de amigo. **[E]** https://x.com/Dexerto/status/1936822547753869714
- **Schedule I** (solo): **210k CCU** na 1ª semana; TikTok do “império”. Recorte de abr/2026: mais CCU que Destiny 2+Marathon somados. **US$ 125M** veio de thread cripto — **hype**. **[E/H]** https://x.com/2Calico/status/2049536645704143028
- **Arc Raiders:** extraction + encontro aleatório = clipe; cheat e drama PvE/PvP. Não é micro-indie.
- **ULTRAKILL:** ainda dita o feel do indie FPS; cansaço cultural (“danificou o gênero”).
- **Lethal Company / The Finals:** template de grito+proximity; look estilizado de broadcast. Referência de *forma*, não de vibe coding.

Padrão: **co-op clipável** e loop social (amigo atrapalha, galinha do Coop-Strike) vendem mais que campanha. História “forte” no X funciona como **premissa absurda em 30s**, não como cutscene.

---

## 4. Armadilhas recorrentes do vibe coding de jogo

1. **Metade não abre.** Na jam 2025, ~1.170 → ~500 jogáveis. Loading, WebGL, domínio, mobile. **[E]**
2. **XSS e buraco de segurança.** Levels no avião: a IA “não se importa” com XSS a menos que você peça. Qualquer ranking/multiplayer web é alvo. **[E]**
3. **Um arquivo de 10k linhas.** O próprio viral virou problema de contexto no Cursor. **[E]**
4. **Beleza antes do loop.** Levels: armadilha clássica é um jogo “complexo e lindo” sem fundação de gameplay. **[E]** https://x.com/levelsio/status/2042352608539492460
5. **Demo ≠ produção.** Retries, inputs ruins, custo de tokens, observabilidade, cheat. “Um prompt → WoW/cyberpunk” é conteúdo. **[H]** @VORTEX_Promos e similares.
6. **Netcode.** IA gera cliente; lag compensation, autoridade de servidor e anti-cheat não saem de um jam.
7. **Asset 3D.** Mesh bonito ≠ rig, colisão, LOD, estilo consistente (cel shading quebra com PBR de Meshy).
8. **Three.js como engine de FPS.** Física limitada, custo de draw calls. Crítica repetida: use para protótipo/viral, porte para Unity/Godot se o jogo crescer. **[H/E]**
9. **Distribuição > código.** O avião e o Peak venceram por clipes + timing, não por arquitetura. Sem live/TikTok, jam some em uma semana.

---

## 5. Contas para seguir (gamedev + IA)

1. [@levelsio](https://x.com/levelsio) — jam, métricas, playbook web 3D.  
2. [@s13k_](https://x.com/s13k_) — infra da jam.  
3. [@timsoret](https://x.com/timsoret) — júri, régua de “jogo de verdade”.  
4. [@mrdoob](https://x.com/mrdoob) — Three.js.  
5. [@Stefan_3D_AI](https://x.com/Stefan_3D_AI) — Unity + Claude Code + Blender, workspace aberto.  
6. [@0xDanielAI](https://x.com/0xDanielAI) — 25+ jogos shippados, plugin Unity.  
7. [@iamarkdev](https://x.com/iamarkdev) / HYTOPIA — shooter Three.js.  
8. [@leocooout](https://x.com/leocooout) — vencedor 2026 (multiplayer + estilo).  
9. [@scobelverse](https://x.com/scobelverse) — jam → Quest.  
10. [@taylor_sntx](https://x.com/taylor_sntx) — Null Range / direção de arte.  
Bônus: [@mayfer](https://x.com/mayfer) (FPS + WebTransport), [@DeemosTech](https://x.com/DeemosTech) (Rodin), [@tripoai](https://x.com/tripoai), [@unitygames](https://x.com/unitygames).

---

## Implicações para o case (dev solo + lives de IA)

- **Fase 1 (conteúdo):** slice Three.js, cel shading, 1 mapa, bots burros, jogável no browser em segundos — o formato que a jam e o X premia.  
- **Fase 2 (produto):** Unity 6 + MCP oficial, spec escrita, Meshy/Tripo só com pipeline de rig, **bots e loop co-op antes de netcode**.  
- **Viral:** premissa clipável (amigo atrapalha), não campanha de 8h. História entra como *setup* e VO ElevenLabs, não como cinema.  
- **Não copiar** o ARR do avião: outlier + ads in-game + audiência já existente do Levels. Peak/Schedule I mostram que **co-op + conteúdo UGC** paga mais que “FPS realista feito por IA”.

*Limite desta pesquisa: só X, sem SteamDB/TwitchTracker. Métricas de CCU/receita de terceiros (Schedule I US$ 125M, rankings GamesByAI, “AI solved gamedev”) ficam marcadas como hype até prova fora da rede.*
