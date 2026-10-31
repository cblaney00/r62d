// Rappelling: on every map, an attacker climbs every rope, slides along the wall, can't climb in through a boarded
// window, climbs in through an open one, lets go back to the ground, and can be seen and shot while hanging.
// Run: node tests/rappel.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, floorAt, ropeS } from '../shared/map.js';
import { T, TEAM } from '../shared/constants.js';
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
  for (const r of m.ropes) {
    n++;
    Object.assign(a, { alive: true, downed: false, ctrl: 'body', rope: null, vault: null, busy: null, hp: 100, x: r.base.x, y: r.base.y });
    if (g.side(a) !== TEAM.ATK) { a.squad = 1 - a.squad; if (g.side(a) !== TEAM.ATK) { fail(id, 'climber is not attacking'); break; } }
    tick(0.1); tick(0.1, { interact: 1 }); tick(0.1);
    if (!a.rope) { fail(id, 'rope', r.i, 'E did not start the climb'); continue; }
    tick(2 * r.lvl + 0.2);
    if (!a.rope || a.rope.st !== 'hang' || floorAt(m, a.x, a.y) !== r.f) { fail(id, 'rope', r.i, 'not hanging on the right floor', a.rope && a.rope.st); continue; }
    // slide both ways along the wall
    const s0 = ropeS(r, a.x, a.y);
    tick(3, { right: 1 }); tick(3, { down: 1 }); const s1 = ropeS(r, a.x, a.y);
    tick(6, { left: 1 }); tick(6, { up: 1 }); const s2 = ropeS(r, a.x, a.y);
    if (r.b - r.a > 20 && !(s1 > s0 + 4 || s2 < s0 - 4)) fail(id, 'rope', r.i, 'could not slide along the wall', s0, s1, s2);
    if (s2 < r.a - 0.5 || s1 > r.b + 0.5) fail(id, 'rope', r.i, 'slid past the end');
    // back to the window, boarded: no way in
    for (const k of r.cells) m.tiles[k] = T.BARRI;
    a.x = r.hang.x; a.y = r.hang.y; tick(0.1);
    if (g.startVault(a, 0)) fail(id, 'rope', r.i, 'climbed in through boards');
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
  console.log(`${id}: ${m.ropes.length} ropes checked`);
}
console.log(fails ? `${fails} failure(s)` : `PASS rappel (${n} ropes)`);
process.exit(fails ? 1 : 0);
