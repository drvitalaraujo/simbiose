# Pelourinho: identidade de Salvador

Responsável: Codex. Revisor: GPT-6 Astra, esforço baixo, solicitado pelo dono.
Estado: concluído; implementação, revisão independente e validações aprovadas.

## Direção e escopo

O dono pediu reconstruir um trecho reconhecível do lugar real, usando referências
fotográficas e Street View como orientação. O largo passa a ocupar a rota leste:
aberto no alto, afunilado na descida, igreja azul ao fundo. A reconstrução mantém
o desenho anime e adapta as dimensões ao combate; não é levantamento topográfico.

- Casario de 9–14 m, lotes maiores, dois ou três pavimentos, venezianas e guilhotinas
  retangulares, molduras, sacadas e telhados acompanhando a descida.
- Largo com 32 m de percurso em declive, largura de 28 m no alto e 16 m embaixo,
  3,2 m de desnível em microdegraus AABB de 0,1 m. Becos recebem escadas de acesso.
  Uma película visual de pedra, de até 10,5 cm sobre as caixas, mantém a aparência
  contínua da ladeira sem alterar a colisão ou o bloqueio de tiro.
- Igreja de 14 m até a cornija, torres voltadas ao largo e cerca de 31 m com
  campanários; cinco janelas altas e cantaria. Cobertura do adro deslocada para
  abrir a vista. Treino começa olhando para esse conjunto.
- Calçamento de pedra irregular periódica, original em canvas; luz de preenchimento
  mais neutra, céu azul costeiro exclusivo do Pelourinho, caixotes de madeira/metal.
- Movimento, armas, hitboxes e regras de combate permanecem com os valores aprovados.
  Cliente e servidor continuam recebendo a mesma planta de dados puros.

Dependências: PALETTE, Builder, atlas colonial, física AABB e mapa ARENA1 existente.
Nenhum asset externo novo, geração paga ou publicação. Lapa e mudanças de menu feitas
simultaneamente por outro trabalho ficam fora deste escopo.

## Referências e origem

Fotos 01, 05, 10, 13, 14 e 19 do dossiê existente:
`docs/concept/referencias-pelourinho/README.md` (créditos/licenças por imagem).
Fotos usadas somente para observação; não incorporadas como texturas.

- [Centro Histórico de Salvador — UNESCO](https://whc.unesco.org/en/list/309/)
- [Rosário dos Pretos — Salvador Capital Afro](https://www.salvadordabahia.com/capitalafro/experiencias/igreja-nossa-senhora-do-rosario-dos-pretos/)

## Tarefas

1. Referências e diagnóstico da arena espelhada — concluída.
2. Planta, desnível, spawns, igreja e casario — concluída.
3. Calçamento, janelas, luz e acabamentos — concluída.
4. Revisão independente — aprovada após corrigir a placa B flutuante.
5. Verificação final e evidências — concluída: npm run check (404 testes), navegador,
   online com dois clientes, benchmark de GPU e capturas.

Capturas e resultados: `docs/screens/pelourinho-real/`.
Revisão: `docs/reviews/2026-10-03-pelourinho-real.md`.
