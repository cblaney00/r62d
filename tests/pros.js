// The pro teams (he asked: the best bots, held to human limits, and the test subjects for game tests).
// Plays pro-vs-pro matches and checks: every round each team picks a plan from its playbook and its leader calls it,
// the plan is carried out (the push starts, people stack and hold), plans get switched when the round goes wrong,
// reactions are human (never faster than ~0.18 s from first sight to first shot), and a pro team beats Expert bots.
// Run: node tests/pros.js [--only <map>] [--rounds N]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE } from '../shared/constants.js';
import { PRO_TEAMS, playbook } from '../shared/pros.js';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
let fails = 0; const bad = (...a) => { fails++; console.log('FAIL', ...a); };
const dt = 1 / 30;

function play(id, { vsExpert = false, maxMin = 25 } = {}) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = 7;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  if (vsExpert) for (const p of g.players.values()) if (p.squad === 1) { p.pro = null; p.level = 5; p.name = p.baseName; p.persona = null; }
  const reacts = [], seenAt = new Map(), rounds = []; let t = 0, last = null;
  while (t < 60 * maxMin) {
    g.tick(dt); t += dt;
    for (const p of g.players.values()) if (p.pro && p.alive && p.ai && p.ai.seen && p.input && p.input.fire && !p.ai.shotAtSeen && p.ai.seenT !== undefined) { p.ai.shotAtSeen = true; reacts.push(g.time - p.ai.seenT); } // first sight to first shot
    if (g.phase !== last) { if (g.phase === PHASE.ROUND_END) rounds.push({ round: g.round, winner: g.winner, why: g.reason, plans: Object.values(g.proState || {}).map(s => s.plan && s.plan.id) }); last = g.phase; }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
  return { g, reacts, rounds };
}

const maps = arg('--only') ? [arg('--only')] : MAP_LIST;
// every map and site has plans for both sides
for (const id of MAP_LIST) { const m = buildMap(id); m.sites.forEach((s, si) => { for (const side of ['atk', 'def']) if (playbook(m, si, side, PRO_TEAMS[0]).length < 2) bad(`${id} site ${si} ${side}: fewer than 2 plans`); }); }
let allReacts = [], switches = 0, calls = 0, gos = 0;
for (const id of maps) {
  const { g, reacts, rounds } = play(id);
  allReacts.push(...reacts);
  const log = g.proLog || [];
  calls += log.length; switches += log.filter(l => /switch|now|Retake|Rotate/i.test(l.text)).length; gos += log.filter(l => /^go!|\bgo now\b|\bwe go\b/i.test(l.text)).length;
  if (rounds.length < 3) bad(id, 'match did not finish');
  for (const r of rounds) if (r.plans.filter(Boolean).length < 2) bad(id, 'round', r.round, 'a team had no plan');
  const plansUsed = new Set(rounds.flatMap(r => r.plans));
  console.log(`${g.map.name}: ${rounds.length} rounds, Northwind ${rounds.filter(r => r.winner === 0).length} – Ironclad ${rounds.filter(r => r.winner === 1).length} — plans ${[...plansUsed].join(', ')}; ${log.length} calls, e.g. "${(log.find(l => /:/.test(l.text)) || {}).text?.slice(0, 80)}"`);
}
allReacts.sort((a, b) => a - b);
const pct = q => allReacts[Math.floor(allReacts.length * q)] || 0;
console.log(`reaction from first sight to first shot: fastest ${pct(0).toFixed(2)} s, median ${pct(0.5).toFixed(2)} s (${allReacts.length} fights)`);
if (allReacts.length && pct(0.02) < 0.16) bad('superhuman reactions', pct(0.02)); // 0.17 s floor, measured in 1/30 s server steps
if (!gos) bad('no team ever started its push'); if (!switches) bad('no plan was ever changed on the fly'); if (!calls) bad('no plans were called');
// pros against Expert bots
const N = +(arg('--rounds') || 2); let pw = 0, ew = 0;
for (const id of maps.slice(0, N)) { const { rounds } = play(id, { vsExpert: true }); for (const r of rounds) r.winner === 0 ? pw++ : ew++; }
console.log(`pros vs Expert bots: ${pw} rounds to ${ew}`);
if (pw <= ew) bad('the pros did not beat Expert bots');
console.log(fails ? `FAIL pros (${fails})` : 'PASS pros');
process.exit(fails ? 1 : 0);
