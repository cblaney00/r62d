// He asked (2026-11-23): an operator whose skill or gadget finds an enemy gets a note. Run: node tests/intel.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game(); for (let i = 0; i < 10; i++) g.addBot(); g.startMatch();
let n = 0; while (g.phase !== PHASE.ACTION && n++ < 30 * 400) g.tick(1 / 30);
const ps = [...g.players.values()], d = ps.find(p => g.side(p) === TEAM.DEF), a = ps.find(p => g.side(p) === TEAM.ATK);
d.bot = false; d.op = 'deadfall';
const notes = () => g.events.filter(e => e.e === 'intel' && e.id === d.id);
g.events.length = 0; g.spot(TEAM.DEF, a.id, 4, { id: 999, type: 'sensor', owner: d.id });
if (notes().length !== 1) fail('no note for a sensor spot', JSON.stringify(g.events)); else console.log(notes()[0].w);
g.events.length = 0; g.spot(TEAM.DEF, a.id, 4, { id: 999, type: 'sensor', owner: d.id });
if (notes().length) fail('the same gadget told again at once');
g.events.length = 0; g.spot(TEAM.DEF, a.id, 4); if (notes().length) fail('a spot with no gadget gave a note');
g.events.length = 0; g.spot(TEAM.DEF, a.id, 4, d); if (notes().length !== 1) fail('no note for your own skill'); else console.log(notes()[0].w);
console.log(fails ? `${fails} failure(s)` : 'PASS intel'); process.exit(fails ? 1 : 0);
