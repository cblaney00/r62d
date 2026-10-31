// Every window and every door to the outside starts boarded on every map, and once its boards are gone every
// window can be vaulted through from both sides (he asked). Run: node tests/outside.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { T, CELL, FL } from '../shared/constants.js';
import { findVault } from '../shared/physics.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); const m = g.map, W = m.W;
  g.boardWindows();
  let wins = 0, doors = 0, vaulted = 0, upstairs = 0;
  for (const o of m.openings) {
    const out = o.ext || o.cells.some(c => [1, -1, W, -W].some(d => { const k = c + d, t = m.tiles[k]; return !o.cells.includes(k) && m.flAt[k] === m.flAt[c] && (t === T.GROUND || t === T.VOID || (t === T.LOW && m.floor[k] === FL.VOID)); }));
    if (o.kind !== 'window' && !out) continue;
    if (o.kind === 'window') wins++; else doors++;
    if (!o.cells.every(c => m.tiles[c] === T.BARRI)) fail(id, o.kind, o.id, 'not boarded');
    if (o.kind !== 'window') continue;
    for (const c of o.cells) m.tiles[c] = T.OPEN; // boards broken
    const c = o.cells[o.cells.length >> 1], cx = (c % W + 0.5) * CELL, cy = (Math.floor(c / W) + 0.5) * CELL;
    const wall = k => m.tiles[k] === T.HARD || m.tiles[k] === T.SOFT || m.tiles[k] === T.REINF;
    const horiz = o.cells.length > 1 ? Math.abs(o.cells[1] - o.cells[0]) === 1 : wall(c - 1) || wall(c + 1); // the wall runs left-right: you cross it up/down
    const [dx, dy] = horiz ? [0, 1] : [1, 0];
    const flr = s => { const k = Math.floor((cy + dy * s * CELL * 1.2) / CELL) * W + Math.floor((cx + dx * s * CELL * 1.2) / CELL); return m.tiles[k] === T.FLOOR || m.tiles[k] === T.GROUND; };
    if (!flr(-1) && !flr(1)) { fail(id, 'window', o.id, 'no floor on either side'); continue; }
    if (!flr(-1) || !flr(1)) { upstairs++; continue; } // air outside an upstairs window: you climb in from the rope (tests/rappel.js)
    for (const s of [-1, 1]) {
      const x = cx + dx * s * CELL * 1.2, y = cy + dy * s * CELL * 1.2;
      if (findVault(m, x, y, Math.atan2(-dy * s, -dx * s))) vaulted++; else fail(id, 'window', o.id, 'cannot be vaulted from one side');
    }
  }
  console.log(`${id}: ${wins} windows and ${doors} outside doors boarded; ${vaulted} window vaults ok (both ways), ${upstairs} upstairs windows reached by rope`);
}
console.log(fails ? `${fails} failure(s)` : 'PASS outside');
process.exit(fails ? 1 : 0);
