// ESPORTS TV (he asked): when a drone is shot the director cuts to the shooter (or someone else). The server marks it
// with a 'dlost' event: id = the drone's pilot, by = who broke it. Run: node tests/tvdrone.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
let fails = 0, seen = 0, byShooter = 0; const ok = (c, ...a) => { if (!c) { fails++; console.log('FAIL', ...a); } };
const g = new Game({ tv: true }); g.tvStart('harbor', 7);
for (let t = 0; t < 30 * 60 * 8 && seen < 3; t++) {
  g.events.length = 0; g.tick(1 / 30);
  for (const e of g.events) if (e.e === 'dlost') {
    seen++; const o = g.players.get(e.id), by = e.by && g.players.get(e.by);
    ok(o, 'dlost names no pilot'); ok(o && o.ctrl !== 'drone', 'pilot still on the drone');
    if (by) byShooter++;
    console.log(`${(t / 30).toFixed(0)} s: ${o && o.name}'s drone lost${by ? ', shot by ' + by.name : ''}`);
  }
}
ok(seen > 0, 'no drone was lost in 8 minutes');
ok(byShooter > 0, 'no lost drone named its shooter');
const n = new Game({}); n.events.length = 0; n.droneLost({ owner: 'x', id: 1, team: 'atk', type: 'drone' }); ok(!n.events.some(e => e.e === 'dlost'), 'dlost sent outside TV');
console.log(fails ? `${fails} failure(s)` : 'PASS');
process.exit(fails ? 1 : 0);
