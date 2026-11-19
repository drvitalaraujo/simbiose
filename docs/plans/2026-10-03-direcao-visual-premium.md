# Direção visual premium — segunda revisão

Responsável e integração: Codex (root). Branch: `feat/direcao-visual-premium`.
Base: `71b5548`. Estado: concluído, com revisão independente e validação integrada.

## Direção

Pedido do dono: revisar personagens, armas, ambientes e acabamento, buscando cartoon
mais convincente, bonito e otimizado. Preservar o Brasil pós-OTIMIZA, a paleta lilás,
o nanquim e os acentos de facção. Realismo vem de luz, construção e materiais legíveis.
Movimento, cadência, dano, hitboxes e rotas competitivas permanecem como aprovados.

## Frentes

| Responsável | Escopo | Dependências | Estado |
| --- | --- | --- | --- |
| Root | Luz, céu, tratamento da imagem, integração e comparação no navegador | Diagnóstico e capturas da base | Concluído |
| Subagente personagens | Rosto, roupa e acabamento das três skins | Worktree/branch `visual-personagens`; paleta atual | Integrado: `3007dac` |
| Subagente arsenal | Quatro armas e mãos, acabamento e construção | Worktree/branch `visual-arsenal`; anchors preservados | Integrado: `72b4403` |
| Subagente auditoria | Pesquisa técnica e revisão independente | Leitura do código; depois diff integrado | Aprovado, sem bloqueios |

## Provas necessárias

- Capturas comparáveis na Lapa, Pelourinho e Bairro; três skins e quatro armas.
- Console sem erros de shader/atlas; tiro e troca de armas funcionais no `?debug`.
- Medição GPU com `__bench()` e mesma resolução/qualidade, quando disponível.
- `npm run check` completo; revisão de cada entrega antes de integrar e revisão final.
- Sem assets pagos ou externos novos. Alterações locais; nenhuma publicação/push.

## Referências técnicas

- [Riot — arte dos mapas de VALORANT](https://playvalorant.com/en-us/news/dev/the-art-of-valorant-map-environments/): hierarquia de detalhe e leitura de personagens.
- [Three.js — gestão de cor](https://threejs.org/manual/pages/color-management.html): luz linear e conversão de saída.
- [Three.js — otimização de objetos](https://threejs.org/manual/en/optimize-lots-of-objects.html): geometria agrupada e custo de desenho.

Resultados, capturas e limites em `docs/reviews/2026-10-03-direcao-visual-premium.md`.
Galeria comparativa: `docs/screens/premium/index.html`.
