# Assets externos

Registro de origem e licença de todo arquivo que não foi feito no projeto (regra do
`AGENTS.md`). Antes de adicionar algo: licença livre (de preferência CC0), nada pago, sem
Synty (proíbe uso com IA), sem Mixamo bruto redistribuído e sem trilha do Suno sem o dono aprovar.

| Arquivo | O que é | Autor | Licença | Origem | Baixado em |
|---|---|---|---|---|---|
| `public/assets/characters/mannequin.glb` | Boneco humanoide rigado (53 ossos) + 19 animações | Quaternius | CC0 1.0 | Universal Animation Library (versão grátis), <https://quaternius.com/packs/universalanimationlibrary.html> / <https://quaternius.itch.io/universal-animation-library>, via espelho glTF fiel ao pacote do itch.io: <https://github.com/J-Ponzo/gltf-universal-animation-library> | 2026-10-02 |
| `public/assets/characters/LICENSE-quaternius-ual.txt` | Texto da licença CC0 que vem com o pacote | Creative Commons | — | mesmo espelho acima | 2026-10-02 |
| `src/game/audio/music*.ts`, `src/game/audio/ambience.ts` | Trilha (5 estilos) e ambiente sonoro por mapa | SIMBIOSE (agentes) | autoral | Trilha e ambiente gerados por código, autorais: síntese Web Audio em tempo real, sem samples, sem Suno, sem download | 2026-10-09 |
| `public/assets/maps/{bairro,pelourinho,lapa,favela}.webp` | Miniaturas 400×225 dos cards de mapa do menu | Projeto (captura do próprio jogo) | do projeto | Renderizadas no `?debug&map=<id>` (qualidade 0, sem HUD nem arma), recortadas em 16:9 e salvas em WebP 0,8; câmeras: Bairro (14, 2.5, 20), Pelourinho (49, 2.2, −6, igreja), Lapa (7, 2.5, 21, Arcos), Favela (−6, 4.2, 23, quadra) | 2026-10-09 |
| `public/fonts/{dela-gothic-one,barlow-condensed}-latin-*.woff2` | Fontes da interface (títulos de cartaz: Dela Gothic One 400; texto/números: Barlow Condensed 600, 700, 800, 800 itálico, 900 itálico), só o subconjunto latino | The Dela Gothic Project Authors (syakuzen) · The Barlow Project Authors (Jeremy Tribby) | SIL OFL 1.1 (textos em `public/fonts/OFL-*.txt`) | Pacotes `@fontsource/dela-gothic-one@5.1.0` e `@fontsource/barlow-condensed@5.1.0` (npm, via cdn.jsdelivr.net), arquivos WOFF2 sem alteração; empacotadas no jogo, nada carregado de CDN em tempo de jogo | 2026-10-21 |

## Como o `mannequin.glb` foi gerado

Do `AnimationLibrary_Godot_Standard.gltf` original (46 animações, 4 MB) ficaram só as
animações usadas e o arquivo foi comprimido com meshopt (gltf-transform 4.5, via `npx`, sem
dependência no projeto). Resultado: 794 KB.

Animações mantidas: `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`,
`Crouch_Idle_Loop`, `Crouch_Fwd_Loop`, `Jump_Start`, `Jump_Loop`, `Jump_Land`, `Death01`,
`Hit_Chest`, `Hit_Head`, `Roll`, `Pistol_Idle_Loop`, `Pistol_Aim_Neutral`, `Pistol_Aim_Up`,
`Pistol_Aim_Down`, `Pistol_Shoot`, `Pistol_Reload`.

```bash
# 1) filtrar as animações (script node que apaga as outras de "animations" no .gltf)
# 2) limpar, reamostrar e comprimir
npx @gltf-transform/cli prune ual_filtrado.gltf p.glb
npx @gltf-transform/cli resample p.glb r.glb
npx @gltf-transform/cli meshopt r.glb mannequin.glb
```

Para carregar: `GLTFLoader` com `setMeshoptDecoder(MeshoptDecoder)` (ver
`src/game/characters/model.ts`).

## Sons (2026-10-03)

| Arquivos em `public/audio/` | Originais | Autor | Licença | Origem |
|---|---|---|---|---|
| `rifle.ogg`, `smg.ogg`, `sniper.ogg`, `shotgun.ogg` | `AR-15/D_32P.wav`, `Carl Gustav M45/G_31P.wav`, `Tikka/W_29P.wav`, `Nova/O_21P.wav` | Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney | CC0 1.0 | [Free Firearm Sound Library](https://opengameart.org/node/21826), arquivo Prepared SFX Library.7z |
| `step-0.ogg` até `step-3.ogg` | `footstep_concrete_000.ogg` até `003` | Kenney | CC0 1.0 | [Impact Sounds](https://kenney.nl/assets/impact-sounds) |
| `mag-out.ogg`, `mag-in.ogg`, `bolt.ogg`, `metal.ogg` | `impactMetal_light_000`, `impactMetal_medium_001`, `impactMetal_light_002`, `impactMetal_medium_003` | Kenney | CC0 1.0 | mesmo pacote |
| `slap.ogg`, `debris.ogg` | `impactPunch_heavy_001`, `impactGeneric_light_002` | Kenney | CC0 1.0 | mesmo pacote |

Baixados em 2026-10-03. Gravações recortadas no ataque, convertidas para mono/44,1 kHz,
normalizadas com folga e com fade na cauda. Total: cerca de 85 KB (14 OGG). `sources.json`
registra cortes e arquivos exatos; `scripts/prepare-audio.py` reproduz o preparo com ffmpeg
a partir dos pacotes extraídos. OGG pode acrescentar pequeno overshoot na codificação.
`LICENSE-kenney.txt` é a licença original do pacote; `LICENSE-firearms.txt` é um registro
da origem/licença declarada na página, pois o arquivo não traz licença separada.

As camadas eletrônicas, graves e confirmações são síntese original em
`src/game/audio/synthesis.ts`, combinadas às gravações pelo `sfx.ts`.

A versão grátis não tem passadas de lado/de costas; o boneco gira as pernas e toca a passada
de trás para frente (ver `locomotion.ts`). A *Universal Animation Library 2* e a versão PRO
(pagas) têm strafes, mas só entram com aprovação do dono.

## Viewmodel (arma + mãos em primeira pessoa)

Sem asset externo: a "Gambiarra MK-2" e as luvas são geometria feita em código
(`src/game/viewmodel/model.ts`), com cores da `PALETTE`. Nenhum GLB foi baixado. A forma
segue as folhas do projeto em `docs/concept/armas/` (`gambiarra-mk-2.png` e
`maos-mk-2-primeira-pessoa.png`); comparação em `docs/screens/viewmodel-v2-comparacao.jpg`.

- `public/assets/maps/patacho.webp`: captura autoral do mapa Patacho (atualizada em 2026-11-18), com materiais, piscinas naturais, arrecifes, jangadas e arquitetura procedurais próprios. Fonte: `docs/screens/patacho-refino.png`. Referências de paisagem em `docs/plans/2026-11-14-patacho.md`; nenhuma foto externa incorporada.
