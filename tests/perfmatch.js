// How much server time a full 10-bot match costs (he asked: Lando's server must stay quiet). Ticks at 30/s and sends
// snapshots at 20/s to ten fake connections, like server.js. Run: node tests/perfmatch.js [map] [seconds] [level]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { PHASE } from '../shared/constants.js';
const id = process.argv[2] || 'harbor', secs = +(process.argv[3] || 240), lvl = +(process.argv[4] || 7);
const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = lvl;
for (let i = 0; i < 10; i++) g.addBot();
let bytes = 0; const fake = { open: true, send: s => { bytes += s.length; }, bufferedAmount: 0 };
for (const p of g.players.values()) p.sock = null;
// four of them are "people" watching (snapshots built for them like for a browser)
[...g.players.values()].slice(0, 4).forEach(p => { p.sock = fake; });
g.startMatch();
const dt = 1 / 30; let t = 0, tickMs = 0, snapMs = 0, n = 0, worst = 0;
while (t < secs && g.phase !== PHASE.MATCH_END) {
  const a = performance.now(); g.tick(dt); const b = performance.now(); tickMs += b - a; worst = Math.max(worst, b - a); n++;
  if (n % 3 !== 0) { const c = performance.now(); g.broadcast(); snapMs += performance.now() - c; }
  t += dt;
}
console.log(`${id}: ${t.toFixed(0)} s of match, tick ${(tickMs / n).toFixed(2)} ms avg (worst ${worst.toFixed(1)}), snapshots ${(snapMs / (n * 2 / 3)).toFixed(2)} ms each, ${(bytes / t / 1024).toFixed(0)} KB/s sent, server busy ${((tickMs + snapMs) / (t * 1000) * 100).toFixed(1)}% of one core`);
process.exit(0);
