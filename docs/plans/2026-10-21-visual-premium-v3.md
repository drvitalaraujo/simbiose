# Visual premium v3: luz, personagens, armas, movimento, mapas e interface

- **Pedido do dono (2026-10-21):** otimizar todo o design (personagens, mapas, armas,
  movimentos) com boas práticas e referências, deixando o jogo mais bonito, mais "top" e
  mais convincente, sem perder o cartoon. Revisão e correção pelo Codex **gpt-6-astra, esforço
  médio**. O dono delegou as decisões ("tome as decisões que você recomendar") e avalia de manhã.
- **Responsáveis:** Claude Code (coordena, integra, valida no navegador) · agentes Claude via
  Orca (um por frente, worktree e branch próprios) · Codex gpt-6-astra médio (revisa e corrige
  cada branch e depois a integração).
- **Branch de integração:** `visual/2026-10-21` (sai da `main` em `b244b67`). Merge final na
  `main` depois da revisão final do Astra. O dono autorizou no chat (2026-10-21) mesclar,
  commitar e fazer push da `main` ao final. Sem publicação do jogo (itch.io/Vercel/VPS).
- **Estado:** concluído em 2026-10-22. Primeira leva (W2–W7) e segunda (W1, luz) integradas,
  revisadas pelo Astra e enviadas à `main`. Pendente só a avaliação do dono jogando (ver fim).

## Diagnóstico (capturas em `docs/screens/2026-10-21/antes-*.jpg`)

- Luz chapada: paredes de uma cor só do chão ao telhado, sem oclusão em quinas e bases, sem
  luz rebatida nem profundidade atmosférica. O contato do passe final é sutil demais.
- Chão: ladrilho/asfalto uniforme, sem desgaste, sujeira, juntas, ralos nem poças.
- 1ª pessoa: o antebraço esquerdo é um tubo roxo que cobre um terço da tela, sem mão visível;
  armas em caixas com pouca construção; pouca vida no movimento da arma.
- 3ª pessoa: boneco Quaternius com skin procedural; pose de mira encolhida, arma pequena
  demais nas mãos, rosto simples.
- Desempenho atual (Intel integrada desta máquina, ~1460×1120, `__bench()`): GPU mediana
  3,3 ms (Bairro), 3,4 ms (Lapa), 3,8 ms (Favela), 4,1 ms (Pelourinho). Há folga.

## Direção de arte (vale para todas as frentes)

1. **Leitura primeiro** (Riot/VALORANT: "ilustrativo", entre realismo e cel): personagem se
   destaca do cenário por valor e saturação; cenário tem hierarquia de detalhe (rico perto das
   rotas, simples longe); nada de ruído na faixa de combate.
2. **Luz pintada** (Hi-Fi Rush, Edgerunners, Jet Set Radio): faixas toon, luz quente e sombra
   lilás fria; gradiente vertical nas paredes (base mais escura, como oclusão pintada); quinas
   e contatos escurecidos; luz rebatida do chão; perspectiva atmosférica; céu pintado vivo.
3. **Material convincente em cartoon:** desgaste localizado, bordas gastas que pegam luz,
   variação por peça (sem repetição evidente), sujeira escorrida, metal com faixa de reflexo,
   plástico fosco, tecido com costura e dobra.
4. **Movimento vivo:** inércia por molas, antecipação e acompanhamento; câmera reage ao corpo
   sem enjoar.
5. **Custo:** medir `await __bench()` antes e depois. Orçamento: mediana de GPU até 7 ms no
   nível 0 nesta máquina; efeito novo caro desliga nos níveis 2 e 3; draw calls não dobram.

Referências: [arte dos mapas de VALORANT](https://playvalorant.com/en-us/news/dev/the-art-of-valorant-map-environments/),
[entrevista Moby Francke](https://inverse.com/gaming/valorant-art-style-interview-moby-francke),
[3D Toon Rendering in Hi-Fi RUSH (GDC 2024)](https://gdcvault.com/play/1034330/3D-Toon-Rendering-in-Hi),
[making of Hi-Fi Rush (80.lv)](https://80.lv/articles/the-making-of-hi-fi-rush-s-3d-toon-rendering-style),
[molas em 1ª pessoa (Opsive)](https://opsive.com/support/documentation/ultimate-character-controller/animation/springs/),
[N8AO](https://npmjs.com/package/n8ao) e [GTAOPass](https://threejs.org/docs/pages/GTAOPass.html) (custo de AO).

## Frentes

| ID | Frente | Arquivos (dono) | Porta vite | Estado |
|---|---|---|---|---|
| W1 | Luz e imagem | `src/game/render/**`, `src/game/toon.ts`, `src/game/world/sky.ts`, `src/game/world/backdrop.ts` | 5191 | integrada (Astra: pode integrar, sobre as outras seis) |
| W2 | Personagens (3ª pessoa) | `src/game/characters/**`, `src/game/online-avatar.ts` | 5192 | integrada (Astra: pode integrar) |
| W3 | Armas e 1ª pessoa | `src/game/viewmodel/**`, `weapon.ts`, `particles.ts`, `impacts.ts`, `impact-surface.ts`, `shot-textures.ts`, `smoke.ts`, `projectiles.ts`, `src/game/online/fx.ts` | 5193 | integrada (Astra: pode integrar) |
| W4 | Movimento e câmera | `movement-camera.ts`, `player.ts` (câmera), `juice.ts`, novo `movement-fx.ts` | 5194 | integrada (Astra: pode integrar) |
| W5 | Mapas: Pelourinho e Lapa | `src/game/maps/pelourinho-*`, `lapa-*`, `colonial.ts`, `world/colonial-*`, `world/cobble*` | 5195 | integrada (Astra: pode integrar) |
| W6 | Mapas: Favela, Bairro e props | `src/game/maps/favela-*`, `world/{bairro,street,city,buildings,props,cars,graffiti,signs,chunks}.ts` | 5196 | integrada (Astra: pode integrar) |
| W7 | Interface | `src/game/menu/**`, `src/game/hud/**`, `src/style.css`, `arsenal.css`, `tutorial.css`, `online/replay.css` | 5197 | integrada (Astra: pode integrar) |

Fluxo de cada frente: agente Claude implementa e entrega → Astra revisa e corrige no mesmo
worktree (`docs/reviews/2026-10-21-<frente>-astra.md`) → coordenador integra.

## Contratos entre frentes

- Arquivos compartilhados (`game.ts`, `online.ts`, `world/builder.ts`, `world/textures.ts`,
  `maps/build.ts`, `maps/facades.ts`, `world/shapes.ts`, `dev/visual-review.ts`, `render/bench.ts`):
  só acréscimos pequenos, em ganchos; a lógica nova mora em arquivo novo da frente.
- Cor nova entra na `PALETTE` (`toon.ts`) como acréscimo de linha; o coordenador resolve conflito.
- W1 é dona da iluminação do ambiente e do pós. W2 pode criar sombreamento próprio de
  personagem em `src/game/characters/` (luz de personagem separada da do cenário, como no Hi-Fi Rush).
- Congelados: `src/sim/feel.test.ts` (movimento, cadência, coice), hitboxes, sólidos, nascimentos
  e rotas dos mapas, dano, ordem do `ARSENAL`, protocolo de rede.
- Atlas `graffiti` e `glowSigns` quase cheios: arte nova vai para atlas novo.

## Integração e provas

Coordenador mescla uma branch por vez, roda `npm run check` e confere no navegador
(`visual-review.html?map=<id>`, `?characters`, `?debug`, `?hud`). Capturas "depois" em
`docs/screens/2026-10-21/`. Revisão final do Astra sobre a integração antes da `main`.

## Andamento

- 2026-10-21 ~21h: sete agentes Claude iniciados. O computador ficou suspenso de ~21h30 a ~08h45;
  a W1 ficou parada num pedido de permissão de leitura nesse intervalo.
- 2026-10-22: W2–W7 entregues, revisadas e corrigidas pelo Astra uma a uma; cola do coordenador
  (`render/detail-quality.ts`: qualidade de personagem e desgaste num ponto só; "Movimento de
  câmera reduzido" ligado à câmera; balanço da arma no ritmo das passadas). Revisão final do
  Astra sobre a integração: `docs/reviews/2026-10-22-visual-v3-integracao-astra.md`.
- 2026-10-22: W2–W7 na `main` (24d3dcd). W1 revisada e corrigida pelo Astra já sobre as seis
  (lilás do Bairro a 65%, ciclo da luz entre cenas, AO e brilho solar desligados nos níveis 2/3)
  e mesclada (8f089e7). `npm run check`: 91 arquivos, 604 testes. Regras novas no `AGENTS.md`.
- 2026-10-22: limpeza a pedido do dono. As 8 worktrees da rodada e suas branches
  (`drvitalaraujo/visual-*`, `visual/2026-10-21`) foram apagadas, tudo já estava na `main`; pasta
  principal de volta na `main`, igual à `origin/main`.

## Provas finais (integração completa, coordenador)

- Navegador sem erro no console: `?debug` nos 4 mapas, níveis de qualidade 3→0, `?characters`,
  `?hud`, online com 3 bots no Pelourinho. Capturas `docs/screens/2026-10-21/final-*.jpg`.
- `__bench()` nível 0, 1464×1121, GPU disputada (terminais do Orca e Chrome ativos): Lapa 5,5 ms,
  Favela 5,8, Bairro 6,4, Pelourinho 7,3. A/B na mesma sessão no Pelourinho: 6,2 ms sem a W1 →
  7,3 com ela (+1,1 ms, igual ao relatório da W1). Com a GPU mais livre o Astra mediu 4,1–5,4 ms
  nos 4 mapas. Draw calls: Bairro 107, Pelourinho 80, Lapa 44, Favela 42.
- Se o Pelourinho pesar em máquina fraca: a qualidade adaptativa cai de nível sozinha, e AO e
  brilho solar já saem nos níveis 2/3.

## Para o dono avaliar jogando

- Sensação da câmera nova (balanço, inclinação, FOV ao correr). Se enjoar: menu → "Movimento de
  câmera reduzido". A física e os números de feel não mudaram.
- Intensidade do lilás nas sombras (Bairro a 65%) e do desgaste/sujeira dos mapas.
- Leitura dos bonecos contra os cenários novos em partida de verdade.
