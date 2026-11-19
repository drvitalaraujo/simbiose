# Pivô: SIMBIOSE vira FPS competitivo multiplayer

- **Responsável:** Vital (decide) · Claude (coordena e integra) · agentes (implementam)
- **Decidido em 2026-10-02:** sai o PvE de ondas de drones como jogo principal; entra um
  FPS **competitivo multiplayer** (estilo CS/Valorant), com times, solo (FFA) e vários modos.
  Os drones viram **modo treino**. Visual **anime premium** (não realista). **Navegador
  primeiro, Steam depois.** Servidor: um VPS Hostinger KVM 4 que o dono já tem, **em São Paulo**.
- **Tema:** IA que tomou conta + guerra de gangues num Brasil pós-apocalíptico. Gangues
  aliadas da IA contra a **Resistência**, que quer retomar o controle da IA e usá-la do
  jeito certo. Mapas em **lugares famosos do Brasil** reimaginados (ver seção 4).
  Hackear drones deixa de ser o mote e vira um **modo** (e talvez habilidade).
- Pesquisas desta sessão (5 agentes): design competitivo/viral, netcode, gráficos e assets,
  engines e auditoria do código. Resumo abaixo.

## 1. O que a pesquisa diz (resumo)

**Design**
- FPS de navegador que deram certo (Krunker, Shell Shockers) colocam você numa partida em
  segundos, sem cadastro, e rodam em PC fraco.
- Partida vazia mata jogo pequeno. A saída é **bots assumidos** completando as partidas
  (com etiqueta BOT, nunca escondidos) e **salas por link**. Por link, o streamer chama o
  chat para jogar contra ele.
- Copiar CS não basta: Concord e XDefiant morreram por serem genéricos. O Strinova
  sobrevive porque tem uma mecânica única. O nosso diferencial é o **hack** e o
  **Brasil-anime**.
- Competitivo "suado" demais espanta gente: The Finals perdeu 80% dos jogadores em
  3 meses. Fácil de aprender e difícil de dominar, com modos casuais.
- Frameworks:
  - MDA: começar pelo sentimento.
  - SDT: competência, autonomia e pertencimento.
  - Flow: matchmaking por nível.
  - Hook: link → 1 clique → clipe → cosmético.
  - Koster: um teto de habilidade alto (movimento, tiro na cabeça).

**Tecnologia**
- **Ficar no Three.js e reforçar.**
  - O Krunker é Three.js e chegou à Steam com o mesmo código.
  - Migrar para Godot/Unity custaria 8–16 semanas só para voltar aonde estamos e
    quebraria o fluxo dos agentes.
- **Rede: Colyseus 0.18** (MIT, TypeScript). Já traz predição, reconciliação e
  lag compensation (*rewind*). WebSocket primeiro.
- Servidor autoritativo:
  - O cliente só manda comandos.
  - Simulação em 60 Hz.
  - Os outros jogadores aparecem ~100 ms no passado.
  - Rewind de hitbox no tiro.
- Anti-cheat possível no navegador:
  - Servidor autoritativo.
  - Limite de cadência.
  - Não enviar a posição de inimigo invisível.
  - Aimbot não tem solução definitiva.
- **Gráficos:**
  - O visual "quadrado" vem da geometria e da luz, não do shader.
  - Para resolver: modelos GLB com chanfro, AO assado, texturas *trim-sheet*, decalques
    e personagens rigados (Mixamo/Quaternius).
  - WebGPU fica para depois.
  - Assets CC0: Kenney, Quaternius, KayKit, Poly Haven.
  - **Synty proíbe uso com IA.** Hunyuan3D não vale na UE/UK/Coreia do Sul.
- **Desempenho medido:**
  - ~563 mil triângulos e ~115 draw calls.
  - A sombra do sol redesenha o mundo parado a cada quadro.
  - O `Builder` mescla tudo, então o *culling* não descarta nada.
  - O dt variável deixa o jogo em câmera lenta abaixo de 30 fps.

## 2. Modos (ordem de entrega)

1. **Treino** (já existe): drones, hack, ondas. Também é o tutorial.
2. **FFA "Arena"** (2–8 jogadores, completado com bots), partidas de 5–8 min, "jogar de
   novo" em menos de 3 s.
3. **Duelo 1v1 por link**: o streamer contra o chat.
4. **TDM 3v3** com bots completando os times.
5. **"Hackeia e Segura"** (modo-assinatura): drones neutros no mapa. Hackeado, o drone
   pontua para o seu time; roubar o do rival vira o jogo.
6. Depois, se pegar: **modo bomba 5v5** com economia de rodada, ranqueado (OpenSkill),
   contas e cosméticos. Nunca cobrar para jogar.

## 3. Roadmap técnico (cada fase jogável e testável)

| Fase | Entrega | Estado |
|---|---|---|
| F0 | Núcleo da simulação: tick fixo 60 Hz, `PlayerCommand`, `sim/` sem Three, raio contra AABB, arma emitindo eventos | **feito** (2026-10-02): `src/sim/`, 60 Hz, sem câmera lenta |
| E0 | Desempenho: sombra estática, mesclagem por blocos (culling), `pixelRatio`, bloom mais barato | **feito**: GPU ~19→14 ms (normal), ~8 ms (`?low`); 560k→237k triângulos |
| E3a | Protótipo de personagem humano animado (correr/agachar/morrer) + hitboxes | **feito**: `?characters`, boneco CC0 Quaternius, hitbox cabeça ×4 |
| G1 | Mapa competitivo em greybox (3 rotas), como dados puros | **feito**: `?map=pelourinho`, 120×88 m, planta em `docs/maps/arena1.svg` |
| F1 | Servidor Colyseus local: 2 abas se vendo andar, sala por link | **feito**: `npm run server` + `?online`, sala por link, boneco animado |
| F2 | Predição, reconciliação e interpolação; teste com latência simulada de 150 ms | **feito**: erro 0 cm a 150 ms |
| F3 | Tiro autoritativo com rewind, vida, morte, respawn, placar FFA + bots | **feito**: FFA online no Pelourinho com bots (revisado pelo Codex) |
| F4 | Deploy no VPS do dono (Docker), link público, apelido | pendente (**pedir confirmação**) |
| E1–E2 | Prédios com chanfro/AO/trim-sheet, props GLB comprimidos (KTX2/meshopt) | Pelourinho v1 feito; v2 em andamento |
| G2 | Vestir o mapa com o tema de um lugar do Brasil | **feito** (Pelourinho v1, revisado pelo Codex) |
| F5+ | TDM, "Hackeia e Segura", killcam/clipe, matchmaking, anti-cheat básico | pendente |
| S | Steam (Electron/Tauri), ranqueado, contas | depois |

## 4. Mapas: lugares do Brasil

Cada mapa é um ponto famoso **reimaginado** depois da tomada da IA (neon, drones, telões,
pichação). Assim o visual fica inconfundível e "Brasil-anime" vira a marca do jogo.
Candidatos:
- **Lapa (Rio)**: arcos e escadaria colorida.
- **Paulista (SP)**: MASP, avenida e prédios.
- **Pelourinho (Salvador)**: ladeiras e casarões coloridos.
- **Esplanada (Brasília)**: monumental e simétrica, ótima para um mapa de bomba.
- **Ver-o-Peso (Belém)**: mercado, docas e barcos.
- **Lençóis Maranhenses**: dunas, um mapa aberto de sniper.

⚠️ **Propriedade intelectual:** prédio público e paisagem, tudo bem. Mas a imagem do
Cristo Redentor é licenciada pela Arquidiocese do Rio, e os azulejos do Selarón são obra
de artista. Fazer versões **inspiradas**, sem copiar.

## 5. Decisões pendentes do dono

- [x] Primeiro lugar do Brasil para o mapa: **Pelourinho (Salvador)** (2026-10-02).
- [x] Região do VPS Hostinger: **São Paulo**.
- [ ] O VPS pode rodar um contêiner Docker do jogo ao lado do que já roda? (confirmar na F4)
- [ ] Validar a sensação depois do tick fixo: o hit-stop vira só visual.
- [ ] Nomes das gangues e da Resistência; personagens/agentes com habilidades.
- [ ] Gastos com geração 3D por IA (Meshy ~US$ 20/mês), só se os assets CC0 não bastarem.


> Estado detalhado no fim da sessão: `docs/plans/2026-10-03-handoff-pivo.md`.
