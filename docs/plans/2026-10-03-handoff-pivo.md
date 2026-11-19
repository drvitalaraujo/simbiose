# Passagem de bastão: pivô competitivo (fim da sessão de 2026-10-02)

- **Responsável:** Vital (decide) · Claude (coordenou) · Codex gpt-6.1-sol médio (revisor, via Orca)
- **Plano-mãe:** `docs/plans/2026-10-02-pivo-competitivo.md` · **Regras:** `AGENTS.md`
- **Fluxo combinado com o dono:** toda entrega de agente passa por revisão do Codex
  (via `/orchestration`, ver memória `orca-codex-workers`) **antes** do merge na `main`.
  Os relatórios ficam em `docs/reviews/`.

## O que já está na `main`

| Área | Estado | Como ver |
|---|---|---|
| Núcleo `src/sim/` (tick fixo 60 Hz, comandos, raio AABB) | feito | `npm test` |
| Desempenho (blocos, sombra estática, bloom próprio) | feito | `?debug` + `await __bench()` |
| Bonecos animados + hitboxes | feito | `?characters` |
| Mapa Pelourinho (greybox + arte v1 e v2, revisadas pelo Codex) | feito | `?map=pelourinho` (`?greybox` = sem arte) |
| Multiplayer local F1–F2 (Colyseus, predição) | feito | `npm run server` + `?online` |
| Arma em 1ª pessoa "Gambiarra MK-2" v2, fiel à folha (aprovada pelo Codex) | feito | qualquer modo |
| **Combate online F3** (tiro autoritativo, FFA, bots; achados do Codex corrigidos) | feito | `npm run server` + `?online` |
| **Interface** (menu, HUD competitivo, `?hud`; Jogar → online) | feito | `npm run dev` |
| **Skins** Lia/Caio/Ivo (revisadas pelo Codex; visual ainda simples) | feito | `?characters`; no online, skin fixa por nome |
| Imagens de referência (Codex) | feito | `docs/concept/` (guia, personagens, armas, mapa, interface) |
| Referências reais do Pelourinho (20 fotos CC) | feito | `docs/concept/referencias-pelourinho/` |
| Benchmark de concorrentes | feito | `docs/research/2026-10-02-benchmark-concorrentes.md` |

## Branches esperando (worktrees em `.claude/worktrees/agent-<id>`)

| Branch | O que é | Estado |
|---|---|---|

**Todas as branches desta sessão já estão na `main`** (219 testes passando). Os worktrees em
`.claude/worktrees/` podem ser removidos (`git worktree remove`) quando o dono quiser.
Próximo passo com o combate dentro: ligar o `CompetitiveHud` ao online (hoje o online usa o
`online-hud.ts` simples; o minimapa disputa o canto superior esquerdo com o painel de rede).
Depois de cada merge: `npm run check` e teste no navegador. Com o combate dentro, ligar o
`CompetitiveHud` aos eventos do online (`game.events.on('kill')`, `game.scoreboard()`) e a skin
e o time no protocolo (`createAvatar(name, {skin, team})`).

## Decisões do dono (2026-10-02, fim da sessão)

1. **Aprovado: Chinelada e deslizar na ladeira**, como recomendou o benchmark:
   - Chinelo = corpo a corpo de todos: golpe 50 (100 pelas costas), arremesso 60 (100 na cabeça),
     1 arremesso por vida, precisa recolher.
   - Deslizar (slide) que ganha velocidade ladeira abaixo nos terraços do Pelourinho.
   - Sem pulo duplo, wall-run nem bhop.
   - **Implementar depois do merge do combate**: os dois mexem em `src/sim` e `src/net/protocol.ts`
     (`FLAT_FIELDS`). O `feel.test.ts` atual não pode mudar; o slide é estado novo.
2. **Personagens 3D: sem gasto por enquanto.** Seguir pelo caminho grátis:
   - melhorar as skins em código (cabelo, máscara, proporções);
   - ou ferramentas gratuitas/abertas (Blender headless, TRELLIS/Hunyuan3D via espaço gratuito,
     respeitando as licenças em `docs/research/2026-10-02-personagens-3d-ia.md`).
   - Nada pago sem nova aprovação.
3. **Deploy:** o dono tem vários domínios e escolhe qual usar para `jogo.` / `jogo-api.`.
   Perguntar qual domínio e pedir o ok final antes de mexer no VPS (plano em
   `docs/plans/2026-10-02-deploy-vps.md`).

## Decisões ainda pendentes

- Qual domínio usar no deploy.
- Fala da OTIMIZA diz "Neo-São Paulo" no Pelourinho (`src/game/lines.ts` `INTRO`): trocar por mapa
  (proposta: `World.greeting`).
- Nomes finais das gangues, da Resistência e dos agentes (folhas: Lia Estalo, Caio Remendo, Ivo Riso).
- Mudanças de colisão para ficar fiel às pinturas: chafariz octogonal, palco com toldo no site A,
  abertura para ver o mar. É decisão de jogabilidade.

## Próximos passos técnicos (depois dos merges)

- **Achado 4 da revisão geral** (`docs/reviews/2026-10-02-codex-revisao-main.md`): o tiro usa
  os sólidos de movimento e ignora `shoot`. Uma parede invisível de limite bloqueia bala; uma
  peça `shoot:true, solid:false` não bloqueia. Criar dados puros de "bloqueio de tiro" separados
  dos sólidos e usá-los na sim e no servidor, com teste das 4 combinações de flags.
- **Achado 9**: `__bench()` não restaura relógio, diretor nem posição. Salvar e restaurar em
  `finally` (é só ferramenta de dev).

- Arsenal v1: SR-5 Estrelas (fuzil, cabeça ×4), Chinelo, recarga/munição na sim (o viewmodel
  já tem a animação). Os números estão no benchmark.
- Áudio posicional (passos e tiros com direção): `docs/research/2026-10-02-audio.md`.
  O dono pode gerar sons no **Gemini** (conferir os termos comerciais e registrar a origem).
- Killcam e clipe dos últimos 10 s; modo TDM 3v3; "Hackeia e Segura".
- Deploy F4 (com confirmação).
