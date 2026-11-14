// Bots lean away from the cover beside them, so the body stays behind it and the head and gun come out past its
// edge (he saw pros lean into walls, bullets hitting them). Checks spots next to cover on every map: whenever
// leanSide picks a side, the leaning head sees further toward where it looks than the body does, and the head is not
// pushed into a wall. Also prints how the old rule (lean toward the nearer wall) did on the same spots.
import './_tmpdata.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { castSight, leanPoint, LEAN_PX } from '../shared/physics.js';
import { leanSide } from '../server/bots.js';
import { CELL, T } from '../shared/constants.js';
let bad = 0, picks = 0, oldBad = 0, oldPicks = 0, spots = 0;
for (const mp of MAP_LIST) {
  const id = mp.id || mp, m = buildMap(id), game = { map: m };
  let n = 0;
  for (let k = 0; k < m.tiles.length && n < 2500; k += 7) {
    const t = m.tiles[k]; if (t === T.HARD || t === T.SOFT || t === T.VOID) continue;
    const x = (k % m.W + 0.5) * CELL, y = (Math.floor(k / m.W) + 0.5) * CELL;
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, r = castSight(m, x, y, a + 0.7, 40, null), l = castSight(m, x, y, a - 0.7, 40, null);
      if (Math.min(r, l) > 30 || castSight(m, x, y, a, 60, null) < 40) continue; // only spots with cover beside and a way to look down
      n++; spots++;
      const far = s => { const lp = leanPoint(m, x, y, a, s * LEAN_PX); return { d: castSight(m, lp.x, lp.y, a, 400, null), moved: Math.hypot(lp.x - x, lp.y - y) }; };
      const body = castSight(m, x, y, a, 400, null);
      const s = leanSide(game, { x, y }, a);
      if (s) { picks++; const f = far(s); if (f.moved < LEAN_PX * 0.6 || f.d + 1 < Math.min(body, 156)) bad++; }
      const o = r < l ? 1 : -1; oldPicks++; { const f = far(o); if (f.moved < LEAN_PX * 0.6 || f.d + 1 < Math.min(body, 156)) oldBad++; }
    }
  }
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%';
console.log(`${spots} spots beside cover: new rule leans at ${picks}, into the wall or seeing less ${bad} (${pc(bad, picks)}); old rule ${oldBad} of ${oldPicks} (${pc(oldBad, oldPicks)})`);
console.log(bad / Math.max(1, picks) < 0.02 ? 'PASS leanside' : 'FAIL leanside');
