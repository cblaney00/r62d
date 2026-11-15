// Asking for the defuser (he asked 2026-11-15): attackers can request it in operator select next to their spawn; it goes
// to one of those who asked, picked at random; nobody asked = any attacker. The request lasts one round.
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const got = new Map();
for (let run = 0; run < 24; run++) {
  const g = new Game(); g.mapId = 'harbor'; for (let i = 0; i < 10; i++) g.addBot(); g.startMatch();
  for (let i = 0; i < 30 * 60 && g.phase !== PHASE.SELECT; i++) g.tick(1 / 30);
  const atk = [...g.players.values()].filter(p => g.side(p) === TEAM.ATK), ask = run % 3 === 2 ? [] : atk.slice(0, 2);
  for (const p of ask) g.handle(p, { t: 'defreq', on: true });
  if (g.players.get(ask[0] && ask[0].id) && !ask[0].defReq) fail('request not taken in operator select');
  const d = [...g.players.values()].find(p => g.side(p) === TEAM.DEF); g.handle(d, { t: 'defreq', on: true }); if (d.defReq) fail('a defender could ask for the defuser');
  for (let i = 0; i < 30 * 120 && g.phase === PHASE.SELECT; i++) g.tick(1 / 30);
  const car = atk.filter(p => p.hasDefuser); if (car.length !== 1) { fail('carriers', car.length); continue; }
  if (ask.length && !ask.includes(car[0])) fail('defuser went to someone who did not ask');
  if (ask.length) got.set(car[0].id === ask[0].id ? 0 : 1, (got.get(car[0].id === ask[0].id ? 0 : 1) || 0) + 1);
  g.nextRound(); if (atk.some(p => p.defReq)) fail('request kept into the next round');
}
if (!(got.get(0) && got.get(1))) fail('always the same asker: not random', [...got]);
console.log(fails ? `FAIL ${fails}` : `PASS defuser requests (askers chosen ${got.get(0)} / ${got.get(1)})`);
process.exit(fails ? 1 : 0);
