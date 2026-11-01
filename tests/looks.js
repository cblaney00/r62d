// Every operator looks like themselves (he asked: no reused helmet types, nobody a reskin of somebody else):
// their own headgear drawing, a back item and a vest cut, and no two operators with the same back + vest pair.
import { OPERATORS } from '../shared/operators.js';
import { HEADGEAR, PACK, VEST } from '../public/js/headgear.js';
let fail = 0; const bad = m => { fail++; console.log('FAIL', m); };
const ops = Object.keys(OPERATORS), fns = new Set(), pairs = new Map();
for (const op of ops) {
  if (typeof HEADGEAR[op] !== 'function') bad(`${op}: no headgear of their own`);
  else { const src = HEADGEAR[op].toString().replace(/^[^(]*/, ''); if (fns.has(src)) bad(`${op}: headgear identical to another`); fns.add(src); }
  if (!PACK[op]) bad(`${op}: nothing on their back`); if (!VEST[op]) bad(`${op}: no vest cut`);
  const k = PACK[op] + '/' + VEST[op]; if (pairs.has(k)) bad(`${op} and ${pairs.get(k)} carry and wear the same`); pairs.set(k, op);
}
for (const k of Object.keys(HEADGEAR)) if (!OPERATORS[k]) bad(`headgear for unknown operator ${k}`);
console.log(fail ? `FAIL looks (${fail})` : `PASS looks (${ops.length} operators, all different)`);
process.exit(fail ? 1 : 0);
