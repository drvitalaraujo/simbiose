# Segurança

## Como reportar

Achou uma falha no servidor ou no cliente (trapaça possível, servidor caindo, vazamento de
dados)? **Não abra issue pública com os detalhes.** Use o botão **Report a vulnerability** na aba
**Security** do repositório (relato privado do GitHub). Inclua os passos para reproduzir e a
versão (commit) testada. Se o botão não aparecer, abra uma issue só com o título "Contato de
segurança", sem detalhes, e aguarde o contato privado. A resposta é feita no tempo livre do projeto: sem prazo garantido.

## O que conta como falha

- Cliente conseguindo decidir algo que é do servidor (dano, posição, rewind, munição).
- Forma de derrubar ou travar o servidor, ou de furar as cotas por IP.
- Comandos de teste (teleporte, drone) funcionando fora do modo de desenvolvimento.

## Para quem hospeda um servidor

- Rode com `NODE_ENV=production` e `SIMBIOSE_DEBUG=0` (o servidor recusa debug em produção).
- Não exponha a porta 2567 direto na internet: coloque um proxy HTTPS na frente que
  **sobrescreva** `X-Real-IP` com o IP real e remova `X-Client-IP`. As cotas por IP dependem
  disso. Exemplo pronto em `deploy/Caddyfile`; detalhes em `deploy/README.md`.
- Ajuste as cotas (`SIMBIOSE_*` em `.env.example`) ao tamanho da máquina.
