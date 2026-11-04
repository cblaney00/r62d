// The ping wheel: a ping reaches the team with its kind, go and hold send bots to the spot, danger calls them off, enemy sends nobody,
// and a made-up kind is ignored. Run: node tests/pingwheel.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE } from '../shared/constants.js';
let bad = 0; const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
const g = new Game({ free: true }), me = g.addPlayer('Me', false);
g.handle(me, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
g.addBot(me.squad); g.addBot(me.squad);
const bots = [...g.players.values()].filter(q => q.bot && q.squad === me.squad);
for (const b of bots) { b.alive = true; b.downed = false; }
g.phase = PHASE.ACTION;
const ping = (pk, x = 900, y = 700) => { me.pingReady = 0; g.events.length = 0; g.event ? g.event(me, { k: 'mark', x, y, w: 'TEST', pk }) : null; return g.events.find(e => e.e === 'mark'); };
const e = ping('go');
check(e && e.pk === 'go', 'the team gets the ping with its kind');
check(bots.every(b => b.ai && b.ai.cmd && b.ai.cmd.k === 'goto' && b.ai.cmd.x === 900), 'go sends the two nearest bots to the spot');
ping('danger');
check(bots.every(b => !b.ai.cmd), 'danger calls off orders to go there');
ping('enemy');
check(bots.every(b => !b.ai.cmd), 'enemy sends nobody');
ping('hold');
check(bots.filter(b => b.ai.cmd && b.ai.cmd.stay === 45).length === 1, 'hold sends one bot, who stays');
const odd = ping('nonsense');
check(odd && odd.pk === undefined, 'a made-up kind is just a plain ping');
console.log(bad ? bad + ' FAILED' : 'PASS'); process.exit(bad ? 1 : 0);
