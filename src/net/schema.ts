// Estado sincronizado da sala e formato da entrada (Colyseus 0.18 + @colyseus/schema 5).
// Compartilhado entre servidor e cliente. O cliente NUNCA escreve aqui: só manda
// `MoveInput` (comandos); quem move o jogador é o servidor, rodando `stepPlayer`.
import { schema, t, type SchemaType } from '@colyseus/schema';

/**
 * Um jogador (gente ou bot). Os campos numéricos da sim espelham `PlayerState` de
 * src/sim/player.ts em forma achatada (a predição do Colyseus só reconcilia escalares de UM
 * objeto). float64 para a predição do cliente bater bit a bit com o servidor.
 */
export const NetPlayer = schema({
  name: t.string(),
  team: t.string(),
  x: t.float64(),
  y: t.float64(),
  z: t.float64(),
  vx: t.float64(),
  vy: t.float64(),
  vz: t.float64(),
  yaw: t.float64(),
  pitch: t.float64(),
  walking: t.boolean(),
  onGround: t.boolean(),
  sinceGround: t.float64(),
  recoil: t.float64(),
  hp: t.float64(),
  sinceHurt: t.float64(),
  cooldown: t.float64(),
  ammo0: t.uint16(), ammo1: t.uint16(), ammo2: t.uint16(), ammo3: t.uint16(),
  reserve0: t.uint16(), reserve1: t.uint16(), reserve2: t.uint16(), reserve3: t.uint16(),
  equipRemaining: t.float64(),
  weaponIndex: t.uint8(),
  selectedWeapon: t.uint8(),
  aimAmount: t.float64(),
  fireHeld: t.boolean(),
  ammo: t.uint16(),
  reserveAmmo: t.uint16(),
  reloadRemaining: t.float64(),
  reloadHeld: t.boolean(),
  sliding: t.boolean(),
  slideTime: t.float64(),
  slideCooldown: t.float64(),
  slideHeld: t.boolean(),
  crouching: t.boolean(),
  crouchAmount: t.float64(),
  grenadeReady: t.boolean(), grenadeHeld: t.boolean(),
  slipperReady: t.boolean(),
  slipperCooldown: t.float64(),
  meleeHeld: t.boolean(),
  throwHeld: t.boolean(),
  /** Onde nasceu desta vez (e volta se cair do mapa). Muda a cada renascimento. */
  spawnX: t.float64(),
  spawnY: t.float64(),
  spawnZ: t.float64(),
  /** Para onde olhar ao nascer (a mira é do cliente; o servidor só sugere). */
  spawnYaw: t.float32(),
  /** Bot do servidor (sempre mostrado com a etiqueta BOT). */
  bot: t.boolean(),
  kills: t.uint16(),
  deaths: t.uint16(),
  /** Ping que o próprio cliente mede e informa (ms); bots = 0. */
  ping: t.uint16(),
  /** Conta os renascimentos: mudou = acabou de nascer (o cliente reposiciona a mira). */
  life: t.uint16(),
  /** Segundos até renascer (só enquanto morto). */
  respawnIn: t.float32(),
  /** Proteção de nascimento: não toma dano (acaba sozinha ou ao atirar). */
  invuln: t.boolean(),
  /**
   * Geração da participação (Modo Live): muda a cada vez que esta conexão entra na partida
   * (fila → jogador). Não é lido por `stepPlayer` (fora do FLAT_FIELDS); 0 = bot.
   */
  seat: t.uint32(),
}, 'NetPlayer');
export type NetPlayer = SchemaType<typeof NetPlayer>;

export const NetGrenade = schema({
  owner: t.string(), x: t.float64(), y: t.float64(), z: t.float64(),
  vx: t.float64(), vy: t.float64(), vz: t.float64(), age: t.float64(), seq: t.int32(),
}, 'NetGrenade');

export const NetSlipper = schema({
  owner: t.string(), life: t.uint16(),
  x: t.float64(), y: t.float64(), z: t.float64(),
  vx: t.float64(), vy: t.float64(), vz: t.float64(),
  resting: t.boolean(), age: t.float64(), seq: t.int32(), hitTarget: t.string(),
}, 'NetSlipper');
export type NetSlipper = SchemaType<typeof NetSlipper>;

export const NetHackDrone = schema({
  x: t.float64(), y: t.float64(), z: t.float64(),
  team: t.string(), hackerId: t.string(), progress: t.float32(), contested: t.boolean(),
  // Drone da OTIMIZA na Arena (src/net/arena-drone.ts); vazios/zero nos drones-objetivo.
  kind: t.string().default(''), phase: t.string().default(''), owner: t.string().default(''),
  hp: t.float32().default(0), timer: t.float32().default(0), target: t.string().default(''), zone: t.string().default(''),
}, 'NetHackDrone');
export type NetHackDrone = SchemaType<typeof NetHackDrone>;

export const ArenaState = schema({
  mapId: t.string(),
  players: t.map(NetPlayer),
  slippers: t.map(NetSlipper),
  grenades: t.map(NetGrenade),
  drones: t.map(NetHackDrone),
  mode: t.string(),
  scoreA: t.uint16(), scoreB: t.uint16(), winnerTeam: t.string(), drawn: t.boolean(),
  /** 'playing' (valendo) ou 'ended' (tela de fim; reinicia sozinha). */
  phase: t.string(),
  /** Segundos que faltam (partida) ou até reiniciar (fim), arredondado para cima. */
  timeLeft: t.uint16(),
  killLimit: t.uint16(),
  /** Vencedor da última partida (id e apelido); vazio enquanto ela corre. */
  winnerId: t.string(),
  winnerName: t.string(),
  /** Conta as partidas da sala (mudou = partida nova). */
  match: t.uint16(),
}, 'ArenaState');
export type ArenaState = SchemaType<typeof ArenaState>;

/**
 * Entrada de UM tick (espelha `PlayerCommand`). Só primitivos: é o formato do
 * `defineInput` do Colyseus. O número de sequência é o do próprio Colyseus (cada
 * `send()` = um tick), usado no ack da reconciliação e no espalhamento do tiro. Não existe
 * campo de posição nem de acerto: o cliente não tem como dizer onde está nem quem acertou.
 */
export const MoveInput = schema({
  weaponSlot: t.uint8(),
  moveX: t.int8(),
  moveZ: t.int8(),
  sprint: t.boolean(),
  jump: t.boolean(),
  crouch: t.boolean(),
  yaw: t.float32(),
  pitch: t.float32(),
  fire: t.boolean(),
  reload: t.boolean(),
  aim: t.boolean(),
  alt: t.boolean(),
  melee: t.boolean(),
  throwSlipper: t.boolean(),
  grenade: t.boolean(),
}, 'MoveInput');
export type MoveInput = SchemaType<typeof MoveInput>;
