// Lying down has R6's two poses (he asked 2026-11-18, a look only): backing up sits you up (snapshot pn 2), moving
// forward lays you flat like a sniper (pn 1). Run: node tests/pronepose.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE } from '../shared/constants.js';
const g = new Game(); for (let i = 0; i < 10; i++) g.addBot(); g.startMatch(); while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
const p = [...g.players.values()].find(q => q.alive); for (const q of g.players.values()) { q.bot = false; q.input = {}; }
const run = (n, inp) => { for (let i = 0; i < n; i++) { p.input = { prone: 1, ...inp }; p.aim = 0; g.applyMove(p, 1 / 30); g.tick(1 / 30); } };
const pn = () => g.snapshotFor ? null : (p.pr >= 1 ? (p.pose === 'sit' ? 2 : 1) : 0);
run(30, {}); const a = pn(); run(6, { left: 1 }); run(10, {}); const b = pn(); run(6, { right: 1 }); run(10, {}); const c = pn();
p.input = {}; for (let i = 0; i < 30; i++) { g.applyMove(p, 1 / 30); g.tick(1 / 30); } run(30, {}); const d = pn();
const ok = a === 1 && b === 2 && c === 1 && d === 1;
console.log(`lie down ${a}, tap back ${b}, forward ${c}, get up and down again ${d}`, ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
