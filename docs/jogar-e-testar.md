# Jogar e verificar a versão competitiva

No PowerShell, abra dois terminais no projeto: `npm run dev` e `npm run server`.
Abra o endereço mostrado pelo Vite. Escolha Arena, Duelo por link, TDM 3v3 ou Hackeia e
Segura. Copie o convite dentro da sala para jogar com amigos no mesmo servidor.

Controles: WASD anda, mouse mira, botão esquerdo atira, Shift anda devagar sem passos, Espaço pula,
C agacha (evite Ctrl+W: fecha a aba no Chrome), V dá Chinelada, G arremessa, E hackeia e botão direito mira,
Tab abre placar e Esc libera o mouse. No treino, E converte drones enfraquecidos; no
Hackeia e Segura, mire no drone a até 4 m e segure E por 2 s. Recolha seu chinelo no chão.
Cada arma recarrega sozinha ao esvaziar o pente, se houver munição reserva; R recarrega antes disso.

Links locais diretos: `?online&modo=ffa`, `?online&modo=duel`, `?online&modo=tdm`,
`?online&modo=hack`; `&mapa=pelourinho` escolhe o mapa. O Duelo aguarda o segundo jogador.
Por padrão, FFA e os modos de equipe têm bots assumidos; Duelo não preenche a vaga com bot.

Ferramentas de desenvolvimento: `?debug` (treino), `?debug&online` (rede), `?hud`
(apresentação) e `?characters` (bonecos). `?debug` expõe `window.__game` e ignora preferências.
Automação deve desligar `__game.pipeline.render` depois das capturas; no online o relógio de
envio usa tempo real, com no máximo 300 quadros por chamada. A vitrine usa
`__chars.frame(1/60)` para avançar manualmente.

Verificação final: `npm run check`. Testes de rede sobem seus próprios servidores com portas
aleatórias; não precisam do servidor manual. A simulação compartilha movimento, cadência
e comandos; o servidor decide acertos, times, coleta do chinelo, hack e pontos.

Deploy e carga: [deploy/README.md](../deploy/README.md). Publicação depende do domínio e da
aprovação do dono. Nesta máquina não há Docker, portanto imagem e HTTPS ainda precisam
ser validados em um host com Docker. Testes Chromium em SwiftShader verificam comportamento
e apresentação, sem medir desempenho real de GPU.
