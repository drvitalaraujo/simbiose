# Deploy preparado; publicação ainda não executada

Responsável: coordenador integra; dono autoriza publicação, domínio e acesso ao VPS.
Escopo: um processo Colyseus, cliente estático, HTTPS e limites configuráveis. Nenhum VPS foi acessado.

1. Copie `.env.example` para `deploy/.env` (ignorado pelo Git). Preencha `GAME_DOMAIN`, `API_DOMAIN`, `ACME_EMAIL` e cotas. Não coloque `VITE_SERVER_URL` secreto: ele faz parte do JavaScript público.
2. Antes do build do cliente, defina `VITE_SERVER_URL=wss://SEU_API_DOMAIN` no ambiente e rode `npm ci` e `npm run check`. No PowerShell: `$env:VITE_SERVER_URL='wss://jogo-api.seudominio'; npm run check`. No Bash: `VITE_SERVER_URL=wss://jogo-api.seudominio npm run check`.
3. Depois da autorização de publicação, configure DNS e confira os serviços existentes nas portas 80/443. Não reinstale o VPS nem altere firewall sem essa conferência.
4. Com portas 80/443 livres: `docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build`.
5. Com proxy existente: `docker compose --env-file deploy/.env -f deploy/docker-compose.yml -f deploy/existing-proxy.yml up -d --build server`. O jogo fica em `127.0.0.1:2567`; sirva `dist/` pelo proxy e encaminhe o domínio da API, incluindo WebSocket, para esse endereço.

No Caddy existente, copie os dois blocos de `Caddyfile`, substitua `/srv/site` pelo caminho absoluto de `dist` e `server:2567` por `127.0.0.1:2567`. No outro proxy, sobrescreva `X-Real-IP` com o IP remoto real e remova `X-Client-IP`: o Colyseus confia nesses cabeçalhos. Não exponha 2567 diretamente à internet. Se houver CDN na frente, configure explicitamente os proxies confiáveis antes de usar o endereço reportado por ela.

O contêiner usa o esbuild já fixado no lockfile, sem instalar ferramenta com `npx`. Runtime tem apenas dependências de produção, usuário sem privilégio, filesystem somente leitura e limites de CPU/RAM. `SIMBIOSE_DEBUG=1` em produção já é recusado no código.

Confira `docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps` e `logs --tail=50 server`, abra o site HTTPS e jogue em dois clientes. Confira que a porta pública 2567 está fechada. Atualizar reinicia partidas; faça fora do horário de jogo. Para reverter, faça checkout do commit aprovado anterior, gere novamente `dist` com o mesmo `VITE_SERVER_URL` e reconstrua a imagem. `down` preserva os volumes de certificados.

Carga local: `npx --no-install tsx scripts/load-online.ts ws://localhost:2568 8 15`. De 1 a 64 clientes por 1 a 120 segundos; limite absoluto de três minutos. Para mais de oito clientes num mesmo IP, configure cotas maiores somente no servidor de carga; não altere o padrão público por causa do teste. A saída mede clientes conectados e ritmo dos comandos; RSS é do gerador de carga. CPU/RAM do servidor são medidas por `docker stats`. Nenhuma capacidade de jogadores é prometida antes da medição no VPS.

Cotas padrão: 40 salas, 3 salas criadas/IP, 8 conexões/IP, 150 mensagens/s por cliente e 1024 bytes/mensagem. São inteiros positivos; valor inválido impede iniciar. Em quedas, a conexão reservada conta por até 10 segundos para reconexão. Salas sem jogadores se desfazem e liberam cotas; apagar a sala libera também autenticações incompletas. O override `?servidor=` prevalece sobre `VITE_SERVER_URL` e acompanha links de convite.

Pendente: Docker indisponível no ambiente Windows desta implementação; executar `docker build -t simbiose-server:teste .` e validar os dois compose no host com Docker, depois testar proxy HTTPS/WebSocket. Publicação, domínio, VPS e push em main dependem da autorização do dono.
