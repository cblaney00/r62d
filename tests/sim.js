// Plays bot-only matches on the server with no browser, to check the rules hold up.
// Run:  node tests/sim.js [--map]
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { T, PHASE } from '../shared/constants.js';

if (process.argv.includes('--map')) {
  const m = buildMap();
  const ch = { [T.GROUND]: ' ', [T.FLOOR]: '.', [T.HARD]: '#', [T.SOFT]: '=', [T.OPEN]: 'O', [T.LOW]: 'l', [T.TALL]: 'T' };
  for (let y = 0; y < m.H; y++) {
    let row = '';
    for (let x = 0; x < m.W; x++) row += ch[m.tiles[y * m.W + x]] ?? '?';
    console.log(String(y).padStart(2) + ' ' + row);
  }
  process.exit(0);
}

const g = new Game();
for (let i = 0; i < 10; i++) g.addBot();
g.startMatch();
const dt = 1 / 30;
let t = 0, rounds = [], lastPhase = null, snaps = 0, maxSnap = 0;
const evCount = {};
while (t < 60 * 25) {
  g.tick(dt); t += dt;
  for (const e of g.events) evCount[e.e] = (evCount[e.e] || 0) + 1;
  if (Math.round(t * 30) % 2 === 0) {
    const json = JSON.stringify({ ents: g.ents.length });
    snaps++; maxSnap = Math.max(maxSnap, json.length);
    g.broadcast();
  }
  if (g.phase !== lastPhase) {
    if (g.phase === PHASE.ROUND_END) rounds.push(`round ${g.round}: squad ${g.winner} won (${g.reason}) at ${t.toFixed(0)}s`);
    lastPhase = g.phase;
  }
  if (g.phase === PHASE.LOBBY && t > 5) break;
}
console.log(rounds.join('\n'));
console.log('final score', g.score, 'phase', g.phase, 'sim seconds', t.toFixed(0));
console.log('events', evCount);
const ok = rounds.length >= 3;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
