# Polimento cartoon e experiência

Responsável: Codex coordenador. Base: `74cd8a3` (visual premium v3 integrado).

## Direção

Preservar cartazes, paleta brasileira, nanquim e luz pintada. Melhorar o céu, a leitura
e operação da interface e retirar trabalho redundante da renderização. Sensação das
armas, simulação, mapas e colisões aprovados permanecem como referência.

## Tarefas

| Responsável | Escopo | Dependências | Estado |
| --- | --- | --- | --- |
| Coordenador | Inspeção visual, céu procedural, comparação e integração | base v3 | concluído |
| render_audit | Passes de pós e consulta de piso das sombras móveis | worktree isolada; sem editar shaders/scene-light | integrado: `4b7e9bf` |
| ux_polish | Configurações por teclado, seleção e layout do menu | worktree isolada; sem main.ts | integrado: `2bc8388` |
| Revisor Codex | Revisão dos diffs e riscos antes dos merges | entregas dos agentes | aprovado, incluindo céu e laboratório |

## Provas

- Comparar imagens e GPU em 1280×720, mesmos enquadramentos, base na porta 5175.
- Verificar Pelourinho, Bairro, Lapa e Favela; nível econômico e mira.
- Exercitar menu por teclado e dimensões menores.
- Rodar testes direcionados, `npm run check` e registrar revisão em `docs/reviews/`.
- Entregar branch local e resultados; publicação e push não fazem parte desta tarefa.

Resultado: 617 testes e build passaram. GPU do Pelourinho caiu 20–32% em duas comparações
na mesma sessão. Quatro mapas, mira econômica e Configurações em 390 px/720p conferidos.
Evidências e limitações: revisão *(não incluído na cópia pública)*.
