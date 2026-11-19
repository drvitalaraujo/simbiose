# Marcas e fumaça de disparo

Responsável: Codex. Revisor: GPT-6 Astra, esforço baixo, solicitado pelo dono.
Estado: implementação e revisão concluídas; verificação final registrada em `docs/reviews/2026-10-03-efeitos-de-disparo.md`.

## Avaliação e escopo

O primeiro pilar do GDD pede que atirar seja gostoso. Clarão, rastros, cápsulas e coice já existiam. A melhoria acrescenta marcas de impacto, poeira e fumaça discreta, mantendo a linguagem anime e a leitura competitiva. Os efeitos são cosméticos e não exigem assets externos.

Marcas duram 45 segundos, com fade nos últimos 10 segundos e limite de 128. Cada marca tem centro escuro, borda irregular e pequenas fissuras; seu tamanho varia por arma e diminui perto de quinas. A fumaça da boca dura aproximadamente 0,5–0,64 s, e a poeira de impacto, 0,36–0,43 s. A escopeta gera uma emissão de fumaça por cartucho e um impacto por projétil que atingiu o cenário.

## Decisões técnicas

- Pools fixos e `InstancedMesh`: um lote para marcas, outro para fumaça local e outro para poeira/fumaça remota. Opacidade por instância permite desaparecer sem criar material por tiro. Essa escolha segue a finalidade de reduzir chamadas de desenho da [documentação de InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
- Transparência usa `depthWrite: false`, teste de profundidade ativo e nenhuma sombra/raycast decorativo. Marcas usam pequeno deslocamento e `polygonOffset`; fumaça é ordenada de trás para frente dentro de cada lote. Referências: [Material](https://threejs.org/docs/pages/Material.html) e [transparência](https://threejs.org/manual/pages/transparency.html).
- Texturas procedurais de 64 × 64, próprias, fora dos atlas do mundo. Cores vêm da PALETTE e materiais usam `toonWith`.
- Normal e limites vêm dos AABBs atingidos. Um raio local de até 0,302 m ajusta somente a marca ao reboco, barrado ou piso visual. `Builder.impactSurfaces` registra apenas caixas/planos com normais alinhadas aos eixos; limites invisíveis ficam fora. A colisão e a resolução do tiro continuam usando seus dados existentes.
- Na Arena, o servidor envia `ShotMsg.impacts`, com os pontos de parede de toda a salva. Clarão/fumaça local continuam imediatos; marcas persistentes só aparecem na confirmação. Mensagens `continuation` e Chinelada não repetem efeitos de bala.
- Reiniciar o Treino limpa marcas; renascer na Arena conserva marcas do ambiente. Troca de arma limpa a fumaça local. Os novos recursos são descartados ao sair do online.

## Tarefas e dependências

| Tarefa | Responsável | Dependência | Estado |
| --- | --- | --- | --- |
| Avaliar efeitos existentes e GDD | Codex | Código atual | Concluída |
| Implementar efeitos e superfícies visuais | Codex | Avaliação | Concluída |
| Integrar impactos autoritativos e escopeta | Codex | Efeitos | Concluída |
| Revisar código, sem editar | GPT-6 Astra, low | Implementação | Aprovada |
| Testes e navegador com dois clientes | Codex | Integração | Concluída |

## Limites desta etapa

Não há destruição da parede, perfuração, física de entulho nem identificação do material para trocar sons/estilhaços. Marcas usam faces planas; formas curvas ou inclinadas continuam aproximadas pelos bloqueadores existentes. Esses recursos maiores pedem outra avaliação de custo e de leitura competitiva.

Regra proposta para Armadilhas: impactos persistentes online vêm de `ShotMsg.impacts`, nunca da predição; `impactSurfaces` serve apenas ao desenho e não deve entrar em colisão, tiro ou rewind.
