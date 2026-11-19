// Boneco dos outros jogadores no modo online. `RemoteAvatar` é a interface que o
// cliente online usa. A cápsula toon aparece enquanto o GLB do boneco animado
// (src/game/characters/) carrega, e continua como reserva se ele falhar.
import * as THREE from 'three';
import { PLAYER_HALF } from '../sim/player';
import type { Vec3 } from '../sim/vec';
import { Avatar } from './characters/avatar';
import { loadCharacter, TEAM_COLOR, type Team } from './characters/model';
import { type SkinId, skinFor } from './characters/skins';
import { addOutline, hex, PALETTE, toon } from './toon';
import { RemoteWeapon } from './characters/remote-weapon';

/** Tudo o que o boneco recebe a cada quadro (já interpolado ~100 ms no passado). */
export interface AvatarPose {
  /** Pés do jogador (ponto no chão, no meio da caixa do corpo). */
  position: Vec3;
  /** Para onde o corpo olha (radianos, mesma convenção da câmera: frente = -z). */
  yaw: number;
  /** Inclinação da mira (radianos; positivo = olhando para cima). */
  pitch: number;
  /** Velocidade (m/s): escolhe parado/andando/correndo e a direção do passo. */
  velocity: Vec3;
  /** Intenção de postura, inclusive durante o slide. */
  crouching: boolean;
  crouchAmount?: number;
  /** No ar (pulando ou caindo). */
  jumping: boolean;
  /** Morto (toca a animação de morte e fica no chão até renascer). */
  dead: boolean;
  weaponIndex?: number;
  reloadRemaining?: number;
}

/** Parte do corpo atingida (reação a tiro). */
export type HitReaction = 'head' | 'torso' | 'legs';

export interface RemoteAvatar {
  readonly object: THREE.Object3D;
  setName(name: string): void;
  /** Chamado uma vez por quadro com a pose interpolada. */
  update(pose: AvatarPose, dt: number): void;
  /** Tiro confirmado pelo servidor acertou este boneco. */
  react(part: HitReaction): void;
  /** Disparo confirmado: anima e devolve a ponta real do cano em coordenadas de mundo. */
  fire(weaponIndex: number): THREE.Vector3;
  dispose(): void;
}

/** Visual do boneco remoto. Sem `skin`: escolhida pelo nome (fixa por jogador, `skinFor`). */
export interface AvatarOptions {
  skin?: SkinId;
  /** Cor de leitura (contorno): inimigo rosa, aliado ciano. Padrão: inimigo. */
  team?: Team;
}

export type AvatarFactory = (name: string, options?: AvatarOptions) => RemoteAvatar;

const noRaycast = () => {};
const HEIGHT = PLAYER_HALF.y * 2;
const RADIUS = PLAYER_HALF.x;

/** Placeholder: cápsula toon com contorno, visor que segue a mira e nome em cima. */
export class CapsuleAvatar implements RemoteAvatar {
  readonly object = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly head = new THREE.Group();
  private readonly tag: THREE.Sprite;
  private readonly tagCanvas = document.createElement('canvas');
  private readonly tagTexture: THREE.CanvasTexture;
  private readonly visorGeo = new THREE.BoxGeometry(0.42, 0.14, 0.2);
  private readonly weapon = new RemoteWeapon();
  private bodyVisible = true;

  constructor(name: string, team: Team = 'enemy') {
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(RADIUS, HEIGHT - RADIUS * 2, 4, 12), toon(TEAM_COLOR[team]));
    this.body.position.y = HEIGHT / 2;
    // Sombra do mundo é estática: quem se mexe usa sombra-bolha (render/blobs.ts no online.ts)
    this.body.castShadow = false;
    addOutline(this.body, 0.03);
    this.object.add(this.body);

    // Visor (mostra para onde a pessoa mira)
    this.head.position.y = PLAYER_HALF.y + 0.65; // altura do olho (EYE_HEIGHT acima do centro)
    const visor = new THREE.Mesh(this.visorGeo, toon(PALETTE.cyan));
    visor.position.z = -RADIUS + 0.05;
    visor.raycast = noRaycast;
    this.head.add(visor);
    this.object.add(this.head);
    this.weapon.root.position.set(0.2, -0.12, -0.25);
    this.head.add(this.weapon.root);

    this.tagCanvas.width = 256;
    this.tagCanvas.height = 64;
    this.tagTexture = new THREE.CanvasTexture(this.tagCanvas);
    this.tagTexture.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTexture, depthWrite: false, transparent: true }));
    this.tag.scale.set(1.6, 0.4, 1);
    this.tag.position.y = HEIGHT + 0.35;
    this.tag.raycast = noRaycast;
    this.object.add(this.tag);
    this.setName(name);
  }

  setName(name: string) {
    const ctx = this.tagCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = hex(PALETTE.ink);
    ctx.fillStyle = hex(PALETTE.paper);
    ctx.strokeText(name, 128, 32);
    ctx.fillText(name, 128, 32);
    this.tagTexture.needsUpdate = true;
  }

  /** Esconde a cápsula (o nome continua) quando o boneco animado assume. */
  showBody(visible: boolean) {
    this.bodyVisible = visible;
    this.body.visible = visible;
    this.head.visible = visible;
  }

  private flinch = 0;

  update(pose: AvatarPose, dt = 0) {
    this.object.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.object.rotation.y = pose.yaw;
    this.head.rotation.x = pose.pitch;
    // Achata um pouco no ar, só para dar leitura de pulo no placeholder
    const crouch = pose.crouchAmount ?? (pose.crouching ? 1 : 0);
    this.body.scale.y = (pose.jumping ? 0.92 : 1) * (1 - crouch * 0.55 / HEIGHT);
    this.head.position.y = PLAYER_HALF.y + 0.65 - crouch * 0.55;
    // Morto: deita; tiro: dá um tranco para trás
    this.flinch = Math.max(0, this.flinch - dt * 6);
    this.body.rotation.x = pose.dead ? -Math.PI / 2 : this.flinch * 0.25;
    this.body.position.y = pose.dead ? RADIUS : HEIGHT / 2 - crouch * 0.275;
    this.head.visible = this.body.visible && !pose.dead;
    this.tag.visible = !pose.dead;
    this.weapon.equip(pose.weaponIndex ?? 0);
    this.weapon.update(dt, pose.dead);
    this.weapon.root.visible = this.bodyVisible && !pose.dead;
  }

  fire(index: number) {
    this.weapon.fire(index);
    return this.weapon.muzzleWorld();
  }

  react(_part: HitReaction) {
    this.flinch = 1;
  }

  /** Libera só o que é deste boneco (materiais toon() são compartilhados pela paleta). */
  dispose() {
    this.weapon.dispose();
    this.object.removeFromParent();
    this.body.geometry.dispose();
    this.visorGeo.dispose();
    this.tagTexture.dispose();
    (this.tag.material as THREE.SpriteMaterial).dispose();
  }
}

/** Boneco animado com skin; a cápsula cobre o carregamento e serve de reserva. */
export class AnimatedAvatar implements RemoteAvatar {
  private readonly capsule: CapsuleAvatar;
  private avatar: Avatar | null = null;
  private disposed = false;
  readonly skin: SkinId;
  readonly team: Team;

  constructor(name: string, options: AvatarOptions = {}) {
    this.capsule = new CapsuleAvatar(name, options.team);
    // Sem escolha sincronizada pela rede ainda: o hash do nome é só um substituto local
    // (cada cliente vê o mesmo jogador com a mesma skin). Não há override global por URL.
    this.skin = options.skin ?? skinFor(name);
    this.team = options.team ?? 'enemy';
    loadCharacter()
      .then((asset) => {
        if (this.disposed) return;
        this.avatar = new Avatar(asset, this.team, this.skin);
        this.capsule.object.add(this.avatar.root); // o grupo da cápsula já segue posição e yaw
        this.capsule.showBody(false);
      })
      .catch((e) => console.warn('[online] boneco animado indisponível, usando cápsula', e));
  }

  get object() {
    return this.capsule.object;
  }

  setName(name: string) {
    this.capsule.setName(name);
  }

  update(pose: AvatarPose, dt: number) {
    this.capsule.update(pose, dt);
    const a = this.avatar;
    if (!a) return;
    // O Avatar gira o modelo pelo yaw; o grupo de fora já gira, então ele trabalha em
    // coordenadas locais (posição 0, yaw 0) e só a velocidade é trazida para o local.
    const c = Math.cos(-pose.yaw), s = Math.sin(-pose.yaw);
    const st = a.state;
    st.x = st.y = st.z = 0;
    st.yaw = 0;
    st.vx = pose.velocity.x * c + pose.velocity.z * s;
    st.vz = pose.velocity.z * c - pose.velocity.x * s;
    st.vy = pose.velocity.y;
    st.pitch = pose.pitch;
    st.crouch = (pose.crouchAmount ?? (pose.crouching ? 1 : 0)) > 0.5;
    st.crouchAmount = pose.crouchAmount;
    st.grounded = !pose.jumping;
    st.dead = pose.dead;
    st.weaponIndex = pose.weaponIndex;
    st.reloadRemaining = pose.reloadRemaining;
    a.update(dt);
  }

  fire(index: number) {
    return this.avatar ? this.avatar.fire(index) : this.capsule.fire(index);
  }

  react(part: HitReaction) {
    this.capsule.react(part);
    this.avatar?.react(part);
  }

  dispose() {
    this.disposed = true;
    this.avatar?.dispose();
    this.capsule.dispose();
  }
}

export const createAvatar: AvatarFactory = (name, options) => new AnimatedAvatar(name, options);
