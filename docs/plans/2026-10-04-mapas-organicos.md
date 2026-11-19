# Favela e Lapa: reforma de espaço, combate e arte

Responsável: Codex (coordenação, integração e validação). Pedido do dono: melhorar
substancialmente os mapas, hoje quadrados e simples, usando referências de FPS competitivos.

## Direção

- Favela: bairro assimétrico, becos em cotovelo, quadra integrada à comunidade,
  lajes com acessos alternativos e silhueta de casas escalonadas.
- Lapa: arcos reconhecíveis atravessando uma sequência de largos, rua recortada,
  coberturas arquitetônicas e acessos alternativos ao desnível.
- Qualidade competitiva: reduzir exposição simultânea, distribuir nascimentos,
  permitir flancos, manter combate legível e diferenciar encontros curtos e médios.
- Escopo da jogabilidade: espaço e oportunidades de combate. Movimento e sensação
  das armas continuam obedecendo `src/sim/feel.test.ts`.
- Colisão AABB compartilhada com servidor; geometria curva pode ser visual ou
  aproximada por caixas quando necessário. Planta irregular não exige sólidos girados.

## Referências primárias consultadas

- [Valve: Reintroducing Train](https://www.counter-strike.net/reintroducing_train):
  leitura dos inimigos, revisão de acessos e coberturas, iteração após jogar.
- [Riot: The Art of VALORANT Map Environments](https://playvalorant.com/en-gb/news/dev/the-art-of-valorant-map-environments/):
  validar layout, detalhes concentrados acima da faixa de combate, marcos fáceis
  de comunicar e orçamento de renderização.
- [Riot: Split, atualização 2.01](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-2-01/):
  alternativas para avanço, menos cantos ambíguos e gargalos com largura suficiente.

São princípios de projeto; os mapas e artes continuam autorais, sem copiar plantas
ou importar assets. A qualidade e o equilíbrio exigem avaliação humana após os testes.

## Tarefas e dependências

| Tarefa | Responsável / branch | Escopo | Estado |
| --- | --- | --- | --- |
| Favela | agente favela_redesign / feat/favela-organica | favela*.ts, planta, testes e plano próprio | integrada: 67e4332 |
| Lapa | agente lapa_redesign / feat/lapa-organica | lapa*.ts, planta, testes e plano próprio | integrada: 6930673 + aa51d67 |
| Integração e câmeras | Codex / feat/mapas-organicos | arquivos compartilhados e ferramentas de inspeção | concluída; 12 câmeras com corpo livre e apoio |
| Revisão independente | agente map_review | leitura de diffs e evidências, sem alteração de código | aprovada, achados corrigidos |
| Verificação final | Codex | navegador, tiros, navegação, desempenho, npm run check | concluída; 421 testes, 40 percursos e online |

Cada implementador trabalha em worktree e branch próprias. Portas reservadas:
5185 integração, 5181 Favela, 5182 Lapa. Nenhuma publicação ou push está no escopo.

## Critérios de aceitação

1. Rotas assimétricas e articulação espacial perceptível na planta e a pé.
2. Nascimentos livres, conexão de ida e volta e entradas alternativas aos pontos altos.
3. Coberturas bloqueiam corpo e tiro conforme seu volume; arcos atravessáveis.
4. Inspeção no Chromium e capturas antes/depois; tiros produzem abates.
5. Plantas regeneradas, revisão independente e `npm run check` aprovado.

## Entrega

- Comparativo visual e passeio pelos mapas *(não incluído na cópia pública)*.
- Revisão e evidências finais *(não incluído na cópia pública)*.
- Medição reproduzível de exposição: `npx tsx scripts/map-metrics.ts`.
- Na integração, quiosques e bancas receberam detalhes nas quatro faces; placas saíram
  da faixa das janelas, o mural da associação ganhou uma empena própria e o painel solar
  foi apoiado no trecho plano da oficina. Marquises que o envelope de salto rejeitava
  foram removidas do código; os elementos altos existentes continuam sujeitos a `clearOfBody`.
- A sensação de movimento/armas aprovada permanece; o teste determinístico de bots
  agora cobre partidas de 90 segundos na Favela e Lapa além do Pelourinho.
- Avaliação humana de equilíbrio é a próxima rodada de iteração, com os mapas já jogáveis.
