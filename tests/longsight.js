// Long indoor sightlines (he asked 2026-11-15: chop up the long hallways; at most 2 or 3 super long indoor angles in the
// whole game, unless soft walls are destroyed; Dust Town is free of this). From every indoor floor cell, sight is cast in
// 32 directions with the map as it starts (soft walls standing, windows boarded); a line that stays indoors for LONG
// metres or more is a long angle. Lines along the same corridor are grouped into one angle (direction + sideways offset).
// Usage: node tests/longsight.js [metres=20] [--all]   (prints every angle; PASS if the game has at most MAX outside Dust Town)
import { buildMap, MAP_LIST, floorAt, roomAt } from '../shared/map.js';
import { castSight } from '../shared/physics.js';
import { CELL, T, FL, PX_PER_M } from '../shared/constants.js';
const LONG = (+process.argv[2] || 20) * PX_PER_M, MAX = 3, FREE = new Set(['dust']);
const INDOOR = t => t === T.FLOOR || t === T.LOW || t === T.STAIR || t === T.HATCH;
let total = 0; const all = [];
for (const it of MAP_LIST) {
  const id = it.id || it, m = buildMap(id), W = m.W, angles = [];
  const rooms = new Set(m.rooms.map(r => r.name)); // indoors = inside a named room (a balcony, walkway or the ledge along an outside wall is not)
  const indoor = (x, y) => { const k = Math.floor(y / CELL) * W + Math.floor(x / CELL); return INDOOR(m.tiles[k]) && m.flAt[k] !== m.roofFloor && m.floor[k] !== FL.VOID && rooms.has(roomAt(m, x, y)); };
  for (let k = 0; k < m.tiles.length; k += 1) {
    const cx = k % W, cy = Math.floor(k / W); if ((cx + cy) % 2) continue; // every other cell is plenty
    if (!INDOOR(m.tiles[k]) || m.flAt[k] === m.roofFloor || m.flAt[k] < 0) continue;
    const x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL; if (!roomAt(m, x, y)) continue;
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI / 16, d = castSight(m, x, y, a, 120 * PX_PER_M, null); if (d < LONG) continue;
      let inside = true; for (let t = 0; t <= d && inside; t += CELL / 2) inside = indoor(x + Math.cos(a) * t, y + Math.sin(a) * t); if (!inside) continue;
      const ai = i % 16, ca = Math.cos(ai * Math.PI / 16), sa = Math.sin(ai * Math.PI / 16), off = -x * sa + y * ca, f = floorAt(m, x, y);
      let g = angles.find(q => q.ai === ai && q.f === f && Math.abs(q.off - off) < 6 * CELL);
      if (!g) angles.push(g = { ai, f, off, n: 0, x, y, a, d, from: roomAt(m, x, y), to: roomAt(m, x + Math.cos(a) * (d - 4), y + Math.sin(a) * (d - 4)) });
      g.n++; if (d > g.d) Object.assign(g, { x, y, a, d, from: roomAt(m, x, y), to: roomAt(m, x + Math.cos(a) * (d - 4), y + Math.sin(a) * (d - 4)) });
    }
  }
  const nm = r => r ? (r.name || r) : 'outside';
  console.log(`${id}: ${angles.length} long indoor angles${FREE.has(id) ? ' (free of the limit)' : ''}`);
  for (const g of angles.sort((p, q) => q.d - p.d)) console.log(`   ${m.floors[g.f] ? m.floors[g.f].name : g.f}  ${(g.d / PX_PER_M).toFixed(0)}+ m  ${nm(g.from)} → ${nm(g.to)}  at ${Math.round(g.x)},${Math.round(g.y)} dir ${(g.a * 180 / Math.PI).toFixed(0)}°  (${g.n} spots)`);
  if (!FREE.has(id)) total += angles.length;
}
console.log(total <= MAX ? `PASS ${total} long indoor angles outside Dust Town (at most ${MAX})` : `FAIL ${total} long indoor angles outside Dust Town (at most ${MAX})`);
process.exit(total <= MAX ? 0 : 1);
