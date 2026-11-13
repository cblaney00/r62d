// Bomb-site compass (he asked 2026-11-12: intuitive and accurate). On every map and site, a walker starts at each
// attacker spawn and only ever steps toward where the compass needle points (taking the stairs/hatch when it says so).
// It must reach the site, and the needle's distance must be close to the walk it really took. Run: node tests/compass.js
import { buildMap, MAP_LIST } from '../shared/map.js';
import { compassRoute } from '../shared/compass.js';
import { CELL } from '../shared/constants.js';

let fails = 0, runs = 0, worst = 0;
for (const id of MAP_LIST) {
  const m = buildMap(id), W = m.W;
  for (let si = 0; si < m.sites.length; si++) for (const sp of m.atkSpawns) {
    runs++;
    let x = sp.x, y = sp.y, walked = 0, ok = false, first = null; const C = {};
    for (let i = 0; i < 4000; i++) {
      const r = compassRoute(m, m, si, { x, y }, C);
      if (!r) break;
      if (r.here) { ok = true; break; }
      if (first == null) first = r.cells;
      const tx = (r.aim % W + 0.5) * CELL, ty = (Math.floor(r.aim / W) + 0.5) * CELL, d = Math.hypot(tx - x, ty - y);
      if (r.via != null && r.aim === r.at && d < CELL * 0.8) { x = (r.via % W + 0.5) * CELL; y = (Math.floor(r.via / W) + 0.5) * CELL; walked += CELL; continue; }
      const st = Math.min(d, CELL * 0.5); if (st < 0.01) { break; }
      x += (tx - x) / d * st; y += (ty - y) / d * st; walked += st;
    }
    if (!ok) { fails++; console.log(`FAIL ${id} site ${m.sites[si].name} from ${sp.name}: the compass did not lead there (at ${Math.round(x)},${Math.round(y)})`); continue; }
    const err = Math.abs(walked / CELL - first) / Math.max(1, first); worst = Math.max(worst, err);
    if (err > 0.15) { fails++; console.log(`FAIL ${id} ${m.sites[si].name} from ${sp.name}: said ${Math.round(first)} cells, walked ${Math.round(walked / CELL)}`); }
  }
}
console.log(`${runs} walks, worst distance error ${(worst * 100).toFixed(1)}%`);
console.log(fails ? `FAIL compass (${fails})` : 'PASS compass');
process.exit(fails ? 1 : 0);
