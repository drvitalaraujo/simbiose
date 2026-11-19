import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { AvatarFactory, RemoteAvatar } from '../online-avatar';
import { Viewmodel } from '../viewmodel';
import { vmUniforms } from '../viewmodel/material';
import type { OnlineFx } from './fx';
import { ReplayPlayer } from './replay-player';
import { emptySample, ReplayRecorder, type ReplayEvent } from './replay-recorder';
import { ReplayViewmodel } from './replay-viewmodel';

const shot = (over: Partial<ReplayEvent> = {}): ReplayEvent => ({
  t: 0.2, kind: 'shot', by: 'killer', target: '', weapon: 'smg', o: [0, 1, 0], e: [0, 1, -20],
  pellets: null, part: '', damage: 0, killed: false, headshot: false, continuation: false, ...over,
});

function setup(events: ReplayEvent[] = []) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(80);
  scene.add(camera);
  const remoteShot = vi.fn();
  const grenade = vi.fn();
  const avatars: RemoteAvatar[] = [];
  const factory: AvatarFactory = () => {
    const object = new THREE.Group();
    const a = { object, update: vi.fn(), fire: vi.fn(() => new THREE.Vector3()), react: vi.fn(), dispose: () => object.removeFromParent() } as unknown as RemoteAvatar;
    avatars.push(a);
    return a;
  };
  const player = new ReplayPlayer(scene, camera, { remoteShot, grenade } as unknown as OnlineFx, factory);
  const rec = new ReplayRecorder({ hz: 10 });
  for (let i = 0; i <= 10; i++) {
    rec.begin(i / 10);
    rec.player('killer', 'Kaia', '', false, { ...emptySample(), alive: true, weapon: 1, aim: 0.8, reload: 0.6, y: 0.85 });
    rec.end();
  }
  for (const e of events) rec.event(e);
  return { scene, camera, remoteShot, grenade, avatars, player, clip: rec.clip(0, 1)! };
}

describe('arma no ponto de vista do replay', () => {
  it('HE gravada desenha trajetória e explosão sem disparar arma do ARSENAL', () => {
    const { player, clip, remoteShot, grenade } = setup([
      shot({ weapon: 'grenade', grenadePhase: 'throw', grenadeVelocity: [0, 2, -16] }),
      shot({ t: 0.8, weapon: 'grenade', grenadePhase: 'explode' }),
      shot({ t: 0.8, weapon: 'grenade', continuation: true, target: 'killer', damage: 40 }),
    ]);
    player.start({ clip, pov: 'killer', from: 0, to: 1, speed: () => 1 });
    const fire = vi.spyOn(player['weapon']!.viewmodel, 'shot');
    player.update(0.9);
    expect(grenade).toHaveBeenCalledTimes(2);
    expect(remoteShot).not.toHaveBeenCalled(); expect(fire).not.toHaveBeenCalled();
    player.stop(); player.dispose();
  });
  it('mostra a arma gravada, segue a mira e preserva a arma ao vivo ao parar', () => {
    const { scene, camera, player, clip, avatars } = setup();
    const live = new Viewmodel(camera, scene);
    live.setWeapon(3);
    player.start({ clip, pov: 'killer', from: 0, to: 1, speed: () => 1 });
    live.update(1 / 60, { vx: 0, vy: 0, vz: 0, onGround: true, bobPhase: 0, yaw: 0, pitch: 0, aimAmount: 0 });
    player.present(80);
    const replay = player['weapon']!.viewmodel;
    expect(replay.model.layout).not.toEqual(live.model.layout);
    expect(replay.model.root.visible).toBe(true);
    expect(avatars[0].object.visible).toBe(false);
    expect(vmUniforms.vmAim.value).toBeGreaterThan(0.8);
    expect(camera.fov).toBeLessThan(80);
    expect(avatars[0].update).toHaveBeenLastCalledWith(expect.objectContaining({ weaponIndex: 1, reloadRemaining: expect.closeTo(0.6, 5) }), 0);
    player.stop();
    expect(replay.model.root.visible).toBe(false);
    expect(live.model.root.parent).toBe(camera);
    player.dispose();
    expect(camera.children).toEqual([live.model.root]);
    live.dispose();
  });

  it('reproduz uma salva com um coice, sem rastro remoto duplicado; congelar não avança a animação', () => {
    const { player, clip, remoteShot } = setup([shot(), shot({ continuation: true })]);
    player.start({ clip, pov: 'killer', from: 0, to: 0.3, speed: () => 0.5 });
    const vm = player['weapon']!.viewmodel;
    const fire = vi.spyOn(vm, 'shot');
    const update = vi.spyOn(vm, 'update');
    player.update(0.6);
    player.present(80);
    expect(fire).toHaveBeenCalledOnce();
    expect(remoteShot).toHaveBeenCalledOnce();
    expect(remoteShot.mock.calls[0].slice(-3)).toEqual([true, 'replay-killer', false]);
    player.update(0.1);
    player.present(80);
    expect(update.mock.calls.at(-1)?.[0]).toBe(0);
    player.dispose();
  });

  it('killcam por drone não cria nem mostra arma em primeira pessoa', () => {
    const { player, clip, camera } = setup();
    player.start({ clip, pov: 'killer', droneCam: 'victim', from: 0, to: 1, speed: () => 1 });
    player.present(80);
    expect(camera.children).toHaveLength(0);
    expect(player.scoped).toBe(false);
    player.dispose();
  });

  it('salva preserva todos os pellets quando o acerto principal está no meio da lista', () => {
    const pellets: [number, number, number][] = [[-1, 1, -20], [0, 1, -20], [1, 1, -20]];
    const { player, clip } = setup([shot({ weapon: 'shotgun', e: pellets[2], pellets })]);
    const onEvent = vi.fn();
    player.start({ clip, pov: 'killer', from: 0, to: 1, speed: () => 1, onEvent });
    const vm = player['weapon']!.viewmodel;
    const fire = vi.spyOn(vm, 'shot');
    const pellet = vi.spyOn(vm, 'pellet');
    player.update(0.2);
    expect(fire.mock.calls.map(([v]) => v.toArray())).toEqual([pellets[0]]);
    expect(pellet.mock.calls.map(([v]) => v.toArray())).toEqual(pellets.slice(1));
    expect(onEvent.mock.calls[0][1].toArray()).toEqual(pellets[2]);
    player.dispose();
  });

  it('troca para a arma gravada e usa a luneta somente quando a sniper está mirando', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(80);
    const weapon = new ReplayViewmodel(camera, scene);
    const s = { ...emptySample(), alive: true, weapon: 2, aim: 1 };
    weapon.present(s, 0, 80);
    expect(weapon.scoped).toBe(true);
    expect(weapon.viewmodel.model.root.visible).toBe(false);
    expect(camera.fov).toBeLessThan(30);
    weapon.present({ ...s, weapon: 3, aim: 0 }, 0, 80);
    expect(weapon.scoped).toBe(false);
    expect(weapon.viewmodel.model.root.visible).toBe(true);
    expect(camera.fov).toBeCloseTo(80);
    weapon.dispose();
  });

  it('retículo reflex segue a MK-2 em ADS e some ao baixar a mira, morrer, trocar arma ou parar', () => {
    const weapon = new ReplayViewmodel(new THREE.PerspectiveCamera(80), new THREE.Scene());
    const s = { ...emptySample(), alive: true, weapon: 0, aim: 1 };
    weapon.present(s, 0, 80);
    expect(weapon.reflex).toBe(true);
    for (const hidden of [{ ...s, aim: 0.85 }, { ...s, alive: false }, { ...s, weapon: 1 }, { ...s, weapon: 2 }]) {
      weapon.present(hidden, 0, 80);
      expect(weapon.reflex).toBe(false);
    }
    weapon.present(s, 0, 80);
    weapon.stop();
    expect(weapon.reflex).toBe(false);
    weapon.dispose();
  });

  it('trocar de replay humano para câmera do drone limpa o reflex', () => {
    const { player, clip } = setup();
    player.start({ clip, pov: 'killer', from: 0, to: 1, speed: () => 1 });
    player['weapon']!.present({ ...emptySample(), alive: true, weapon: 0, aim: 1 }, 0, 80);
    expect(player.reflex).toBe(true);
    player.start({ clip, pov: 'killer', droneCam: 'victim', from: 0, to: 1, speed: () => 1 });
    player.present(80);
    expect(player.reflex).toBe(false);
    player.stop();
    expect(player.reflex).toBe(false);
    player.dispose();
  });
});
