// Every "Keys like another game" layout: no key does two jobs, nothing important is left without a key, and Siege's 3 / 4 are right.
const store = {};
Object.assign(globalThis, { localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } } });
for (const [k, v] of Object.entries({ window: globalThis, addEventListener() {}, matchMedia: () => ({ matches: false }), location: { search: '' }, innerHeight: 900, innerWidth: 1600 })) if (!(k in globalThis)) globalThis[k] = v;
if (!globalThis.document) globalThis.document = { documentElement: { classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} } }, addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
const { ACTIONS, PRESETS, applyPreset, getBinds } = await import('../public/js/keys.js');
let bad = 0;
const fail = m => { bad++; console.log('FAIL', m); };
for (const [id, name] of PRESETS) {
  applyPreset(id);
  const b = getBinds(), seen = {};
  for (const k in b) for (const c of b[k]) { if (!c) continue; if (seen[c]) fail(`${name}: ${c} is both ${seen[c]} and ${k}`); seen[c] = k; }
  for (const [a] of ACTIONS) if (a !== 'opPrev' && a !== 'crouchTap' && !((a === 'fire' || a === 'aimIn') && id !== 'trackpad') && !(a === 'crouch' && b.crouchTap.some(Boolean)) && !b[a].some(Boolean)) fail(`${name}: nothing on ${a}`);
  console.log(name.padEnd(32), ['sprint', 'crouch', 'crouchTap', 'prone', 'walk', 'interact', 'gadget', 'ability', 'melee', 'leanL', 'leanR', 'wheel', 'map', 'view', 'drone'].map(a => a + '=' + b[a].filter(Boolean).join('/').replace(/Key|Digit/g, '')).join(' '));
}
applyPreset('r6');
const r = getBinds();
if (r.crouchTap[0] !== 'KeyC' || r.prone[0] !== 'ControlLeft' || r.sprint[0] !== 'ShiftLeft') fail('Siege: C taps crouch, Ctrl lies down, Shift sprints');
if (r.gadget[0] !== 'Digit3') fail('Siege: 3 should be the gadget');
if (r.ability[0] !== 'Digit4') fail('Siege: 4 should be the operator skill');
console.log(bad ? `${bad} problems` : 'PASS');
process.exit(bad ? 1 : 0);
