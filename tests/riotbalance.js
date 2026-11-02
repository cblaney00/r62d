// Riot shield balance (he asked: test the shield operators thoroughly with the pros): the pro teams play matches on
// every map, playing any operator of their job; the six shield operators always carry their shield in one half and
// always a gun in the other. Prints each shield operator's round win rate, kills and deaths per round and damage both
// ways, so a shield that is far better or far worse than the guns shows up. Run: node tests/riotbalance.js [matches per map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE } from '../shared/constants.js';
import { RIOT, LOADOUTS, OPERATORS } from '../shared/operators.js';

const per = +process.argv[2] || 2;
const owners = Object.keys(LOADOUTS).filter(o => LOADOUTS[o].primaries.some(w => RIOT[w]));
const stats = { shield: {}, gun: {} };
for (const mode of ['shield', 'gun']) for (const id of MAP_LIST) for (let n = 0; n < per; n++) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = 7; g.proAnyOp = true;
  for (let i = 0; i < 10; i++) g.addBot();
  const bl = g.botLoadout.bind(g);
  g.botLoadout = op => { const l = bl(op), L = LOADOUTS[op], sh = L.primaries.find(w => RIOT[w]); if (!sh) return l; l.primary = mode === 'shield' ? sh : L.primaries.find(w => !RIOT[w]); if (mode === 'shield') l.secondary = L.secondaries.find(w => w === 'p10' || w === 'vex50' || w === 'sparrow' || w === 'bison') || l.secondary; return l; };
  // shield operators get picked often: half the time a pro takes one if it is free in their job
  const pick = g.pickOp.bind(g); let forcing = false;
  g.pickOp = (p, op) => { if (!forcing && p.bot && Math.random() < 0.5) { const s = owners.find(o => OPERATORS[o].team === OPERATORS[op].team && p.job && (LOADOUTS[o] && OPERATORS[o]) && ![...g.players.values()].some(q => q.op === o && q.squad === p.squad)); if (s) { forcing = true; const j = p.job; p.job = null; pick(p, s); forcing = false; if (p.op) return; p.job = j; } } pick(p, op); };
  const S = k => stats[mode][k] || (stats[mode][k] = { rounds: 0, won: 0, kills: 0, deaths: 0, dmg: 0, taken: 0 });
  const dmg0 = g.damage.bind(g);
  g.damage = (q, amount, s, wname, ang) => { const before = Math.max(0, q.hp); dmg0(q, amount, s, wname, ang); const done = Math.min(Math.round(amount), before);
    if (s && s !== q && g.side(s) !== g.side(q) && owners.includes(s.op)) S(s.op).dmg += done; if (owners.includes(q.op) && s && g.side(s) !== g.side(q)) S(q.op).taken += done; };
  g.startMatch();
  let t = 0, last = g.phase, k0 = new Map();
  while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30; g.events = [];
    if (g.phase !== last) {
      if (g.phase === PHASE.ACTION) for (const p of g.players.values()) k0.set(p.id, [p.kills || 0, p.deaths || 0]);
      if (g.phase === PHASE.ROUND_END && g.winner != null) for (const p of g.players.values()) if (owners.includes(p.op)) {
        const s = S(p.op), [k, d] = k0.get(p.id) || [0, 0]; s.rounds++; if (g.winner === p.squad) s.won++; s.kills += (p.kills || 0) - k; s.deaths += (p.deaths || 0) - d; }
      last = g.phase;
    }
  }
}
console.log('operator  shield            with the shield                          with a gun');
for (const o of owners) {
  const f = s => s ? `${String(s.rounds).padStart(3)} rnd  win ${Math.round(s.won / s.rounds * 100).toString().padStart(3)}%  K/r ${(s.kills / s.rounds).toFixed(2)}  D/r ${(s.deaths / s.rounds).toFixed(2)}  dmg/r ${Math.round(s.dmg / s.rounds).toString().padStart(3)}` : '  (not played)';
  console.log(`${OPERATORS[o].name.padEnd(9)} ${RIOT[LOADOUTS[o].primaries.find(w => RIOT[w])].name.padEnd(16)} ${f(stats.shield[o])}   ${f(stats.gun[o])}`);
}
