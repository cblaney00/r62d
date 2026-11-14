// Climbing OUT of an upper window onto its rope (he asked 2026-11-14: plant, then get outside to some safety and play
// by the window): an attacker just inside a window that has a rope, facing out, presses Space and ends up hanging
// outside it, level with the window; boards get smashed on the way; a defender can't; facing into the room does nothing.
// Also: no breakable wall right beside any window (he asked: no cheesy wallbangs round the window's edges), and
// sprinting moves you faster along the wall.
// Run: node tests/ropeout.js [map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { T, TEAM, PHASE } from '../shared/constants.js';

let fails = 0, outs = 0, jambs = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of process.argv[2] ? [process.argv[2]] : MAP_LIST) {
  const g = new Game({ free: true });
  const a = g.addPlayer('Climber', false), d = g.addPlayer('Guard', false);
  g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 });
  g.free.god = false; g.phase = PHASE.ACTION;
  const m = g.map;
  if (g.side(a) !== TEAM.ATK) a.squad = 1 - a.squad;
  d.squad = 1 - a.squad; g.equip(d);
  const tick = (q, s, inp = {}) => { for (let i = 0; i < Math.max(1, s * 30); i++) { q.prevInput = q.input; q.input = { ...inp }; g.applyMove(q, 1 / 30); g.tickPlayer(q, 1 / 30); g.time += 1 / 30; } };
  const put = (q, r, ang) => { Object.assign(q, { alive: true, downed: false, ctrl: 'body', rope: null, vault: null, busy: null, prep: null, hp: 999, x: r.inside.x, y: r.inside.y, aim: ang }); };
  // no soft wall beside a window
  for (let k = 0; k < m.tiles.length; k++) if (m.win[k]) for (const dd of [1, -1, m.W, -m.W]) { let j = k + dd; while (m.win[j]) j += dd; if (m.tiles[j] === T.SOFT) { jambs++; if (jambs < 4) fail(id, 'a breakable wall beside a window at', j % m.W, Math.floor(j / m.W)); } }
  const ropes = m.ropes.filter(r => !r.wall && r.inside && r.cells.length).slice(0, 5);
  for (const r of ropes) {
    for (const k of r.cells) m.tiles[k] = T.BARRI; // boarded: Space smashes through
    put(a, r, r.out + Math.PI); g.event(a, { k: 'vault', a: r.out + Math.PI }); tick(a, 1);
    if (a.rope) fail(id, 'rope', r.i, 'facing into the room still climbed out');
    put(a, r, r.out); g.event(a, { k: 'vault', a: r.out }); tick(a, 1.2);
    if (!a.rope || a.rope.st !== 'hang' || a.rope.r !== r.i) { fail(id, 'rope', r.i, 'Space at the window did not put you on its rope', JSON.stringify(a.rope)); continue; }
    if (r.cells.some(k => m.tiles[k] === T.BARRI)) fail(id, 'rope', r.i, 'the boards were not smashed');
    if (!g.ropeLevel(a)) fail(id, 'rope', r.i, 'not level with the window after climbing out');
    outs++;
    // sprinting along the wall is faster
    const s0 = a.x * r.tx + a.y * r.ty; tick(a, 0.3, { right: 1 }); const v1 = Math.abs(a.x * r.tx + a.y * r.ty - s0);
    const s1 = a.x * r.tx + a.y * r.ty; tick(a, 0.3, { left: 1, sprint: 1 }); const v2 = Math.abs(a.x * r.tx + a.y * r.ty - s1);
    if (v1 > 0.5 && v2 > 0.5 && v2 < v1 * 1.3 && Math.abs(r.b - r.a) > 30) fail(id, 'rope', r.i, 'sprint did not speed up moving along the wall', v1.toFixed(1), v2.toFixed(1));
    // a defender can't
    put(d, r, r.out); g.event(d, { k: 'vault', a: r.out }); tick(d, 1.2);
    if (d.rope) fail(id, 'rope', r.i, 'a defender climbed out onto a rope');
  }
  console.log(id.padEnd(9), 'climbed out at', ropes.length, 'windows');
}
console.log(`${outs} climbs out, ${jambs} breakable walls beside windows`);
console.log(fails ? `FAIL ropeout (${fails})` : 'PASS ropeout');
