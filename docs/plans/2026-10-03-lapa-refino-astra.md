# Refino visual da Lapa

Responsável: worker Astra, revisão e integração pelo Codex coordenador.
Branch: `drvitalaraujo/lapa-refino-astra`, base `68153b9`.

Escopo: dar identidade aos lotes do casario, acabamento ao patrimônio, comércio,
praça e skyline. Preservar integralmente os sólidos, spawns e navegação existentes.
Arte procedural autoral, PALETTE/toon, atlas exclusivo e batching do Builder.
Referências: somente as referências já registradas no plano original da Lapa;
o comércio e a propaganda são ficcionais, não uma reconstrução de lojas reais.

| Tarefa | Dependência | Estado |
| --- | --- | --- |
| Capturas e métricas antes, quatro vistas fixas | Vite próprio | Concluída |
| Casario, materiais, praça e entorno | Dados existentes | Concluída |
| Check, capturas depois e console | Arte final | Concluída; 404 testes e build |
| Revisão do diff e integração | Entrega com commit | Codex coordenador |

Porta autorizada pelo coordenador: 5176 (5174 preexistente preservada).
Não é necessário servidor online porque os dados e a simulação não mudam.
Capturas headless 1440 × 900, qualidade 0; contagens incluem pipeline completo,
não medem GPU integrada. Comparar mesmas câmeras, sem HUD ou arma.

Resultado e métricas: `docs/reviews/2026-10-03-lapa-refino-astra-entrega.md`.
Só os labels foram ajustados nos dados: nomes das casas de shows passam ao atlas
autoral, placa de rua fica menor. Planta SVG não mudou após `vitest maps -u`.
