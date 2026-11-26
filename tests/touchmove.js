// The phone move stick (2026-11-26, a player found it slow): a thumb's exact direction (input.mv) is used as it is,
// not rounded to 8 ways, and keys without mv move as before. Run: node tests/touchmove.js
import './_tmpdata.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { stepMove } from '../shared/physics.js';
import { CELL, T } from '../shared/constants.js';

const m = buildMap(MAP_LIST[0].id);
let start = -1; // a cell with open ground all round (so nothing stops the walk)
for (let k = 0; k < m.tiles.length && start < 0; k++) { const x = k % m.W, y = Math.floor(k / m.W); let ok = x > 6 && y > 6 && x < m.W - 7 && y < m.H - 7; for (let dy = -6; ok && dy <= 6; dy++) for (let dx = -6; ok && dx <= 6; dx++) if (m.tiles[k + dy * m.W + dx] !== T.FLOOR && m.tiles[k + dy * m.W + dx] !== T.GROUND) ok = false; if (ok) start = k; }
if (start < 0) { console.log('FAIL: no open spot'); process.exit(1); }
const run = input => { const o = { x: (start % m.W + 0.5) * CELL, y: (Math.floor(start / m.W) + 0.5) * CELL, vx: 0, vy: 0 }, x0 = o.x, y0 = o.y; for (let i = 0; i < 20; i++) stepMove(m, o, input, 1 / 30, { armor: 2 }); return Math.atan2(o.y - y0, o.x - x0) * 180 / Math.PI; };
let fails = 0; const check = (name, got, want) => { const ok = Math.abs(got - want) < 1.5; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${got.toFixed(1)}° (want ${want}°)`); };
check('thumb at 30° goes 30°', run({ right: 1, mv: 30 * Math.PI / 180 }), 30);
check('thumb at -70° goes -70°', run({ up: 1, mv: -70 * Math.PI / 180 }), -70);
check('keys right+down go 45° (no mv)', run({ right: 1, down: 1 }), 45);
check('keys up go -90°', run({ up: 1 }), -90);
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0);
