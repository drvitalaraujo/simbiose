// Comando do jogador: tudo que a simulação precisa saber da entrada em UM tick.
// Objeto puro e serializável: na fase de rede, é isto que o cliente manda ao servidor.

export interface PlayerCommand {
  /** Número sequencial do tick (para a reconciliação com o servidor). */
  seq: number;
  /** Slot desejado (persistente): 1–4 equipa; 0/ausente mantém a arma. */
  weaponSlot?: number;
  /** Andar para o lado: -1 (esquerda) a 1 (direita). */
  moveX: number;
  /** Andar para frente: -1 (trás) a 1 (frente). */
  moveZ: number;
  /** Shift: caminhada silenciosa (nome legado do protocolo). */
  sprint: boolean;
  /** Pulo apertado neste tick (borda de descida, não "segurando"). */
  jump: boolean;
  /** C (Ctrl alternativo): agachar. */
  crouch?: boolean;
  /** V: golpe; G: arremesso de chinelo. */
  melee?: boolean;
  throwSlipper?: boolean;
  /** Q: granada explosiva, uma por vida. */
  grenade?: boolean;
  /** Ângulos absolutos da mira (radianos), mesma convenção da câmera. */
  yaw: number;
  pitch: number;
  /** Gatilho segurado. */
  fire: boolean;
  /** R segurado; a arma detecta a borda para não repetir recargas. */
  reload?: boolean;
  /** Botão direito: mirar pela arma (E continua sendo hack). */
  aim?: boolean;
  /** Botão alternativo segurado (hoje: hackear). */
  alt: boolean;
}

export function emptyCommand(seq = 0): PlayerCommand {
  return { seq, moveX: 0, moveZ: 0, sprint: false, jump: false, yaw: 0, pitch: 0, fire: false, alt: false };
}
