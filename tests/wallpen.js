// Shooting through walls (he asked: walls take damage off the bullet, so spraying through them doesn't win):
// the bullet loses more per wall for weak guns, a headshot through a wall isn't an instant kill, and past a wall
// a bullet can drift off target. Run: node tests/wallpen.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { T, CELL } from '../shared/constants.js';
import { WEAPONS, gunMods, penOf } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true });
const a = g.addPlayer('Shooter', false), b = g.addPlayer('Target', false);
g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
const m = g.map, W = m.W;
// a plain soft drywall cell with floor on both sides (across in y)
let k = -1;
for (let i = W * 2; i < m.tiles.length - W * 2; i++) if (m.tiles[i] === T.SOFT && !m.shape[i] && m.mat[i] === 0 && [1, 2, 3].every(d => m.tiles[i - W * d] === T.FLOOR && m.tiles[i + W * d] === T.FLOOR)) { k = i; break; }
if (k < 0) { console.log('no wall found'); process.exit(1); }
const cx = (k % W + 0.5) * CELL, cy = (Math.floor(k / W) + 0.5) * CELL;
const shoot = (wid, off = 2.5, n = 200) => { // n shots through the wall at a body 2.5 cells behind it (off px from its centre)
  let hits = 0, dmg = 0, kills = 0;
  for (let i = 0; i < n; i++) {
    m.tiles[k] = T.SOFT; m.hp[k] = 9999;
    for (const q of [a, b]) { q.alive = true; q.downed = false; q.ctrl = 'body'; q.viewTime = null; q.staged = false; }
    a.x = cx; a.y = cy - CELL * 2.5; b.x = cx + off; b.y = cy + CELL * 2.5; b.hp = 500; b.maxHp = 500;
    const w = WEAPONS[wid]; g.shotW = w;
    g.hitscan(a, a.x, a.y, Math.PI / 2, 2000, w.dmg, w.name, w.cls); g.shotW = null;
    if (b.hp < 500 || !b.alive) { hits++; dmg += 500 - Math.max(0, b.hp); if (!b.alive) kills++; }
  }
  return { hits, avg: hits ? dmg / hits : 0, kills };
};
// headshot (dead centre) through a wall: never an instant kill
const hs = shoot('k4', 0, 100);
if (hs.kills) fail('a headshot through a wall killed instantly', hs.kills, 'times');
// damage left after one wall follows the gun
for (const id of ['k4', 'v9', 'pike']) {
  const r = shoot(id, 3);
  const want = WEAPONS[id].dmg * penOf(WEAPONS[id]);
  if (r.hits && Math.abs(r.avg - want) > 1) fail(id, 'did', r.avg.toFixed(1), 'through a wall, expected', want.toFixed(1));
  console.log(`${WEAPONS[id].name}: ${r.hits}/200 hit through the wall, ${r.avg.toFixed(1)} damage (${WEAPONS[id].dmg} in the open)`);
}
// drift: a shot aimed at the edge of the body sometimes misses after a wall
const edge = shoot('k4', 5.5);
if (edge.hits === 200) fail('no drift: every edge shot through the wall hit');
if (edge.hits === 0) fail('edge shots never hit');
console.log(`edge shots through a wall: ${edge.hits}/200 hit`);
console.log(fails ? `${fails} failure(s)` : 'PASS wallpen');
process.exit(fails ? 1 : 0);
