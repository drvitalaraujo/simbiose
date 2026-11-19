# Arsenal competitivo e mira — 2026-10-03

Responsável: Codex, branch `feat/arsenal-ads`. Revisor solicitado: GPT 6 Astra,
esforço baixo, somente leitura. Nenhum asset externo ou API paga.

## Pesquisa e decisão

- [Arsenal oficial de VALORANT](https://playvalorant.com/en-us/arsenal/): categorias
  separadas de SMG, fuzil, sniper e escopeta, com funções de perto, versatilidade,
  precisão e controle de posição. Adotamos essas funções, com nomes e silhuetas próprios.
- [Valve — Second Shot](https://blog.counter-strike.net/second-shot/): recuperação de
  precisão e diferença entre tiro isolado, rajada e spray criam espaço para habilidade;
  a Valve também trata os valores como ponto inicial a medir jogando. Mantivemos a
  recuperação de coice da MK-2 aprovada, sem copiar padrões de spray ou números de CS.
- [Halo — Technical Preview Outcomes](https://www.halowaypoint.com/en-us/news/technical-preview-outcomes):
  funções específicas e resposta dos jogadores orientam ajustes do sandbox. A nossa
  conclusão é começar com quatro categorias distinguíveis e medir antes de expandir.

São referências de design, incluindo publicações históricas; não representam estatísticas
atuais do meta. Os valores abaixo são escolhas iniciais próprias para SIMBIOSE.

## Valores implementados

| Arma | Função | Dano torso perto | Cabeça | Carregador/reserva | Cadência nominal | Recarga | Zoom |
|---|---|---:|---:|---:|---:|---:|---:|
| Gambiarra MK-2 | Fuzil versátil | 20 | ×2 | 30/120 | 9/s | 1,35 s | 1,35× |
| Faísca | SMG de pressão próxima | 17 | ×1,8 | 36/144 | 13/s | 1,50 s | 1,2× |
| Linha Morta | Sniper de precisão | 80 | ×1,5 | 5/20 | 1/1,15 s | 2,40 s | 4× |
| Quebra-Beco | Escopeta de corredor | 14 × 8 projéteis | ×1,25 | 6/30 | 1/0,8 s | 2,10 s | 1,15× |

Cadência efetiva é quantizada pelo tick de 60 Hz: MK-2 dispara a cada 7 ticks
(~8,57/s), SMG a cada 5 (~12/s). Com todos os acertos no torso a curta distância,
TTK teórico contra 100 HP: fuzil ~0,467 s, SMG ~0,417 s; sniper precisa de dois
acertos no torso e mata com um na cabeça; escopeta pode matar com uma salva próxima
se projéteis suficientes acertarem. Isso não prevê desempenho real de jogadores.

Queda de dano: fuzil 18→40 m até 60%; SMG 10→28 m até 40%; sniper 100→160 m até
85%; escopeta 6→20 m até 15%. Alcances: 120/80/200/45 m. Dano e munição estão no
catálogo puro `src/sim/weapons.ts`; nenhuma regra depende de Three.js ou do DOM.

## Escopo concluído

| Tarefa | Dependência | Estado |
|---|---|---|
| Catálogo, munição, cadência, gatilho semi e ADS em passo fixo | Pesquisa/GDD | Implementado e testado |
| Salva de escopeta, dano por arma e loadout validado pelo servidor | Catálogo | Implementado e testado |
| Predição/schema/FLAT_FIELDS com arma, gatilho e progressão ADS | Simulação | Implementado e testado |
| Modelos procedurais, zoom, luneta, sons, HUD e painel B | Catálogo/predição | Implementado; capturas inspecionadas |
| Revisão GPT 6 Astra, esforço baixo | Implementação | Duas revisões; achados corrigidos; recomenda merge após check/browser |
| Check completo e reteste browser online após ajustes | Todos | Passando: 320 testes + build; browser sem erros; relatório em docs/reviews/2026-10-03-arsenal-mira.md |

## Regras de implementação

- Uma principal + Chinelada. B/1–4 no painel escolhem; no treino reinicia, no online
  só muda no próximo nascimento. Não há troca de munição gratuita durante a luta.
- Botão direito é ADS; E mantém o verbo de hack. ADS cancela corrida, sem modificar
  as constantes de movimento. Slide, melee, morte e recarga suprimem a mira.
- Zoom usa razão óptica (tangente do meio FOV), com sensibilidade proporcional. A
  luneta não muda o raio: disparo nasce do olho e continua seguindo a mira real.
- Sniper exige ADS completo e estabilidade: andar ou pular adiciona dispersão.
  O indicador usa a mesma função de dispersão da sim; a luneta avisa para parar.
- Espalhamento vem do RNG secreto do servidor, nunca de sequência/carimbo do cliente.
  Uma salva usa um rewind, um cartucho, um coice e um evento visual. Soma dano por
  alvo antes de atualizar vida/abate; projéteis não atravessam paredes ou aliados.
- Recarga é por carregador nas quatro categorias, incluindo a escopeta com célula:
  preserva balas, transfere reserva apenas na conclusão e pode ser interrompida.
- MK-2 mantém movimento, cadência, recoil, hip spread e áudio aprovados; no treino
  cada acerto continua causando 1 HP de drone, mesmo longe. PvP mantém seu falloff.
- Modelos das três novas armas são protótipos originais construídos com primitivas e
  materiais toon/paleta, reutilizando o rig de mãos. Trocas liberam recursos GPU.

## Avaliação humana seguinte

Validar conforto do ADS/sensibilidade, chance real de acerto da escopeta, domínio da
SMG nos corredores e sniper nos mapas. Não declarar balanceamento final pelo robô.
Bots permanecem usando MK-2; escolha tática de armas por bots, secundárias, economia
de compra, drops e skins são expansões futuras. O protocolo mudou: servidor e cliente
precisam rodar esta versão; reinicie o servidor de desenvolvimento após atualizar.
