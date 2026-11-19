# Publicar o código aberto

Passo a passo para o dono (cada passo público só com a aprovação dele). O repositório privado
continua sendo o de trabalho; o público recebe cópias geradas por `scripts/export-public.mjs`.

## Primeira vez

1. No GitHub, renomeie o repositório privado (ex.: `simbiose-dev`) para liberar o nome
   `simbiose`, e crie o repositório **público** `simbiose`, vazio (sem README nem licença).
2. Pegue o e-mail noreply em GitHub → Settings → Emails (`…@users.noreply.github.com`).
3. Com a `main` atualizada e sem mudanças pendentes:
   `node scripts/export-public.mjs ../simbiose-publico --email <noreply>`
4. Confira a pasta gerada (README, LICENSE, nenhuma captura interna) e faça o push dela:
   `git -C ../simbiose-publico remote add origin https://github.com/drvitalaraujo/simbiose.git`
   e `git -C ../simbiose-publico push -u origin main`.
5. No repositório público: Settings → Code security → ative **Private vulnerability
   reporting**; ative Issues e Discussions. Abra o endereço numa janela anônima para conferir.

## Build que vai para jogadores

O link "código-fonte" do jogo leva ao repositório público; o `THIRD-PARTY-NOTICES.txt` que vai
junto no build aponta para a revisão exata (`/tree/<commit>`). Por isso o build distribuído sai
**da cópia pública**, não deste repositório (aqui o commit é privado e não pode ser baixado):

```bash
cd ../simbiose-publico && npm ci && npm run build   # VITE_SERVER_URL=wss://... se for online
```

Confira na primeira linha do `dist/THIRD-PARTY-NOTICES.txt` que o link da revisão abre sem
login e que não aparece "mudanças locais não commitadas".

## Atualizações

A cópia pública é sempre um commit novo e independente. Para manter o histórico público, gere a
cópia numa pasta nova, copie o conteúdo (menos `.git`) por cima do clone público, faça commit
lá e push.
