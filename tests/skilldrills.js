// Skill drills (server/skilldrills.js, he asked 2026-11-20): every situation sets up and finishes on both small maps, the locked
// run really uses no skill, a session adds up, eagerness moves, and a drill idea two pros back gets adopted.
// Run: node tests/skilldrills.js [pairs]
import './_tmpdata.js';
import { runSkillDrill, skillSession, SITUATIONS, SMALL } from '../server/skilldrills.js';
import { training, addSkillDrills, closeSkillSession } from '../server/training.js';
import { formDrillIdeas } from '../server/opinions.js';

let bad = 0; const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) bad++; };
const t0 = Date.now();
for (const map of SMALL) for (const sit of Object.keys(SITUATIONS)) {
  const op = sit === 'roam' || sit === 'hold' ? 'ember' : 'wraith';
  const r = runSkillDrill({ op, sit, trainee: 'Grit', opp: 'Pax', map, skill: true });
  ok(r.done, `${map} ${sit}: ${op} finished in ${r.time} s (${r.reason}), won ${r.win}, ${r.uses} skill uses`);
}
for (const op of ['ferro', 'wraith', 'mason', 'ember']) {
  let u = 0; for (let i = 0; i < 3; i++) u += runSkillDrill({ op, sit: op === 'mason' || op === 'wraith' ? 'hold' : 'entry', trainee: 'Grit', opp: 'Pax', skill: false }).uses;
  ok(u === 0, `${op} locked: ${u} skill uses in 3 drills`);
}
const n = +process.argv[2] || 24, T0 = Date.now(), D = skillSession(n, training.skill || {}, training.skillDrills || {});
ok(!D.crash && D.n >= n * 0.8, `a session of ${n} pairs: ${D.n} finished in ${((Date.now() - T0) / 1000).toFixed(1)} s${D.crash ? ' CRASH ' + D.crash : ''}`);
addSkillDrills(D); closeSkillSession();
ok(training.skillDrills.n === D.n && Object.keys(training.skillDrills.prog).length > 0, 'results kept, progress per pro per situation');
// eagerness: a pro whose higher tries win moves up
addSkillDrills({ n: 0, sit: {}, pro: {}, eag: { Grit: { ferro: { hi: [5, 6], lo: [1, 6] } } } });
ok(training.skill.Grit.ferro.eager > 1, `eagerness moves toward what wins (${training.skill.Grit.ferro.eager.toFixed(2)})`);
// drill ideas: two pros flat for 3 sessions in the same drill → their change is adopted
const T = training.skillDrills; T.sit['ferro|entry'] = [20, 8, 20, 10, 12];
for (const name of ['Kaze', 'Brick']) T.prog[name] = { entry: [[50, 4], [45, 4], [40, 4]] };
formDrillIdeas('test');
ok((T.ideas || []).length > 0, `${T.ideas.length} drill ideas, e.g. "${(T.ideas[0] || {}).text}"`);
ok(T.ideas.some(x => x.adopted), 'an idea two pros back is adopted: tweaks ' + JSON.stringify(T.tweaks));
console.log(`\n${bad ? bad + ' FAILED' : 'all passed'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(bad ? 1 : 0);
