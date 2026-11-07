// The rank ladder (he asked: Silver/Gold an average player, Diamond hard work, Champion the top 0.8%, Pro better still):
// each rank plays bot-only matches against the rank above it and the higher rank must win more of the fights (Silver → Gold is the smallest step: his aim times are 0.9 and 0.8 s).
// Run: node tests/ladder.js [matches per step] [--map <id>] [--from <rank 0-6>: only the steps from that rank up]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { PHASE, BOT_LEVELS, PRO_LEVEL } from '../shared/constants.js';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const N = +process.argv[2] || 2, maps = arg('--map') ? [arg('--map')] : ['harbor', 'villa', 'embassy', 'dust'];
let fails = 0;

// levels[squad]; a Pro side is a pro team (squad 1 stays at its own level)
function play(id, levels) {
  const g = new Game();
  g.mapId = id; g.map = buildMap(id);
  for (let i = 0; i < 10; i++) g.addBot();
  if (levels[0] === PRO_LEVEL) { g.botLevel = PRO_LEVEL; g.startMatch(); for (const p of g.players.values()) if (p.squad === 1) { p.pro = null; p.level = levels[1]; } }
  else { for (const p of g.players.values()) p.level = levels[p.squad]; g.startMatch(); }
  const kills = [0, 0], dt = 1 / 30;
  for (let t = 0; t < 60 * 16; t += dt) {
    g.tick(dt);
    for (const e of g.events) if (e.e === 'kill') { const k = g.players.get(e.by || e.k || e.killer), v = g.players.get(e.v || e.victim); if (k && (!v || v.squad !== k.squad)) kills[k.squad]++; }
    g.events.length = 0; // (the server empties them after sending)
    if (levels[0] === PRO_LEVEL) for (const p of g.players.values()) if (p.squad === 1 && p.pro) { p.pro = null; p.level = levels[1]; }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
  return kills;
}

for (let L = +(arg('--from') || 0); L < PRO_LEVEL; L++) {
  const k = [0, 0];
  for (let i = 0; i < N; i++) { const r = play(maps[i % maps.length], [L + 1, L]); k[0] += r[0]; k[1] += r[1]; }
  const share = k[0] / Math.max(1, k[0] + k[1]), ok = share >= 0.52; // (about ±4% is luck at 8 matches a step)
  if (!ok) fails++;
  console.log(`${BOT_LEVELS[L + 1].padEnd(9)} vs ${BOT_LEVELS[L].padEnd(9)} kills ${k[0]}-${k[1]}  (${Math.round(share * 100)}% to the higher rank)${ok ? '' : '  TOO CLOSE'}`);
}
console.log(fails ? `FAIL ladder (${fails})` : 'PASS ladder');
