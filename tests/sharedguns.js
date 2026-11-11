// Gun setups are shared between operators (he asked), unless "only for this operator" is ticked.
import './_tmpdata.js';
import { store } from '../server/store.js';
import { attachFor } from '../shared/operators.js';

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const { token } = store.login('Gun Tester');
const o = attachFor('k4'), pick = s => o[s][o[s].length - 1], a = { barrel: pick('barrel'), grip: pick('grip'), sight: pick('sight'), ammo: pick('ammo') };
store.setLoadout(token, 'ember', { primary: 'k4' });
store.setLoadout(token, 'kestrel', { primary: 'k4' });
store.setGun(token, 'k4', a);
const same = x => JSON.stringify(x) === JSON.stringify(a);
ok(same(store.loadout(token, 'ember').att.k4), 'shared setup on Ember');
ok(same(store.loadout(token, 'kestrel').att.k4), 'and on Kestrel');
const mine = { barrel: o.barrel[0], grip: o.grip[0], sight: o.sight[0], ammo: o.ammo[0] };
store.setLoadout(token, 'kestrel', { primary: 'k4', att: { k4: mine }, own: { k4: true } });
ok(JSON.stringify(store.loadout(token, 'kestrel').att.k4) === JSON.stringify(mine), 'ticked: Kestrel keeps her own');
ok(same(store.loadout(token, 'ember').att.k4), 'Ember still on the shared one');
store.setGun(token, 'k4', { ...a, sight: o.sight[0] });
ok(store.loadout(token, 'ember').att.k4.sight === o.sight[0], 'changing the shared one moves Ember');
ok(JSON.stringify(store.loadout(token, 'kestrel').att.k4) === JSON.stringify(mine), 'but not ticked Kestrel');
store.setLoadout(token, 'kestrel', { primary: 'k4', att: { k4: mine }, own: { k4: false } });
ok(store.loadout(token, 'kestrel').att.k4.sight === o.sight[0], 'unticked: back to the shared one');
console.log(fails ? `FAIL sharedguns (${fails})` : 'PASS sharedguns'); process.exit(fails ? 1 : 0);
