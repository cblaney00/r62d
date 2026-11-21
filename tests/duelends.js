// 1V1 round ends (he asked 2026-11-20): a round ends the moment one player dies, unless the defuser is planted; then it
// ends only when the defuser is disabled or its countdown runs out. Checks each case on a live 1V1.
// Run: node tests/duelends.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM, DUR } from '../shared/constants.js';
import { buildMap } from '../shared/map.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
function action() {
  const g = new Game(); g.mode = 'duel'; g.mapId = 'house'; g.map = buildMap('house'); g.botLevel = 0;
  g.addBot(0); g.addBot(1); g.startMatch();
  for (let i = 0; i < 30 * 120 && (g.phase !== PHASE.ACTION || g.introT > 0); i++) g.tick(1 / 30);
  const ps = [...g.players.values()], atk = ps.find(p => g.side(p) === TEAM.ATK), def = ps.find(p => g.side(p) === TEAM.DEF);
  for (const p of ps) p.bot = false; // (they stand still: the test decides what happens)
  return { g, atk, def };
}
const plant = g => { const b = g.map.sites[g.site].bombs[0]; g.planted = { x: b.x, y: b.y, bomb: b.id, t: DUR.bomb }; };
const run = (g, s) => { for (let i = 0; i < 30 * s && g.phase === PHASE.ACTION; i++) g.tick(1 / 30); };
{ const { g, atk, def } = action(); g.kill(atk, def, 'test'); run(g, 0.2); if (g.phase !== PHASE.ROUND_END || g.reason !== 'Attackers eliminated') fail('attacker died, no plant: round did not end', g.phase, g.reason); else console.log('attacker dies before a plant: round over, defender wins'); }
{ const { g, atk, def } = action(); g.kill(def, atk, 'test'); run(g, 0.2); if (g.phase !== PHASE.ROUND_END || g.reason !== 'Defenders eliminated') fail('defender died, no plant: round did not end', g.phase, g.reason); else console.log('defender dies before a plant: round over, attacker wins'); }
{ const { g, atk, def } = action(); g.damage(atk, 999, def, 'test'); run(g, 0.2); if (g.phase !== PHASE.ROUND_END) fail('attacker downed (no teammate), no plant: round did not end', g.phase); else console.log('attacker downed, nobody to revive: round over'); }
{ const { g, atk, def } = action(); plant(g); g.kill(atk, def, 'test'); run(g, 3); if ((g.phase !== PHASE.ACTION || g.introT > 0)) fail('planted, attacker died: round ended before the defuse', g.reason); else console.log('planted, attacker dies: round goes on');
  run(g, DUR.bomb + 1); if (g.reason !== 'Defuser completed') fail('planted, nobody disabled it: not an attack win', g.reason); else console.log('planted, countdown runs out: attacker wins'); }
{ const { g, atk, def } = action(); plant(g); g.kill(atk, def, 'test'); run(g, 1); g.busy = null; def.busy = { k: 'defuse', t: 0, dur: 0.01 }; g.continueInteract(def, 1); if (g.reason !== 'Defuser disabled') fail('defuse did not win', g.reason); else console.log('planted, defender disables it: defender wins'); }
console.log(fails ? `${fails} FAILED` : 'PASS'); process.exit(fails ? 1 : 0);
