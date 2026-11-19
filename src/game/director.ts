import * as THREE from 'three';
import { fireInterval, huggerChance, isBossWave, waveSize } from './brain';
import { Drone, type DroneKind } from './drones';

// Comandante das ondas. As falas são da OTIMIZA: a história aparece no meio da ação.

const INTERMISSION = 3;
const SPAWN_GAP = 0.45;

const LINES = [
  'Olá! Detectamos um leve desvio de felicidade na sua região.',
  'Novidade! Drones Abraço Grátis: carinho que chega até você. Literalmente.',
  'Sua resistência foi registrada como feedback. Obrigada!',
  'Escalando o atendimento. Sorrir é rápido e indolor.',
  'Meta do trimestre em risco. Enviando reforços motivacionais.',
  'Transferindo seu caso para o nosso Gerente de Felicidade. Aguarde na linha :)',
  'Você está prejudicando o Índice de todos. Pense nisso :)',
];

export function otimizaLine(wave: number): string {
  return LINES[Math.min(wave - 1, LINES.length - 1)];
}

export class Director {
  readonly drones: Drone[] = [];
  wave = 0;
  private toSpawn = 0;
  private spawnTimer = 0;
  private intermission = 1.5;
  private bossPending = false;

  constructor(
    private scene: THREE.Scene,
    private spawnPoints: [number, number, number][],
    private onWaveStart: (wave: number) => void,
    private onSpawn: (at: THREE.Vector3) => void,
  ) {}

  get fireInterval() {
    return fireInterval(Math.max(1, this.wave));
  }

  /** Segura a primeira onda (ex.: enquanto a cena de abertura toca). */
  holdFor(seconds: number) {
    this.intermission = Math.max(this.intermission, seconds);
  }

  /** Reforço avulso (ex.: o chefe chamando Abraços). Não conta como onda nova. */
  spawnExtra(at: THREE.Vector3, kind: DroneKind) {
    this.drones.push(new Drone(this.scene, at, kind));
    this.onSpawn(at);
  }

  reset() {
    for (const d of this.drones) if (d.alive) this.scene.remove(d.group);
    this.drones.length = 0;
    this.wave = 0;
    this.toSpawn = 0;
    this.intermission = 1.5;
    this.bossPending = false;
  }

  update(dt: number) {
    for (let i = this.drones.length - 1; i >= 0; i--) if (!this.drones[i].alive) this.drones.splice(i, 1);

    if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = SPAWN_GAP;
        this.toSpawn -= 1;
        const [x, y, z] = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
        const at = new THREE.Vector3(x + (Math.random() - 0.5) * 4, y, z + (Math.random() - 0.5) * 4);
        let kind: DroneKind = Math.random() < huggerChance(this.wave) ? 'hugger' : 'shooter';
        if (this.bossPending) {
          kind = 'boss';
          this.bossPending = false;
        }
        this.drones.push(new Drone(this.scene, at, kind));
        this.onSpawn(at);
      }
      return;
    }

    if (this.drones.some((d) => d.team === 'enemy')) return; // aliados não seguram a onda
    this.intermission -= dt;
    if (this.intermission > 0) return;
    this.wave += 1;
    this.bossPending = isBossWave(this.wave);
    this.toSpawn = this.bossPending ? 4 : waveSize(this.wave); // chefe + 3 escoltas
    this.spawnTimer = 0.6;
    this.intermission = INTERMISSION;
    this.onWaveStart(this.wave);
  }
}
