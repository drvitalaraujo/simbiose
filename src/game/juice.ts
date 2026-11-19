import * as THREE from 'three';
import { OnomaCadence, onomaPlacement } from './onomatopoeia';
import { CameraKick, cameraMotionScale, type KickKind, lateralOf } from './movement-camera';

// "Juice": tudo que faz o tiro ser gostoso sem mudar as regras do jogo.
// Referência: Jan Willem Nijman, "The Art of Screenshake" (Vlambeer, 2013).

const HIT_WORDS = ['PÁ!', 'TÁ!', 'POW!', 'TUM!'];
const KILL_WORDS = ['BUM!', 'KABUM!', 'CRASH!', 'PLAFT!'];

export class Juice {
  /** Trauma de 0 a 1; o tremor é trauma² para fortes impactos se destacarem. */
  private trauma = 0;
  private hitStop = 0;
  private impactTimer = 0;
  private readonly fxLayer = document.getElementById('fx-layer')!;
  private readonly impactEl = document.getElementById('impact-frame')!;
  private readonly hitmarker = document.getElementById('hitmarker')!;
  /** Soco direcional (rolagem, zoom de impacto, empurrão): ver `CameraKick`. */
  private readonly kick = new CameraKick();
  private lastYaw = 0;
  private readonly onomaCadence = new OnomaCadence();

  reset() {
    this.kick.reset();
    this.onomaCadence.reset();
    this.fxLayer.querySelectorAll('.onoma').forEach(el => el.remove());
    this.trauma = this.hitStop = this.impactTimer = 0;
    this.impactEl.classList.remove('on');
  }

  addTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /**
   * Soco de câmera "anime" no acerto/abate/dano. `from` (mundo) é de onde veio o dano e
   * `eye` o olho do jogador: a cabeça tomba para longe e a câmera é empurrada.
   */
  punch(kind: KickKind, from?: { x: number; y: number; z: number }, eye?: { x: number; y: number; z: number }) {
    if (kind !== 'hurt' || !from || !eye) { this.kick.add(kind); return; }
    const d = { x: eye.x - from.x, y: 0, z: eye.z - from.z };
    const len = Math.hypot(d.x, d.z) || 1;
    this.kick.add(kind, lateralOf(from, eye, this.lastYaw), { x: d.x / len, y: 0, z: d.z / len });
  }

  /** Congela o jogo por alguns milissegundos para o impacto "pesar". */
  freeze(seconds: number) {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  /** Impact frame de anime: tela invertida em preto e branco por um instante. */
  impactFrame(seconds = 0.06) {
    this.impactTimer = seconds;
    this.impactEl.classList.add('on');
  }

  hitMarker() {
    this.hitmarker.classList.remove('show');
    void this.hitmarker.offsetWidth; // reinicia a animação CSS
    this.hitmarker.classList.add('show');
  }

  onomatopoeia(world: THREE.Vector3, camera: THREE.Camera, kill: boolean, word?: string, variant?: 'glitch' | 'hack') {
    const p = world.clone().project(camera);
    if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return;
    if (!this.onomaCadence.allow(kill || !!variant)) return;
    this.fxLayer.querySelectorAll('.onoma').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = (kill ? 'onoma big' : 'onoma') + (variant ? ` ${variant}` : '');
    const words = kill ? KILL_WORDS : HIT_WORDS;
    el.textContent = word ?? words[Math.floor(Math.random() * words.length)];
    const at = onomaPlacement(p.x, p.y);
    el.style.left = `${at.x * 100}%`;
    el.style.top = `${at.y * 100}%`;
    this.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), kill || variant ? 440 : 300);
  }

  /** Retorna o dt do jogo (0 durante o hit-stop). Atualiza timers em tempo real. */
  tick(realDt: number): number {
    this.onomaCadence.tick(realDt);
    this.trauma = Math.max(0, this.trauma - realDt * 1.8);
    if (this.impactTimer > 0) {
      this.impactTimer -= realDt;
      if (this.impactTimer <= 0) this.impactEl.classList.remove('on');
    }
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      return 0; // o soco fica parado na pose do impacto durante o congelamento
    }
    this.kick.step(realDt);
    return realDt;
  }

  /**
   * Depois de posicionar a câmera e o FOV: tremor do trauma + soco direcional. O tremor
   * gira mais em torno do centro da tela (rolagem) e desloca a câmera; a mira quase não
   * sai do lugar, porque o tiro segue a simulação, não a câmera.
   */
  shakeCamera(camera: THREE.PerspectiveCamera, time: number) {
    this.lastYaw = camera.rotation.y;
    const k = this.kick.read();
    const scale = 0.25 + 0.75 * Math.min(1, cameraMotionScale());
    const s = this.trauma * this.trauma * scale;
    camera.rotation.z += k.roll;
    camera.position.x += k.x;
    camera.position.y += k.y;
    camera.position.z += k.z;
    if (Math.abs(k.fov) > 0.01) {
      camera.fov = Math.max(10, camera.fov + k.fov * camera.fov / 80);
      camera.updateProjectionMatrix();
    }
    if (s <= 0) return;
    const t = time * 40;
    camera.rotation.x += s * 0.022 * noise(t);
    camera.rotation.y += s * 0.022 * noise(t + 100);
    camera.rotation.z += s * 0.09 * noise(t + 200);
    camera.translateX(s * 0.05 * noise(t * 0.8 + 300));
    camera.translateY(s * 0.04 * noise(t * 0.8 + 400));
  }
}

function noise(t: number) {
  return Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4;
}

// Compatibilidade para quem importa o áudio junto dos efeitos visuais.
export { Sfx } from './audio/sfx';
