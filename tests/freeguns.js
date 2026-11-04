// Free play: any gun from the menu (he asked: change weapons freely). Pistols replace the sidearm, the rest the main
// gun; the pick stays through a respawn and goes when you switch operator. Run: node tests/freeguns.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { WEAPONS, SIDEARMS } from '../shared/operators.js';
let fails = 0; const ok = (c, ...a) => { if (!c) { fails++; console.log('FAIL', ...a); } };
const g = new Game({ free: true }), p = g.addPlayer('Me', false); p.sock = { open: true, send() {} };
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
for (const w of Object.keys(WEAPONS)) {
  g.handle(p, { t: 'free', a: 'gun', w }); g.tick(1 / 30);
  const i = p.guns.findIndex(q => q.w === w);
  ok(i >= 0 && p.slot === i, 'not in hand:', w, p.guns.map(q => q.w));
  ok(p.guns.length === 2 && SIDEARMS.has(p.guns[1].w) && !SIDEARMS.has(p.guns[0].w), 'slots mixed up after', w, p.guns.map(q => q.w));
}
g.handle(p, { t: 'free', a: 'gun', w: 'pike' }); g.handle(p, { t: 'free', a: 'gun', w: 'sparrow' });
g.freeSpawn(p, true); ok(p.guns[0].w === 'pike' && p.guns[1].w === 'sparrow', 'pick lost on respawn', p.guns.map(q => q.w));
g.handle(p, { t: 'free', a: 'pick', op: 'rampart' }); ok(!p.guns.some(q => q.w === 'pike'), 'pick kept after switching operator');
g.handle(p, { t: 'free', a: 'gun', w: 'longbow' }); ok(p.guns[0].w === 'longbow' && !p.riot, 'riot shield not replaced', p.riot);
console.log(fails ? `${fails} failure(s)` : 'PASS freeguns'); process.exit(fails ? 1 : 0);
