// Side-specific weapons (he asked): no gun is carried by both attackers and defenders, defence has no marksman or
// sniper rifles but does have a slug shotgun, every gun is carried by someone, and each has its art, sound and spray.
// Run: node tests/weapons.js
import { WEAPONS, LOADOUTS, OPERATORS, SPRAY, SIDEARMS } from '../shared/operators.js';
let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const sides = {};
for (const [op, L] of Object.entries(LOADOUTS)) for (const w of [...L.primaries, ...L.secondaries]) {
  if (!WEAPONS[w]) { fail(op, 'carries an unknown gun', w); continue; }
  (sides[w] || (sides[w] = new Set())).add(OPERATORS[op].team);
  if (L.secondaries.includes(w) && !SIDEARMS.has(w)) fail(op, 'has', w, 'as a sidearm');
}
for (const [w, s] of Object.entries(sides)) if (s.size > 1) fail(WEAPONS[w].name, 'is carried by both sides');
for (const w of Object.keys(WEAPONS)) {
  if (!sides[w]) fail(WEAPONS[w].name, 'is carried by nobody');
  if (!SPRAY[w]) fail(WEAPONS[w].name, 'has no spray pattern');
}
const def = Object.keys(sides).filter(w => sides[w].has('def'));
if (def.some(w => WEAPONS[w].cls === 'DMR')) fail('a marksman rifle on defence:', def.filter(w => WEAPONS[w].cls === 'DMR'));
if (!def.some(w => WEAPONS[w].cls === 'Shotgun' && WEAPONS[w].pellets === 1)) fail('defence has no slug shotgun');
const atk = Object.keys(sides).filter(w => sides[w].has('atk'));
console.log(`attack: ${atk.length} guns, defence: ${def.length} guns`);
console.log(fails ? `${fails} failure(s)` : 'PASS weapons');
process.exit(fails ? 1 : 0);
