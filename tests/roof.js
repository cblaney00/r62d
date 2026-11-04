// Roofs: every map has one, at least 2 hatches in it reached by rope from the ground with a stop at each window; a hatch drops you to
// the top floor once broken; defenders reinforce them from below and never get up; nothing but a hatch opens the roof.
// Run: node tests/roof.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, floorAt, ropeAt } from '../shared/map.js';
import { T, TEAM, CELL, CELL_HP, FL } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game({ free: true }), a = g.addPlayer('Climber', false), d = g.addPlayer('Guard', false);
  g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 });
  const m = g.map, RF = m.roofFloor, hs = m.hatches.filter(h => h.roof);
  if (m.floors[RF].name !== 'RF') fail(id, 'no roof');
  if (hs.length < 2) fail(id, 'only', hs.length, 'roof hatches');
  for (const h of hs) { const f = floorAt(m, h.bx, h.by); if (h.fl !== RF || f <= m.groundFloor || f >= RF) fail(id, 'hatch', h.id, 'does not join the roof and an upper floor'); }
  if (g.side(a) !== TEAM.ATK) { a.squad = 1 - a.squad; d.squad = 1 - a.squad; }
  const tick = (s, inp = {}, q = a) => { for (let i = 0; i < s * 30; i++) { q.prevInput = q.input; q.input = { ...inp }; g.applyMove(q, 1 / 30); g.tickPlayer(q, 1 / 30); g.time += 1 / 30; } };
  const reset = () => Object.assign(a, { alive: true, downed: false, ctrl: 'body', rope: null, vault: null, busy: null, hp: 100 });
  // climb every rope that ends on the roof, from the ground, one stop at a time
  const toRoof = m.ropes.filter(r => r.roof); let got = 0, stops = 0;
  if (!toRoof.length) { fail(id, 'no rope reaches the roof'); continue; }
  for (const r0 of toRoof) {
    let first = r0; while (first.down >= 0) first = m.ropes[first.down];
    reset(); a.x = first.base.x; a.y = first.base.y; tick(0.1); tick(0.1, { interact: 1 }); tick(0.1);
    if (!a.rope) continue;
    for (let i = 0; i < 6 && a.rope; i++) {
      tick(ROPE_T(a) + 0.1);
      if (a.rope && a.rope.st === 'hang') { stops++; if (m.ropes[a.rope.r].f !== floorAt(m, a.x, a.y)) fail(id, 'hanging on the wrong floor'); tick(0.1); tick(0.1, { sprint: 1 }); tick(0.05); }
    }
    if (!a.rope && floorAt(m, a.x, a.y) === RF) got++;
  }
  if (!got) fail(id, 'never got onto the roof');
  // down again from the roof: a stop, not straight to the ground
  const r = toRoof[0]; reset(); a.x = r.roof.x; a.y = r.roof.y; tick(0.1); tick(0.1, { interact: 1 }); tick(1.2);
  if (!a.rope || a.rope.st !== 'hang' || a.rope.r !== r.i) fail(id, 'could not rappel down from the roof');
  // nothing but a hatch opens the roof
  const floorCell = (() => { for (let k = 0; k < m.tiles.length; k++) if (m.flAt[k] === RF && m.tiles[k] === T.FLOOR && m.hatchAt[k] < 0) return k; })();
  const fx = (floorCell % m.W + 0.5) * CELL, fy = (Math.floor(floorCell / m.W) + 0.5) * CELL, before = m.tiles.slice(); reset(); a.rope = null; a.x = fx; a.y = fy;
  g.explode({ x: fx, y: fy, owner: a.id, team: TEAM.ATK }, { r: 75, dmg: 130, cellR: 60, cells: [T.SOFT, T.HARD, T.FLOOR, T.BARRI, T.HATCH], kind: 'frag' });
  for (let i = 0; i < 3; i++) { a.meleeCd = 0; a.aim = 0; g.melee(a); }
  let broke = 0; for (let k = 0; k < m.tiles.length; k++) if (m.flAt[k] === RF && m.tiles[k] !== before[k] && m.hatchAt[k] < 0) broke++;
  if (broke) fail(id, 'the roof itself broke,', broke, 'cells');
  // a defender below reinforces it, an attacker on it breaks it and drops
  const h = hs[0]; for (const k of h.cells) if (m.tiles[k] !== T.HATCH) { m.tiles[k] = T.HATCH; m.hp[k] = CELL_HP[T.HATCH]; }
  Object.assign(d, { alive: true, downed: false, ctrl: 'body', x: h.bx, y: h.by, hp: 100, busy: null }); g.reinforce = 5;
  tick(0.1, {}, d); tick(5, { interact: 1 }, d);
  if (m.tiles[h.cells[0]] !== T.HATCHR) fail(id, 'defender could not reinforce the roof hatch from below');
  const h2 = hs[1]; reset(); a.x = h2.x; a.y = h2.y; a.aim = 0;
  for (let i = 0; i < 3; i++) { a.meleeCd = 0; g.melee(a); tick(0.05); }
  if (m.tiles[h2.cells[0]] !== T.HOLE) fail(id, 'three melee hits did not open the roof hatch', m.tiles[h2.cells[0]]);
  a.x = h2.x; a.y = h2.y; tick(0.5);
  if (floorAt(m, a.x, a.y) !== floorAt(m, h2.bx, h2.by)) fail(id, 'did not drop to the floor below');
  // nobody walks back up
  tick(0.2, { up: 1 });
  if (floorAt(m, a.x, a.y) === RF) fail(id, 'walked back up through the hatch');
  console.log(id.padEnd(9), 'roof hatches', hs.length, 'ropes to roof', toRoof.length, 'climbed', got, 'window stops', stops);
}
function ROPE_T(p) { return p.rope && p.rope.st === 'move' ? p.rope.dur : 0; }
console.log(fails ? fails + ' FAILED' : 'PASS'); process.exit(fails ? 1 : 0);
