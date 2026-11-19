# Armas, mãos e inventário imediato

Responsável: Codex. Branch: `feat/arsenal-ads`. Estado: implementado e validado.

## Escopo aprovado

- Diferenciar fuzil e escopeta pela construção, melhorar mãos, recuo visual e miras.
- Manter a mira da SMG; apresentar a óptica do fuzil com o zoom de 1,35× já existente.
- Ajuste solicitado durante a implementação: todas as quatro armas disponíveis durante a vida, trocadas em 1–4, inclusive online. Substitui a restrição de uma principal por vida.
- Sem geração paga ou assets externos. Geometria original, paleta e materiais do projeto.

## Referências e decisões

[Riot: construção do arsenal de VALORANT](https://playvalorant.com/en-gb/news/dev/how-the-valorant-arsenal-was-built/): silhuetas reconhecíveis, marcadores visuais por categoria, manipulação intencional e ópticas compactas que preservam a leitura do alvo. Aplicação: fuzil alongado, carregador curvo e reflex vazada; escopeta com depósito tubular, telha móvel e cartuchos laterais.

[Call of Duty: treinamento de armas](https://www.callofduty.com/guides/training/call-of-duty-guides-modern-warfare-iii-weapons-training-and-tactics) e [categorias e equipamentos](https://www.callofduty.com/guides/multiplayer-pre-game/call-of-duty-modern-warfare-III-campaign-play-guides-weapons-loadouts): a apresentação da mira e o papel de cada categoria devem ser legíveis. Os valores atuais de zoom, dano, cadência e precisão foram preservados; não se copiou o balanceamento desses jogos.

## Entregas

1. Concluído — fuzil com cano exposto e óptica aberta; escopeta longa, telha animada em osso próprio e recarga por gestos de alimentação tubular. Dedos segmentados e afunilados, palma menor e luvas preservando a identidade da Resistência.
2. Concluído — menor torção lateral no recuo, retorno com molas, acompanhamento exponencial da velocidade e estabilização angular ao mirar. Entrada visual ao equipar.
3. Concluído — barra de slots 1 fuzil / 2 SMG / 3 sniper / 4 escopeta, seleção direta e teclado numérico. B permanece apenas como atalho opcional aos detalhes.
4. Concluído — inventário autoritativo com munição independente; troca cancela recarga, conserva munição e cooldown anterior, e exige 0,28 s para equipar. Desejo de slot persistente suporta descarte de comandos atrasados. Campos escalares entram em NetPlayer e FLAT_FIELDS.
5. Concluído — revisão independente e regressão do descarte de comandos. Registro em `docs/reviews/2026-10-03-armas-inventario-visual.md`.

## Validação

- `npm run check`: 48 arquivos / 327 testes passaram; TypeScript cliente/servidor e build passaram. Aviso de pacote principal acima de 800 kB continua presente.
- Navegador `?debug`: inspeção das quatro armas em descanso e mira; abates com cada arma (kills 0→4), movimento x=14→17,15 e ausência de erros JavaScript. Quadros manuais com render desativado; capturas renderizadas isoladamente.
- Navegador `?debug&online`, servidor separado na porta 2568: slots 2→3→4→1 sem renascer, estado predito e autoritativo iguais; fuzil conserva 26 balas após a volta.
- Teste de sala Colyseus real com 100±15 ms de atraso verifica troca e conservação de munição. Teste de reconciliação compara todos os campos; teste de bombeamento verifica retorno antes do próximo disparo.
- Cada arma mantém duas malhas mescladas, aproximadamente 2–2,5 mil triângulos no conjunto arma/mãos. Sem passe extra de renderização para a óptica.

## Uso

Reiniciar o servidor online ao atualizar: o formato de MoveInput e NetPlayer ganhou campos de inventário. Julgamento final da sensação e estética fica para uma partida humana.
