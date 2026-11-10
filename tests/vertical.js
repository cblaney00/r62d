// The four up-and-down operators (he asked 2026-11-10, he chose all four): GIMLET's floor drill (a peephole you can
// see through from both floors but not fall through), HOIST's grapple (up an open hatch, onto the roof from outside),
// LOCKJAW's hatch trap (stuns and spots the attacker by the opened hatch), DEADFALL's drop charge (a hole into the
// floor below). Run: node tests/vertical.js [map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, floorSpot, hatchSight, floorAt, cellBelow } from '../shared/map.js';
import { T, CELL, TEAM, PHASE } from '../shared/constants.js';
import { canSee } from '../shared/physics.js';
import { jobOf } from '../shared/operators.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); }, ok = (c, ...a) => { if (!c) fail(...a); };
for (const op of ['gimlet', 'hoist', 'lockjaw', 'deadfall']) ok(jobOf(op), op, 'has no role');
const id = process.argv[2] || 'harbor';
const g = new Game({ free: true }), a = g.addPlayer('Att', false), d = g.addPlayer('Def', false);
g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 });
d.squad = 1 - a.squad; if (g.side(a) !== TEAM.ATK) { a.squad = 1 - a.squad; d.squad = 1 - a.squad; }
const m = g.map, W = m.W;
const setup = (p, op, x, y, aim, crouch = 0) => { p.op = op; g.equip(p); Object.assign(p, { alive: true, downed: false, ctrl: 'body', staged: false, viewTime: null, x, y, aim, vault: null, busy: null, rope: null, grapple: null, input: { crouch }, prevInput: {}, vx: 0, vy: 0, pr: 0, hp: 500, maxHp: 500, stunUntil: 0 }); };
const run = (sec, ps = []) => { for (let i = 0; i < sec * 30; i++) { g.tickEnts(1 / 30); for (const p of ps) g.tickGrapple(p, 1 / 30); g.time += 1 / 30; } };
const up = m.floors.find(f => f.i > 0 && !f.roof);
const spots = []; for (const r of m.rooms.filter(r => r.fl === up.i).sort((p, q) => q.w * q.h - p.w * p.h)) { const k0 = floorSpot(m, (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL); if (k0 >= 0) spots.push({ x: (k0 % W + 1) * CELL, y: (Math.floor(k0 / W) + 1) * CELL }); }
for (let k = 0; k < m.tiles.length && spots.length < 3; k += 3) if (m.flAt[k] === up.i && floorSpot(m, (k % W + 1) * CELL, (Math.floor(k / W) + 1) * CELL) === k && spots.every(q => Math.hypot(q.x - (k % W + 1) * CELL, q.y - (Math.floor(k / W) + 1) * CELL) > 120)) spots.push({ x: (k % W + 1) * CELL, y: (Math.floor(k / W) + 1) * CELL }); // (Dust Town: small upper rooms)
ok(spots.length >= 3, 'not enough clear floor spots', spots.length);

// GIMLET: crouched, drill the floor; 3 s later a peephole that shows the room below, not walkable through
{ const s = spots[0]; setup(a, 'gimlet', s.x - 10, s.y, 0, 1);
  const n = m.hatches.length; g.useAbility(a); ok(g.ents.some(e => e.type === 'drill'), 'GIMLET: no drill set'); run(3.2);
  const h = m.hatches[m.hatches.length - 1]; ok(m.hatches.length === n + 1 && h.peep, 'GIMLET: no peephole after drilling');
  if (h && h.peep) {
    ok(m.tiles[h.cells[0]] === T.FLOOR && !(m.portal[h.cells[0]] >= 0), 'GIMLET: you can fall through a peephole');
    let looked = 0, seen = 0; // from each side of it: the line from your eye through the hole lands in the room below (a wall may be in the way on some sides)
    for (const [ex, ey] of [[-14, 0], [14, 0], [0, -14], [0, 14]]) { const v = hatchSight(m, h, h.x + ex, h.y + ey, 'crouch'); if (!v) continue; looked++;
      const tx = v.mask.ex + (v.x - v.mask.ex) / v.mask.f, ty = v.mask.ey + (v.y - v.mask.ey) / v.mask.f; if (canSee(m, v, tx, ty, [])) seen++; }
    ok(looked === 4, 'GIMLET: cannot look down the peephole', looked); ok(seen > 0, 'GIMLET: the room below is not seen through it');
    ok(hatchSight(m, h, h.bx - 30, h.by, 'stand'), 'GIMLET: cannot look up through it from below');
  }
  // standing on the ground floor: drills the ceiling
  const gk = m.tiles.findIndex((t, k) => t === T.FLOOR && m.flAt[k] === up.i - 1 && m.rooms.some(r => r.fl === up.i - 1) && cellBelow(m, k) < 0);
  const n2 = m.hatches.length; setup(a, 'gimlet', h.bx - 12, h.by + 40, 0, 0); a.abilityCount = 3; g.useAbility(a); run(3.2);
  ok(m.hatches.length >= n2, 'GIMLET ceiling drill errored'); }

// HOIST: open a floor with a blast, stand below it, grapple up
{ const s = spots[1]; const h = g.blowFloor(s.x, s.y); ok(h, 'could not open a floor for HOIST');
  if (h) { setup(a, 'hoist', h.bx + 30, h.by, Math.PI); g.useAbility(a); ok(a.grapple, 'HOIST: no grapple under an open hatch');
    run(0.5, [a]); ok(floorAt(m, a.x, a.y) === floorAt(m, h.bx, h.by), 'HOIST: arrived too early'); run(1.5, [a]);
    ok(floorAt(m, a.x, a.y) === h.fl && Math.hypot(a.x - h.x, a.y - h.y) < CELL * 2.5 && m.tiles[Math.floor(a.y / CELL) * W + Math.floor(a.x / CELL)] !== T.HOLE, 'HOIST: not beside the hole upstairs', a.x, a.y); }
  // from outside, onto the roof: find a spot on the ground facing the building where it works
  let roofed = false;
  for (let k = 0; k < m.tiles.length && !roofed; k += 7) {
    if (m.tiles[k] !== T.GROUND || m.flAt[k] !== m.groundFloor) continue;
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      setup(a, 'hoist', (k % W + 0.5) * CELL, (Math.floor(k / W) + 0.5) * CELL, ang); const t = g.grappleTarget(a);
      if (t && t.roof) { a.abilityCount = 3; g.useAbility(a); run(3.2, [a]); roofed = floorAt(m, a.x, a.y) === m.roofFloor; break; }
    }
  }
  ok(roofed, 'HOIST: never got onto the roof from outside'); }

// LOCKJAW: rig a shut hatch from on top; it opens with an attacker under it: stunned and spotted
{ const h = m.hatches.find(h => !h.dyn && !h.peep && !h.roof && m.tiles[h.cells[0]] === T.HATCH);
  ok(h, 'no shut hatch to rig');
  if (h) { setup(d, 'lockjaw', h.x - 22, h.y, 0); g.useAbility(d); ok(g.ents.some(e => e.type === 'htrap'), 'LOCKJAW: trap not set');
    setup(a, 'gimlet', h.bx + 10, h.by + 30, 0); run(2); ok(!(a.stunUntil > g.time), 'LOCKJAW: went off on a shut hatch');
    g.breakHatch(h.id); run(0.2);
    ok(a.stunUntil > g.time, 'LOCKJAW: attacker by the opened hatch not stunned');
    ok(g.spots[g.side(d)].get(a.id) > g.time, 'LOCKJAW: attacker not spotted'); } }

// DEADFALL: a drop charge opens the floor in front of her
{ const s = spots[2]; setup(d, 'deadfall', s.x - 12, s.y, 0); const n = m.hatches.length;
  g.useAbility(d); ok(g.ents.some(e => e.type === 'dropch'), 'DEADFALL: charge not set'); run(1); ok(m.hatches.length === n, 'DEADFALL: went off too soon'); run(1.5);
  ok(m.hatches.length === n + 1 && m.hatches[n].cells.every(k => m.tiles[k] === T.HOLE), 'DEADFALL: no hole');
  // and nothing on the lowest floor
  const lo = m.tiles.findIndex((t, k) => t === T.FLOOR && m.flAt[k] === 0); setup(d, 'deadfall', (lo % W + 0.5) * CELL, (Math.floor(lo / W) + 0.5) * CELL, 0); d.abilityCount = 2;
  g.useAbility(d); ok(!g.ents.some(e => e.type === 'dropch'), 'DEADFALL: set a charge on the lowest floor'); }
console.log(fails ? `${fails} failure(s)` : 'PASS vertical');
process.exit(fails ? 1 : 0);
