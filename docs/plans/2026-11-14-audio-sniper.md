# Áudio competitivo e Linha Morta

Responsável: Codex. Revisor solicitado: Claude Opus 5.5, esforço médio via Orca.
Escopo autorizado: melhorar passos, volume, espacialização e coerência da sniper.

## Diagnóstico e mudanças

- O mixer multiplicava efeitos por 0,78 antes do volume geral. Agora usa 0,9 (+1,24 dB);
  feedback passa de 0,9 para 1. Preferências de volume e compressor final preservados.
- Passos remotos: camada de 0,55 para 0,8 (+3,25 dB), aterrissagem de 0,6 para 0,8.
  Alcances de 24/28 m e oclusão preservados. Passos próprios continuam discretos.
  Prioridade 7 protege passos de detritos; tiros remotos usam 8 e não são cortados por passos.
  Passos não acionam duck. Aliados do jogador usam prioridade 5, sem reserva de HRTF;
  espectador neutro trata todas as fontes igualmente.
  Nível-base musical de 0,4 para 0,3, mantendo o controle de música do usuário.
- HRTF antes dependia de qualidade gráfica 0: GPUs lentas perdiam informação binaural.
  Agora independe de gráficos e alcança 32 m; limite de oito vozes, duas reservadas
  explicitamente para passos relevantes. Detritos usam panorama simples. Distância é aplicada uma vez.
- Sniper: intervalo 1,15 → 1,45 s (aproximadamente 52 → 41 tiros/min sem recarregar).
  Continua semiautomática, com 105 no tronco e precisão estável de 0,00065.
  Durante o ferrolho a luneta baixa; nos últimos 0,32 s pode voltar a mirar.
  Pulando/caindo perde ADS progressivamente e mantém a penalidade de dispersão existente;
  pousar recupera ADS progressivamente. Não há precisão instantânea por aterrissar.
  Queda curta ao descer degraus (menos de 0,2 s e velocidade vertical entre -5 e 0 m/s)
  preserva ADS, sem alterar física ou dispersão preexistente. Trocas mantêm cooldown pendente.
  Toda regra usa estado existente replicado, sem relógio visual nem campo novo de rede.
- MK-2, demais armas e caracterização de movimento/coice não foram alterados.

## Referências e limites

- Valve, [Air Time](https://blog.counter-strike.net/air-time/): precisão no ar é pior
  que no chão e depende da arma. Referência de princípio; não alegamos reproduzir
  o modelo de velocidade vertical do CS nem seus números atuais de AWP.
- MDN, [PannerNode.panningModel](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/panningModel):
  HRTF usa respostas medidas para espacialização binaural, ao contrário do panorama simples.
- Não existe volume universal ideal: mixagem depende de fones e equipamento. Aumento
  de ganho e compressão não substituem escuta humana nem garantem ausência de mascaramento.
- Oclusão atual continua um raio direto com abafamento, sem propagação por portas/difração.

## Estado e validação

- Implementação e testes de regressão: concluídos. `npm run check` passou:
  103 arquivos, 665 testes, TypeScript de cliente/servidor e build Vite.
  Primeira execução teve expectativa antiga de cadência e comparação exata de ponto
  flutuante nos testes (corrigidas), além de timeout de teste de pisos da Lapa.
  Esse arquivo passou isolado (8 testes) e na segunda suíte completa sem alterar o teste.
- Revisão Opus 5.5 médio recebida: `docs/reviews/2026-11-14-audio-sniper-opus.md`.
  Codex corrigiu regressão de degraus, prioridade/duck, aliados, teste isolado de ferrolho
  e teste de paridade das demais armas no ar. Testes focados: 39 passaram.
  Ganho geral reduzido para 0,9 por prudência de mixagem; `mixer.stats` expõe
  `compressionDb` e `baseLatency` para medição real. Isso é instrumentação, não uma medição.
  Checagem completa após correções passou: 103 arquivos, 667 testes, TypeScript e build.
  Re-revisão Opus 5.5 médio concluída: aprovado, sem novo bloqueador de código.
  Parecer final e ressalvas registrados no relatório de revisão.
- Navegador: bloqueado nesta sessão. `cua.createBrowserTab` retorna
  `The browser access host is unavailable`; inventário também relata pipe nativo indisponível.
- Pendência de aceitação: jogar com fones, comparar passos nas quatro direções/andares,
  com tiros simultâneos, e sniper no chão/pulando/trocando arma. Sem publicação nem commit.

Regra proposta: qualidade gráfica não deve reduzir informação de áudio competitivo;
orçamento de HRTF deve reservar vagas para passos.
Regra proposta após revisão: regras de mira que dependem de `onGround` precisam de
teste descendo degraus; a física não gruda no degrau inferior, causando quedas curtas.
