# Personagens 3D com IA: da folha de arte ao boneco jogável

> Pesquisa rápida (15 min), 2026-10-02. Objetivo: decidir se vale pagar ~US$ 20/mês por
> geração 3D com IA para trocar o manequim Quaternius pelas personagens das folhas de arte
> (`docs/concept/personagens/*.png`). Preços e recursos mudam rápido: confira na hora de pagar.

## Resumo em 3 frases

1. **Para começar, use o Meshy 6 (plano Pro, US$ 20/mês)**: recebe frente/lado/costas, faz
   rig humanoide automático, tem API REST que um agente usa sem tela, e no plano pago o modelo
   é seu (sem atribuição obrigatória). O **Tripo** é a segunda opção quase empatada e mais barata
   via API avulsa (US$ 0,01/crédito, sem mensalidade).
2. **Não dá para reaproveitar o rig da IA direto**: o nosso esqueleto (Quaternius UAL, 53 ossos
   com nomes `DEF-hips`, `DEF-upper_arm.L`...) é diferente do que as IAs geram; o caminho mais
   confiável é **re-esqueletar no Blender sem interface (headless)** — vestir a malha nova no
   esqueleto UAL — e assim os 19 clipes atuais funcionam sem retarget.
3. Alvo: **~8–10 mil triângulos por personagem** (o manequim de hoje tem ~13,7 mil), uma
   textura de 1024 px, e dois níveis de detalhe extras gerados com `gltf-transform`/`gltfpack`.
   Teste completo com a Lia: **cerca de US$ 20 (um mês de Meshy Pro) ou menos de US$ 5 via
   API do Tripo**.

## O que temos hoje (medido no repositório)

- `public/assets/characters/mannequin.glb`: ~13.743 triângulos, 53 ossos estilo Rigify
  (`root`, `DEF-hips`, `DEF-spine.001..003`, `DEF-neck`, `DEF-head`, braços, dedos, pernas),
  19 animações embutidas, "no lugar" (o jogo move o boneco).
- `src/game/characters/model.ts` troca os materiais por `toon()` e cria um **contorno de casca
  invertida** (uma segunda malha) — ou seja, cada personagem desenha a malha **duas vezes**.
  Isso pesa na conta de triângulos.
- A folha da Lia (frente/lado/costas em pose A, fundo liso) é **quase ideal** para IA: vistas
  limpas, pose aberta, cores chapadas. O que a IA vai errar: dedos, rosto (olhos de anime
  costumam virar "bonequinho de borracha"), alça amarela cruzada e o rádio pendurado.

## Comparação das ferramentas

Legenda: ✔ sim · ~ parcial · ✘ não.

| Ferramenta | Anime/cel | Várias vistas | Topologia / polígonos | Textura | Rig automático | Preço | Licença comercial | API / sem tela |
|---|---|---|---|---|---|---|---|---|
| **Meshy 6** | Boa; personagens estilizados mantêm proporção e rosto melhor que Tripo/Hunyuan nos testes | ✔ Multi-Image to 3D (até 4 imagens) | Triângulos ou quads; remesh com alvo de polígonos (5 créditos) | A mais caprichada dos comerciais; 2K/4K, PBR | ✔ humanoide, 5 créditos; exporta moldes Mixamo, **Blender Rigify** (beta), UE, Unity | Grátis 100 cr/mês; **Pro US$ 20/mês = 1.000 cr**; multi-vista 20–35 cr | Grátis = CC BY 4.0 (precisa creditar); pago = privado e seu | ✔ REST API (créditos de API comprados à parte no painel) |
| **Tripo 3.0 / P1** | Boa; tem modo "cartoon"; mais rápido para iterar | ✔ Multiview to 3D | **Quad mesh** (+5 cr) e **Smart Low-poly** (+10 cr) — o melhor para jogo pronto | PBR, HD (+10) | ✔ 25 cr (UniRig) + retarget de animação 10 cr | Studio Pro US$ 20/mês (3.000 cr, anual); **API avulsa US$ 0,01/cr** (multi-vista 20–30) | Grátis = público e **sem uso comercial**; pago = privado e comercial | ✔ REST API + SDK |
| **Rodin Gen-2 / 2.5 (Hyper3D)** | Média; o forte é realismo e detalhe | ✔ concat/fuse | **Quads limpos 18k/50k**, força pose T/A | 4K PBR | ~ (pose T/A ajuda; sem rig próprio forte) | Creator US$ 30/mês (~60 modelos); API ~0,5 cr × US$ 1,50 ≈ US$ 0,75/modelo | Pago = comercial | ✔ API (Business US$ 120/mês ou terceiros como fal.ai) |
| **Hunyuan3D 3.0/3.1 (Tencent)** | Boa em estilizado; versões abertas preservam o "desenho" | ✔ 3.0 até 4 vistas, 3.1 até 8 | Triângulos densos; precisa decimar | PBR (+custo) | ✘ | API pay-per-use ≈ US$ 0,23–0,38/modelo (Tencent Cloud e revendas) | 2.1 aberta: comercial **exceto UE, Reino Unido e Coreia do Sul**; 3.x só via nuvem | ✔ Tencent Cloud / revendas |
| **TRELLIS 2 (Microsoft)** | Boa em estilizado (textura mais simples ajuda) | ~ (uma imagem é o forte) | Denso; precisa decimar e retopologia | Básica | ✘ | Grátis, mas precisa GPU NVIDIA forte (ou nuvem paga) | **MIT** — a mais limpa | ~ script Python/ComfyUI; sem API oficial |
| **UniRig** (só rig, aberto) | — | — | — | — | ✔ rig de qualquer malha (SIGGRAPH 2025) | Grátis (GPU) | Aberto | Script / ComfyUI |

**Leitura para leigo:**
- **Meshy** = melhor "acabamento" e exporta com cara de esqueleto Rigify (nosso tipo).
- **Tripo** = melhor "pronto para jogo" (malha em quadrados e versão leve com um botão) e
  dá para pagar só o que usar, sem assinatura.
- **Rodin** = mais detalhe, mais caro; exagero para anime.
- **Hunyuan / TRELLIS** = grátis ou quase, mas exigem placa de vídeo forte e mais trabalho
  depois; o Hunyuan tem restrição geográfica na licença (atrapalha publicar na Europa).
- Nenhuma gera "cel shading" de fábrica: a textura vem com sombra pintada. Para o nosso
  visual, pedir **textura sem iluminação** (ou cores chapadas) e deixar o `toon()` sombrear.

## Como reaproveitar as 19 animações que já temos

| Caminho | Como funciona | Prós | Contras | Veredito |
|---|---|---|---|---|
| **A. Re-esqueletar no Blender headless** | Script Python (`blender -b -P script.py`) importa a malha da IA, encaixa no esqueleto UAL do `mannequin.glb` e calcula os pesos (`automatic weights`); exporta GLB | Animações **idênticas** às de hoje; `hitbox.ts` e `locomotion.ts` continuam valendo; agente roda sem tela | Pesos automáticos erram em axilas/dedos; a malha precisa estar na **mesma pose A** do manequim | **Recomendado** |
| B. `SkeletonUtils.retargetClip` (Three.js) | Converte o clipe UAL para o esqueleto gerado pela IA em tempo de execução | Sem Blender | Fórum do Three.js relata pés invertidos e mãos ao contrário entre esqueletos diferentes; precisa mapa de nomes e ajuste de pose de repouso | Só se A falhar |
| C. Rig da própria IA + retarget dela | Meshy exporta molde "Blender Rigify"; Tripo faz retarget (10 cr/animação) | Rápido | Os nossos clipes não estão na biblioteca deles; nomes do Rigify do Meshy ainda precisam conferir com `DEF-*` | Testar o molde Rigify do Meshy no passo 3 — se os nomes baterem, vira o caminho mais curto |
| D. Mixamo | Sobe a malha, ele rigga, baixa animações dele | Grátis | Site com tela (sem API), não usa nossos clipes, esqueleto diferente | ✘ |
| E. AccuRIG 2 (Reallusion) | Programa grátis de rig, exporta FBX | Grátis, rig bom com dedos | Programa com tela (agente não usa); esqueleto diferente do nosso | Plano B manual |

## Otimização: quanto pesa cada personagem

Estimativa para **10 jogadores em GPU integrada** (não medida no jogo ainda — medir no passo 5):

- **Orçamento**: ~8–10 mil triângulos por personagem perto da câmera. Com o contorno de casca
  invertida, 10 bonecos × 10 mil × 2 = ~200 mil triângulos animados, dentro do razoável para
  uma GPU integrada junto com o cenário. Hoje já são ~13,7 mil × 2 por boneco.
- **Níveis de detalhe (LOD)**: LOD0 ~9k (até ~10 m), LOD1 ~4k (10–30 m), LOD2 ~1,5k (longe).
  O Three.js tem `THREE.LOD`; com malha animada cada nível precisa do mesmo esqueleto (vem
  de graça se todos os níveis forem decimados do mesmo GLB já riggado).
- **Materiais**: **1 material, 1 textura de 1024 px** (cor chapada, sem mapa de metal/rugosidade,
  que o `toon()` ignora). Menos chamadas de desenho importa mais que triângulos em GPU integrada.
- **Ferramentas (linha de comando, um agente roda sozinho)**:
  - `npx @gltf-transform/cli simplify in.glb out.glb --ratio 0.5 --error 0.001` (usa meshoptimizer;
    para quando o erro passa do limite, então nem sempre atinge a proporção pedida).
  - `gltfpack` (meshoptimizer): decimação que respeita malha animada (melhoria recente para
    malhas "skinned") + compressão `-cc` — o jogo já carrega com `MeshoptDecoder`.
  - Textura: `gltf-transform resize --width 1024` e `webp`/`ktx2`.
- **Atenção**: decimar **antes** de riggar dá menos erro de peso; peça baixa contagem já na
  geração (Smart Low-poly do Tripo ou Remesh do Meshy com alvo ~10k).

## Plano em 5 passos para testar com a Lia

| # | Passo | Quem | Custo |
|---|---|---|---|
| 1 | **Preparar as imagens**: recortar frente, lado e costas da folha em PNGs quadrados com fundo branco, sem os textos. | Agente (script) | US$ 0 |
| 2 | **Gerar 2 candidatas**: Meshy Multi-Image (textura 2K, remesh ~10k) e Tripo Multiview (quad + Smart Low-poly), 2–3 tentativas cada, via API. Pedir textura sem sombra pintada. | Agente + dono escolhe a melhor | Meshy Pro US$ 20 (sobra muito crédito) **ou** Tripo API ~US$ 1–3 |
| 3 | **Encaixar no esqueleto UAL**: script do Blender headless coloca a malha no esqueleto do `mannequin.glb` e copia os 19 clipes. Em paralelo, testar o molde "Blender Rigify" do Meshy. | Agente | US$ 0 (Blender é grátis) |
| 4 | **Otimizar**: `gltfpack`/`gltf-transform` → LOD0 ~9k, LOD1 ~4k, LOD2 ~1,5k, textura 1024; salvar como `public/assets/characters/lia.glb`; registrar origem em `docs/assets.md`. | Agente | US$ 0 |
| 5 | **Provar no jogo**: trocar o manequim pela Lia em `?debug`, 10 bonecos na tela, conferir quadro < 22 ms, hitbox e animações; dono compara com a folha e decide se assina. | Agente + dono joga | US$ 0 |

**Custo total estimado do teste: US$ 3–20**, mais ~2–4 h de agente. Se aprovar, as outras
personagens (Caio, Ivo...) custam poucos dólares cada; se o Pro mensal virar desperdício,
voltar para API avulsa. Lembrete do AGENTS.md: **gastar com API paga exige confirmação do dono**.

## Riscos

- **Licença**: usar plano pago (Meshy/Tripo grátis exigem atribuição ou proíbem uso comercial).
  Registrar ferramenta, data e plano de cada modelo gerado em `docs/assets.md`.
- **Rosto anime**: a IA tende a esculpir olhos/boca em relevo. Plano B barato: rosto pintado
  na textura (ou decalque) em vez de geometria.
- **Proporção**: se a Lia sair com altura diferente de ~1,83 m, ajustar escala no Blender para
  não quebrar `hitbox.ts`.

## Fontes

- Meshy — preços da API: <https://docs.meshy.ai/en/api/pricing>
- Meshy — multi-vista (guia 2026): <https://www.meshy.ai/tutorials/multi-view-image-to-3d>
- Meshy — licença comercial: <https://help.meshy.ai/en/articles/9992001-can-i-use-my-generated-assets-for-commercial-projects>
- Meshy — auto-rig e moldes de esqueleto: <https://www.meshy.ai/features/ai-auto-rigging>, <https://www.meshy.ai/tutorials/how-to-use-mixamo-with-meshy>
- Meshy — pipeline com API para jogos: <https://github.com/meshy-dev/game-asset-pipeline>
- Tripo — preços da API: <https://developers.tripo3d.ai/en/pricing>; planos: <https://www.tripo3d.ai/pricing>
- Tripo — licença: <https://www.tripo3d.ai/blog/ai-3d-commercial-use-license>, <https://makerstack.co/reviews/tripo-ai-review/>
- Rodin Gen-2 — API: <https://developer.hyper3d.ai/api-specification/rodin-generation-gen2>; review 2026: <https://makerstack.co/reviews/hyper3d-rodin-review/>
- Hunyuan3D 3.x — API e multi-vista: <https://www.3daistudio.com/Platform/API/Hunyuan3D>, <https://triposr.org/blog/hunyuan3d-versions>
- Hunyuan vs TRELLIS (licenças): <https://triposr.org/blog/hunyuan3d-vs-trellis>, <https://www.3daistudio.com/blog/trellis-2-vs-hunyuan-3d-differences-explained>
- Comparativos 2026: <https://www.3daistudio.com/blog/best-3d-model-generation-apis-2026>, <https://ideate.xyz/blogs/posts/ai-3d-model-comparison-trellis-tripo-meshy-rodin-hunyuan>, <https://www.3daistudio.com/blog/best-ai-3d-character-and-avatar-generators-2026>
- Quaternius UAL: <https://quaternius.com/packs/universalanimationlibrary.html>
- Three.js retarget (problemas): <https://discourse.threejs.org/t/skeletonutils-retarget-doesnt-work-with-mixamorig-skeleton-inverted-feet-backward-hands/54892>
- AccuRIG 2: <https://www.cgchannel.com/2025/07/rig-and-animate-3d-characters-for-free-with-accurig-2-0/>
- UniRig: <https://github.com/VAST-AI-Research/UniRig>
- Rokoko (retarget no Blender): <https://github.com/Rokoko/rokoko-studio-live-blender>
- gltf-transform `simplify`: <https://gltf-transform.dev/modules/functions/functions/simplify>; meshoptimizer/gltfpack: <https://github.com/zeux/meshoptimizer>
