// Stairwells: someone at the bottom of a staircase and someone at the top can see and shoot each other (each shows
// on the other floor's steps), both ways; from far away, nobody shows. Run: node tests/stairfight.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, stairEnds, stairGhost, stairLooks, floorAt } from '../shared/map.js';
import { PHASE, T } from '../shared/constants.js';

let fails = 0, pairs = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game({ free: true });
  const a = g.addPlayer('Low', false), b = g.addPlayer('High', false);
  g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 });
  const m = g.map;
  for (const q of [a, b]) { q.alive = true; q.downed = false; q.ctrl = 'body'; q.viewTime = null; q.staged = false; }
  m.stairs.forEach((s, i) => {
    // a free spot on each landing (some landings have a bush or a railing in the middle)
    const free = (end) => { for (const n of [1, 0.6, 1.6]) for (const side of [0, -0.5, 0.5, -1, 1]) { const e = stairEnds(m, i, n), p = e[end], q = { x: p.x + Math.cos(e.up + Math.PI / 2) * side * 16, y: p.y + Math.sin(e.up + Math.PI / 2) * side * 16 }; const t = m.tiles[Math.floor(q.y / 16) * m.W + Math.floor(q.x / 16)]; if (t === T.FLOOR || t === T.GROUND || t === T.STAIR) return q; } return stairEnds(m, i, 1)[end]; };
    Object.assign(a, free('bottom')); Object.assign(b, free('top'));
    const ga = stairGhost(m, a.x, a.y), gb = stairGhost(m, b.x, b.y);
    if (!ga || !gb) { fail(id, 'stairs', i, 'landing not in the stairwell', !!ga, !!gb); return; }
    if (floorAt(m, ga.x, ga.y) !== s.b || floorAt(m, gb.x, gb.y) !== s.a) fail(id, 'stairs', i, 'copy on the wrong floor');
    for (const [p, q, gq] of [[a, b, gb], [b, a, ga]]) {
      for (const o of [p, q]) { o.alive = true; o.downed = false; o.ctrl = "body"; o.viewTime = null; }
      q.hp = 999; q.maxHp = 999;
      const hp0 = q.hp, ang = Math.atan2(gq.y - p.y, gq.x - p.x);
      g.hitscan(p, p.x, p.y, ang, 2000, 30, 'Test', 'AR');
      if (q.hp >= hp0) fail(id, 'stairs', i, p.name, 'could not shoot', q.name, 'up/down the stairs');
      pairs++;
    }
    // from far away (12 cells to the side of the bottom landing), the copy is not there to see or hit
    if (stairLooks(m, i, a.x + 200, a.y + 200)) fail(id, 'stairs', i, 'seen from far away');
  });
  console.log(`${id}: ${m.stairs.length} staircases checked`);
}
console.log(fails ? `${fails} failure(s)` : `PASS stairfight (${pairs} shots up and down stairs)`);
process.exit(fails ? 1 : 0);
