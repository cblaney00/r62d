// Outdoor scenes (shared/outdoors.js): every map's spawns are dressed to their theme, no spawn is blocked or shut in.
// Run: node tests/outdoors.js
import { buildMap, MAP_LIST } from '../shared/map.js';
import { T, CELL, blocksMove } from '../shared/constants.js';
import { OUTDOORS } from '../shared/outdoors.js';

let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const t0 = Date.now(), m = buildMap(id), o = m.outdoors, ms = Date.now() - t0;
  const W = m.W, gi = m.floors.findIndex(f => f.name === '1F'), n = m.props.filter(p => p.outdoor).length;
  if (!OUTDOORS[id]) fail(id, 'no outdoor scene');
  for (const s of m.atkSpawns) if (!OUTDOORS[id].spawns[s.name]) fail(id, 'no scene for spawn', s.name);
  if (o.placed / o.planned < 0.75) fail(id, `only ${o.placed}/${o.planned} pieces fit`);
  const seen = new Set(), start = Math.floor(m.atkSpawns[0].y / CELL) * W + Math.floor(m.atkSpawns[0].x / CELL), q = [start]; seen.add(start);
  for (let h = 0; h < q.length; h++) for (const d of [1, -1, W, -W]) { const k = q[h] + d; if (k < 0 || k >= m.tiles.length || seen.has(k) || m.flAt[k] !== gi || blocksMove(m.tiles[k])) continue; seen.add(k); q.push(k); }
  for (const s of m.atkSpawns) { const k = Math.floor(s.y / CELL) * W + Math.floor(s.x / CELL); if (blocksMove(m.tiles[k])) fail(id, s.name, 'spawn is inside something'); if (!seen.has(k)) fail(id, s.name, 'spawn is shut in'); }
  let cut = 0; for (let k = 0; k < m.tiles.length; k++) if (m.flAt[k] === gi && m.tiles[k] === T.GROUND && !seen.has(k)) { const F = m.floors[gi], x = k % W - F.gx, y = (k / W) | 0; if (x > 3 && y > 3 && x < F.w - 4 && y < F.h - 4) cut++; } // little pockets behind the edge trees don't matter
  if (cut > 0) fail(id, cut, 'ground cells cut off');
  console.log(id.padEnd(8), `${o.placed}/${o.planned} scene pieces, ${n} outdoor things, built in ${ms} ms`, o.missing.length ? 'left out: ' + o.missing.join(' ') : '');
}
console.log(fails ? `${fails} FAILED` : 'PASS'); process.exit(fails ? 1 : 0);
