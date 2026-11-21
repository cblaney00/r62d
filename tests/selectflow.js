// Operator select order (he asked 2026-11-16): the site (defenders, whoever locks it in decides: no vote) or your
// spawn (attackers) is locked in before roles / operators; attackers can switch operator in preparation, nobody can once
// the action starts, and defenders can't in preparation. Run: node tests/selectflow.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { opsForTeam, jobOf } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game();
const a = g.addPlayer('Atk', false), d = g.addPlayer('Def', false);
for (const p of [a, d]) p.sock = { open: true, send() {} };
for (let i = 0; i < 8; i++) g.addBot();
g.startMatch();
let atk = g.side(a) === TEAM.ATK ? a : d, def = atk === a ? d : a;
if (g.side(def) !== TEAM.DEF) { // both on one team: move one over
  def.squad = 1 - atk.squad; }
const mates = p => [...g.players.values()].filter(q => q.squad === p.squad);
const freeOp = (p, not) => opsForTeam(g.side(p)).find(o => o !== not && !mates(p).some(q => q !== p && q.op === o));
if (g.siteLk) fail('the bots locked the site although a person defends');
g.handle(def, { t: 'pick', op: freeOp(def) }); if (def.op) fail('defender picked before the site was locked in');
const other = (g.site + 1) % g.map.sites.length; g.handle(def, { t: 'site', n: other }); if (g.site !== other) fail('site choice ignored');
g.handle(def, { t: 'place' }); if (!g.siteLk) fail('site lock ignored');
g.handle(def, { t: 'site', n: (other + 1) % g.map.sites.length }); if (g.site !== other) fail('site changed after it was locked in');
const dop = freeOp(def); g.handle(def, { t: 'pick', op: dop }); if (def.op !== dop) fail('defender pick after the site lock ignored');
g.handle(atk, { t: 'pick', op: freeOp(atk) }); if (atk.op) fail('attacker picked before locking in a spawn');
g.handle(atk, { t: 'place' }); const op1 = freeOp(atk); g.handle(atk, { t: 'pick', op: op1 }); if (atk.op !== op1) fail('attacker pick ignored');
g.handle(atk, { t: 'lock' }); g.handle(def, { t: 'lock' });
for (let i = 0; i < 30 * 20 && g.phase === PHASE.SELECT; i++) g.tick(1 / 30);
if (g.phase !== PHASE.PREP) fail('no preparation phase:', g.phase);
const drone = atk.droneId, op2 = freeOp(atk, op1);
g.handle(atk, { t: 'role', r: jobOf(op2) }); g.handle(atk, { t: 'pick', op: op2 });
if (atk.op !== op2) fail('attacker could not switch operator in preparation');
if (atk.droneId !== drone || atk.ctrl !== 'drone' || !atk.staged) fail('switching lost the drone / spawn wait');
const dop2 = freeOp(def, dop); g.handle(def, { t: 'pick', op: dop2 }); if (def.op !== dop) fail('defender switched in preparation');
for (let i = 0; i < 30 * 40 && g.phase === PHASE.PREP; i++) g.tick(1 / 30);
if ((g.phase !== PHASE.ACTION || g.introT > 0)) fail('no action phase:', g.phase);
g.handle(atk, { t: 'pick', op: freeOp(atk, op2) }); if (atk.op !== op2) fail('attacker switched in the action phase');
console.log(fails ? `${fails} failures` : 'PASS selectflow');
process.exit(fails ? 1 : 0);
