// Breakable floors (he asked 2026-11-10: every floor and ceiling can be broken, except the roof and the lowest floor).
// A breach charge set on an upper floor and a nitro blast open a hatch-sized hole that drops you to the floor below
// and that you can see through; the ground floor and the roof never break; a client copy of the map picks the hole up
// from the snapshot's dh list. Run: node tests/floors.js [map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, floorSpot, cellBelow, syncDyn, hatchSight, floorAt, MAP_LIST } from '../shared/map.js';
import { T, CELL, TEAM } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); }, ok = (c, ...a) => { if (!c) fail(...a); };
for (const id of process.argv[2] ? [process.argv[2]] : MAP_LIST) {
  const g = new Game({ free: true }), a = g.addPlayer('Att', false);
  g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 });
  const m = g.map, W = m.W, gf = m.groundFloor ?? m.floors.findIndex(f => !f.roof);
  // every upper non-roof floor has breakable spots; the lowest floor and the roof none
  const count = new Map();
  for (let k = 0; k < m.tiles.length; k++) if (m.tiles[k] === T.FLOOR && cellBelow(m, k) >= 0) { const f = m.flAt[k]; count.set(f, (count.get(f) || 0) + 1); }
  ok(!count.has(0), id, 'the lowest floor can break');
  ok(!count.has(m.roofFloor), id, 'the roof can break');
  const uppers = m.floors.filter(f => f.i > 0 && !f.roof);
  for (const f of uppers) ok((count.get(f.i) || 0) > 50, id, f.name, 'has almost no breakable floor', count.get(f.i) || 0);
  if (!uppers.length) { console.log(id, 'one floor only'); continue; }
  // a spot in the middle of a room on the first upper floor
  let spot = null;
  for (const r of m.rooms.filter(r => r.fl === uppers[0].i).sort((p, q) => q.w * q.h - p.w * p.h)) {
    const k0 = floorSpot(m, (r.x + r.w / 2) * CELL, (r.y + r.h / 2) * CELL); if (k0 >= 0) { spot = { k0, x: (k0 % W + 1) * CELL, y: (Math.floor(k0 / W) + 1) * CELL }; break; }
  }
  if (!spot) for (let k = 0; k < m.tiles.length && !spot; k++) if (m.flAt[k] === uppers[0].i && floorSpot(m, (k % W + 1) * CELL, (Math.floor(k / W) + 1) * CELL) === k) spot = { k0: k, x: (k % W + 1) * CELL, y: (Math.floor(k / W) + 1) * CELL };
  ok(spot, id, 'no room to break a floor in'); if (!spot) continue;
  // a breach charge set on the floor
  a.op = 'ember'; g.equip(a); Object.assign(a, { alive: true, downed: false, ctrl: 'body', staged: false, x: spot.x - 14, y: spot.y, aim: 0, input: {}, prevInput: {}, gadgetCount: 3, hp: 9999, maxHp: 9999 });
  const before = m.hatches.length;
  a.gadget = 'breach'; a.gadgetCount = 3; g.useGadget(a);
  const ch = g.ents.find(e => e.type === 'breach');
  ok(ch && ch.floor, id, 'breach charge not set on the floor', ch && ch.floor);
  for (let i = 0; i < 120; i++) g.tickEnts(1 / 30), g.time += 1 / 30;
  ok(m.hatches.length === before + 1, id, 'no hole after the charge went off');
  const h = m.hatches[m.hatches.length - 1];
  if (h) {
    ok(h.cells.every(k => m.tiles[k] === T.HOLE && m.portal[k] >= 0), id, 'hole cells not open / no drop');
    ok(floorAt(m, h.bx, h.by) === uppers[0].i - 1, id, 'the hole does not lead one floor down');
    ok(hatchSight(m, h, h.x - CELL * 2, h.y, 'stand'), id, 'cannot look down the new hole');
    // a client copy of the map (as main.js keeps it) gets the hole from the snapshot list
    const c = buildMap(id); for (const k of h.cells) c.tiles[k] = T.HOLE; syncDyn(c, m.dyn);
    ok(c.hatches.length === m.hatches.length && h.cells.every(k => c.portal[k] === m.portal[k]), id, 'client copy did not pick up the hole');
  }
  // nitro on the ground floor: no hole
  const gk = m.tiles.findIndex((t, k) => t === T.FLOOR && m.flAt[k] === 0);
  const n0 = m.hatches.length; g.explode({ x: (gk % W + 0.5) * CELL, y: (Math.floor(gk / W) + 0.5) * CELL, team: 'atk' }, { r: 70, dmg: 0, cellR: 20, cells: [], kind: 'nitro', floor: true });
  ok(m.hatches.length === n0, id, 'nitro broke the lowest floor');
  console.log(`${id.padEnd(8)} breakable floor cells: ${uppers.map(f => `${f.name} ${count.get(f.i) || 0}`).join(', ')}`);
}
console.log(fails ? `${fails} failure(s)` : 'PASS floors');
process.exit(fails ? 1 : 0);
