import * as THREE from 'three';
import type { HackDrone } from '../../net/hack-objectives';
import { PALETTE, toon } from '../toon';
import { DRONE_KIND } from '../../net/arena-drone';
import { type FeetLookup, OtimizaDroneView, type OtimizaDroneDeps } from './otimiza-drone';

/** Para o drone da OTIMIZA na Arena: quem é você e onde cada um está desenhado. */
export interface ArenaDroneFrame {
  me: string;
  players: Iterable<[string, { x: number; y: number; z: number; hp: number }]>;
  feet: FeetLookup;
  dt: number;
}

/** Drones-objetivo só visuais: regras e progresso chegam do estado autoritativo. */
export class OnlineObjectives {
  private readonly meshes = new Map<string, THREE.Group>();
  /** Drone da OTIMIZA na Arena (FFA): online/otimiza-drone.ts. */
  readonly arena: OtimizaDroneView | null;
  constructor(private readonly scene: THREE.Scene, deps?: OtimizaDroneDeps) {
    this.arena = deps ? new OtimizaDroneView(scene, deps) : null;
  }

  sync(drones: Iterable<[string, Omit<HackDrone, 'team'> & { team: string }]>, elapsed = 0, localTeam = 'a', frame?: ArenaDroneFrame) {
    const alive = new Set<string>();
    let otimiza: HackDrone | undefined;
    for (const [id, d] of drones) {
      if (d.kind === DRONE_KIND) { otimiza = d as HackDrone; continue; }
      alive.add(id);
      let root = this.meshes.get(id);
      if (!root) {
        root = new THREE.Group();
        const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), toon(PALETTE.yellow));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 24), toon(PALETTE.paper));
        ring.rotation.x = Math.PI / 2;
        const charge = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), toon(PALETTE.cyan));
        charge.position.y = 0.7;
        root.add(body, ring, charge);
        root.traverse(node => { node.raycast = () => {}; });
        this.scene.add(root); this.meshes.set(id, root);
      }
      root.position.set(d.x, d.y + Math.sin(elapsed * 2) * 0.1, d.z);
      root.rotation.y = elapsed;
      const body = root.children[0] as THREE.Mesh;
      body.material = toon(d.team ? d.team === localTeam ? PALETTE.cyan : PALETTE.pink : PALETTE.yellow);
      root.children[1].scale.setScalar(d.contested ? 1.3 : 1);
      root.children[2].visible = !!d.hackerId;
      root.children[2].scale.setScalar(0.5 + d.progress * 2);
    }
    for (const [id, mesh] of this.meshes) if (!alive.has(id)) { this.remove(mesh); this.meshes.delete(id); }
    if (frame) this.arena?.sync(otimiza, frame.me, frame.players, frame.feet, frame.dt, elapsed);
  }

  private remove(root: THREE.Group) {
    root.removeFromParent();
    root.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
  }
  dispose() { for (const root of this.meshes.values()) this.remove(root); this.meshes.clear(); this.arena?.dispose(); }
}
