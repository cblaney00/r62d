// Free climbing and R6's window rule (he asked 2026-11-14): a climber goes up and down the wall at any height; only with
// the head level with a window can they and someone inside see and shoot each other (bots too); below or above it they
// can't, and only the rope (drawn by the client) gives them away. Run: node tests/climb.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { visibleEnemy } from '../server/bots.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { T, TEAM } from '../shared/constants.js';
import { castSight } from '../shared/physics.js';

let fails = 0, n = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game({ free: true });
  const a = g.addPlayer('Climber', false), d = g.addPlayer('Guard', false);
  g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 }); g.free.god = false;
  const m = g.map;
  if (g.side(a) !== TEAM.ATK) a.squad = 1 - a.squad;
  d.squad = 1 - a.squad; g.equip(d);
  const tick = (s, inp = {}) => { for (let i = 0; i < Math.max(1, s * 30); i++) { a.prevInput = a.input; a.input = { ...inp }; g.applyMove(a, 1 / 30); g.tickPlayer(a, 1 / 30); g.time += 1 / 30; } };
  for (const r of m.ropes.filter(r => r.cells.length && r.down < 0 && r.inside).slice(0, 4)) {
    Object.assign(a, { alive: true, downed: false, ctrl: 'body', rope: null, vault: null, busy: null, prep: null, hp: 999, x: r.base.x, y: r.base.y });
    tick(0.1); tick(0.1, { interact: 1 }); tick(0.1);
    if (!a.rope || a.rope.st !== 'hang') { fail(id, r.i, 'E did not put you on the wall'); continue; }
    if (g.ropeLevel(a)) fail(id, r.i, 'level with the window straight from the ground');
    // climb until level with this window
    let k = 0; while (k++ < 400 && !(g.ropeLevel(a) && m.ropes[a.rope.r].f === r.f && Math.abs((a.rope.h ?? 0) - 0.5) < 0.06)) tick(1 / 30, { rc: Math.sign(r.lvl + 0.5 - (m.ropes[a.rope.r].lvl + a.rope.h)) });
    if (!g.ropeLevel(a)) { fail(id, r.i, 'could not climb level with the window', JSON.stringify(a.rope)); continue; }
    n++;
    a.x = r.hang.x; a.y = r.hang.y; a.rope.r = r.i;
    for (const c of r.cells) { m.tiles[c] = T.OPEN; m.hp[c] = 0; }
    let spot = null; for (let dd = 12; dd < 120 && !spot; dd += 6) { const x = r.inside.x - Math.cos(r.out) * dd, y = r.inside.y - Math.sin(r.out) * dd; if (castSight(m, a.x, a.y, Math.atan2(y - a.y, x - a.x), Math.hypot(x - a.x, y - a.y), null, true) >= Math.hypot(x - a.x, y - a.y) - 1) spot = { x, y }; }
    if (!spot) continue;
    Object.assign(d, { alive: true, downed: false, ctrl: 'body', hp: 999, x: spot.x, y: spot.y, aim: Math.atan2(a.y - spot.y, a.x - spot.x) });
    a.aim = Math.atan2(d.y - a.y, d.x - a.x);
    const shoots = (src, dst) => { dst.hp = 999; const ang = Math.atan2(dst.y - src.y, dst.x - src.x); g.shotAim = { x: dst.x + Math.cos(ang + Math.PI / 2) * 5, y: dst.y + Math.sin(ang + Math.PI / 2) * 5 }; for (const off of [0.02, 0, -0.02]) if (dst.hp >= 999) g.hitscan(src, src.x, src.y, ang + off, 2000, 30, 'Test', 'AR'); g.shotAim = null; return dst.hp < 999; };
    if (!shoots(a, d)) fail(id, r.i, 'level: could not shoot in');
    if (!shoots(d, a)) fail(id, r.i, 'level: the defender could not shoot out');
    if (!visibleEnemy(g, d, 2000)) fail(id, r.i, 'level: a bot inside did not see the climber');
    // below the window: hidden both ways
    a.rope.h = 0.1;
    if (g.ropeLevel(a)) fail(id, r.i, 'below the sill counted as level');
    if (shoots(a, d)) fail(id, r.i, 'below the window: shot someone inside');
    if (shoots(d, a)) fail(id, r.i, 'below the window: was shot from inside');
    if (visibleEnemy(g, d, 2000)) fail(id, r.i, 'below the window: a bot inside saw the climber');
    if (g.startVault(a, 0)) fail(id, r.i, 'below the window: climbed in');
    // upside down from above: head comes down level with it
    a.rope.h = 0.95; a.rope.inv = true;
    if (!g.ropeLevel(a)) fail(id, r.i, 'upside down from above was not level with the window');
    a.rope.inv = false; a.rope.h = 0.5; d.x = -9000;
    // climbing down to the ground takes you off the rope
    tick(5, { rc: -1 });
    if (a.rope) fail(id, r.i, 'climbing all the way down did not put you on the ground', JSON.stringify(a.rope));
  }
  console.log(`${id}: done`);
}
console.log(fails ? `FAIL climb (${fails})` : `PASS climb (${n} windows)`);
process.exit(fails ? 1 : 0);
