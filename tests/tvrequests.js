// ESPORTS TV viewer requests: requested operators are played every round by the player with that role, on both
// teams (sides swap), for pros and amateurs. Run: node tests/tvrequests.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { OPERATORS } from '../shared/operators.js';
import { PHASE } from '../shared/constants.js';
let fails = 0; const ok = (c, ...a) => { if (!c) { fails++; console.log('FAIL', ...a); } };
for (const level of [7, 2]) {
  const g = new Game({ tv: true }); g.tv.req = ['salvo', 'torque', 'lynx']; // torque: same role as salvo, the server's filter would drop it; here only one breacher plays
  g.tvStart('harbor', level);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 30 * 40 && g.phase !== PHASE.PREP && g.phase !== PHASE.ACTION; i++) g.tick(1 / 30);
    const ops = [...g.players.values()].map(p => p.op);
    ok(ops.includes('salvo') && ops.includes('lynx'), `level ${level} round ${g.round}: requested operators missing`, ops.join(' '));
    console.log(`level ${level} round ${g.round}:`, ops.map(o => OPERATORS[o]?.name).join(' '));
    g.nextRound();
  }
}
console.log(fails ? `${fails} failure(s)` : 'PASS');
process.exit(fails ? 1 : 0);
