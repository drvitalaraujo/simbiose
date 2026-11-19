# Plano: deploy do SIMBIOSE no VPS

- Responsável: coordenador integra/revisa; dono aprova publicação e acesso ao VPS.
- Estado: implementação local validada; nenhuma publicação nem acesso ao VPS.
- Escopo: endpoint de build, convites, cotas configuráveis, Docker, proxy e carga limitada.
- Dependências: domínio/API e conhecimento dos serviços atuais no VPS antes da publicação.

| Tarefa | Estado | Prova |
|---|---|---|
| Endpoint VITE_SERVER_URL, override e convite | implementado | src/net/deploy.test.ts |
| Trava debug em produção | já existia; override programático também protegido | review.test.ts + teste de inicialização |
| Cotas de salas/IP, conexões/IP e mensagens | já existiam; ambiente validado e descarte reforçado | deploy.test.ts + room.node.test.ts |
| Dockerfile e variantes de proxy | preparados | bundle local; Docker não disponível |
| Carga sem dependência nova | implementada | scripts/load-online.ts usa SDK do lockfile |
| Publicação e teste HTTPS real | pendentes de autorização/domínio/VPS | dois clientes após deploy |

Arquivos e instruções atuais: [deploy/README.md](../../deploy/README.md). Esse documento substitui os exemplos antigos deste plano: eles baixavam esbuild por npx e listavam como ausentes limites e trava de debug que já estavam no código.

Não estimar capacidade a partir do tamanho do VPS: medir CPU/tick e rede com carga antes de prometer jogadores simultâneos. Não mexer nas portas, firewall ou serviços do VPS durante preparação local.

Validação: `npm run check` passou (29 arquivos, 223 testes, tsc cliente/servidor e build). Bundle do servidor com esbuild do lockfile iniciou na porta 2568; carga de oito clientes por três segundos concluiu com todos conectados. Docker não está instalado neste ambiente, portanto build de imagem e proxy HTTPS continuam pendentes no host com Docker.
