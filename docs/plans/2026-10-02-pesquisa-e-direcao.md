# Pesquisa e direção inicial do jogo

- **Responsável:** Vital (decisões) · agentes de IA (implementação)
- **Estado:** conceito escolhido (SIMBIOSE, ver `docs/GDD.md`); semanas 1, 2 e 3 entregues
- **Restrições definidas (2026-10-02):** jogar no navegador por link · ~5 h/semana · demo em ~1 mês · dev não programa (100% via IA)

## 1. Decisão de stack

| Opção | Veredito | Por quê |
|---|---|---|
| **Three.js + TypeScript + Vite** | **Escolhida** | Roda por link, sem instalar. O agente faz tudo em código-texto e testa sozinho no navegador (Playwright). Ciclo de feedback em segundos, o que é ótimo para live. Caso fly.pieter.com: 320 mil jogadores e US$ 1M de ARR em 17 dias (levels.io) |
| Godot 4.7 | Plano B / ida à Steam | Melhor engine para IA entre as "de verdade" (cenas em texto, MCP, roda headless). Mas depende do editor e o export web é mais pesado |
| Unity 6 / Unreal 5 | Descartadas | Arquivos binários ou YAML difíceis para agentes. Unity MCP só no plano Pro. Unreal puxa para o realismo |

Peças da stack web:
- Física e colisão com **Rapier** (WASM)
- Visual toon: `MeshToonMaterial` com rampa de 2 a 3 faixas e outline por pós-processamento (profundidade e normais) ou por casca invertida
- Multiplayer a partir do mês 2: **Colyseus** (MIT; ~15% dos jogos multiplayer da Vibe Jam 2026)
- Hospedagem: itch.io ou Vercel/Netlify

## 2. Princípios de design (o que a pesquisa mostra)

1. **MDA:** comece pelo *sentimento* que o jogador deve ter e só depois defina as regras.
2. **SDT/PENS:** jogo prende quando dá competência, autonomia e pertencimento.
3. **Flow:** desafio acompanha a habilidade, com bots de dificuldade adaptativa.
4. **Juice antes de conteúdo** (Nijman, "Art of Screenshake"): atirar num cubo cinza já tem que ser gostoso (som, hit-stop, coice, tremor de tela, partículas).
5. **"30 segundos de diversão" variados** (Griesemer, Halo): o mesmo núcleo em arenas, combinações de inimigos e modificadores diferentes.
6. **Um verbo-assinatura** que nenhum FPS popular tem (exemplos: o portal do Splitgate, a estamina do Peak, o ritmo do Hi-Fi Rush).
7. **Padrões dos virais de 2023 a 2026** (Lethal Company, R.E.P.O., Peak, Content Warning, Buckshot Roulette):
   - co-op de 1 a 4 pessoas, não PvP
   - falhar é engraçado
   - momentos de 10 segundos que viram clipe
   - gancho que cabe em uma frase
   - grátis ou barato
   - visual inconfundível
8. **História** (Half-Life, Portal, Titanfall 2, Ultrakill, Mouthwashing):
   - narrativa ambiental ("o que aconteceu aqui?")
   - um parceiro ou narrador que fala
   - lore opcional para quem quer cavar
   - campanha curta em "action blocks": cada capítulo traz uma mecânica nova ligada a um momento da história
   - os bots são personagens, com nome e personalidade
9. **Arte = uma regra forte + legibilidade** (Valorant, Obra Dinn, Hi-Fi Rush): o jogo é reconhecível num thumbnail de 1 segundo, e aliado e inimigo se distinguem de relance. O estilo também esconde a pouca fidelidade dos assets gerados por IA.
10. **Lição do Splitgate 2:** identidade antes de monetização.

## 3. Roadmap (5 h/semana)

| Semana | Entrega jogável (por link) | Estado |
|---|---|---|
| 1 | Greybox: andar, pular, atirar com juice, alvos | **feito** (2026-10-02) |
| 2 | Bots que perseguem e atiram; vida e morte; uma arena | **feito** (2026-10-02): ondas com falas da OTIMIZA, orbes destrutíveis, regeneração |
| 3 | Shader toon, outline, paleta e verbo-assinatura | **feito** (2026-10-02): hack de drones + bairro Neo-SP (agente paralelo em worktree) |
| 4 | Polimento, tela de título, 1 cena de história; **demo pública** | pendente |
| Mês 2-3 | Co-op online 2-4 jogadores (Colyseus); live de playtest com o público | pendente |
| Depois | Campanha curta; avaliar a ida para a Steam (port em Godot ou empacotamento) | pendente |

Fora do escopo agora: PvP ranqueado, contas de usuário, monetização, dublagem completa.

## 4. Ferramentas de IA para assets

| Uso | Ferramenta | Observação |
|---|---|---|
| Modelos 3D | Tripo (props), Meshy 6 (personagens) | Depois: ajuste no Blender e rig e animações no Mixamo |
| Voz | ElevenLabs | Uso comercial a partir de US$ 5/mês |
| Música | Suno | Risco jurídico em aberto (processos em 2026). Evitar na trilha principal até decidir |

Na Steam, é preciso declarar IA em arte, som e texto. Código gerado por IA não precisa ser declarado.

## 5. Riscos

- Não há um FPS multiplayer de sucesso feito por vibe coding. É território novo, o que é bom para o case e arriscado para o jogo.
- Rankings de "melhor engine para IA" e de geradores 3D vêm quase sempre de fornecedores.
- PvP online é onde projetos solo morrem (lag compensation, cheat, população mínima). Co-op primeiro.

## 6. Pendências

- [x] Escolher o conceito: SIMBIOSE (`docs/GDD.md`)
- [x] Pesquisa no X via Grok: concluída, ver `2026-10-02-pesquisa-x-grok.md`
- [x] Preencher o `AGENTS.md` com stack e comandos reais
