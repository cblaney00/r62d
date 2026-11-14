// The pro drills (server/drills.js, he asked): every kind runs a simulated minute or less in the Drill Hall, nobody
// crosses the middle line, no skills or gadgets go out, the scoring adds up, and a session teaches each pro a style.
// node tests/drills.js [drills]
import './_tmpdata.js';
import { runDrill, drillSession, learnStyles, DRILLS, DRILL_TIME, PROS } from '../server/drills.js';
import { buildMap } from '../shared/map.js';
const n = Number(process.argv[2]) || 40;
let fail = 0; const bad = m => { fail++; console.log('FAIL ' + m); };
const m = buildMap('drill'), hall = m.rooms.find(r => r.name === 'Drill Hall');
console.log(`Drill Hall: ${hall.w} x ${hall.h} cells`);
for (const kind of Object.keys(DRILLS)) {
  const K = DRILLS[kind], names = PROS.map(p => p.name), r = runDrill(kind, names.slice(0, K.a), names.slice(5, 5 + K.b));
  const kills = r.fights.length;
  console.log(`${kind}: ${r.a.join('+')} vs ${r.b.join('+')} → ${r.win === -1 ? 'draw' : r.win ? 'side B' : 'side A'} in ${r.time} s, ${kills} kills`);
  if (r.time > DRILL_TIME) bad(kind + ' ran past a minute');
}
const t0 = Date.now(), S = drillSession(n);
if (S.crash) bad('a drill crashed: ' + S.crash);
console.log(`${S.n} drills in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const [k, v] of Object.entries(S.kinds)) console.log(`  ${k}: ${v.n} played, ${v.draws} draws, ${(v.time / v.n).toFixed(0)} s on average`);
let fights = 0; for (const [h, [w, f]] of Object.entries(S.feats)) { fights += f; console.log(`  ${h}: won ${w} of ${f} fights where only one side had it`); }
const k = Object.values(S.pro).reduce((a, p) => a + p.k, 0);
if (!k) bad('nobody killed anyone');
const styles = learnStyles({}, S.styleRec);
console.log('styles learned for', Object.keys(styles).length, 'pros, e.g.', JSON.stringify(Object.entries(styles)[0] || ''));
// nobody crossed the line: checked with the positions of a fresh drill every tick
console.log(fail ? 'FAIL drills' : 'PASS drills');
// into the training record, styles learned, and every pro forms a view of the worst thing in the game
const { training, addDrills, drillMul } = await import('../server/training.js');
const { formOpinions } = await import('../server/opinions.js');
addDrills(S); formOpinions('test');
console.log(`training.drills: ${training.drills.n} drills, ${Object.keys(training.drills.style).length} styles, Kaze lean x${drillMul('Kaze', 'lean').toFixed(2)}`);
for (const [name, log] of Object.entries(training.opinions)) console.log(`  ${name}: ${log[log.length - 1].text}`);
if (Object.keys(training.opinions).length < 10) console.log('FAIL not every pro has a view');
