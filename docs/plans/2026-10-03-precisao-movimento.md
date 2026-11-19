# Precisão ao mover e atirar

Responsável: Codex. Revisor: GPT-6 Astra, esforço baixo, solicitado pelo dono.
Escopo: precisão das quatro armas no treino e na Arena; feedback da mira. Sem mudar
movimento, dano, munição, cadência, coice, mapas ou protocolo. Dependências: nenhuma.

## Pesquisa e decisão

- [VALORANT 3.0](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-3-0/):
  parar antes de atirar recompensa precisão em média distância; SMGs conservam mobilidade
  em curta distância. Uma pequena zona de velocidade permite voltar a acertar ao frear.
- [VALORANT 9.10](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10/):
  relação intuitiva entre velocidade e erro; identidade móvel das SMGs é preservada.
- [VALORANT 12.09](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-09/):
  ajustes específicos de precisão das escopetas reforçam que cada categoria merece tuning próprio.

Adaptação para SIMBIOSE, não cópia dos números: continuar podendo correr e atirar,
preservar o ritmo arcade e tornar a escolha de arma/posição significativa. Sem bloquear
gatilho, reduzir velocidade, exigir contra-movimento ou adicionar timer de estabilidade.
Não introduzir bloom de rajada nesta mudança: o coice já cobre o controle do gatilho.

## Regra implementada

`weaponSpread()` soma a dispersão base com erro por velocidade horizontal simulada e ar.
Até 0,5 m/s fica estável; duas curvas smoothstep contínuas interpolam até andar (7 m/s)
e correr (11 m/s). Acima disso o custo horizontal tem teto, inclusive nos slides.
ADS reduz parte do custo nas armas móveis, mas não elimina erro por movimento.
O ar soma uma penalidade independentemente da velocidade, inclusive no topo do pulo.
Agachado ganha estabilidade pela velocidade menor (3,5 m/s), sem bônus pela tecla.
Frear usa a desaceleração existente: de 11 m/s até precisão base em 11 ticks (~183 ms).

Valores são largura total do espalhamento no plano local do tiro, não ângulos em graus:

| Arma | Andar: adicional | Correr: adicional | Ar: adicional | Fração do custo em ADS |
| --- | ---: | ---: | ---: | ---: |
| MK-2 | 0,024 | 0,060 | 0,075 | 70% |
| Faísca | 0,012 | 0,032 | 0,045 | 80% |
| Linha Morta | 0,050 | 0,110 | 0,140 | 100% |
| Quebra-Beco | 0,018 | 0,045 | 0,060 | 85% |

O círculo cresce pela mesma regra do tiro, inclusive em ADS do fuzil e na luneta.
Amarelo indica movimento/ar; luneta continua pedindo para parar. A projeção acompanha
o FOV atual. O círculo representa os limites horizontal/vertical; o sorteio existente
continua quadrado (as diagonais podem ficar fora do círculo).

Sem estado novo na rede: servidor e predição já compartilham velocidade e `onGround`.
Semente autoritativa e rewind permanecem no servidor.

## Estado e prova

- Implementação e testes direcionados: concluídos (29 testes passando).
- Caracterização: nenhum número gravado alterado. O teste isolado de dispersão base
  fixa `onGround` antes do tiro porque nasce 1 cm acima do chão; a penalidade aérea
  autorizada tem cobertura própria. Trajetória, origem dos tiros, cadência e coice preservados.
- Testes novos: continuidade, diferença entre categorias, custo aéreo/slide, recuperação,
  taxa de acerto com semente e igualdade treino/servidor em movimento/ADS/ar.
- `npm run check`: concluído, TypeScript cliente/servidor + 59 arquivos/392 testes + build.
- Navegador: concluído no treino e na Arena com dois clientes reais, todas as armas.
  Tiros correndo, ADS móvel, parada/recuperação, munição confirmada pelo servidor;
  no treino também salto e um abate real por arma. Sem erros de página.
- Revisão GPT-6 Astra (baixo): concluída, sem bloqueios. Observação P3 de cobertura
  corrigida e revalidada pelo revisor. Relatório: `../reviews/2026-10-03-precisao-movimento.md`.
- Tuning definitivo depende de avaliação humana; o robô de teste isola a dispersão e mira melhor que gente.

Regra proposta para AGENTS.md: toda precisão contextual deve passar por `weaponSpread()`
e usar velocidade simulada, para tiro e indicador concordarem no treino e online.
