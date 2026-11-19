# Próxima versão competitiva

- Responsável: Codex coordena e revisa; Vital valida a sensação e autoriza publicação.
- Escopo autorizado: implementação local dos próximos passos do handoff; sem push em main, publicação ou serviços pagos.
- Base: `0be1578`; integração em `feat/competitive-next`.

| Tarefa | Responsável | Dependências | Estado |
|---|---|---|---|
| HUD competitivo no online, eventos, fim/revanche | agente HUD (`feat/next-hud`) | combate existente | integrado; achado Astra corrigido |
| Bloqueio de tiros independente da colisão, benchmark reversível | agente colisão (`fix/next-collision`) | nenhuma | integrado e revisado |
| Cliente configurável, limites de servidor, Docker e ensaio de carga | agente deploy (`feat/next-deploy`) | nenhuma; publicar depende do dono | integrado; Docker indisponível para teste |
| Slide e Chinelada determinísticos com predição | Codex | revisão das interfaces de rede | integrado no treino e online; correções Astra confirmadas |
| Duelo, TDM e Hackeia e Segura | agente colisão (`feat/next-modes`) + Codex | integração das primeiras entregas | integrado: servidor, bots, menu, HUD e drones visuais |
| Rede real: golpes, coleta, predição com 150 ms | agente deploy (`test/next-network`) | slide e Chinelada integrados | integrado; 3 testes passaram |
| Revisão, `npm run check`, navegador e relatório | Codex + GPT-6 Astra (low) | todas as entregas | concluído: 282 testes; revisão sem bloqueadores após correções; navegador validado |

Cada agente edita somente seu worktree e entrega commit, verificações e pendências. A integração acontece depois de revisão registrada em `docs/reviews/`. Valores congelados em `feel.test.ts` permanecem intactos. Sem assets externos novos.

O dono pediu expressamente GPT-6 Astra com esforço low como revisor. Rodado via `codex exec --model gpt-6-astra -c model_reasoning_effort=low` em worktree isolado. Relatórios em `docs/reviews/2026-10-02-astra-*.md`. Validação de navegador usa Chromium isolado: o navegador Orca falhou com `runtime_unavailable`.
