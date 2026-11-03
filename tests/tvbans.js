// ESPORTS TV bans (he asked, R6 rules): 2 attackers + 2 defenders per team before round 1 (4 banned each side), then
// 1 more per team every round, from the side the other team plays; nobody ever plays a banned operator, a viewer
// request is never banned. Run: node tests/tvbans.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { OPERATORS } from '../shared/operators.js';
import { PHASE } from '../shared/constants.js';
let fails = 0; const ok = (c, ...a) => { if (!c) { fails++; console.log('FAIL', ...a); } };
for (const level of [7, 3]) {
  const g = new Game({ tv: true }); g.tv.req = ['lynx'];
  g.tvStart('villa', level);
  for (let r = 1; r <= 4; r++) {
    let t = 0;
    for (; t < 30 * 90 && g.phase !== PHASE.PREP; t++) g.tick(1 / 30);
    const want = 8 + (r - 1) * 2, side = s => g.bans.filter(b => OPERATORS[b.op].team === s).length;
    ok(g.bans.length === want, `round ${r}: ${g.bans.length} bans, wanted ${want}`);
    if (r === 1) { ok(side('atk') === 4 && side('def') === 4, 'round 1: not 4 a side'); for (const sq of [0, 1]) ok(g.bans.filter(b => b.sq === sq).length === 4, 'round 1: team', sq, 'did not ban 4'); }
    else { const nw = g.bans.filter(b => b.rd === r); ok(nw.length === 2 && nw[0].sq !== nw[1].sq && OPERATORS[nw[0].op].team !== OPERATORS[nw[1].op].team, `round ${r}: new bans wrong`, JSON.stringify(nw)); }
    ok(new Set(g.bans.map(b => b.op)).size === g.bans.length, 'an operator was banned twice');
    ok(!g.bans.some(b => b.op === 'lynx'), 'the viewer request was banned');
    const ops = [...g.players.values()].map(p => p.op);
    ok(!ops.some(o => g.isBanned(o)), `round ${r}: a banned operator is played`, ops.join(' '));
    ok(ops.every(Boolean), `round ${r}: someone has no operator`);
    console.log(`level ${level} round ${r}: select took ${(t / 30).toFixed(0)} s, banned:`, g.bans.map(b => OPERATORS[b.op].name).join(', '));
    g.nextRound();
  }
}
console.log(fails ? `${fails} failure(s)` : 'PASS');
process.exit(fails ? 1 : 0);
