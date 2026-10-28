// Team camera / drone feeds: defenders flip through every working camera of their team (map, turret,
// sticky), attackers through every team drone and wall scope; only the owner can steer their own drone
// or turn / fire their own gadget camera, but anyone watching can mark enemies. Run: node tests/feeds.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, TEAM } from '../shared/constants.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game();
for (let i = 0; i < 10; i++) g.addBot();
g.mapId = MAP_LIST[0]; g.map = buildMap(g.mapId); g.startMatch();
while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
const ps = [...g.players.values()];
const [d1, d2] = ps.filter(p => g.side(p) === TEAM.DEF && p.alive), [a1, a2] = ps.filter(p => g.side(p) === TEAM.ATK && p.alive);
for (const p of [d1, d2, a1, a2]) { p.bot = false; p.ctrl = 'body'; p.busy = null; p.downed = false; }
const enemy = a2;
// defence: a turret owned by d2 joins the list
const tur = { id: g.eid(), type: 'cam', x: d2.x, y: d2.y, team: TEAM.DEF, owner: d2.id, hp: 1, offUntil: 0, ang: 0, tu: 1 };
g.ents.push(tur);
const feeds = g.feeds(TEAM.DEF);
if (!feeds.includes(tur)) fail('turret not in defender feeds');
if (feeds.some(f => f.team !== TEAM.DEF)) fail('enemy feed in defender list');
g.toggleView(d1); if (d1.ctrl !== 'cam') fail('defender could not open cameras');
let seen = new Set(); for (let i = 0; i < feeds.length; i++) { seen.add(d1.feedId); g.cycleCam(d1, 1); }
if (seen.size !== feeds.length) fail('defender did not flip through all', seen.size, feeds.length);
g.event(d1, { k: 'camSet', id: tur.id }); if (d1.feedId !== tur.id) fail('camSet to turret failed');
g.handle(d1, { t: 'input', k: {}, a: 1.5, dt: 0.016, s: 1 }); if (tur.ang !== 0) fail('non-owner turned the turret');
d1.input = { ...d1.input, fire: 1 }; d1.turretCd = 0; const ev0 = g.events.length; g.tickPlayer(d1, 1 / 30);
if (g.events.slice(ev0).some(e => e.e === 'laser')) fail('non-owner fired the turret');
d1.input = { ...d1.input, fire: 0 };
g.toggleView(d2); g.event(d2, { k: 'camSet', id: tur.id }); g.handle(d2, { t: 'input', k: {}, a: 1.5, dt: 0.016, s: 1 });
if (tur.ang !== 1.5) fail('owner could not turn the turret');
g.event(d1, { k: 'spot', id: enemy.id }); if (!g.spots.def.has(enemy.id)) fail('could not mark from a teammate\'s camera');
tur.hp = 0; g.tickPlayer(d1, 1 / 30); if (d1.ctrl === 'cam' && d1.feedId === tur.id) fail('still watching a broken camera');
// attack: own drone is driven, a teammate's is only watched
for (const p of [a1, a2]) { p.drones = 1; p.ctrl = 'body'; g.toggleView(p); }
if (a1.ctrl !== 'drone' || a2.ctrl !== 'drone') fail('attackers could not drone', a1.ctrl, a2.ctrl);
const own = g.ent(a1.droneId), other = g.ent(a2.droneId);
const af = g.feeds(TEAM.ATK); if (!af.includes(own) || !af.includes(other)) fail('team drones missing from attacker feeds');
seen = new Set(); for (let i = 0; i < af.length; i++) { seen.add(a1.ctrl === 'drone' ? a1.droneId : a1.feedId); g.cycleCam(a1, 1); }
if (seen.size !== af.length) fail('attacker did not flip through all drones', seen.size, af.length);
g.event(a1, { k: 'camSet', id: other.id }); if (a1.ctrl !== 'cam' || a1.feedId !== other.id) fail('could not watch teammate drone');
const ox = other.x, oy = other.y;
for (let i = 0; i < 20; i++) g.handle(a1, { t: 'input', k: { up: 1, right: 1 }, a: 0, dt: 0.03, s: i });
if (other.x !== ox || other.y !== oy) fail('drove a teammate\'s drone');
g.event(a1, { k: 'spot', id: d1.id }); if (!g.spots.atk.has(d1.id)) fail('could not mark from a teammate\'s drone');
g.event(a1, { k: 'camSet', id: own.id }); if (a1.ctrl !== 'drone') fail('own drone not driven');
g.hitEnt(other, a1); g.tickPlayer(a2, 1 / 30); if (a2.ctrl !== 'body') fail('pilot not back in body');
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
