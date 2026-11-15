// Solid walls and floors are never see-through (he asked 2026-11-15). On every map:
//  1. a sight line that runs straight through the solid middle of an intact wall cell (concrete, plaster, brick,
//     reinforced, metal panel; no bullet holes in it, not an angled piece) never sees past it;
//  2. nobody sees from one floor onto another through the map grid (floors sit side by side in it; only stairs,
//     hatches and windows join them, and those go through their own views, not plain sight).
// Usage: node tests/solidsight.js [samples per floor]
import { buildMap, MAP_LIST, floorAt } from '../shared/map.js';
import { los } from '../shared/physics.js';
import { CELL, T, walkable } from '../shared/constants.js';

const N = Number(process.argv[2] || 4000), SOLID = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL]);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let fails = 0, checked = 0, cross = 0;
for (const it of MAP_LIST) {
  const id = it.id || it, m = buildMap(id), W = m.W;
  const spots = m.floors.map(() => []);
  for (let k = 0; k < m.tiles.length; k++) if (walkable(m.tiles[k])) { const x = (k % W + 0.5) * CELL, y = (Math.floor(k / W) + 0.5) * CELL, f = floorAt(m, x, y); if (f >= 0) spots[f].push([x, y]); }
  const solidMid = (x, y) => { // inside the solid middle of an intact plain wall cell (2 px in from its edges)
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), k = cy * W + cx;
    if (!SOLID.has(m.tiles[k]) || (m.shape && m.shape[k]) || (m.holes && m.holes[k] && m.holes[k].length)) return false;
    const fx = x - cx * CELL, fy = y - cy * CELL; return fx > 2 && fx < CELL - 2 && fy > 2 && fy < CELL - 2;
  };
  let bad = 0, cr = 0;
  for (let f = 0; f < m.floors.length; f++) {
    const S = spots[f]; if (S.length < 2) continue;
    for (let i = 0; i < N; i++) {
      const [ax, ay] = S[Math.floor(rnd() * S.length)], [bx, by] = S[Math.floor(rnd() * S.length)], d = Math.hypot(bx - ax, by - ay);
      if (d < CELL * 2 || d > 900) continue;
      let through = false; for (let t = 0.02; t < 0.98 && !through; t += 2 / d) through = solidMid(ax + (bx - ax) * t, ay + (by - ay) * t);
      if (!through) continue; checked++;
      if (los(m, ax, ay, bx, by, null)) { bad++; if (bad <= 3) console.log(`  ${id}: sees through a wall from ${ax},${ay} to ${bx},${by}`); }
    }
    for (let g = 0; g < m.floors.length; g++) if (g !== f && spots[g].length) for (let i = 0; i < N / 8; i++) {
      const [ax, ay] = S[Math.floor(rnd() * S.length)], [bx, by] = spots[g][Math.floor(rnd() * spots[g].length)];
      if (Math.hypot(bx - ax, by - ay) > 1400) continue; cross++;
      if (los(m, ax, ay, bx, by, null)) { cr++; if (cr <= 3) console.log(`  ${id}: floor ${m.floors[f].name} sees floor ${m.floors[g].name} through the grid, ${ax},${ay} to ${bx},${by}`); }
    }
  }
  console.log(`${id}: ${bad} wall leaks, ${cr} floor-to-floor leaks`);
  fails += bad + cr;
}
console.log(`${checked} lines through walls, ${cross} lines between floors checked`);
console.log(fails ? `FAIL ${fails} see-through sight lines` : 'PASS no sight line passes a solid wall or between floors');
process.exit(fails ? 1 : 0);
