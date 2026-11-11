// Status icons (he asked): blind / slow / snare / daze / deaf carry the side that caused them in the snapshot (ef), so
// only that side sees the icon (and Esports TV). Run: node tests/status.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game(); for (let i = 0; i < 10; i++) g.addBot(); g.startMatch();
while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
const atk = [...g.players.values()].find(p => g.side(p) === TEAM.ATK), def = [...g.players.values()].find(p => g.side(p) === TEAM.DEF);
for (const p of g.players.values()) p.bot = false;
const efOf = q => g.efOut(q) || [];
def.x = atk.x + 40; def.y = atk.y;
g.detonate({ type: 'nade', kind: 'stun', x: def.x + 5, y: def.y, team: TEAM.ATK, owner: atk.id });
const bl = efOf(def).find(e => e[0] === 'blind');
if (!bl) fail('stun grenade: no blind on the defender', JSON.stringify(efOf(def))); else if (bl[2] !== TEAM.ATK) fail('blind should be by attack', bl);
if (!(def.stunUntil > g.time)) fail('blind did not set stunUntil');
g.detonate({ type: 'mine', x: def.x, y: def.y, team: TEAM.ATK, owner: atk.id });
if (!efOf(def).some(e => e[0] === 'slow' && e[2] === TEAM.ATK)) fail('mine: no slow by attack');
g.effect(atk, 'snare', 2, def);
if (!efOf(atk).some(e => e[0] === 'snare' && e[2] === TEAM.DEF)) fail('snare by a defender player');
if (!(atk.clampUntil > g.time)) fail('snare did not set clampUntil');
for (let i = 0; i < 30 * 5; i++) g.tick(1 / 30);
if (efOf(atk).length) fail('snare should have worn off', JSON.stringify(efOf(atk)));
console.log(fails ? `${fails} failure(s)` : 'PASS status'); process.exit(fails ? 1 : 0);
