// Pushing as a team (he asked: bots walked on top of each other on the same path): plays bot matches on every map and
// measures, while teammates are moving in the action phase, how often two are under 0.5 m apart (on top of each
// other) and how often under 1 m. Run: node tests/spacing.js [--level 7]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, floorAt } from '../shared/map.js';
import { PHASE, PX_PER_M } from '../shared/constants.js';
const lvl = process.argv.includes('--level') ? +process.argv[process.argv.indexOf('--level') + 1] : 7;
let samples = 0, onTop = 0, close = 0;
for (const id of MAP_LIST) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = lvl;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  let t = 0;
  while (t < 60 * 12 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30; g.events = [];
    if (g.phase !== PHASE.ACTION || Math.round(t * 30) % 15) continue;
    const ps = [...g.players.values()].filter(p => p.alive && !p.downed && p.ctrl === 'body' && p.moving);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j]; if (a.squad !== b.squad || floorAt(g.map, a.x, a.y) !== floorAt(g.map, b.x, b.y)) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y) / PX_PER_M; if (d > 4) continue;
      samples++; if (d < 0.5) onTop++; if (d < 1) close++;
    }
  }
}
console.log(`moving teammates within 4 m: ${samples} samples, on top of each other (<0.5 m) ${(onTop / samples * 100).toFixed(1)}%, under 1 m ${(close / samples * 100).toFixed(1)}%`);
