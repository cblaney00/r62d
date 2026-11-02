// Jumping onto furniture and leaning (he asked). Run: node tests/jumplean.js
import { buildMap } from '../shared/map.js';
import { stepMove, standable, LEAN_PX } from '../shared/physics.js';
import { CELL, T } from '../shared/constants.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const m = buildMap('harbor'), W = m.W;
// a low furniture cell with plain floor two cells to its left
let k = -1;
for (let i = 0; i < m.tiles.length && k < 0; i++) if (standable(m, i) && m.tiles[i - 1] === T.FLOOR && m.tiles[i - 2] === T.FLOOR && m.tiles[i - 3] === T.FLOOR && m.tiles[i - 1 - W] === T.FLOOR && m.tiles[i - 1 + W] === T.FLOOR) k = i;
if (k < 0) { console.log('FAIL no furniture found'); process.exit(1); }
const cx = (k % W + 0.5) * CELL, cy = (Math.floor(k / W) + 0.5) * CELL;
const o = { x: cx - 2.2 * CELL, y: cy, vx: 0, vy: 0 }, mods = { armor: 2, mul: 1 };
for (let i = 0; i < 60; i++) stepMove(m, o, { right: 1 }, 1 / 30, mods);
if (o.x > cx - CELL * 0.6) fail('walked into furniture without jumping', o.x - cx);
for (let i = 0; i < 40; i++) stepMove(m, o, { right: 1, jump: i === 0 ? 1 : 0 }, 1 / 30, mods);
const onIt = standable(m, Math.floor(o.y / CELL) * W + Math.floor(o.x / CELL));
console.log('after a jump: up =', !!o.up, 'standing on furniture =', onIt);
if (!o.up && !onIt) fail('jumping did not get onto the furniture');
// lean right while facing up: moves to +x (screen right) by LEAN_PX, and back
const p = { x: cx - 2.2 * CELL, y: cy, vx: 0, vy: 0 }, x0 = p.x;
for (let i = 0; i < 20; i++) stepMove(m, p, { lean: 1, la: -Math.PI / 2 }, 1 / 30, mods);
console.log('lean right moved', (p.x - x0).toFixed(1), 'px');
if (Math.abs(p.x - x0 - LEAN_PX) > 1.5) fail('lean did not move LEAN_PX sideways', p.x - x0);
for (let i = 0; i < 20; i++) stepMove(m, p, { lean: 0, la: -Math.PI / 2 }, 1 / 30, mods);
if (Math.abs(p.x - x0) > 1) fail('did not come back from the lean', p.x - x0);
console.log(fails ? `FAIL jumplean (${fails})` : 'PASS jumplean');
process.exit(fails ? 1 : 0);
