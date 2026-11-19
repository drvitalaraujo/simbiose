// Comparação reproduzível de plantas: npx tsx scripts/map-metrics.ts
// Área aproximada na grade de 1 m; 16 direções por amostra de piso alcançável.
// Mede exposição geométrica, não substitui partida humana nem estima equilíbrio.
import { getMap } from '../src/net/maps';
import { buildNav, nodeAt, nodePos, walkDistances } from '../src/game/maps/nav';
import { lineOfSight, raycastBoxes } from '../src/sim/ray';

const result: Record<string, unknown> = {};
for (const id of ['favela', 'lapa']) {
  const net = getMap(id), map = net.data!, nav = buildNav(map, 1);
  const root = nodeAt(nav, map.playerSpawn);
  if (root === null) throw new Error(`${id}: nascimento fora da navegação`);
  const distances = walkDistances(nav, root);
  const lengths: number[] = [];
  let accessible = 0, elevated = 0;
  for (let i = 0; i < distances.length; i++) {
    if (!Number.isFinite(distances[i])) continue;
    accessible++;
    const p = nodePos(nav, i);
    if (p.y > 0.45) elevated++;
    // Quatro índices por célula; amostra um piso a cada três células.
    if (i % 12 !== 0) continue;
    for (let d = 0; d < 16; d++) {
      const angle = d / 8 * Math.PI;
      const hit = raycastBoxes({ ...p, y: p.y + 1.5 },
        { x: Math.cos(angle), y: 0, z: Math.sin(angle) }, net.shotBlockers, 120);
      lengths.push(hit?.t ?? 120);
    }
  }
  lengths.sort((a, b) => a - b);
  const eyes = map.spawns.ffa.map(p => ({ ...p, y: p.y + 1.5 }));
  let spawnPairs = 0;
  eyes.forEach((p, i) => eyes.slice(i + 1).forEach(q => {
    if (lineOfSight(p, q, net.shotBlockers)) spawnPairs++;
  }));
  result[id] = {
    accessibleArea: accessible, elevatedArea: elevated, spawnPairs,
    totalSpawnPairs: eyes.length * (eyes.length - 1) / 2,
    sightMedian: lengths[Math.floor(lengths.length * .5)],
    sightP90: lengths[Math.floor(lengths.length * .9)],
    raysOver40pct: 100 * lengths.filter(x => x > 40).length / lengths.length,
    samples: lengths.length,
  };
}
console.log(JSON.stringify(result, null, 2));
