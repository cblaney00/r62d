// Barricades like R6 (he asked): doorways start open, windows start boarded, each defender has 3 barricades that take ~2.5 s
// to put up; a barricade breaks as one board; three melee hits break one; rifle,
// SMG, LMG and pistol bullets only chew small holes in it, which you can look (and shoot) through; a shotgun takes
// two blasts. Run: node tests/barricades.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, T, CELL, TEAM, DUR, BARRICADES_EACH } from '../shared/constants.js';
import { castSight } from '../shared/physics.js';
import { WEAPONS } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game();
  for (let i = 0; i < 2; i++) g.addBot();
  g.mapId = id; g.map = buildMap(id); g.startMatch();
  while (g.phase !== PHASE.PREP) g.tick(1 / 30);
  const m = g.map, W = m.W;
  const defs = [...g.players.values()].filter(q => g.side(q) === TEAM.DEF);
  const boarded = m.openings.filter(o => o.kind !== 'window' && o.cells.some(c => m.tiles[c] === T.BARRI)).length;
  for (const o of m.openings) if (o.kind === 'window' && !o.cells.every(c => m.tiles[c] === T.BARRI)) { fail(id, 'a window did not start boarded'); break; }
  if (boarded > defs.length * BARRICADES_EACH) fail(id, boarded, 'barricades up from', defs.length, 'defenders');
  if (boarded === m.openings.filter(o => o.kind !== 'window').length) fail(id, 'every doorway boarded up at the start');
  for (const q of defs) if (q.barri < 0 || q.barri > BARRICADES_EACH) fail(id, q.name, 'has', q.barri, 'barricades');
  // a person holding E: about 2.5 s each, 3 of them, then none left
  {
    const d = defs[0], sw = d.bot; d.bot = false; d.alive = true; d.ctrl = 'body'; d.barri = BARRICADES_EACH;
    let done = 0;
    for (const o of m.openings) {
      if (done > BARRICADES_EACH) break;
      if (!o.cells.every(c => m.tiles[c] === T.OPEN)) continue;
      const k = o.cells[0], cx = (k % W + 0.5) * CELL, cy = (Math.floor(k / W) + 0.5) * CELL;
      const spot = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: cx + dx * CELL * 1.3, y: cy + dy * CELL * 1.3 }))
        .find(s => [T.FLOOR, T.GROUND].includes(m.tiles[Math.floor(s.y / CELL) * W + Math.floor(s.x / CELL)]));
      if (!spot) continue;
      d.x = spot.x; d.y = spot.y; d.aim = Math.atan2(cy - spot.y, cx - spot.x); d.busy = null;
      const left = d.barri; let t = 0;
      d.input.interact = 1;
      for (; t < 4 && !o.cells.every(c => m.tiles[c] === T.BARRI); t += 1 / 30) { d.input.interact = 1; d.aim = Math.atan2(cy - spot.y, cx - spot.x); if (!d.busy) d.busy = g.startInteract(d); if (d.busy) g.continueInteract(d, 1 / 30); }
      d.input.interact = 0; d.busy = null;
      const up = o.cells.every(c => m.tiles[c] === T.BARRI);
      if (left > 0) {
        if (!up) { fail(id, 'holding E did not barricade', o.kind); continue; }
        if (Math.abs(t - DUR.barricade) > 0.1) fail(id, 'barricade took', t.toFixed(2), 's');
        if (d.barri !== left - 1) fail(id, 'barricade count did not go down');
      } else if (up) fail(id, 'a 4th barricade went up');
      done++;
    }
    d.bot = sw;
  }
  for (const q of g.players.values()) { q.bot = false; q.alive = true; q.staged = false; q.ctrl = 'body'; q.downed = false; q.bracing = false; if (q.op === 'bulwark') q.op = 'ember'; } // the shield's melee is a bash
  const p = [...g.players.values()][0];
  // a 2-cell doorway in a straight wall, floor on both sides
  for (const o of m.openings) if (o.cells.every(c => m.tiles[c] === T.OPEN)) g.barricade(o.id, T.BARRI, true); // board everything up for the rest
  const o = m.openings.find(o => o.cells.length === 2 && o.cells.every(c => m.tiles[c] === T.BARRI) && o.cells.every(c => [W, -W].every(d => m.tiles[c + d] === T.FLOOR || m.tiles[c + d] === T.GROUND)));
  if (!o) { console.log(id, 'no simple doorway to test'); continue; }
  const k = o.cells[0], cx = (k % W + 0.5) * CELL, cy = (Math.floor(k / W) + 0.5) * CELL;
  // bullets: holes, no damage; then you can see through the hole
  p.x = cx; p.y = cy - CELL * 2; p.aim = Math.PI / 2; p.viewTime = null;
  const hp0 = m.hp[k], before = castSight(m, p.x, p.y, Math.PI / 2, 200);
  g.shotW = WEAPONS.k4; g.hitscan(p, p.x, p.y, Math.PI / 2, 600, 31, 'K4', 'AR'); g.shotW = null;
  if (m.hp[k] !== hp0) fail(id, 'a rifle bullet damaged the barricade');
  if (!(m.holes[k] && m.holes[k].length)) fail(id, 'a rifle bullet left no hole');
  const after = castSight(m, p.x, p.y, Math.PI / 2, 200);
  if (!(after > before + CELL)) fail(id, 'cannot see through the bullet hole', before, after);
  // melee: three hits
  p.y = cy - CELL * 1.2;
  for (let i = 1; i <= 3; i++) {
    p.meleeCd = 0; g.melee(p);
    const broken = o.cells.every(c => m.tiles[c] === T.OPEN);
    if (i < 3 && broken) fail(id, 'barricade broke after', i, 'melee hits');
    if (i === 3 && !broken) fail(id, 'barricade still up after 3 melee hits');
  }
  // one board: a marksman shot that breaks one half breaks all of it (no half-boarded doorway)
  g.barricade(o.id, T.BARRI);
  g.damageCell(o.cells[1], 1000);
  if (!o.cells.every(c => m.tiles[c] === T.OPEN)) fail(id, 'half a barricade left standing');
  // board it up again (defenders), then a shotgun: one blast is not enough, two are
  g.barricade(o.id, T.BARRI);
  if (m.holes[k]) fail(id, 'old bullet holes left in a new barricade');
  for (let i = 1; i <= 2; i++) {
    g.shotW = WEAPONS.breaker; for (let j = 0; j < 8; j++) g.hitscan(p, p.x, p.y, Math.PI / 2 + (j - 3.5) * 0.004, 600, 15, 'Breaker', 'Shotgun'); g.shotW = null;
    if (i === 1 && m.tiles[k] !== T.BARRI) fail(id, 'one shotgun blast broke the barricade');
    if (i === 2 && m.tiles[k] === T.BARRI) fail(id, 'two shotgun blasts did not break it');
  }
  console.log(`${id}: ${boarded} of ${m.openings.filter(o => o.kind !== 'window').length} doorways boarded by the bots at the start (every window starts boarded)`);
}
console.log(fails ? `${fails} failure(s)` : 'PASS barricades');
process.exit(fails ? 1 : 0);
