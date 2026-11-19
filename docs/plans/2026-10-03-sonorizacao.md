# Revisão da sonorização

Responsável: Codex. Revisor: GPT-6 Astra, esforço baixo (pedido do dono).

Escopo: áudio do treino e Arena; preservar regras, cadência, coice e protocolo.

| Tarefa | Dependência | Estado |
|---|---|---|
| Inventário e pesquisa de Web Audio e sons CC0 | — | Concluída |
| Mixer, buffers, limites de vozes e posicionamento/oclusão | pesquisa | Concluída |
| Disparos em camadas, mecânica, passos, Chinelada e feedback | mixer | Concluída |
| Volume, pausa/retomada e integração treino/Arena | mixer | Concluída |
| Testes, navegador e revisão Astra | implementação | Concluída; parecer em `docs/reviews/2026-10-03-sonorizacao.md` |

## Direção

Estalo curto, corpo grave e cauda controlada nas armas; pequenas variações por disparo.
MK-2 seca e mecânica; Faísca leve e rápida; Linha Morta pesada e com cauda longa;
Quebra-Beco com impacto amplo. Feedback de acerto/cabeça/abate curto, distinto e legível.
Passos remotos posicionais, agachar silencioso, sem passos no ar ou durante slide.
Sons de drones continuam eletrônicos, com explosões posicionais. Sem alterar a simulação.

## Fontes consultadas

- [MDN: boas práticas Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices): buffers curtos decodificados, desbloqueio em gesto e controle de volume.
- [MDN: PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode): direção e distância; `maxDistance` não equivale a cortar audibilidade.
- [MDN: compressor](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode): controlar soma de sons e picos.
- [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds): foley CC0.
- [Free Firearm Sound Library](https://opengameart.org/node/21826): gravações CC0, Ben Jaszczak, Brian Nelson, Kevin Heras e Matthew Nanney.

Validação: `npm run check`; sessão própria `?debug` e Arena por link; verificar áudio ativo,
buffers, limite de vozes, posição, disparos, munição, acertos e abates. Avaliação subjetiva
final da mixagem cabe ao dono jogando com seus fones/caixas.
