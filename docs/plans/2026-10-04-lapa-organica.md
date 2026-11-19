# Lapa: ruas, largos e escolhas de combate

Responsável: agente Lapa (`feat/lapa-organica`), coordenação e integração pelo Codex.
Escopo: topologia e vestido procedural da Lapa; movimento, armas e monumento preservados.
Dependências: coordenador atualiza câmeras de benchmark/revisão e valida no navegador.

## Referências e decisões

- [Riot — The Art of VALORANT Map Environments](https://playvalorant.com/en-gb/news/dev/the-art-of-valorant-map-environments/): leitura do combate, materiais de valor próximo, detalhes concentrados acima dos jogadores, marcos e nomes curtos. Consulta em 2026-10-04.
- [Valve — Reintroducing Train](https://www.counter-strike.net/reintroducing_train): reduzir fogo cruzado impossível de verificar, oferecer abrigo antes das entradas e relacionar acabamento com distância/escala. Consulta em 2026-10-04.

Aplicação autoral: manter os 14 vãos e os dois andares do aqueduto; converter a praça plana em largos separados por quarteirões reais. Não foi copiada planta nem asset externo.

## Entrega

| Tarefa | Estado | Prova |
| --- | --- | --- |
| Quarteirões recortados e flancos | Implementada | Casario nas bordas avança e recua; duas ilhas com volta por frente/fundo; Beco do Sebo em cotovelo |
| Cobertura e respawn | Implementada | Bilheterias e equipamentos públicos cortam as retas; 4/45 pares de spawn se enxergam |
| Terraço do Choro | Implementada | Piso a 1,6 m; duas escadas de 5 m de largura, degraus de 0,4 m; física real testa subida e descida |
| Acabamento | Implementada | Faces laterais/traseiras habitadas, toldos altos, escadas legíveis, pisos por área, marcos locais; removido letreiro gigante do chão |
| Verificações automatizadas | Concluída | `npx vitest run src/game/maps -u`, `npx tsc --noEmit` e `npm run check` |
| Navegador e revisão independente | Coordenador | Câmeras, movimentação, tiros, kills e medição final antes de integrar |

## Medidas de layout

Mesmo script do coordenador: grade conectada de 1 m, raios horizontais amostrados e linhas entre pares de spawn FFA. Métricas são diagnóstico estrutural, não substituem uma partida humana.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Área caminhável conectada | 5.737 m² | 5.449 m² |
| Área elevada alcançável | 0 m² | 187 m² |
| Pares FFA com visão direta | 19/45 | 4/45 |
| Comprimento de mira no percentil 90 | 54 m | 37,48 m |
| Raios com comprimento >40 m | 20,5% | 8,36% |

A área útil caiu aproximadamente 5% enquanto a exposição longa caiu mais de metade. Mantém-se uma troca frontal de 41 m no largo (de `[-19,1.5,21]` a `[22,1.5,21]`) e travessia individual de todos os arcos.

## Pontos para QA

Coordenadas abaixo são **pés**; no player, somar 0,85 a `y`.

- Escada oeste: `[4,0,31.5] → [12,1.6,31.5]`, andando em +x. Degraus começam em x=5 e terminam em x=9. Testar também descida.
- Escada sul: `[20.5,0,22] → [20.5,1.6,30]`, andando em +z. Degraus começam em z=23 e terminam em z=27. Testar também descida.
- Beco do Sebo: `[-39,0,20] → [-39,0,28] → [-18,0,28] → [-18,0,37]`; retorno alternativo pela frente da ilha, em z=12.
- Flanco do Centro: `[40,0,18] → [40,0,25] → [30,0,28] → [25.5,0,31] → [25.5,0,41]`; entrada sul por z=8.
- Vãos: centros em x=`-39+6*i`, i=0…13; atravessar de z=4 até z=-4 no térreo.

Câmeras sugeridas, em coordenadas de olho:

- Geral: posição `[9,1.55,21]`, alvo `[0,7,0]`.
- Beco: `[-39,1.55,28]`, alvo `[-20,2,32]`.
- Terraço: `[20.5,3.15,33]`, alvo `[10,6,0]`.
- Circo: `[-18,1.55,-20]`, alvo `[-28,5,-27]`.

Sem nova regra necessária para `AGENTS.md`. O atlas autoral permanece exclusivo da Lapa; nenhuma nova dependência, API paga ou asset externo.
