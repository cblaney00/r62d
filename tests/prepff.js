// No friendly fire in preparation (he asked: shotgunning walls to set up): a teammate's shot passes through you, then
// the wall behind still breaks; in the action phase friendly fire is back. Run: node tests/prepff.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game(); for (let i = 0; i < 10; i++) g.addBot(); g.startMatch();
while (g.phase !== PHASE.PREP) g.tick(1 / 30);
const [a, b] = [...g.players.values()].filter(p => g.side(p) === TEAM.DEF);
for (const p of [a, b]) { p.bot = false; p.hp = p.maxHp = 100; }
b.x = a.x + 30; b.y = a.y;
g.hitscan(a, a.x, a.y, 0, 400, 30, 'Test', 'Shotgun'); if (b.hp !== 100) fail('teammate hurt in preparation', b.hp);
g.damage(a, 50, a, 'Nitro Pack', 0); if (a.hp !== 100) fail('hurt yourself in preparation');
g.phase = PHASE.ACTION; g.hitscan(a, a.x, a.y, 0, 400, 30, 'Test', 'AR'); if (b.hp === 100) fail('friendly fire should be back in the action phase');
console.log(fails ? `${fails} failure(s)` : 'PASS prepff'); process.exit(fails ? 1 : 0);
