# Próximos passos a partir da pesquisa de mercado

Responsável pela decisão: Vital. Responsável pela pesquisa e proposta: Codex.
Data: 03/10/2026. Estado: proposta para priorização; tarefas de produto não iniciadas por este plano.
Base: [pesquisa completa](../research/2026-10-03-mercado-e-direcao.md).

## Resultado pretendido

Uma Arena de anime no Brasil que convidados entendem, abrem com amigos e escolhem repetir. Aumentar a profundidade com personagens presentes, ambiente narrativo e uma interação de hack validada. Preservar os quatro pilares e a sensação aprovada do tiro.

O escopo aprovado segue Treino e Arena. As janelas de 30/60/90 dias são uma sequência proposta, sujeita ao ritmo real e aos testes. Este plano não estima prazos de implementação nem autoriza publicação, gasto ou alteração dos valores protegidos.

## Tarefas e dependências

| ID | Alvo e mudança esperada | Dependências | Responsável proposto | Estado | Como provar que terminou |
|---|---|---|---|---|---|
| M0 | Diagnóstico local, comparação e proposta | GDD, código e fontes atuais | Codex | Concluído nesta sessão | Pesquisa salva com fontes, fatos separados de hipóteses e baseline de check |
| M1 | Consolidar áudio, alinhamento e precisão já em andamento | Revisar entregas atuais; não duplicar implementações | Codex após definição da tarefa | Proposto | Check, navegador e dono aprovando sensação; integração revista |
| M2 | Medir entrada e sessão com eventos mínimos | M1; decidir identificação para retorno e armazenamento | Codex | Proposto | Eventos conferidos em sessões reais; humanos/bots e fonte separados |
| M3 | Facilitar convite e ensinar ações centrais no jogo | M1/M2 | Codex | Proposto | 8 de 10 convidados demonstram tiro, troca e Chinelada; convite chega à mesma sala |
| M4 | Dar escolha e presença a Lia, Caio e Ivo | M1; definir relação de Kaia com o elenco | Direção Vital; execução futura a definir | Proposto | Seleção funciona; três silhuetas/gestos lembrados; mesmas regras competitivas |
| M5 | Aprofundar largo, ladeira e igreja | Budget gráfico e referências culturais | Direção Vital; execução futura a definir | Proposto | Histórias e orientação legíveis; desempenho e colisão preservados |
| M6 | Observar duas rodadas de testes com pessoas | M2/M3; recrutamento | Vital e Codex | Proposto | Registro de 12–20 pessoas por rodada com fricções, revanche e lembrança espontânea |
| M7 | Prototipar um drone neutro hackeável | M1/M6; escolher finalidade e sinais | Codex após escolha do experimento | Proposto | Pessoas entendem execução e resposta; autoridade do servidor; confronto ainda desejado |
| M8 | Testar três mensagens de divulgação | M3/M5/M6; material de gameplay real | Vital | Proposto | Chinelada, personagem e bastidor comparados por sessão/revanche e fonte |
| M9 | Escolher expansão | M6/M7/M8 e observação de retorno | Vital | Pendente de evidências | Decisão registrada: segundo mapa, equipes ou PvE, com motivo observado |

O estado “proposto” não implica autorização para implementar todas as tarefas. Primeiro escolher um pacote pequeno e concretizar seu escopo. Regras de publicação e de gastos do AGENTS.md continuam aplicáveis.

## Primeira sequência recomendada

1. Fechar e revisar o trabalho atual de apresentação/combate.
2. Instrumentar o início e fim de sessão, e observar cinco pessoas novas sem explicação oral. Corrigir os bloqueios encontrados.
3. Fazer um passe concentrado de personagem/cenário, com uma cena antes/depois e uma partida completa para comparar.
4. Ampliar os testes; só então introduzir um experimento de hack.
5. Decidir expansão após observar repetição, dificuldades e o que as pessoas contam aos amigos.

M4 e M5 podem ser preparados enquanto se recruta M6, desde que a produção tenha escopo e orçamento de desempenho. Caso haja edição por vários agentes, cada um precisará de branch/worktree próprios, arquivos autorizados, porta exclusiva e prova de conclusão conforme AGENTS.md. Este plano não iniciou delegações.

## Metas iniciais propostas

- Entrada: mediana até controle ≤ 15 s numa máquina/conexão definida; separar cache e primeira visita e registrar cauda de lentidão.
- Aprendizagem: pelo menos 8/10 demonstram ações centrais sem ajuda oral.
- Revanche: investigar se pelo menos metade dos humanos que terminam inicia outra partida; mostrar contagens, não apenas percentual.
- Assinatura: pelo menos 7/10 lembram espontaneamente ação, lugar ou personagem próprio do SIMBIOSE.
- Hack: pelo menos 8/10 explicam uma resposta possível após jogar o protótipo.
- Retorno: estabelecer D1/D7 por coorte antes de fixar metas; não substituir pessoas por abas, bots ou views.

São hipóteses operacionais, não padrões comprovados do mercado. Amostras pequenas servem para aprender; decisões de retenção precisam de amostra e acompanhamento maiores.

## Limites do pacote inicial

Manter Arena e Treino no menu. Personagens podem expressar identidade com regras comuns. Novos gadgets, números de combate, modos, mapas ou progressão terão tarefa própria baseada em observação. História entra em detalhes do mundo, falas curtas e conflito do elenco; campanha e hub permanecem horizonte futuro.

Antes de ranqueado ou loja, medir população humana recorrente, integridade do confronto, custo de operação e retorno. Antes de replay/clipe automático, verificar o que há de memorável nas sessões e separar reprodução de eventos de exportação de vídeo.

## Validação e pendências desta entrega

- `npm.cmd run check`: passou nesta sessão, 56 arquivos/377 testes, TypeScript e build; aviso de chunk acima de 800 kB permanece.
- Pesquisa de browser: capturas reais existentes foram inspecionadas; não houve nova sessão manual de gameplay ou teste de carga nesta tarefa.
- Documentos de pesquisa/plano são as únicas edições desta entrega. Alterações locais de gameplay preexistentes ou concorrentes não pertencem à pesquisa.
- Nenhum commit, merge, push, deploy ou API paga executado.
- Pendente: priorização pelo dono, teste com pessoas e avaliação de cada proposta antes de implementar.
- Nenhuma regra nova de AGENTS.md proposta: esta tarefa não mudou comandos, convenções ou armadilhas técnicas.
