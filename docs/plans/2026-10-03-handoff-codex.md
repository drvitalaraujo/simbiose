# Passagem de bastão: revisão e evolução com o Codex (2026-10-03, 14h)

- **Responsável:** Vital (decide) · Codex (revisa/implementa) · Claude (coordenou até aqui)
- **Estado do código:** `main` em `b994ed8`+ (ver `git log`). `npm run check` passando (26 testes).
- **Como rodar:** `npm install && npm run dev` → http://localhost:5173 (teste automatizado:
  `?debug`, ver Armadilhas no `AGENTS.md`).

## O que existe hoje

| Sistema | Arquivos | Notas |
|---|---|---|
| Movimento, tiro com juice | `player.ts`, `weapon.ts`, `juice.ts`, `physics.ts` | O dono aprovou a sensação ("bem gostoso") — **não mexer no tuning sem pedir** |
| Drones (atirador, Abraço Grátis, chefe) | `drones.ts`, `brain.ts`, `projectiles.ts` | Inércia, deriva, esquiva, inclinação; kamikaze com reação em cadeia; chefe na onda 5 |
| Hack (verbo-assinatura) | `hack.ts`, partes de `game.ts` | Pane → segurar E; esquadrão de 3; sobrecarga; chefe hackeável na pane |
| Ondas e história | `director.ts`, `game.ts` (INTRO, BIT) | Falas da OTIMIZA por onda; abertura com Kaia |
| Bairro Neo-SP | `world/*` | Feito por agente em paralelo; colisão só AABB |
| Visual anime | `render/pipeline.ts`, `render/shaders.ts`, `toon.ts` | Nanquim em tela cheia, bloom, gradação, retícula |

## Revisão pedida (prioridade)

1. **`render/shaders.ts` + `pipeline.ts`** — limiares do contorno, custo em GPU integrada
   (medido 25–34 ms/quadro numa Intel integrada; suspeita de disputa de GPU, não confirmada).
   Já existe qualidade adaptativa (`render/quality.ts`, `?low`); revisar os limiares dela.
2. **`drones.ts`** (~500 linhas, acima da convenção de ~400) — dividir por responsabilidade
   (movimento / combate / visual / tipos) sem mudar comportamento.
3. **`world/*`** — troncos de árvore e props sólidos podem atrapalhar a circulação; conferir
   jogando.
4. Correções de bugs que encontrar, com teste quando for lógica pura.

## Próximas features candidatas (o dono escolhe)

- Co-op online 2–4 (Colyseus) — maior salto para lives.
- Publicar por link (itch.io) — exige o dono criar a conta/página.
- Mais facções/inimigos (Os Sorridentes no chão exigem pathfinding — os drones não têm).
- Hub da Vila Analógica entre ondas, upgrades.

## Pendências conhecidas

- Medir FPS real num notebook comum com a máquina livre.
- Orelhões parecem "bolhas laranja"; ar-condicionados desalinhados das janelas.
- `package-lock.json` pode aparecer modificado após `npm install` em worktrees novos: não commitar.
