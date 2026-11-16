// Where attackers die (balance: is a map lost outside on the approach?). Pro teams, trained if R62D_TEST_TRAINING.
// Run: node tests/deaths.js <matches> <mapId>
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, floorAt } from '../shared/map.js';
import { PHASE, TEAM, T, CELL } from '../shared/constants.js';
const per = +process.argv[2] || 2, id = process.argv[3] || 'lodge';
const R = { rounds: 0, atk: 0, aDeaths: 0, out: 0, outFromUp: 0, outEarly: 0, inDeaths: 0, dDeaths: 0, dOut: 0, t: [0, 0, 0, 0] };
for (let n = 0; n < per; n++) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = 7; g.proExplore = true;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  let t = 0, last = g.phase, actT = 0;
  while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30; if (g.phase === PHASE.ACTION) actT += 1 / 30;
    for (const e of g.events) if (e.e === 'kill') {
      const k = g.players.get(e.killer), v = g.players.get(e.victim); if (!k || !v || g.side(k) === g.side(v)) continue;
      const m = g.map, vk = Math.floor(v.y / CELL) * m.W + Math.floor(v.x / CELL), outside = m.tiles[vk] === T.GROUND || m.flAt[vk] === m.groundFloor && m.tiles[vk] !== T.OPEN && m.floor[vk] !== undefined && m.tiles[vk] === T.GROUND;
      const up = floorAt(m, k.x, k.y) > floorAt(m, v.x, v.y);
      if (g.side(v) === TEAM.ATK) { R.aDeaths++; R.t[Math.min(3, Math.floor(actT / 30))]++; if (outside) { R.out++; if (up) R.outFromUp++; if (actT < 30) R.outEarly++; } else R.inDeaths++; }
      else { R.dDeaths++; if (outside) R.dOut++; }
    }
    g.events = [];
    if (g.phase !== last) {
      if (g.phase === PHASE.ROUND_END && g.winner != null) { R.rounds++; const a = [...g.players.values()].find(p => g.side(p) === TEAM.ATK).squad; if (g.winner === a) R.atk++; }
      if (g.phase === PHASE.ACTION) actT = 0;
      last = g.phase;
    }
  }
}
const pc = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
console.log(`${id}: ${R.rounds} rounds, attack ${pc(R.atk, R.rounds)} | attacker deaths ${R.aDeaths}: outside ${pc(R.out, R.aDeaths)} (from a floor above ${pc(R.outFromUp, R.out)}, in the first 30 s ${pc(R.outEarly, R.out)}) | by 30 s steps ${R.t.join('/')} | defender deaths ${R.dDeaths} (outside ${pc(R.dOut, R.dDeaths)})`);
