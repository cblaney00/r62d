// TRENCH's Drop Cover (he asked: thin, at any angle, side by side, vaultable). Run: node tests/cover.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, CELL, T } from '../shared/constants.js';
import { stepMove, findVault, rayCovers } from '../shared/physics.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true });
const p = g.addPlayer('Tester', false);
g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
g.freeSwitch(p, 'trench');
// find an open spot: 5 x 5 cells of floor
const m = g.map; let spot = null;
for (let k = 0; k < m.tiles.length && !spot; k++) { const x = k % m.W, y = (k / m.W) | 0; let ok = x > 3 && y > 3;
  for (let dy = -3; ok && dy <= 3; dy++) for (let dx = -3; ok && dx <= 3; dx++) if (m.tiles[(y + dy) * m.W + x + dx] !== T.FLOOR) ok = false; if (ok) spot = { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL }; }
p.x = spot.x; p.y = spot.y; p.aim = 0.6; // an angle that isn't along the grid
g.event(p, { k: 'ability' }); for (let i = 0; i < 45; i++) g.tickPlayer(p, 1 / 30); g.time += 1.5; g.tickPlayer(p, 1 / 30);
let covers = g.ents.filter(e => e.type === 'cover');
if (covers.length !== 1) fail('no cover placed'); else console.log('cover at', covers[0].ang.toFixed(2), 'rad (aim + 90°)');
// another one right beside it
p.aim = 0.6; p.x += Math.cos(0.6 + Math.PI / 2) * 30; p.y += Math.sin(0.6 + Math.PI / 2) * 30; p.abilityCount = 2;
g.event(p, { k: 'ability' }); for (let i = 0; i < 45; i++) g.tickPlayer(p, 1 / 30); g.time += 1.5; g.tickPlayer(p, 1 / 30);
covers = g.ents.filter(e => e.type === 'cover');
if (covers.length !== 2) fail('could not place a second cover right beside the first');
// bullets stop at it
const c = covers[0], bx = c.x - Math.cos(0.6) * 40, by = c.y - Math.sin(0.6) * 40;
if (!rayCovers(m, bx, by, Math.cos(0.6), Math.sin(0.6), 100)) fail('a bullet line through the cover is not stopped');
// a body walking into it is stopped
const b = { x: bx, y: by, vx: 0, vy: 0 };
for (let i = 0; i < 60; i++) stepMove(m, b, { right: 1, rot: 0.6 }, 1 / 30, { armor: 2, mul: 1 });
const along = (b.x - c.x) * Math.cos(0.6) + (b.y - c.y) * Math.sin(0.6);
console.log('stopped', along.toFixed(1), 'px before the plate'); if (along > -7 || along < -14) fail('walked through the cover or never reached it', along.toFixed(1));
// and can vault it
const v = findVault(m, b.x, b.y, 0.6);
if (!v) fail('cannot vault the cover'); else console.log('vaults to', ((v.x - c.x) * Math.cos(0.6) + (v.y - c.y) * Math.sin(0.6)).toFixed(1), 'px past it');
console.log(fails ? `FAIL cover (${fails})` : 'PASS cover');
process.exit(fails ? 1 : 0);
