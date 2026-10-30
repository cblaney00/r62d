// Barricades like R6 (he asked): every doorway and window starts boarded up; three melee hits break one; rifle,
// SMG, LMG and pistol bullets only chew small holes in it, which you can look (and shoot) through; a shotgun takes
// two blasts. Run: node tests/barricades.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, T, CELL } from '../shared/constants.js';
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
  const open = m.openings.filter(o => o.cells.some(c => m.tiles[c] !== T.BARRI && m.tiles[c] !== T.PANEL)); // (a defender may have put a steel panel up)
  if (open.length) fail(id, open.length, 'of', m.openings.length, 'doorways/windows not boarded up at the start');
  for (const q of g.players.values()) { q.bot = false; q.alive = true; q.staged = false; q.ctrl = 'body'; q.downed = false; q.bracing = false; }
  const p = [...g.players.values()][0];
  // a 2-cell doorway in a straight wall, floor on both sides
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
  // board it up again (defenders), then a shotgun: one blast is not enough, two are
  g.barricade(o.id, T.BARRI);
  if (m.holes[k]) fail(id, 'old bullet holes left in a new barricade');
  for (let i = 1; i <= 2; i++) {
    g.shotW = WEAPONS.breaker; for (let j = 0; j < 8; j++) g.hitscan(p, p.x, p.y, Math.PI / 2 + (j - 3.5) * 0.004, 600, 15, 'Breaker', 'Shotgun'); g.shotW = null;
    if (i === 1 && m.tiles[k] !== T.BARRI) fail(id, 'one shotgun blast broke the barricade');
    if (i === 2 && m.tiles[k] === T.BARRI) fail(id, 'two shotgun blasts did not break it');
  }
  console.log(`${id}: ${m.openings.length} doorways and windows boarded up`);
}
console.log(fails ? `${fails} failure(s)` : 'PASS barricades');
process.exit(fails ? 1 : 0);
