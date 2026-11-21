// The walk-in (he asked 2026-11-20): when the action phase starts the attackers walk in from the edge of the map to
// their spawn spots in about 3 s, nobody can move or shoot meanwhile, and the round clock waits. On every map: each
// attacker starts away from their spot and ends on it, defenders don't move, the clock reads 2:40 when it ends.
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE, DUR, TEAM } from '../shared/constants.js';
let fails = 0;
for (const id of MAP_LIST) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = 4;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  let t = 0; while (g.phase !== PHASE.PREP && t < 120) { g.tick(1 / 30); t += 1 / 30; g.events.length = 0; }
  g.timer = 0.01; g.tick(1 / 30); g.events.length = 0; // the end of preparation
  const P = [...g.players.values()], atk = P.filter(p => g.side(p) === TEAM.ATK), def = P.filter(p => g.side(p) === TEAM.DEF);
  const def0 = def.map(p => [p.x, p.y]), start = atk.map(p => [p.x, p.y]), goal = atk.map(p => p.intro ? [p.intro.tx, p.intro.ty] : null);
  const walked = atk.map((p, i) => goal[i] ? Math.hypot(goal[i][0] - start[i][0], goal[i][1] - start[i][1]) : 0);
  let n = 0; while (g.introT > 0 && n < 200) { g.tick(1 / 30); n++; g.events.length = 0; }
  const off = atk.map((p, i) => goal[i] ? Math.hypot(goal[i][0] - p.x, goal[i][1] - p.y) : 0), defMoved = def.map((p, i) => Math.hypot(p.x - def0[i][0], p.y - def0[i][1]));
  const ok = g.phase === PHASE.ACTION && Math.abs(n / 30 - 3) < 0.1 && Math.abs(g.timer - DUR.action) < 0.1 && walked.filter(w => w > 100).length >= atk.length - 1 && Math.max(...off) < 8 && Math.max(...defMoved) < 1;
  if (!ok) fails++;
  console.log(id.padEnd(10), `walk-in ${(n / 30).toFixed(2)} s, clock ${g.timer.toFixed(1)}, walked ${walked.map(w => Math.round(w)).join(' ')} px, off their spot ${Math.round(Math.max(...off))} px, defenders moved ${Math.max(...defMoved).toFixed(1)} px`, ok ? 'OK' : 'FAIL');
}
console.log(fails ? `FAIL ${fails}` : 'PASS');
