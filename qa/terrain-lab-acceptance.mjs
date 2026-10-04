import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { canStand, findPath, sweep } from '../dist/ea-navigation.mjs';
import { audit, command, createMap, createState, master, POIS, step, VERSION } from '../dist/terrain-lab/world.mjs';
const map = createMap(); let segments = 0;
for (const from of POIS) for (const goal of POIS) { const route = findPath(map, from, goal, { snap: false }); assert.ok(route); let p = from; for (const q of route) { assert.equal(sweep(map, p, q).blocked, false); segments++; p = q; } }
let sweeps = 0;
for (const p of [POIS[0], POIS[2], { x: 7.5, y: 15.5 }, { x: 19.5, y: 17.5 }, POIS[3]]) for (let d = 0; d < 360; d++) { const angle = d * Math.PI / 180; const q = sweep(map, p, { x: p.x + Math.cos(angle) * 5, y: p.y + Math.sin(angle) * 5 }); assert.ok(canStand(map, q)); sweeps++; }
const s = createState(); for (let i = 0; i < 4; i++) assert.ok(command(s, 'recruit'));
for (let cycle = 0; cycle < 10; cycle++) {
  command(s, 'party', [s.actors[1 + cycle % 9].id, s.actors[1 + (cycle + 3) % 9].id]);
  const destination = POIS.find(p => p.id === ['garden', 'home', 'arena'][cycle % 3]); assert.ok(command(s, 'walk', destination));
  for (let tick = 0; tick < 600; tick++) step(s, .05);
  assert.ok(Math.hypot(master(s).x - destination.x, master(s).y - destination.y) < .02);
  assert.deepEqual(audit(s), []);
}
assert.equal(s.stats.violations, 0);
const result = { version: VERSION, generatedAt: new Date().toISOString(), publicDestinationPairs: 25, validatedRouteSegments: segments, sweptDirections: sweeps, residents: s.actors.length, simulatedSeconds: +s.elapsed.toFixed(2), commandedJourneys: 10, crowdMetrics: s.stats, assertionResult: 'passed', browserAcceptance: 'Recorded separately; this script does not test rendering or real devices.' };
writeFileSync(new URL('./terrain-lab-acceptance-report.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
