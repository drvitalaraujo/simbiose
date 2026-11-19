// Resolve a salva contra a mesma pose de rewind e prepara uma mensagem por alvo.
// Vida, invulnerabilidade, equipes e placar continuam sob controle de ArenaSim.
import type { ShotEvent } from '../sim/events';
import type { Box } from '../sim/physics';
import { gunSpec } from '../sim/weapons';
import { damageFor, groupVolleyHits, resolveShot, type ShotResolution, type ShotTarget } from './combat';
import type { ShotMsg, V3 } from './feed';
import { rayBox } from '../sim/ray';
import { addScaled, type Vec3 } from '../sim/vec';

/** Alvo sem hitbox de personagem (o drone da OTIMIZA): só uma caixa, dano de corpo da arma. */
export interface PropTarget {
  id: string;
  box: Box;
}

/** O raio para no objeto se ele vier antes do que o tiro já acertou (parede ou gente). */
function throughProps(origin: Vec3, dir: Vec3, ray: ShotResolution, props: readonly PropTarget[], spec: ReturnType<typeof gunSpec>): ShotResolution {
  let far = Math.hypot(ray.end.x - origin.x, ray.end.y - origin.y, ray.end.z - origin.z);
  let hit: ShotResolution | null = null;
  for (const prop of props) {
    const t = rayBox(origin, dir, prop.box, far);
    if (t === null || t >= far) continue;
    far = t;
    const point = addScaled(origin, dir, t);
    hit = { end: point, wall: false, hit: { id: prop.id, part: 'torso', t, point, damage: damageFor('torso', t, spec) } };
  }
  return hit ?? ray;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const tuple = (v: { x: number; y: number; z: number }): V3 => [round(v.x), round(v.y), round(v.z)];

export function gunMessages(by: string, seq: number, index: number, shot: ShotEvent, blockers: readonly Box[], targets: readonly ShotTarget[], props: readonly PropTarget[] = []): ShotMsg[] {
  const spec = gunSpec(index);
  const rays = (shot.pellets ?? [shot]).map(p => throughProps(shot.origin, p.dir, resolveShot(shot.origin, p.dir, blockers, targets, spec, spec.range), props, spec));
  const base: ShotMsg = { by, seq, o: tuple(shot.origin), e: tuple(rays[0].end), weapon: spec.id,
    ...(rays.length > 1 ? { pellets: rays.map(r => tuple(r.end)) } : {}),
    ...(rays.some(r => r.wall) ? { impacts: rays.filter(r => r.wall).map(r => tuple(r.end)) } : {}) };
  const hits = groupVolleyHits(rays);
  if (!hits.length) return [{ ...base, ...(rays[0].wall ? { w: true } : {}) }];
  return hits.map((hit, i) => ({
    ...(i === 0 ? base : { by, seq, o: base.o, weapon: base.weapon, continuation: true }),
    e: tuple(hit.point), t: hit.id, part: hit.part, dmg: hit.damage,
  }));
}
