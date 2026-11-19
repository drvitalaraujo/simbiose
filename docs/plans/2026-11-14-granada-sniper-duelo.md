# Granada, sniper e reserva do duelo

Responsável: Codex, único implementador em `feat/granada-sniper-duelo`.
Escopo autorizado em 2026-11-14; revisão independente posterior pelo coordenador.

## Decisões

- Granada HE em Q, uma por vida, sem entrar no ARSENAL. Fusível de 1,5 s,
  velocidade inicial de 16 m/s, gravidade de 18 m/s², quique amortecido.
  Explosão até 6 m, 110 de dano até 1 m e queda linear; linha de visão até o
  centro do alvo bloqueada por shotBlockers. Pode ferir o dono; equipes preservam
  a regra sem fogo amigo. Servidor decide lançamento, física e dano no presente.
- Estoque e borda do comando reconciliados; nenhuma mensagem de cliente aceita
  posição, dano, fusível ou múltiplos lançamentos. Projétil sobrevive à morte do
  dono; fim/reinício de partida e saída limpam projéteis.
- Sniper: 105 no tronco até 100 m, pernas 68,25; cadência, dispersão, zoom e
  coice simulado preservados. Sensação visual reforçada sem mexer no eixo da mira.
- Duelo: reserva recebe um carregador adicional de cada arma a cada nascimento,
  replicada junto dos campos existentes; outros modos e tamanhos dos carregadores iguais.

## Estado e dependências

- [x] Ler AGENTS/GDD e avaliar simulação, schema, predição, treino e apresentação.
- [x] Implementar simulação pura e testes de física/dano/oclusão/estoque.
- [x] Integrar servidor, treino, HUD, áudio, espectadores e replay.
- [x] Ajustar sniper e reserva com testes de regressão.
- [x] Rodar npm run check e verificar navegador em 5176/2576.
- [x] Revisar diff e registrar evidências em docs/reviews.

Sem publicação, push ou assets externos. Revisão independente depende da entrega.

## Entrega

Implementação e autorrevisão concluídas; `npm run check`: 649 testes/98 arquivos,
TypeScript e build passando. Evidências, ajustes encontrados, navegador e limitações:
revisão Codex *(não incluído na cópia pública)*.
Sem commit/push; revisão independente pelo coordenador permanece como próximo passo.


## Retorno da revisão Opus e legibilidade — 2026-11-14

Responsável: Codex, único editor; sem commit/push. Todos os achados M1 e B1–B5 foram confirmados e corrigidos.

- M1: dano próprio preserva agressor inimigo e arma/parte anteriores, com janela independente de 5 s; não renova o prazo. Suicídio puro, agressor ausente ou agora aliado não pontuam. Respawn limpa crédito. Mantidos filtros de equipe e expiração.
- B1: tiro em si mesmo não confirma acerto; mensagem de suicídio não incrementa kills local.
- B2: cada explosão aplica todos os danos/abates antes de verificar encerramento. Score contabiliza cada vítima elegível; encerramento interrompe o snapshot de projéteis já limpos.
- B3: raio AABB aceita padding opcional, sem recriar todas as caixas por tick. Defaults preservam demais raios.
- B4: movimento da HE consulta shotBlockers e solids (incluindo bounds), tanto no treino/servidor quanto no replay; oclusão do dano continua exclusivamente em shotBlockers.
- B5: pulso óptico nasce do consumo de munição da sniper, não de cooldown herdado ao equipar; morte/troca limpam pulso. Não altera yaw/pitch nem cadência.
- Escopo adicional: onomatopeias de impacto/abate/hack/HE usam faixa lateral oposta ao impacto, max-width 24vw, sem rotação ou overshoot. Uma por vez; impactos normais espaçados 220 ms, duração 280 ms; eventos importantes 420 ms. Replay também sai do centro e perde ampliação inicial 2,6x. Tiros remotos comuns não criam onomatopeia; confirmação local online usa o mesmo Juice. Mantidos texto anime, cor, hitmarker, partículas, áudio e efeitos de arma.

Regressões novas: crédito em duelo/FFA/TDM, expiração sem renovação por dano próprio, abandono/aliados, suicídio puro, explosão multi-vítima em ordem inversa e no limite de partida, interrupção de projétil limpo, HUD sem autoabate, bounds sem oclusão artificial, sniper por consumo de munição, posição/cadência de texto.

Evidência de navegador desta revisão (Vite 5176 / servidor 2576; abas próprias): duelo real com dois clientes; fuzil retirou 20 HP, novo tiro seguido de Q no pé creditou rival (1/0), vítima deaths=1, kills local=0, confirmações próprias=0. Após respawn, nova HE própria sem agressor manteve rival=1 e próprio=0, deaths=2, confirmações=0. Fixtures usam debug-perto autorizado e input normal para tiros/HE, sem chamar handler de dano.

Treino debug: fogo contínuo real contra drone imóvel com HP elevado (fixture impede morte/deslocamento, não injeta feedback), 337 impactos registrados; 2.407 amostras DOM em larguras efetivas 951 e 853 px, zero interseções do texto com faixa central de 40% da tela. Qualidade 2 testada; captura mostra alvo e mira desobstruídos com TUM! lateral: captura *(não incluído na cópia pública)*. Orca ajustou automaticamente o viewport após pedidos 640/1280; registramos larguras efetivas, não as solicitadas. Na preparação, sobrescrita temporária de render causou uma captura vazia; recarregamos a página, restauramos fluxo normal e descartamos essa captura. A imagem final foi inspecionada visualmente.

Autorrevisão Codex: relidos diff de crédito/encerramento, raios, pulso e caminhos de Juice/replay; sem achados pendentes conhecidos. Nenhum dos achados baixos foi deixado sem correção. Avaliação humana da sensação e releitura independente do Opus continuam com o coordenador.

Proposta adicional de regra (não editada em AGENTS): dano próprio nunca deve renovar/apagar crédito inimigo; efeitos de área concluem todas as vítimas antes do encerramento; texto de combate preserva faixa central e não usa overshoot que invada a mira.

Verificação final após todas as correções e onomatopeias: `npm run check` **PASSOU**, exit 0, TypeScript cliente/servidor, **661 testes em 102 arquivos**, build Vite; log `docs/reviews/2026-11-14-granada-revisao-check.log`. `git diff --check` passou. Branch `feat/granada-sniper-duelo`, HEAD `d67e043`, alterações não commitadas. Estado: implementação e verificações concluídas, aguardando releitura Opus coordenada.
