# SIMBIOSE

> Fonte única de instruções compartilhada entre os agentes (Codex, Claude Code, Antigravity,
> Grok Build, Qwen Code, Cursor...). Não crie cópias dele em `CLAUDE.md`, `GEMINI.md` etc.
> Regra: só entra o que um agente erraria se não estivesse escrito aqui. Meta: < 200 linhas.

FPS competitivo multiplayer em anime que roda no navegador (Three.js + TypeScript + Vite), feito solo por um dono
que **não programa**: todo o código é escrito por agentes. Também serve de case para lives
sobre IA. Conceito, tom e pilares: `docs/GDD.md`. Roadmap e decisões: `docs/plans/`.

## Comandos

Testados no PowerShell 7 e no Git Bash.

```bash
npm install                      # setup
npm run dev                      # dev server em http://localhost:5173
npm test                         # testes (vitest run)
npx vitest run src/game/physics  # um teste só
npm run check                    # checagem final: tsc + testes + build
```

## Convenções

- Idioma: código (nomes) em inglês; comentários, textos do jogo e commits em pt-BR.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`...).
- Um sistema por arquivo em `src/game/` (player, weapon, drones, juice...). Arquivo passando
  de ~400 linhas deve ser dividido.
- Lógica pura (física, regras, IA de decisão) sem importar Three.js, com teste em `*.test.ts`.
- Cores só da `PALETTE` em `src/game/toon.ts`; materiais via `toon()` (não use MeshStandard).
- Toda mudança de jogabilidade respeita os 4 pilares do GDD; "atirar é gostoso" vem primeiro.

## Armadilhas

- NÃO criar `CLAUDE.md`, `.claude/CLAUDE.md` nem `CLAUDE.local.md` com conteúdo próprio:
  com qualquer um deles, o Claude Code deixa de ler este arquivo. Se um cliente exigir,
  crie só um `CLAUDE.md` com a linha `@AGENTS.md`.
- NÃO criar `AGENTS.override.md`: o Codex passa a ler ele *no lugar* deste arquivo.
- Navegador controlado por automação não consegue travar o mouse (pointer lock). Para
  testar jogando, abra `http://localhost:5173/?debug` (só em dev): pula o menu e expõe
  `window.__game`.
- Qualidade gráfica cai sozinha se o quadro passar de ~22 ms por 2 s (`render/quality.ts`);
  `?low` força o nível 2. Em teste com `frame()` manual ela não muda (dt falso).
- Aba em segundo plano pausa o `requestAnimationFrame`. Em testes no navegador, avance
  quadros na mão: `__game.clock.getDelta = () => 1/60; for (...) __game.frame()`.
- Teste de verdade é jogar: depois de mudar jogabilidade, verifique no navegador (posição,
  acertos, `__game.kills`) além do `npm run check`.
- Objetos decorativos presos a malhas atingíveis (contorno, rosto, anel) precisam de
  `mesh.raycast = () => {}`, senão bloqueiam o tiro.
- Colisão é só AABB: sem rampas nem sólidos girados. Use degraus de até 0.4
  (`stairs()` em `src/game/world/shapes.ts`) e carros/props só a 0° ou 90°.
- O atlas de texturas de canvas (`src/game/world/textures.ts`) lança "atlas cheio" se
  estourar o tamanho: confira o console ao adicionar letreiros.
- No atlas, reserve as artes altas primeiro e reutilize variantes antes de aumentar o
  tamanho: prateleiras desperdiçadas podem ocupar mais que os pixels úteis. `Atlas(size)` tem
  largura `size + 4` e 2 px de margem por arte: quatro artes de 256 não cabem em 1024.
- Drones não têm pathfinding: só voam por cima. Pontos de spawn (`world.droneSpawns`)
  ficam no alto; não crie áreas cobertas grandes onde o jogador fique inalcançável.
- Render passa pelo pipeline de pós (`src/game/render/`): não chame `renderer.render`
  direto e não religue `renderer.info.autoReset` (o pipeline zera a contagem por quadro).
- Para brilhar no bloom, a cor em luz linear precisa passar de ~1.05: use
  `new THREE.Color(PALETTE.x).multiplyScalar(GLOW)`. Cor pura da paleta não brilha.
- Decalques/partículas transparentes: `depthWrite: false`, senão o passe de nanquim
  contorna o recorte do alpha. Sujeira de multiplicar (`grimeKit().mul`) escurece tudo atrás:
  não a estenda sobre vãos abertos (arcos, janelas vazadas).
- NÃO ligar MSAA (`samples`) no alvo do pipeline: em GPU integrada custa mais que o pós todo.
- Atlas `graffiti` (~93%) e `glowSigns` (~88%) estão quase cheios (ocupação no console
  como `bairro: atlas ...`): pichação nova vai para atlas novo.
- Editar código via PowerShell com aspas duplas interpola `$` e crases (template strings
  do TS somem). Use a ferramenta de edição de arquivo ou aspas simples.
- Balanceamento: meça com um "robô de teste" no console (mira automática + `frame()`), mas
  lembre que ele joga melhor que gente — a palavra final é de quem joga.
- `THREE.Raycaster` contra as malhas mescladas do mundo é caro (o chão cobre o mapa todo):
  para tiro e linha de visão, use raio contra os sólidos AABB.
- NÃO usar assets Synty (a licença proíbe uso com IA generativa). Hunyuan3D não vale na
  UE, no Reino Unido nem na Coreia do Sul. Prefira CC0 (Kenney, Quaternius, KayKit, Poly Haven).
- Simulação mora em `src/sim/`: sem Three.js, DOM, `Math.random()` (use `createRng`) nem dt
  variável. `sim.node.test.ts` falha se alguém importar. Regra de jogo roda em `tick(TICK)`
  (60 Hz) no `game.ts`; efeitos visuais usam o dt do quadro. Mira em `__game.inputRef.yaw/pitch`.
- `src/sim/feel.test.ts` congela a sensação aprovada (movimento, cadência, coice): não mude
  os valores sem o dono aprovar. Hit-stop é só visual (`?hitstop=sim` = jeito antigo).
  Câmera de apresentação (`movement-camera.ts`) só mexe em altura, rolagem, FOV e centímetros,
  escalada por `cameraMotionScale()` ("Movimento de câmera reduzido"): pitch/yaw grande tira o
  centro da tela de onde a simulação atira.
- Movimento tático: sem corrida/slide. `sprint` é o nome legado do comando de Shift
  (caminhada silenciosa); `walking` entra no schema/predição e silencia passos remotos também.
- Killcam apresenta a arma depois dos efeitos ao vivo (`replays.present`): os dois viewmodels
  compartilham uniforms. Mira/recarga vêm do replay, nunca do jogador local.
- Agachamento mantém `pos.y` como referência do corpo em pé (pés = y − 0.85).
  Use `crouchAmount` para colisão, olho e hitbox; campo de hitbox novo também entra no rewind.
- Sombra do mundo é estática: mudou algo que projeta sombra, chame `pipeline.refreshShadows()`.
  Objeto móvel usa `render/blobs.ts`, não `castShadow`. O tiro bate em cópias invisíveis do
  cenário: para mudar o que bloqueia tiro, use as opções `shoot`/`solid` do Builder.
- Luz pintada do cenário (pé de parede, rebatida, sombra lilás, névoa) entra por `sceneLit` no
  `Builder.finish()`: cenário usa `toonScene()`; personagem e viewmodel, `toonVertexColors()`.
  Ajuste por mapa em `configureSceneLight`. Acabamento caro fora do pós (sombreamento de boneco,
  sujeira dos mapas) segue o nível do pipeline via `applyDetailQuality`: não leia `?low` da URL.
- Medir desempenho: `await __bench()` em `?debug` (mediana de GPU ms). O valor absoluto oscila
  com a GPU disputada: compare antes/depois na mesma sessão (base num worktree em outra porta).
- Mapas competitivos são dados puros em `src/game/maps/`. Mudou um mapa? Rode
  `npx vitest run src/game/maps -u` para regerar a planta `docs/maps/<id>.svg`.
  Mapa novo precisa de câmeras em `render/bench.ts` e `dev/visual-review.ts`, senão a
  medição e a inspeção caem nos pontos do Bairro (podem ficar dentro das paredes).
  Após redesenho, valide corpo livre e apoio dessas câmeras nos sólidos: `nodeAt` aceita desvio.
- Acerto em personagem vem só de `characters/hitbox.ts` (dados), nunca dos ossos animados.
  GLTFLoader tira pontos dos nomes de osso: use `PropertyBinding.sanitizeNodeName()`.
- Pontos da arma (boca, ejeção, mira) vêm do `WeaponLayout`, também na arma remota, que fica no
  grupo do `Avatar` e é posta pelo `GunRig` (IK) depois do mixer. Material de boneco é por boneco
  (piscar/dano): não compartilhe nem guarde em cache. No viewmodel, tecido/luva/pele usam
  `wear: 0`; peça presa à arma atrás de z = 6 cm some ao mirar (a coronha dobra, `vmAim`).
- Ao indexar geometria animada, preserve normal, cor, pesos/índices dos ossos e `vmSurface`
  das armas; unir só pela posição mistura materiais, quinas e partes animadas.
- Em teste no navegador: desligue o desenho (`__game.pipeline.render = () => {}`), no máximo
  ~300 quadros por chamada, aba própria e confira a porta livre (`netstat -ano`) antes do vite.
- Modo online: `npm run server` (porta 2567) + `?debug&online` (`&sala=<id>` entra numa sala).
  `&modo=duel|tdm|hack` cria os novos modos; entrar por `sala` respeita o modo da sala.
  O ritmo dos comandos segue o relógio real, não o dt falso: em aba de fundo, avance quadros
  num laço que espere tempo real (MessageChannel). Campo novo lido por `stepPlayer` precisa
  entrar em `NetPlayer` e `FLAT_FIELDS` (`src/net/protocol.ts`), senão a predição diverge.
- Servidor autoritativo: rewind e espalhamento nunca saem de dado que o cliente controla ou
  prevê (seq, carimbo). Teleporte de teste só com `SIMBIOSE_DEBUG=1` E `NODE_ENV` ≠ production.
  O SDK do Colyseus reaproveita o buffer de envio: quem atrasa `ws.send` copia os bytes na hora.
- Dano e multiplicador por parte do corpo ficam em `src/sim/weapons.ts` (por arma; com 100 de
  vida, nada de ×4 em arma automática rápida). A hitbox só diz a parte atingida.
- Índices de `ARSENAL` fazem parte do protocolo: acrescente ao fim, nunca reordene.
  Botão direito é mira; hack fica no E. Slots 1–4 trocam em vida; munição é independente.
  `weaponSlot` é desejo persistente: pulso de um tick se perde quando o servidor descarta fila atrasada.
- Corpo usa `solids`; tiro, linha de visão e coleta de chinelo usam `shotBlockers`.
  No Hack, E só declara intenção: canalização e pontos avançam no tick do servidor.
- Decoração sem colisão que sai mais de 0,12 m da parede passa por `clearOfBody`
  (`maps/facades.ts`): o pulo em movimento de qualquer piso alcançável também conta.
- Mexeu no `src/main.ts`? Valide `?characters`, `?hud`, `?debug` e `?online` (entrar por link).
  Preferências do jogador (sensibilidade, FOV, mapa, qualidade) não valem em `?debug`/`?hud`.
- Toda entrega passa por revisão de outro agente/modelo antes do merge (relatórios em `docs/reviews/`).
- Cópia pública sai de `node scripts/export-public.mjs` (um commit, e-mail noreply): `docs/reviews`,
  `docs/screens` e imagens de `docs/concept` ficam fora. Não escreva caminho local (`C:/Users/...`)
  nem e-mail pessoal em arquivo versionado. Licença por pasta: `LICENSE-ASSETS.md`.
- Assets gerados por IA (Suno etc.) têm risco de licença: não adicione trilha do Suno sem o
  dono aprovar. Registre a origem de todo asset externo (`docs/assets.md` e `LICENSE-ASSETS.md`).
- Som passa por `Sfx`/`audio/mixer.ts`; som remoto recebe posição e id da fonte. Salva de
  escopeta toca um disparo, não um por projétil. `?debug` ignora o volume salvo no menu.
- A trilha reage a `Sfx.onCue` e `OnlineGame.events`: som novo do jogador local passa pelo
  `Sfx`. Música e ambiente usam os buses `music`/`ambience` (nada direto em `ctx.destination`).
  Áudio só toca após clique real e com a aba visível (`document.hidden` silencia); veja `__music.state`.
- Bot só dispara arma semiautomática e só recarrega apertando e soltando (`triggerFor` em
  `net/bot-persona.ts`). Teste de mira de bot: duelo em campo aberto com `arenaDrone: false`.
- Teclas 1–4 seguem a barra (1 escopeta, 2 SMG, 3 fuzil, 4 sniper), não a ordem do `ARSENAL`.
- Arma `drone` (drone da OTIMIZA na Arena) não é do `ARSENAL`: todo código que mapeia arma →
  índice (killfeed, replay, espectador) trata `drone` à parte. Alvo de tiro que não é personagem
  entra como caixa em `props` do `gunMessages`. Chamar o drone em teste: `room.send('debug-drone', true)`.
- Espectadores (Modo Live) ficam fora de `state.players`: quem percorre conexões confere
  `audience.has(id)`, e mensagem nova para jogadores também precisa de tratamento na
  `SpectatorView`. Trocar jogador ↔ espectador usa canvas novo e descarta o jogo anterior inteiro:
  na mesma conexão o jogo sai com `dispose(false)` (`session.release()`, não `leave`) e tudo
  que a página liga ao jogo entra no `teardown` do `createOnline` (`src/main.ts`). O papel vem
  do servidor (`vaga {seat}`/`banco`, reenviado no `onReconnect`, lido por `roleOf(room)` em
  `net/role.ts`): só assuma a vaga quando o `NetPlayer` com aquele `seat` estiver no estado.
- Elemento novo na tela do online some durante replay (`body.replay-on` em `online/replay.css`);
  os replays só precisam dos ganchos `shot`/`kill`/`drive` do `online.ts`. Tamanho fixo no HUD
  multiplica `var(--hk)`; fonte nova só OFL/CC0 em `public/fonts`, registrada em `docs/assets.md`.
- `Predict.dispose()` do SDK atual não desfaz `attachAll`: guarde os detachers que ele devolve e
  chame-os antes do `dispose`, senão o preditor descartado volta a anexar jogadores.
- Mensagem de abate/tiro chega antes do patch de estado (vida, `life`): lógica disparada pela
  mensagem não confere `hp` no mesmo quadro; espere ou confira depois.
- Teste de rede com relógio real (lag, rewind) pode oscilar com a suíte inteira em paralelo:
  rode o arquivo sozinho antes de concluir que quebrou.

## Limites

- NÃO editar: `package-lock.json` à mão, `dist/`, `node_modules/`.
- NÃO commitar segredos — use variáveis de ambiente; documente as chaves em `.env.example`.
- Pedir confirmação antes de: publicar o jogo (itch.io, Vercel) ou a cópia pública, push em `main`, gastar com
  APIs pagas (geração 3D, voz, música).

## Trabalho com vários agentes

- Uma tarefa por agente. Cada agente que edita em paralelo tem o seu worktree **e** a sua
  branch — nunca dois agentes na mesma pasta.
- Toda tarefa delegada diz: alvo, mudança esperada, arquivos que pode editar, recursos
  compartilhados que pode usar (porta, banco, fila) e como provar que terminou.
  Fora desse escopo, pergunte a quem coordena.
- Em paralelo, cada agente usa uma porta de dev própria (`npx vite --port 517X`) e de servidor
  (`PORT=257X npm run server` + `&servidor=ws://localhost:257X`), abas próprias no Chrome e
  logs com nome único (o scratchpad é compartilhado).
- Worktree de subagente nasce de `origin/HEAD`, não da branch local: para trabalhar sobre uma
  branch de integração, o agente roda `git reset --hard <branch>` antes de começar.
- Planos que precisam sobreviver à sessão vão em `docs/plans/AAAA-MM-DD-tema.md`, com
  responsável, escopo, dependências e estado de cada tarefa.
- Ao terminar, entregue: branch/commit, o que mudou (até 3 frases), comandos de verificação
  rodados com o resultado, e o que ficou pendente.
- Quem coordena integra (merge) e é quem edita este arquivo. Os outros agentes **propõem**
  regras novas para `Armadilhas` na entrega.
- Mudança grande passa por revisão de outro agente, de preferência de outro modelo.

## Definição de pronto

1. `npm run check` rodado e passando — rode, não presuma.
2. Mudança de jogabilidade verificada no navegador com `?debug`.
3. Regra nova proposta se um comando, convenção ou armadilha mudou.
