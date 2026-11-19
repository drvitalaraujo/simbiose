import type * as THREE from 'three';
import type { WeaponState } from '../sim/weapon';
import { gunSpec, weaponSpread } from '../sim/weapons';
import type { Input } from './input';
import './arsenal.css';
import { SniperPulse } from './sniper-pulse';
import { cameraMotionScale } from './movement-camera';

/** Zoom óptico proporcional ao FOV escolhido pelo jogador. */
export function aimedFov(baseFov: number, zoom: number, amount: number): number {
  const ratio = 1 + (zoom - 1) * amount;
  return 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) / ratio) * 180 / Math.PI;
}

/** Apresentação apenas: precisão e transição da mira pertencem à simulação. */
export class AimPresentation {
  private amount = 0;
  private readonly shotPulse = new SniperPulse();
  private readonly scope = document.createElement('div');
  private readonly ring = document.createElement('div');
  private readonly crosshair = document.getElementById('crosshair');
  private readonly reflex = document.createElement('div');
  private weaponIndex = -1;
  private readonly scopeLabel: HTMLElement;

  constructor() {
    this.scope.className = 'weapon-scope';
    this.scope.hidden = true;
    this.scope.innerHTML = '<div class="scope-glass"><i></i><b>LINHA MORTA · 4×</b></div>';
    this.scopeLabel = this.scope.querySelector('b')!;
    this.reflex.className = 'weapon-reflex';
    this.reflex.hidden = true;
    this.ring.className = 'weapon-spread';
    document.body.append(this.scope, this.ring, this.reflex);
  }

  update(dt: number, state: WeaponState, camera: THREE.PerspectiveCamera, input: Input, baseFov: number, alive: boolean, onGround = true, speed = 0) {
    const spec = gunSpec(state.weaponIndex);
    if (this.weaponIndex !== state.weaponIndex) { this.amount = 0; this.weaponIndex = state.weaponIndex; }
    const target = alive && input.locked ? state.aimAmount : 0;
    this.amount = alive ? this.amount + (target - this.amount) * (1 - Math.exp(-dt * 25)) : 0;
    // Pulso óptico curto: retículo continua no centro e yaw/pitch da simulação não mudam.
    const pulse = this.shotPulse.update(dt, state, alive) * cameraMotionScale();
    const fov = aimedFov(baseFov, spec.zoom, this.amount) + pulse;
    if (Math.abs(camera.fov - fov) > 0.005) { camera.fov = fov; camera.updateProjectionMatrix(); }
    input.aimSensitivity = 1 / (1 + (spec.zoom - 1) * this.amount);
    const scoped = alive && spec.id === 'sniper' && this.amount > 0.96;
    this.scope.hidden = !scoped;
    document.body.classList.toggle('weapon-scoped', scoped);
    const spread = weaponSpread(state.weaponIndex, state.aimAmount, onGround, speed);
    const status = spec.id === 'sniper' && (!onGround || speed > 0.5) ? 'LINHA MORTA · 4× · PARE PARA PRECISÃO' : 'LINHA MORTA · 4×';
    const label = this.scopeLabel;
    if (label.textContent !== status) label.textContent = status;
    // shotDirection sorteia x/y em ±spread/2 no plano local; projeção usa essa tangente.
    const radius = Math.max(4, (spread / 2) / Math.tan(fov * Math.PI / 360) * window.innerHeight / 2);
    const reflex = alive && input.locked && spec.id === 'mk2' && this.amount > 0.85;
    this.reflex.hidden = !reflex;
    this.ring.hidden = !alive || !input.locked;
    this.ring.style.width = this.ring.style.height = `${radius * 2}px`;
    this.ring.classList.toggle('shotgun', spec.id === 'shotgun');
    this.ring.classList.toggle('moving', !onGround || speed > 0.5);
    if (this.crosshair) this.crosshair.style.opacity = alive && !scoped && !reflex ? '1' : '0';
    return this.amount;
  }

  destroy() {
    this.scope.remove(); this.ring.remove(); this.reflex.remove();
    document.body.classList.remove('weapon-scoped');
    if (this.crosshair) this.crosshair.style.opacity = '';
  }
}
