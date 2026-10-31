// The tutorial runs as one quick run: round 1 you attack, a quick plant ends it, the sides swap, round 2 you defend,
// the bots never hurt you, and it stops after round 2. Run: node tests/tutorial.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { opsForTeam } from '../shared/operators.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ tut: true }), p = g.addPlayer('Learner', false);
g.handle(p, { t: 'tut', a: 'start', lesson: 'all' });
const run = s => { for (let i = 0; i < s * 30; i++) g.tick(1 / 30); };
const pick = () => { p.op = opsForTeam(g.side(p))[0]; p.locked = true; g.handle(p, { t: 'tut', a: 'go' }); };
let worst = 0;
const watch = s => { for (let i = 0; i < s * 30; i++) { g.tick(1 / 30); if (p.alive) worst = Math.min(worst, p.hp - p.maxHp); } };
if (g.phase !== PHASE.SELECT || g.side(p) !== TEAM.ATK) fail('does not start with you attacking');
pick(); run(1);
if (g.phase !== PHASE.PREP) fail('operator select did not end', g.phase);
run(5); if (g.phase !== PHASE.PREP) fail('preparation did not wait for the coach');
g.handle(p, { t: 'tut', a: 'go' }); run(5);
if (g.phase !== PHASE.ACTION) fail('no action phase', g.phase);
watch(40); // bots are defending; walk into them: they never hurt you
const site = g.map.sites[g.site], b = site.bombs[0];
p.x = b.x; p.y = b.y; p.hasDefuser = false;
g.planted = { x: b.x, y: b.y, bomb: b.id, t: 3 }; // as if you planted (the tutorial shortens the wait)
run(4); if (g.phase !== PHASE.ROUND_END) fail('the plant did not end the round quickly', g.phase);
run(8); if (g.round !== 2 || g.phase !== PHASE.SELECT || g.side(p) !== TEAM.DEF) fail('no defending round after', g.round, g.phase, g.side(p));
pick(); run(1); run(3); if (g.phase !== PHASE.PREP) fail('defence prep did not wait'); g.handle(p, { t: 'tut', a: 'go' }); run(5);
watch(90);
if (worst < 0) fail("a bot hurt you, lost hp", -worst);
g.handle(p, { t: 'tut', a: 'finish' }); run(1);
if (g.phase !== PHASE.ROUND_END) fail('finish did not end the round');
run(20); if (g.phase !== PHASE.ROUND_END || g.round !== 2) fail('the tutorial went on after round 2', g.round, g.phase);
console.log(fails ? `${fails} failure(s)` : 'PASS tutorial');
process.exit(fails ? 1 : 0);
