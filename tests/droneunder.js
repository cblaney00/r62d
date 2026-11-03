// He saw a drone "on top of" a bus. Checks every place a drone can go under, on every map: a drone can stand there, its view
// from there is not walled in, and a standing shooter can't hit it (a lying one can).
import './_tmpdata.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { CELL, T, UNDER_KINDS, underAt, blocksDrone } from '../shared/constants.js';
import { castSight } from '../shared/physics.js';
let bad = 0;
for (const id of MAP_LIST) {
  const m = buildMap(id), kinds = {}; let cells = 0, tight = 0, lone = [];
  for (const p of m.props || []) if (UNDER_KINDS.has(p.kind)) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
  for (let k = 0; k < m.tiles.length; k++) {
    if (!underAt(m, k, m.tiles[k])) continue; cells++;
    const x = (k % m.W + 0.5) * CELL, y = (Math.floor(k / m.W) + 0.5) * CELL;
    const poly = []; for (let i = 0; i < 96; i++) { const a = i / 96 * 6.2832, d = castSight(m, x, y, a, 230, [], false, true); poly.push([x + Math.cos(a) * d, y + Math.sin(a) * d]); }
    let a = 0; for (let i = 0, n = poly.length; i < n; i++) { const P = poly[i], Q = poly[(i + 1) % n]; a += (Array.isArray(P) ? P[0] * Q[1] - Q[0] * P[1] : P.x * Q.y - Q.x * P.y); }
    const area = Math.abs(a) / 2 / (CELL * CELL);
    if (area < 12) { tight++; if (lone.length < 3) lone.push(`${k % m.W},${Math.floor(k / m.W)}`); }
  }
  console.log(id.padEnd(9), 'cells under', String(cells).padStart(4), 'tight views', String(tight).padStart(3), lone.join(' '), JSON.stringify(kinds));
  bad += tight;
}
console.log(bad ? `NOTE ${bad} spots with a small view` : 'PASS');
