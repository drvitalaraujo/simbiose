# Lapa mais completa e movimento menos exagerado

Responsável: Codex coordena, revisa e integra; GPT-6 Astra com esforço médio implementa
o refino visual da Lapa; Vital avalia a sensação jogando.
Base: `68153b9`. Integração local: `feat/lapa-movimento-refino`, na pasta principal do projeto.
Autorização: pedidos do dono nesta sessão para enriquecer a Lapa e reduzir caminhada,
corrida e distância de slide. Sem publicação, push ou serviços pagos.

| Tarefa | Escopo | Dependências | Estado |
| --- | --- | --- | --- |
| Refino da Lapa | Astra, worktree/branch próprios; módulos Lapa, arte, testes e capturas | Planta e referências existentes | Concluído; commit `3a98ae5` |
| Movimento menos rápido | Codex; `sim/player.ts`, `slide.ts`, dispersão e testes | Pedido explícito do dono permite revisar `feel.test.ts` | Concluído; check e navegador treino/rede passaram |
| Revisão e integração | Codex; diff e capturas Astra, relatório e integração local | Entrega Astra | Concluído; revisão `docs/reviews/2026-10-03-lapa-refino-codex.md` |
| Validação final | Check, navegador, circulação, tiros e rede | Integração | Concluído; check 406 testes e navegador passaram |

## Ajuste de movimento

| Medida | Antes | Depois |
| --- | --- | --- |
| Caminhada | 7 m/s | 6 m/s |
| Corrida | 11 m/s | 9,5 m/s |
| Duração máxima do slide | 1,15 s | 0,95 s |
| Slide no plano a partir da corrida | 10,068 m / 70 ticks | 7,278 m / 58 ticks |
| Teto na descida | 18 m/s | 14 m/s |
| Velocidade mínima do slide | 8 m/s | 7 m/s |

Mantidos aceleração, pulo, gravidade, agachamento, cadência e coice. Dispersão por
movimento usa as novas velocidades como referências, preservando o custo de andar e
correr de cada arma. Não foram introduzidos campos de protocolo. O envelope de
decoração em `maps/facades.ts` conserva a velocidade antiga como margem conservadora.

## Recursos e evidências

- Vite do usuário: 5173; servidor: 2567. Astra: 5176, servidor temporário permitido 2570;
  portas 5174/5175 e 2568/2569 já estavam ocupadas e foram preservadas.
- Orquestração: `run_55af71b7ba3d`, tarefa `task_52b27c96b5e0`, dispatch `ctx_0e52074eee0c`.
- Worktree Astra: pasta `lapa-refino-astra` do Orca;
  branch `drvitalaraujo/lapa-refino-astra`. Modelo/effort efetivos conferidos no lançamento.
- Testes focados: 5 arquivos / 35 testes passaram (feel, slide, accuracy treino/rede, facades).
- Chromium isolado, `?debug&map=lapa`, render desligado, lotes de até 120 quadros:
  caminhada atravessou o vão x=3 de z=6 a -5,692; corrida chegou a -12,228;
  slide percorreu 7,278 m / 58 quadros, console sem exceção.
- Capturas e validação finais serão registradas na revisão após integrar o mapa.
- Check do movimento: TypeScript cliente/servidor, 62 arquivos / 406 testes e build passaram;
  aviso preexistente de chunk acima de 800 kB.
- Treino: pilar x=0 parou o corpo em z=1,4501; tiro atrás do pilar preservou o drone
  (HP=3, kills=0), tiro pelo vão matou (HP=0, kills=1). Sem exceções.
- Rede real: caminhada e corrida confirmadas pelo servidor em 6 e 9,5 m/s, iguais à
  predição, correção 0 cm. Servidor local 2567 reiniciado para carregar o ajuste.

Refino inclui 14 lotes de casario, patrimônio, comércio, cartazes, quiosques e skyline,
sem alteração dos sólidos/spawns. Check integrado: 62 arquivos / 406 testes passaram;
navegador repetiu circulação, tiros e Arena, com atlas 63% e nenhum erro.
A revisão autorizada de movimento fica registrada aqui, no GDD e nos testes de sensação.
Regra de empacotamento do atlas proposta pelo Astra incorporada pelo coordenador em AGENTS.
Pendência: avaliação humana de sensação, estética e GPU integrada; nenhuma publicação/push.
