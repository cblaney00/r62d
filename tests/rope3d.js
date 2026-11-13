// The rope rules behind the 3D rope view (he asked 2026-11-13, R6's rules): from a window rope, W goes up a floor (or onto
// the roof), crouch flips you upside down and back, you can shoot a defender inside through the open window, throw a
// grenade in, and put a breach charge on the boarded window or soft wall in front of you; S goes back down.
// Run: node tests/rope3d.js [map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, floorAt } from '../shared/map.js';
import { T, TEAM } from '../shared/constants.js';
import { castSight } from '../shared/physics.js';

let fails = 0, checked = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of process.argv[2] ? [process.argv[2]] : MAP_LIST) {
  const g = new Game({ free: true });
  const a = g.addPlayer('Climber', false), d = g.addPlayer('Guard', false);
  g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 });
  g.free.god = false;
  const m = g.map;
  if (g.side(a) !== TEAM.ATK) a.squad = 1 - a.squad;
  d.squad = 1 - a.squad; g.equip(d);
  const tick = (s, inp = {}) => { for (let i = 0; i < Math.max(1, s * 30); i++) { a.prevInput = a.input; a.input = { ...inp }; g.applyMove(a, 1 / 30); g.tickPlayer(a, 1 / 30); g.tickEnts && g.tickEnts(1 / 30); g.time += 1 / 30; } };
  const hangOn = r => { Object.assign(a, { alive: true, downed: false, ctrl: 'body', rope: null, vault: null, busy: null, prep: null, hp: 999, x: r.base.x, y: r.base.y }); tick(0.1); tick(0.1, { interact: 1 }); tick(0.1); tick(2 * r.lvl + 0.3); if (a.rope && a.rope.st === 'hang') { a.x = r.hang.x; a.y = r.hang.y; a.rope.r = r.i; } return a.rope && a.rope.st === 'hang'; };
  const ropes = m.ropes.filter(r => r.cells.length && r.down < 0 && r.inside).slice(0, 4);
  for (const r of ropes) {
    if (!hangOn(r)) { fail(id, 'rope', r.i, 'could not get onto it'); continue; }
    checked++;
    // upside down and back
    tick(0.05, { inv: 1 }); tick(0.05);
    if (!a.rope.inv) fail(id, 'rope', r.i, 'crouch did not flip upside down');
    tick(0.05, { inv: 1 }); tick(0.05);
    if (a.rope.inv) fail(id, 'rope', r.i, 'crouch did not flip back');
    // shoot a defender inside through the open window
    for (const k of r.cells) { m.tiles[k] = T.OPEN; m.hp[k] = 0; }
    let spot = null; for (let dd = 0; dd < 120 && !spot; dd += 6) { const x = r.inside.x - Math.cos(r.out) * dd, y = r.inside.y - Math.sin(r.out) * dd; if (castSight(m, a.x, a.y, Math.atan2(y - a.y, x - a.x), Math.hypot(x - a.x, y - a.y), null, true) >= Math.hypot(x - a.x, y - a.y) - 2 && m.tiles[Math.floor(y / 16) * m.W + Math.floor(x / 16)] === T.FLOOR && dd > 10) spot = { x, y }; } // clear floor, in plain sight
    if (!spot) { a.rope = null; continue; } // (furniture right inside this window: nothing to see or shoot)
    Object.assign(d, { alive: true, downed: false, hp: 999, x: spot.x, y: spot.y });
    const ang = Math.atan2(d.y - a.y, d.x - a.x); a.aim = ang; g.shotAim = { x: d.x + Math.cos(ang + Math.PI / 2) * 6, y: d.y + Math.sin(ang + Math.PI / 2) * 6 };
    for (const off of [0.03, 0, -0.03]) if (d.hp >= 999) g.hitscan(a, a.x, a.y, ang + off, 2000, 30, 'Test', 'AR'); g.shotAim = null;
    if (d.hp >= 999) fail(id, 'rope', r.i, 'could not shoot the defender inside from the rope');
    d.x = -9000;
    // a grenade in through the window
    a.gadget = 'frag'; a.gadgetCount = 2; a.aim = r.out + Math.PI; a.aimX = r.inside.x - Math.cos(r.out) * 60; a.aimY = r.inside.y - Math.sin(r.out) * 60;
    const before = g.ents.length; g.event(a, { k: 'gadget' }); tick(0.8);
    if (!g.ents.some(e => e.type === 'nade' || e.kind === 'frag') && g.ents.length <= before && a.gadgetCount >= 2) fail(id, 'rope', r.i, 'no grenade thrown from the rope');
    if (!a.rope) fail(id, 'rope', r.i, 'throwing took you off the rope');
    g.ents = g.ents.filter(e => !(e.type === 'nade'));
    // a breach charge on the boarded window
    g.barricade(m.openId[r.cells[0]], T.BARRI, true);
    a.gadget = 'breach'; a.gadgetCount = 1; a.aim = r.out + Math.PI; a.x = r.hang.x; a.y = r.hang.y;
    g.event(a, { k: 'gadget' }); tick(1.5);
    if (!g.ents.some(e => e.type === 'breach') && a.gadgetCount >= 1) fail(id, 'rope', r.i, 'no breach charge placed from the rope');
    g.ents = g.ents.filter(e => e.type !== 'breach');
    // W: up a floor or onto the roof; S: back down
    if (!a.rope) { hangOn(r); }
    const r0 = a.rope && a.rope.r;
    tick(0.05, { rv: 1 }); tick(2.6);
    const up = a.rope ? m.ropes[a.rope.r] : null;
    if (r.up >= 0 || r.roof) {
      if (r.up >= 0 && !(up && up.lvl > r.lvl)) fail(id, 'rope', r.i, 'W did not go up a floor', a.rope && a.rope.st);
      if (r.up < 0 && (a.rope || floorAt(m, a.x, a.y) !== m.roofFloor)) fail(id, 'rope', r.i, 'W did not go onto the roof');
      if (r.up >= 0 && up) { tick(0.05, { rv: -1 }); tick(1.4); if (!a.rope || m.ropes[a.rope.r].lvl !== r.lvl) fail(id, 'rope', r.i, 'S did not come back down a floor', a.rope && a.rope.r, r0); }
    }
  }
  console.log(`${id}: ${ropes.length} window ropes tried`);
}
console.log(fails ? `FAIL rope3d (${fails} of ${checked})` : `PASS rope3d (${checked} ropes)`);
process.exit(fails ? 1 : 0);
