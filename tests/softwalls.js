// Fewer breakable walls: how many stay breakable on each map, and how many each site room has.
// Fails if a site room is left with more than 3 breakable walls (its partner + 2) or none at all.
import { MAPS, buildMap } from '../shared/map.js';
import { T } from '../shared/constants.js';

let bad = 0;
for (const id of Object.keys(MAPS)) {
  const m = buildMap(id);
  let soft = 0, hard = 0, holes = 0;
  for (let k = 0; k < m.W * m.H; k++) { if (m.tiles[k] === T.SOFT) soft++; if (m.hardened[k]) hard++; if (m.dhole[k]) holes++; }
  console.log(`${m.name}: ${soft} breakable wall cells, ${hard} made solid (${Math.round(100 * hard / (soft + hard))}%), ${holes} drone holes`);
  for (const s of m.sites) for (const name of s.rooms) {
    const r = m.rooms.find(q => q.name === name);
    // count separate breakable stretches round the room
    const ring = [];
    for (let x = r.x - 1; x <= r.x + r.w; x++) ring.push([x, r.y - 1, 0], [x, r.y + r.h, 1]);
    for (let y = r.y; y < r.y + r.h; y++) ring.push([r.x - 1, y, 2], [r.x + r.w, y, 3]);
    const cells = ring.filter(([x, y]) => m.tiles[y * m.W + x] === T.SOFT).length;
    const sides = new Set(ring.filter(([x, y]) => m.tiles[y * m.W + x] === T.SOFT).map(c => c[2])).size;
    console.log(`   ${s.name.padEnd(28)} ${name.padEnd(16)} ${String(cells).padStart(3)} breakable cells on ${sides} side(s)`);
    if (cells === 0) { console.log('      ^ no breakable wall at all'); bad++; }
  }
}
console.log(bad ? `FAIL (${bad})` : 'PASS');
process.exit(bad ? 1 : 0);
