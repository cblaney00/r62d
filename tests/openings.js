// Every door and window is still open after the map is built (a wall drawn later must not cover one). Run: node tests/openings.js
import { MAP_LIST, buildMap } from '../shared/map.js';
import { T } from '../shared/constants.js';
let bad = 0;
for (const id of MAP_LIST) { const m = buildMap(id);
  for (const o of m.openings) { const off = o.cells.filter(k => m.tiles[k] !== T.OPEN && m.tiles[k] !== T.BARRI); if (off.length) { bad++; console.log(id, 'opening', o.id, o.kind, 'covered at', off.map(k => (k % m.W) + ',' + Math.floor(k / m.W)).join(' ')); } }
  console.log(id, m.W + 'x' + m.H, 'rooms', m.rooms.length);
}
console.log(bad ? 'FAIL' : 'PASS'); process.exit(bad ? 1 : 0);
