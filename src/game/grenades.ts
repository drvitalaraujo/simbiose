// Apresentação compartilhada: malha procedural, efeitos e indicador de estoque.
import * as THREE from 'three';
import type { GrenadeProjectile } from '../sim/grenade';
import type { ShotMsg } from '../net/feed';
import type { Sfx } from './audio/sfx';
import type { Particles } from './particles';
import { PALETTE, toon } from './toon';
import './grenades.css';

export function grenadeEffect(m: ShotMsg, sfx: Sfx, particles: Particles, local = false) {
  if (m.weapon !== 'grenade' || !m.grenadePhase) return;
  const at = new THREE.Vector3(...m.o);
  sfx.grenade(m.grenadePhase, at, m.by, local);
  if (m.grenadePhase === 'explode') {
    particles.burst(at, PALETTE.yellow, 28, 12, 0.22);
    particles.burst(at, PALETTE.paper, 12, 7, 0.15);
    particles.burst(at, PALETTE.inkSoft, 14, 5, 0.25);
  }
}

export class GrenadeVisuals {
  private readonly objects = new Map<string, THREE.Group>();
  private readonly body = new THREE.IcosahedronGeometry(0.09, 1);
  private readonly cap = new THREE.BoxGeometry(0.04, 0.045, 0.09);
  private readonly material = toon(PALETTE.yellow);
  private readonly metal = toon(PALETTE.inkSoft);
  constructor(private scene: THREE.Scene) {}
  update(projectiles: Iterable<[string, GrenadeProjectile]>, visible = true) {
    const seen = new Set<string>();
    for (const [id, p] of projectiles) {
      seen.add(id);
      let g = this.objects.get(id);
      if (!g) {
        g = new THREE.Group();
        g.add(new THREE.Mesh(this.body, this.material));
        const cap = new THREE.Mesh(this.cap, this.metal); cap.position.y = 0.09; g.add(cap);
        g.traverse(n => { n.raycast = () => {}; });
        this.scene.add(g); this.objects.set(id, g);
      }
      g.visible = visible;
      g.position.set(p.x, p.y, p.z);
      g.rotation.set(p.age * 12, p.age * 7, 0);
    }
    for (const [id, g] of this.objects) if (!seen.has(id)) { g.removeFromParent(); this.objects.delete(id); }
  }
  dispose() {
    for (const g of this.objects.values()) g.removeFromParent();
    this.objects.clear(); this.body.dispose(); this.cap.dispose(); this.material.dispose(); this.metal.dispose();
  }
}
export class GrenadeHud {
  private readonly el = document.createElement('div');
  constructor() { this.el.className = 'grenade-stock'; document.body.append(this.el); }
  update(ready: boolean, alive: boolean) {
    this.el.hidden = !alive;
    this.el.classList.toggle('empty', !ready);
    this.el.textContent = ready ? 'Q · GRANADA HE  1' : 'Q · GRANADA HE  0';
  }
  dispose() { this.el.remove(); }
}
