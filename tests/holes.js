// Rifles, SMGs, pistols and LMGs only punch small see-through holes in soft walls; shotguns
// still break them. Run: node tests/holes.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { T, CELL, CELL_HP } from '../shared/constants.js';
import { los } from '../shared/physics.js';

const g = new Game(), m = g.map;
let k = -1;
for (let i = 0; i < m.tiles.length && k < 0; i++) { // a one-cell-thick soft wall with floor either side
  const x = i % m.W, y = Math.floor(i / m.W), f = (cx) => m.tiles[y * m.W + cx] === T.FLOOR;
  if (m.tiles[i] === T.SOFT && f(x - 1) && f(x - 2) && f(x + 1) && f(x + 2) && m.tiles[i - m.W] === T.SOFT && m.tiles[i + m.W] === T.SOFT) k = i;
}
const cx = k % m.W, cy = Math.floor(k / m.W), y = (cy + 0.5) * CELL;
const src = { id: 'test', x: (cx - 1.5) * CELL, y, aim: 0 };
const far = { x: (cx + 2.5) * CELL, y };
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
ok(!los(m, src.x, src.y, far.x, far.y), 'a plain soft wall blocks sight');
for (let i = 0; i < 60; i++) g.hitscan(src, src.x, src.y, 0, 600, 31, 'K4', 'AR');
ok(m.tiles[k] === T.SOFT && m.hp[k] === CELL_HP[T.SOFT], '60 rifle bullets leave the wall standing and undamaged');
ok(m.holes[k] && m.holes[k].length === 2, 'the same spot makes one hole');
ok(los(m, src.x, src.y, far.x, far.y), 'you can see straight through the hole');
ok(los(m, src.x - 20, src.y, far.x + 20, far.y), 'and along that line further back');
ok(!los(m, src.x, src.y, far.x, far.y + 6), 'but not a few pixels to the side');
for (const cls of ['Pistol', 'SMG', 'MP', 'LMG']) g.hitscan(src, src.x, src.y, 0.04, 600, 30, cls, cls);
ok(m.tiles[k] === T.SOFT && m.hp[k] === CELL_HP[T.SOFT], 'pistols, SMGs, machine pistols and LMGs do not break it either');
const shotK = k + m.W; // the cell below: a shotgun still smashes it
for (let i = 0; i < 10 && m.tiles[shotK] === T.SOFT; i++) g.hitscan(src, src.x, src.y + CELL, 0, 600, 15, 'Breaker', 'Shotgun');
ok(m.tiles[shotK] !== T.SOFT, 'shotguns still break soft walls');
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
