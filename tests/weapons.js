// Side-specific weapons (he asked): no gun is carried by both attackers and defenders, defence has no marksman or
// sniper rifles but does have a slug shotgun, every gun is carried by someone, and each has its art, sound and spray.
// Run: node tests/weapons.js
import { WEAPONS, LOADOUTS, OPERATORS, SPRAY, SIDEARMS, RIOT } from '../shared/operators.js';
let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const sides = {};
for (const [op, L] of Object.entries(LOADOUTS)) for (const w of [...L.primaries, ...L.secondaries]) {
  if (RIOT[w]) { if (RIOT[w].side !== OPERATORS[op].team) fail(op, 'has the other side\'s shield', w); continue; } // a riot shield, not a gun
  if (!WEAPONS[w]) { fail(op, 'carries an unknown gun', w); continue; }
  (sides[w] || (sides[w] = new Set())).add(OPERATORS[op].team);
  if (L.secondaries.includes(w) && !SIDEARMS.has(w)) fail(op, 'has', w, 'as a sidearm');
}
// he asked (2026-11-17): nobody carries 3 or more guns of one type (Onyx had 3 LMGs); and the starting guns are in the lists
for (const [op, L] of Object.entries(LOADOUTS)) {
  const n = {}; for (const w of [...L.primaries, ...L.secondaries]) { const k = RIOT[w] ? 'shield' : WEAPONS[w] && WEAPONS[w].cls; n[k] = (n[k] || 0) + 1; }
  for (const [k, c] of Object.entries(n)) if (c >= 3) fail(op, 'carries', c, k + 's');
  if (!L.primaries.includes(OPERATORS[op].primary) && !RIOT[OPERATORS[op].primary]) fail(op, 'starts with a primary not in their list', OPERATORS[op].primary);
}
for (const [w, s] of Object.entries(sides)) if (s.size > 1) fail(WEAPONS[w].name, 'is carried by both sides');
for (const w of Object.keys(WEAPONS).filter(k => !WEAPONS[k].zb)) {
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
