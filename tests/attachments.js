// Attachments (he asked: balanced trade-offs that make sense for the type of gun): every gun has at least 3 choices in
// every slot, every attachment (besides "none" and the plain red dot) has an upside AND a downside, and no
// combination pushes a gun to silly numbers.
import { WEAPONS, ATTACH, ATTACH_SLOTS, attachFor, gunMods } from '../shared/operators.js';
let fail = 0; const bad = m => { fail++; console.log('FAIL', m); };
const GOOD_LOW = ['settle', 'ads', 'hip', 'adsSpread', 'kick', 'sway', 'first'], GOOD_HIGH = ['dmg', 'range'];
for (const [slot] of ATTACH_SLOTS) for (let [id, a] of Object.entries(ATTACH[slot])) {
  if (id === 'none' || id === 'reddot') continue;
  // a gun always has a sight, so sights are measured against the red dot
  if (slot === 'sight') { const r = ATTACH.sight.reddot; a = { ...a }; for (const k of GOOD_LOW) a[k] = (a[k] ?? 1) / (r[k] ?? 1); }
  const up = GOOD_LOW.some(k => a[k] < 1) || GOOD_HIGH.some(k => a[k] > 1) || a.quiet || a.zoom;
  const down = GOOD_LOW.some(k => a[k] > 1) || GOOD_HIGH.some(k => a[k] < 1) || a.laser;
  if (!up || !down) bad(`${slot} ${id}: needs an upside and a downside`);
  if (!/^\+ .* − /.test(a.desc)) bad(`${slot} ${id}: description should say "+ ... − ..."`);
}
for (const w of Object.keys(WEAPONS)) {
  const opts = attachFor(w);
  for (const [slot] of ATTACH_SLOTS) {
    if (opts[slot].length < 3) bad(`${w}: only ${opts[slot].length} ${slot} choices`);
    for (const id of opts[slot]) if (!ATTACH[slot][id]) bad(`${w}: unknown ${slot} ${id}`);
  }
  for (const b of opts.barrel) for (const g of opts.grip) for (const s of opts.sight) {
    const m = gunMods(w, { barrel: b, grip: g, sight: s });
    if (m.ads < 0.6 || m.ads > 1.6 || m.kick < 0.6 || m.sway < 0.35 || m.hip < 0.5 || m.adsSpread < 0.5 || m.range > 1.35 || m.dmg < 0.85)
      bad(`${w} ${b}/${g}/${s}: out of range ${JSON.stringify(m)}`);
  }
}
const count = Object.values(ATTACH).reduce((n, s) => n + Object.keys(s).length, 0);
console.log(`${count} attachments, ${Object.keys(WEAPONS).length} guns checked`);
console.log(fail ? `FAIL attachments (${fail})` : 'PASS attachments');
process.exit(fail ? 1 : 0);
