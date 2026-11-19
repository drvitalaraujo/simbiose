// Bonecos de TODOS os jogadores para quem assiste (interpolados ~100 ms no passado, como os
// remotos do online.ts), passos com som posicional e sombra-bolha. Times: A ciano, B rosa;
// no FFA todo mundo é "inimigo" (rosa).
import type * as THREE from 'three';
import type { Predict } from '@colyseus/sdk';
import type { NetMap } from '../../net/maps';
import type { NetPlayer } from '../../net/schema';
import { PLAYER_HALF } from '../../sim/player';
import type { Sfx } from '../juice';
import { type AvatarFactory, createAvatar, type RemoteAvatar } from '../online-avatar';
import { type BlobTarget, BlobShadows } from '../render/blobs';

type Field = 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz' | 'yaw' | 'pitch' | 'crouchAmount';

export class SpectatorCast {
  private readonly avatars = new Map<string, RemoteAvatar>();
  private readonly teams = new Map<string, string>();
  private readonly blobs: BlobShadows;
  private readonly blobTargets: BlobTarget[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly predict: Predict,
    private readonly sfx: Sfx,
    private readonly factory: AvatarFactory = createAvatar,
  ) {
    this.blobs = new BlobShadows(scene);
  }

  /** Valor interpolado de um campo (o que a tela mostra). */
  value(p: NetPlayer, f: Field): number {
    return this.predict.value(p, f);
  }

  get(id: string): RemoteAvatar | undefined {
    return this.avatars.get(id);
  }

  teamOf(id: string): 'ally' | 'enemy' {
    return this.teams.get(id) === 'ally' ? 'ally' : 'enemy';
  }

  /** `hidden`: quem está na 1ª pessoa (o boneco dele não pode tapar a câmera). */
  update(players: Iterable<[string, NetPlayer]>, map: NetMap, playing: boolean, hidden: string | null, dt: number) {
    const seen = new Set<string>();
    this.blobTargets.length = 0;
    for (const [id, p] of players) {
      seen.add(id);
      const team = p.team === 'a' ? 'ally' : 'enemy';
      let avatar = this.avatars.get(id);
      if (avatar && this.teams.get(id) !== team) {
        avatar.dispose();
        avatar = undefined;
      }
      if (!avatar) {
        avatar = this.factory(p.bot ? `BOT ${p.name}` : p.name, { team });
        this.avatars.set(id, avatar);
        this.teams.set(id, team);
        this.scene.add(avatar.object);
      }
      const v = (f: Field) => this.value(p, f);
      const position = { x: v('x'), y: v('y'), z: v('z') };
      const crouch = v('crouchAmount');
      this.sfx.movement(id, { position, grounded: p.onGround, sliding: p.sliding, walking: p.walking, crouch, alive: p.hp > 0 && playing, vy: v('vy'), life: p.life }, true);
      avatar.object.visible = id !== hidden;
      avatar.update({
        position: { x: position.x, y: position.y - PLAYER_HALF.y, z: position.z },
        yaw: v('yaw'),
        pitch: v('pitch'),
        velocity: { x: v('vx'), y: v('vy'), z: v('vz') },
        crouching: crouch > 0.5,
        crouchAmount: crouch,
        jumping: !p.onGround,
        dead: p.hp <= 0,
        weaponIndex: p.weaponIndex,
        reloadRemaining: p.reloadRemaining,
      }, dt);
      this.blobTargets.push({ position, radius: 0.5 });
    }
    for (const [id, avatar] of this.avatars) {
      if (seen.has(id)) continue;
      avatar.dispose();
      this.avatars.delete(id);
      this.teams.delete(id);
      this.sfx.feet.forget(id);
    }
    this.blobs.update(this.blobTargets, map.solids);
  }

  dispose() {
    for (const avatar of this.avatars.values()) avatar.dispose();
    this.avatars.clear();
    this.teams.clear();
  }
}
