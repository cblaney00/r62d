// Roles: every operator has exactly one role; choosing a role limits your pick to its operators; switching role
// drops an operator from another role; bots end up with a role too. Run: node tests/roles.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE } from '../shared/constants.js';
import { JOBS, jobOf, opsForTeam } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const t of ['atk', 'def']) for (const o of opsForTeam(t)) {
  const n = JOBS[t].filter(j => j.ops.includes(o)).length;
  if (n !== 1) fail(o, 'is in', n, 'roles');
}
const g = new Game();
const h = g.addPlayer('Human', false); h.sock = { open: true, send() {} };
for (let i = 0; i < 5; i++) g.addBot();
g.startMatch();
// he asked: bots never pick before you
for (let i = 0; i < 30 * 8; i++) g.tick(1 / 30);
for (const q of g.players.values()) if (q.bot && q.squad === h.squad && q.op) fail(q.name, 'picked', q.op, 'before the human locked in');
if (![...g.players.values()].some(q => q.bot && q.squad !== h.squad && q.op)) fail('the other team\'s bots did not pick');
const side = g.side(h), [j1, j2] = JOBS[side];
g.handle(h, { t: 'role', r: j1.id });
g.handle(h, { t: 'pick', op: j2.ops[0] });
if (h.op) fail('picked', h.op, 'outside the role', j1.id);
const free = j1.ops.find(o => ![...g.players.values()].some(q => q !== h && q.squad === h.squad && q.op === o)) || j1.ops[0];
g.handle(h, { t: 'pick', op: free });
if (h.op !== free) fail('could not pick', free, 'in its own role');
g.handle(h, { t: 'role', r: j2.id });
if (h.op) fail('kept', h.op, 'after switching role to', j2.id);
g.handle(h, { t: 'role', r: j1.id }); g.handle(h, { t: 'pick', op: free }); g.handle(h, { t: 'lock' });
g.handle(h, { t: 'role', r: j2.id });
if (h.job !== j1.id || h.op !== free) fail('changed role after locking in');
for (let i = 0; i < 30 * 10 && g.phase === PHASE.SELECT; i++) g.tick(1 / 30);
if (g.phase !== PHASE.PREP) fail('round did not start');
for (const q of g.players.values()) if (!q.job || jobOf(q.op) !== q.job) fail(q.name, 'has role', q.job, 'but plays', q.op);
// he asked: bots spread out over roles nobody has yet (roughly, not strictly)
{
  let distinct = 0, N = 200;
  for (let n = 0; n < N; n++) {
    const b = new Game(); for (let i = 0; i < 10; i++) b.addBot();
    b.startMatch();
    for (let i = 0; i < 30 * 20 && b.phase === PHASE.SELECT; i++) b.tick(1 / 30);
    for (const sq of [0, 1]) distinct += new Set([...b.players.values()].filter(q => q.squad === sq).map(q => q.job)).size;
  }
  const avg = distinct / N / 2;
  console.log('bot teams of 5 use', avg.toFixed(2), 'different roles on average (of 5)');
  if (avg < 3.9) fail('bots do not spread over the roles');
  if (avg > 4.95) fail('bot roles are always perfectly even (should be loose)');
}
console.log(fails ? `${fails} failure(s)` : 'PASS roles');
process.exit(fails ? 1 : 0);
