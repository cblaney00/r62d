// Looking up through an open hatch from below (he asked: not too much): whatever spot you stand at near it, the patch
// of the floor above you can see never reaches more than HATCH_UP_SEE (1 m) past the opening's edge, and aiming at
// the opening counts as aiming up (aimUpHatch, the raised-gun pose). Run: node tests/hatchup.js
import { MAP_LIST, buildMap, floorAt, hatchSight, aimUpHatch, HATCH_UP_SEE, HATCH_LOOK } from '../shared/map.js';
import { canSee } from '../shared/physics.js';
import { T, CELL } from '../shared/constants.js';

let fails = 0, views = 0, seen = 0, far = 0;
const fail = (...a) => { fails++; if (fails < 20) console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const m = buildMap(id);
  for (const h of m.hatches) {
    for (const k of h.cells) m.tiles[k] = T.HOLE;
    const fb = floorAt(m, h.bx, h.by);
    for (let dx = -HATCH_LOOK; dx <= HATCH_LOOK; dx += 8) for (const st of ['stand', 'crouch', 'prone']) {
      const x = h.bx + dx, y = h.by + dx * 0.4;
      if (floorAt(m, x, y) !== fb) continue;
      const v = hatchSight(m, h, x, y, st); if (!v) continue;
      if (v.up) fail(id, h.id, 'a view from below says it looks down');
      views++;
      for (let ux = -5; ux <= 5; ux++) for (let uy = -5; uy <= 5; uy++) {
        const px = h.x + ux * CELL, py = h.y + uy * CELL;
        if (!canSee(m, v, px, py, [])) continue;
        seen++; const past = Math.max(Math.abs(px - h.x), Math.abs(py - h.y)) - CELL;
        if (past > HATCH_UP_SEE + 0.01) { far++; fail(id, h.id, st, 'sees', past.toFixed(0), 'px past the edge'); }
      }
      if (!aimUpHatch(m, x, y, h.bx + 4, h.by - 4)) fail(id, h.id, 'aiming at the opening is not aiming up');
    }
    if (aimUpHatch(m, h.bx + 6 * CELL, h.by + 6 * CELL, h.bx + 6 * CELL + 40, h.by + 6 * CELL)) fail(id, h.id, 'aiming at the floor counts as aiming up');
  }
}
console.log(`${views} views from below, ${seen} spots seen above, ${far} too far`);
console.log(fails ? `FAIL hatchup (${fails})` : 'PASS hatchup');
process.exit(fails ? 1 : 0);
