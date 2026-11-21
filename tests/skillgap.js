// What the tests can't see (he asked 2026-11-20: "find limits in the tests ability when it comes to what the bots dont like to
// do but could be beneficial, consider your recent notes on wraith in 1v1 and why they are balanced").
// Every operator plays bot rounds twice: bots as they are, and bots that reach for their skill whenever it could help
// (R62D_EAGER, bots.js skillEager). The gap in skill uses and in win rate shows where bot-only tests (balance.js, duelmeta.js,
// the pros' practice) undersell an operator: a person who uses the skill well may be that much stronger.
// Run: node tests/skillgap.js [rounds per operator each way] [--5v5] [--eager 2.5] [--ops a,b]
import './_tmpdata.js';
import { measure, rate } from './_measure.js';
import { OPERATORS, OP_LIST } from '../shared/operators.js';
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const per = +process.argv[2] || 100, mode = process.argv.includes('--5v5') ? '5v5' : '1v1', E = arg('--eager') || '2.5';
const ops = arg('--ops') ? arg('--ops').split(',') : OP_LIST, t0 = Date.now();
const a = await measure({ focus: ops, rounds: per * ops.length, mode }), b = await measure({ focus: ops, rounds: per * ops.length, mode, env: { R62D_EAGER: E } });
const rows = ops.map(op => { const x = a.ops[op] || { n: 0, won: 0, uses: 0 }, y = b.ops[op] || { n: 0, won: 0, uses: 0 };
  return { op, x, y, du: y.uses / Math.max(1, y.n) - x.uses / Math.max(1, x.n), dw: y.won / Math.max(1, y.n) - x.won / Math.max(1, x.n) }; }).sort((p, q) => q.dw - p.dw);
console.log(`${mode}, ${per} rounds per operator each way, eager ${E}×, attack ${rate(a.atk.won, a.atk.n)} → ${rate(b.atk.won, b.atk.n)}, ${((Date.now() - t0) / 60000).toFixed(1)} min\n`);
console.log('OPERATOR   side  uses/rd as is → eager   win as is → eager     gap');
for (const r of rows) console.log(`${OPERATORS[r.op].name.padEnd(10)} ${OPERATORS[r.op].team}   ${(r.x.uses / Math.max(1, r.x.n)).toFixed(2).padStart(5)} → ${(r.y.uses / Math.max(1, r.y.n)).toFixed(2).padEnd(5)}   ${rate(r.x.won, r.x.n).padStart(7)} → ${rate(r.y.won, r.y.n).padEnd(7)}  ${r.dw >= 0 ? '+' : ''}${Math.round(r.dw * 100)}${r.dw > 0.08 ? '  ← the tests undersell this one' : r.du < 0.1 ? '  (uses barely change: the bot only uses it when its own trigger fires)' : ''}`);
