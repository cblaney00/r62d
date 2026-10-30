// Plays bot-only matches on every map on the server with no browser, to check the rules hold up.
// Run:  node tests/sim.js [--map <id>] [--only <id>]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, floorAt } from '../shared/map.js';
import { T, PHASE } from '../shared/constants.js';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
if (process.argv.includes('--map')) {
  const m = buildMap(arg('--map') || 'harbor');
  const ch = { [T.GROUND]: ',', [T.FLOOR]: '.', [T.HARD]: '#', [T.SOFT]: '=', [T.OPEN]: 'O', [T.LOW]: 'l', [T.TALL]: 'T', [T.VOID]: ' ', [T.STAIR]: 'S' };
  for (const F of m.floors) {
    console.log(`--- ${m.name} ${F.name} ---`);
    for (let y = 0; y < F.h; y++) {
      let row = '';
      for (let x = F.gx; x < F.gx + F.w; x++) row += m.shape && m.shape[y * m.W + x] ? '/' : ch[m.tiles[y * m.W + x]] ?? '?';
      console.log(String(y + F.y0).padStart(2) + ' ' + row);
    }
  }
  process.exit(0);
}

let allOk = true;
for (const id of arg('--only') ? [arg('--only')] : MAP_LIST) {
  const g = new Game();
  g.mapId = id; g.map = buildMap(id);
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  const dt = 1 / 30;
  let t = 0, rounds = [], lastPhase = null;
  const evCount = {}, floorsVisited = new Set();
  const t0 = performance.now();
  while (t < 60 * 25) {
    g.tick(dt); t += dt;
    for (const e of g.events) evCount[e.e] = (evCount[e.e] || 0) + 1;
    if (Math.round(t * 30) % 2 === 0) g.broadcast();
    for (const p of g.players.values()) if (p.alive) floorsVisited.add(floorAt(g.map, p.x, p.y));
    if (g.phase !== lastPhase) {
      if (g.phase === PHASE.ROUND_END) rounds.push(`  round ${g.round} (${g.map.sites[g.site].name}): squad ${g.winner} won (${g.reason}) at ${t.toFixed(0)}s`);
      lastPhase = g.phase;
    }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
  const ms = (performance.now() - t0) / (t * 30);
  const ok = rounds.length >= 3;
  allOk = allOk && ok;
  console.log(`${g.map.name}: ${rounds.length} rounds, score ${g.score}, floors used ${[...floorsVisited].sort().join(',')}, kills ${evCount.kill || 0}, ${ms.toFixed(2)} ms per server tick — ${ok ? 'ok' : 'FAIL'}`);
  console.log(rounds.join('\n'));
}
console.log(allOk ? 'PASS' : 'FAIL');
process.exit(allOk ? 0 : 1);
