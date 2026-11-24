// The walk-in (he asked 2026-11-23: defenders froze during it): while the attackers walk on, defenders move and act as
// usual, attackers ignore input and can't be hurt; afterwards everything is normal. Run: node tests/introdef.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game(); for (let i = 0; i < 10; i++) g.addBot(); g.startMatch();
let n = 0; while (!(g.phase === PHASE.ACTION && g.introT > 0) && n++ < 30 * 400) g.tick(1 / 30);
if (!(g.introT > 0)) { fail('no walk-in started'); process.exit(1); }
const ps = [...g.players.values()], def = ps.filter(p => g.side(p) === TEAM.DEF), atk = ps.filter(p => g.side(p) === TEAM.ATK);
const d0 = def.map(p => [p.x, p.y, p.aim]);
const a = atk[0]; const hp0 = a.hp; g.damage(a, 50, def[0], 'Test', 0); if (a.hp !== hp0) fail('a walking-on attacker was hurt');
for (let i = 0; i < 45 && g.introT > 0; i++) g.tick(1 / 30);
const moved = def.filter((p, i) => Math.hypot(p.x - d0[i][0], p.y - d0[i][1]) > 4 || Math.abs(p.aim - d0[i][2]) > 0.05).length;
if (!moved) fail('no defender moved or turned during the walk-in'); else console.log(`${moved}/${def.length} defenders moved during the walk-in`);
while (g.introT > 0) g.tick(1 / 30);
const h1 = a.hp; g.damage(a, 10, def[0], 'Test', 0); if (a.hp === h1) fail('attacker still safe after the walk-in');
console.log(fails ? `${fails} failure(s)` : 'PASS introdef'); process.exit(fails ? 1 : 0);
