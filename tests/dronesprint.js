// Drone sprint: Shift on a drone gives 1.6x speed for up to 3 s, 3 a round, 6 s before the next. Run: node tests/dronesprint.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { DRONE_SPRINT } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true }), p = g.addPlayer('Pilot', false);
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
const d = { id: g.eid(), type: 'drone', x: 0, y: 0, team: g.side(p), owner: p.id, hp: 1 };
// a long open stretch: the street below the building
let spot = null;
for (let y = 2; y < g.map.H - 2 && !spot; y++) for (let x = 2; x < g.map.W - 40 && !spot; x++) { let ok = true; for (let i = 0; i < 36 && ok; i++) ok = g.map.tiles[y * g.map.W + x + i] === 0; if (ok) spot = { x: x * 16 + 8, y: y * 16 + 8 }; }
Object.assign(d, spot); g.ents.push(d); p.droneId = d.id; p.ctrl = 'drone'; p.alive = true;
const run = (secs, walk) => { const x0 = d.x; for (let i = 0; i < secs * 30; i++) { p.prevInput = p.input; p.input = { right: true, walk }; g.applyMove(p, 1 / 30); g.tickPlayer(p, 1 / 30); g.time += 1 / 30; } return (d.x - x0) / secs; };
const base = run(1, false); d.x = spot.x;
const fast = run(1, true);
if (fast < base * 1.4) fail('sprint not faster', base.toFixed(0), fast.toFixed(0));
run(2.5, true); if (g.mods(p).sprint) fail('sprint lasted past 3 s');
if (p.sprints !== DRONE_SPRINT.charges - 1) fail('charges', p.sprints);
d.x = spot.x; run(0.1, false); run(0.1, true); if (g.mods(p).sprint) fail('sprint again before the 6 s wait');
d.x = spot.x; run(6, false); d.x = spot.x; run(0.1, true); if (!g.mods(p).sprint) fail('no second sprint after the wait');
for (let k = 0; k < 3; k++) { d.x = spot.x; run(0.2, false); run(6.5, false); d.x = spot.x; run(0.1, true); }
if (g.mods(p).sprint || p.sprints !== 0) fail('more than 3 sprints', p.sprints);
console.log(`plain ${base.toFixed(0)} px/s, sprint ${fast.toFixed(0)} px/s`);
console.log(fails ? `${fails} failure(s)` : 'PASS dronesprint');
process.exit(fails ? 1 : 0);
