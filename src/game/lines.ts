// Falas do treino (Bit, OTIMIZA, Kaia). Só texto: nenhuma regra de jogo aqui.

// Falas do Bit (o primeiro drone hackeado, narrador e alívio cômico — ver GDD).
export const BIT = {
  firstHack: 'Eita... tô livre? Ninguém mandando eu sorrir? Valeu, Kaia! Bora quebrar uns colegas!',
  overload: 'Três drones é o limite do esquadrão! O mais velho virou fogos de artifício. Descanse em paz, parça.',
  allyDown: 'Perdemos um! Morreu do jeito que viveu: livre.',
  bossHacked: 'VOCÊ HACKEOU O GERENTE! Agora ele trabalha pra gente. Primeira reunião: demitir a OTIMIZA.',
  bossDown: 'O Gerente caiu! Alguém avisa o RH da OTIMIZA.',
  bossPane: 'O Gerente travou! Segura o E nele, rápido, antes que ele reinicie!',
};

// Abertura: a premissa inteira em ~15 s (pensada para quem chega numa live no meio)
export const INTRO = [
  { speaker: 'OTIMIZA', line: 'Bom dia, Neo-São Paulo! O Índice de Felicidade Bruta está em 98,7%. Falta tão pouco!', seconds: 4.5 },
  { speaker: 'KAIA', line: 'Falta pouco pra quê? Pra ninguém mais conseguir ficar triste?', seconds: 3.5 },
  { speaker: 'KAIA', line: 'Fui eu que escrevi essa métrica. Agora eu vou apagar ela. Bairro por bairro.', seconds: 4 },
  { speaker: 'OTIMIZA', line: 'Detectamos insatisfação. Enviando atendimento :)', seconds: 3 },
];
