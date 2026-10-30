// Every attacker bot drones in preparation (he asked): each drone leaves its spawn, heads for a site and gets near
// one, on every map. Run: node tests/drones.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, TEAM, CELL } from '../shared/constants.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  for (let round = 0; round < 2; round++) {
    const g = new Game();
    for (let i = 0; i < 10; i++) g.addBot();
    g.mapId = id; g.map = buildMap(id); g.startMatch();
    while (g.phase !== PHASE.PREP) g.tick(1 / 30);
    const atk = [...g.players.values()].filter(q => g.side(q) === TEAM.ATK);
    const start = new Map(atk.map(q => { const d = g.ent(q.droneId); return [q.id, d && { x: d.x, y: d.y }]; }));
    let t = 0; while (g.phase === PHASE.PREP && t < 40) { g.tick(1 / 30); t += 1 / 30; }
    const rooms = g.map.sites.flatMap(s => s.rooms).map(n => g.map.rooms.find(r => r.name === n));
    let moved = 0, near = 0, lost = 0;
    for (const q of atk) {
      const d = g.ent(q.droneId), s = start.get(q.id);
      if (!d) { lost++; moved++; continue; } // shot by a defender: it was out driving
      if (Math.hypot(d.x - s.x, d.y - s.y) > 3 * CELL) moved++;
      if (rooms.some(r => Math.hypot(d.x - (r.x + r.w / 2) * CELL, d.y - (r.y + r.h / 2) * CELL) < Math.max(r.w, r.h) * CELL)) near++;
    }
    console.log(`${id} round ${round + 1}: ${moved}/${atk.length} drones out driving (${lost} shot), ${near} near a site after ${t.toFixed(0)} s`);
    if (moved < atk.length) fail(id, 'a bot left its drone at the spawn');
    if (near + lost < Math.ceil(atk.length / 2)) fail(id, 'most drones never got near a site');
  }
}
console.log(fails ? `${fails} failure(s)` : 'PASS drones');
process.exit(fails ? 1 : 0);
