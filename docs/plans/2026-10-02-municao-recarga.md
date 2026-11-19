# Munição e recarga da MK-2

Responsável: Codex. Revisor: GPT-6 Astra, esforço baixo (somente leitura).

## Escopo

- Treino e todos os modos online usam 30 tiros no carregador e 120 na reserva.
- R inicia recarga de 1,35 s. Tentar disparar vazio inicia recarga automática se há reserva.
- Apenas a diferença para completar o carregador sai da reserva, no fim da recarga.
- R tem detecção de borda: segurar não reinicia nem repete a recarga.
- Movimento e hack continuam disponíveis; Chinelada/arremesso e morte cancelam recarga.
- Nascer/reiniciar restaura munição. Sem reserva, o chinelo continua disponível; nesta
  primeira versão não há caixas de munição nem reposição por abate.
- Cadência, dano, espalhamento, coice e movimento aprovados permanecem iguais.
- Viewmodel existente (mão, carregador e ferrolho) segue o tempo da simulação;
  HUD mostra estoque real, avisos e progresso. Sons mecânicos são sintetizados localmente.

## Referências e decisão técnica

- [Valve: predição de armas](https://developer.valvesoftware.com/w/index.php?title=Latency_Compensating_Methods_in_Client%2FServer_In-game_Protocol_Design_and_Optimization):
  munição, cadência e estado da arma pertencem ao servidor e entram na predição/reconciliação.
- [Epic: habilidades do Lyra](https://dev.epicgames.com/documentation/unreal-engine/abilities-in-lyra-in-unreal-engine):
  separar capacidade do carregador, estoque e ações de disparo/recarga.
- Quantidades e duração são escolhas iniciais deste jogo, não valores prescritos pelas fontes.
  A duração reaproveita a animação que já existia; os números devem ser avaliados pelo dono jogando.

## Tarefas e dependências

1. Regras puras e entrada R — implementadas.
2. Estado autoritativo, schema, reconciliação e bots — implementados; dependem de 1.
3. HUD, animação e áudio — implementados; dependem de 1 e 2.
4. Testes puros, servidor real e navegador — concluídos: treino e online em Chromium,
   com estoque, bloqueio, progresso, pose do carregador, cancelamento e abate conferidos.
5. Revisão Astra e correções — concluídas: aprovado sem bloqueadores; proteção contra
   repetição de sons após correção regressiva de rede implementada e coberta por teste.

Regra proposta para AGENTS.md: munição e recarga ficam em `src/sim/ammo.ts`; animação/HUD
leem `reloadRemaining`, e mudanças de estoque passam pela simulação, nunca pelo viewmodel.
