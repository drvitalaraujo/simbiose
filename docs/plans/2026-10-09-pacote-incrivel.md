# Pacote "Incrível": bots, música, Modo Live, replays, drone hackeável e polimento

- **Responsável:** Vital (decide e testa) · Claude Code (coordena e integra) · agentes Opus 5.5
  esforço médio (implementam, um por frente, cada um no seu worktree e branch).
- **Pedido do dono (2026-10-09):** implementar todas as melhorias da avaliação do mesmo dia.
- **Estado:** concluído e mesclado na `main` local em 2026-10-09, após três revisões do Codex (veredito final: pode ir para a main). Sem push nem publicação.

## Frentes

| ID | Frente | O que o jogador vê | Arquivos principais (dono) | Portas vite/servidor | Estado |
|---|---|---|---|---|---|
| W1 | Bots vivos | Bots com personalidade: sniper no alto, escopeta nos becos, SMG agressiva, chinelada e arremesso; dificuldade fácil/normal/difícil | `src/net/bot*.ts`, novo `src/net/bot-persona.ts` | 5181 / 2571 | integrada (50ab0df) |
| W2 | Música e clima | Trilha gerada por código (sem licença de terceiros) por mapa, com intensidade dinâmica, vinhetas e ambiente sonoro | `src/game/audio/*` (novos `music*.ts`, `ambience.ts`) | 5182 / 2572 | integrada (d6bd95b) |
| W3 | Modo Live | Sala da live com QR code, espectador com câmera livre/seguir/diretor automático, placar da sessão, quem sobra assiste e entra na próxima | novo `src/game/spectator/*`, `server/arena-room.ts` (entrada de espectador) | 5183 / 2573 | integrada (28f4497); correções M2–M4/M6 (571d638) e M7–M10 (2849757) |
| W4 | Replays | Killcam do ponto de vista de quem te matou e "Jogada da Partida" no fim, com botão de salvar clipe | novo `src/game/online/replay*.ts`, ganchos em `online.ts` | 5184 / 2574 | integrada (3c6fd5a); correção M5 (8b60033, 687f6b1) |
| W5 | Drone da OTIMIZA na Arena | Drone neutro aparece na Arena; quem hackear ganha um aliado que luta por alguns segundos; dá para derrubá-lo | `src/net/hack-objectives.ts`, novo `src/net/arena-drone.ts`, `src/game/online/objectives.ts` | 5185 / 2575 | integrada (ff522ba, 1eaa8dd) |
| W6 | Primeira experiência | Tutorial "Teste de Admissão", menu com mapas certos e imagens, seletor de dificuldade, nascimento olhando para o jogo | `src/game/menu/*`, novo `src/game/tutorial*.ts` | 5186 / 2576 | integrada (2007706, 5f7e3b3); M1 corrigido (6708558) |
| W7 | Publicar | Jogo no ar por link | `deploy/` | — | adiado pelo dono em 2026-10-09 (domínio e VPS ainda não decididos) |

## Contratos entre frentes

- `&dificuldade=facil|normal|dificil` na URL do online vira opção de criação da sala
  (`dificuldade`). W1 lê no cliente/servidor; W6 escreve pelo menu. Padrão: `normal`.
- `&live` na URL do online: cria a sala e entra como espectador anfitrião (W3). Quem entra pelo
  convite joga normalmente.
- Música (W2) se liga de fora, pelos eventos públicos (`OnlineGame.events`, eventos do treino);
  todo som passa pelo `AudioMixer`.
- Eventos novos em `src/game/online/events.ts` e armas novas do killfeed: só acrescentar.
- Arquivos compartilhados (`online.ts`, `arena-sim.ts`, `arena-room.ts`, `main.ts`,
  `settings.ts`, `client.ts`): edição mínima, em ganchos; a lógica mora em arquivos novos.
- Valores protegidos por `src/sim/feel.test.ts` não mudam.

## Integração

Coordenador mescla uma branch por vez numa branch de integração, roda `npm run check` e testa
no navegador depois de cada merge. Revisão independente (Codex, conforme AGENTS.md) antes de
levar para a `main`. Nenhum push nem publicação sem o dono.

## Revisão

Codex (gpt-6.1-sol, esforço médio): `docs/reviews/2026-10-09-pacote-incrivel.md`. Seis achados médios
(M1–M6), nenhum furo de autoridade do servidor. M1 corrigido pelo coordenador; M2–M6 por dois agentes Opus. A segunda revisão achou M7–M10
(papel do Modo Live em reconexão, detachers do `Predict.attachAll`, killcam com patch atrasado),
corrigidos por um terceiro agente; a terceira revisão aprovou o merge na `main`.

## Pendências para o dono avaliar jogando

- Ritmo dos bots no Difícil (líder com 7 abates em ~40 s na Favela num teste).
- Volume e arranjos da trilha (`MUSIC_LEVEL`/`AMBIENCE_LEVEL` em `audio/mixer.ts`).
- "SALVAR CLIPE" ainda não foi gravado com a aba visível; o vídeo salvo não leva os letreiros.
- Chinelada em drone no Treino conta as "costas" invertidas (existia antes; mudar altera o Treino).
- `online.ts`, `game.ts` e `arena-sim.ts` passaram de ~400 linhas: dividir numa próxima tarefa.
