// How long the defuser counts down vs who wins (he asked 2026-11-20: it ticks too long, use it to balance attack and
// defence). Bot matches on every map (5v5, trained-pro level 4) and the small maps (1V1); prints attack win %, plants and
// how planted rounds ended (R62D_LVL=7 plays the pros). Run: R62D_BOMB=35 node tests/bombtime.js [matches per map] [5v5|duel]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, MAPS } from '../shared/map.js';
import { PHASE, DUR } from '../shared/constants.js';
const per = +process.argv[2] || 1, mode = process.argv[3] || '5v5';
let rounds = 0, atk = 0, plants = 0; const ends = {};
for (const id of MAP_LIST.filter(k => mode !== 'duel' || MAPS[k].small)) for (let n = 0; n < per; n++) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = +process.env.R62D_LVL || 4; // R62D_LVL=7: the pros
  if (mode === 'duel') { g.mode = 'duel'; g.addBot(0); g.addBot(1); } else { g.proAnyOp = true; for (let i = 0; i < 10; i++) g.addBot(); }
  g.startMatch(); let t = 0, last = null, a = null, pl = false;
  while (t < 60 * 40) { g.tick(1 / 30); t += 1 / 30; g.events.length = 0;
    if (g.planted && !pl) { pl = true; plants++; }
    if (g.phase !== last) { last = g.phase; if (g.phase === PHASE.PREP) { a = g.atkSquad(); pl = false; }
      if (g.phase === PHASE.ROUND_END) { rounds++; if (g.winner === a) atk++; if (pl) ends[g.reason] = (ends[g.reason] || 0) + 1; } }
    if (g.phase === PHASE.LOBBY && t > 5) break; }
}
console.log(`defuser ${DUR.bomb} s, ${mode}: ${rounds} rounds, attack won ${(100 * atk / rounds).toFixed(1)}%, plants ${plants} (${(100 * plants / rounds).toFixed(0)}% of rounds), planted rounds ended: ${JSON.stringify(ends)}`);
