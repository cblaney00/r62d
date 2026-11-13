// Rappelling: on every map, an attacker climbs every rope, slides along the wall, can't climb in through a boarded
// window, climbs in through an open one, lets go back to the ground, and can be seen and shot while hanging.
// Run: node tests/rappel.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, floorAt, ropeS } from '../shared/map.js';
import { T, TEAM, CELL } from '../shared/constants.js';
import { canSee } from '../shared/physics.js';

let fails = 0, n = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game({ free: true });
  const a = g.addPlayer('Climber', false), d = g.addPlayer('Guard', false);
  g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 });
  const m = g.map;
  if (!m.ropes.length) { fail(id, 'no ropes'); continue; }
  const tick = (s, inp = {}) => { for (let i = 0; i < s * 30; i++) { a.prevInput = a.input; a.input = { ...inp }; g.applyMove(a, 1 / 30); g.tickPlayer(a, 1 / 30); g.time += 1 / 30; } };
  let walls = 0;
  for (const r of m.ropes) {
    if (r.down >= 0) continue; // (reached from the stop below it: tests/roof.js)
    n++;
    Object.assign(a, { alive: true, downed: false, ctrl: 'body', rope: null, vault: null, busy: null, hp: 100, x: r.base.x, y: r.base.y });
    if (g.side(a) !== TEAM.ATK) { a.squad = 1 - a.squad; if (g.side(a) !== TEAM.ATK) { fail(id, 'climber is not attacking'); break; } }
    tick(0.1); tick(0.1, { interact: 1 }); tick(0.1);
    if (!a.rope) { fail(id, 'rope', r.i, 'E did not start the climb'); continue; }
    tick(2 * r.lvl + 0.2);
    if (!a.rope || a.rope.st !== 'hang' || floorAt(m, a.x, a.y) !== r.f) { fail(id, 'rope', r.i, 'not hanging on the right floor', a.rope && a.rope.st); continue; }
    if (a.rope.r !== r.i) { const q = m.ropes[a.rope.r]; if (q.f !== r.f || Math.abs(q.ax - r.ax) * CELL > Math.max(r.b - r.a, q.b - q.a) + 40) fail(id, 'rope', r.i, 'climbed a rope somewhere else', q.i); Object.assign(a, { rope: null }); continue; } // (two stretches start from the same spot on the ground: the nearer one)
    // slide both ways along the wall
    const along = () => { const q = m.ropes[a.rope.r]; return q.ax * CELL + ropeS(q, a.x, a.y) - r.ax * CELL; }; // (sliding can carry on onto the next stretch of wall)
    const s0 = along();
    tick(3, { right: 1 }); tick(3, { down: 1 }); const s1 = along(), on1 = a.rope.r;
    tick(6, { left: 1 }); tick(6, { up: 1 }); const s2 = along(), on2 = a.rope.r;
    a.rope.r = r.i;
    if (r.b - r.a > 20 && !(s1 > s0 + 4 || s2 < s0 - 4)) fail(id, 'rope', r.i, 'could not slide along the wall', s0, s1, s2);
    if ((on2 === r.i && s2 < r.a - 0.5) || (on1 === r.i && s1 > r.b + 0.5)) fail(id, 'rope', r.i, 'slid past the end');
    if ((on1 !== r.i && r.right === undefined && r.left === undefined) || (on2 !== r.i && r.left === undefined && r.right === undefined)) fail(id, 'rope', r.i, 'ended up on another rope with no neighbour');
    if (!r.cells.length) { walls++; Object.assign(a, { x: r.base.x, y: r.base.y, rope: null, vault: null }); continue; } // a plain wall: no window to go in through (climbing and sliding checked above)
    // back to the window: blocked = no way in and Space never goes up; boarded = Space swings in through the boards (he chose)
    a.x = r.hang.x; a.y = r.hang.y; tick(0.1);
    const hang = { ...a.rope }, cells0 = r.cells.map(k => m.tiles[k]);
    for (const k of r.cells) m.tiles[k] = T.HARD;
    if (g.startVault(a, 0) || !a.rope || a.rope.st !== 'hang') fail(id, 'rope', r.i, 'Space at a blocked window did something', JSON.stringify(a.rope));
    r.cells.forEach((k, i) => { m.tiles[k] = cells0[i]; });
    g.barricade(m.openId[r.cells[0]], T.BARRI, true);
    if (!g.startVault(a, 0) || r.cells.some(k => m.tiles[k] === T.BARRI)) fail(id, 'rope', r.i, 'Space did not swing in through the boards');
    a.vault = null; a.rope = hang; a.x = r.hang.x; a.y = r.hang.y; tick(0.1);
    // three melee hits from the rope break the boards
    g.barricade(m.openId[r.cells[0]], T.BARRI, true); a.aim = r.out + Math.PI;
    for (let i = 0; i < 3; i++) { a.meleeCd = 0; g.melee(a); }
    if (r.cells.some(k => m.tiles[k] === T.BARRI)) fail(id, 'rope', r.i, 'melee from the rope did not break the boards');
    // a defender inside sees and hits the hanger through the open window
    for (const k of r.cells) m.tiles[k] = T.OPEN;
    Object.assign(d, { alive: true, downed: false, ctrl: 'body', x: r.inside.x, y: r.inside.y, hp: 100 });
    const ang = Math.atan2(a.y - d.y, a.x - d.x);
    if (!canSee(m, { x: d.x, y: d.y, ang, fov: 1.8, range: 1100, near: 26 }, a.x, a.y, [])) fail(id, 'rope', r.i, 'defender at the window cannot see the hanger');
    a.hp = 999; g.hitscan(d, d.x, d.y, ang + Math.atan2(4, Math.hypot(a.x - d.x, a.y - d.y)), 2000, 20, 'Test', 'AR'); // body, not head
    if (a.hp >= 999) fail(id, 'rope', r.i, 'defender cannot shoot the hanger');
    a.hp = 100; d.x = -9000;
    // in through the open window
    if (!g.startVault(a, 0)) { fail(id, 'rope', r.i, 'could not climb in an open window', JSON.stringify(a.rope), a.alive, a.downed, ropeS(r, a.x, a.y), r.half, r.cells.map(k => m.tiles[k])); continue; }
    tick(1.2);
    if (a.rope || floorAt(m, a.x, a.y) !== r.f || Math.hypot(a.x - r.inside.x, a.y - r.inside.y) > 8) fail(id, 'rope', r.i, 'did not end up inside', !!a.rope, floorAt(m, a.x, a.y), r.f, Math.hypot(a.x - r.inside.x, a.y - r.inside.y).toFixed(1), a.alive);
    // and once more: climb up, let go, back on the ground
    Object.assign(a, { x: r.base.x, y: r.base.y, rope: null, vault: null });
    tick(0.1, { interact: 1 }); tick(2 * r.lvl + 0.3); tick(0.1, { interact: 1 }); tick(0.1); tick(r.lvl + 0.3);
    if (a.rope || floorAt(m, a.x, a.y) !== m.groundFloor) fail(id, 'rope', r.i, 'letting go did not bring you down');
  }
  console.log(`${id}: ${m.ropes.length} ropes checked (${walls} on plain walls)`);
}
console.log(fails ? `${fails} failure(s)` : `PASS rappel (${n} ropes)`);
process.exit(fails ? 1 : 0);
