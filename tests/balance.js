// Balance report: many bot-only matches on every map, recording how each operator and each gun
// does (round win rate, kills and deaths per round, damage, accuracy). Run: node tests/balance.js [matches per map]
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { OPERATORS, WEAPONS } from '../shared/operators.js';

const per = +process.argv[2] || 3;
const ops = {}, guns = {}, src = {};
const O = k => ops[k] || (ops[k] = { rounds: 0, won: 0, kills: 0, deaths: 0, dmg: 0, abilityDmg: 0 });
const Gn = k => guns[k] || (guns[k] = { kills: 0, dmg: 0, shots: 0, hits: 0, carried: 0, hs: 0 });
let rounds = 0, atkWins = 0;
for (const id of MAP_LIST) for (let n = 0; n < per; n++) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id);
  for (let i = 0; i < 10; i++) g.addBot();
  const dmg0 = g.damage.bind(g), fire0 = g.fire.bind(g);
  g.damage = (q, amount, s, wname, ang) => {
    const before = Math.max(0, q.hp);
    dmg0(q, amount, s, wname, ang);
    if (!s || s === q || g.side(s) === g.side(q)) return;
    const done = Math.min(Math.round(amount), before);
    O(s.op).dmg += done;
    if (Object.values(WEAPONS).some(w => w.name === wname)) Gn(wname).dmg += done; else O(s.op).abilityDmg += done;
    (src[wname] || (src[wname] = { dmg: 0, kills: 0 })).dmg += done;
  };
  g.fire = (p, gun, w) => { Gn(w.name).shots += w.pellets; fire0(p, gun, w); };
  g.startMatch();
  let t = 0, last = g.phase;
  while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30;
    for (const e of g.events) if (e.e === 'kill') {
      const k = g.players.get(e.killer), v = g.players.get(e.victim);
      if (v) O(v.op).deaths++;
      if (k && v && g.side(k) !== g.side(v)) {
        O(k.op).kills++;
        if (Object.values(WEAPONS).some(w => w.name === e.w)) { Gn(e.w).kills++; if (e.hs) Gn(e.w).hs++; }
        (src[e.w] || (src[e.w] = { dmg: 0, kills: 0 })).kills++;
      }
    } else if (e.e === 'hit' && e.k === 'blood') {}
    g.events.length = 0;
    if (g.phase !== last && g.phase === PHASE.ROUND_END && g.winner !== null) {
      rounds++;
      const winSide = [...g.players.values()].find(p => p.squad === g.winner);
      const ws = winSide ? g.side(winSide) : null;
      if (ws === TEAM.ATK) atkWins++;
      for (const p of g.players.values()) if (p.op) {
        O(p.op).rounds++; if (g.side(p) === ws) O(p.op).won++;
        for (const gun of p.guns || []) Gn(WEAPONS[gun.w].name).carried++;
      }
    }
    last = g.phase;
  }
}
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
console.log(`${rounds} rounds, attackers won ${pct(atkWins, rounds)}\n`);
console.log('OPERATOR    side rounds  win%  K/round D/round dmg/round  ability dmg/round');
for (const [k, s] of Object.entries(ops).sort((a, b) => b[1].won / Math.max(1, b[1].rounds) - a[1].won / Math.max(1, a[1].rounds)))
  console.log(`${k.padEnd(10)} ${OPERATORS[k].team}  ${String(s.rounds).padStart(5)}  ${pct(s.won, s.rounds).padStart(4)}  ${(s.kills / Math.max(1, s.rounds)).toFixed(2).padStart(6)}  ${(s.deaths / Math.max(1, s.rounds)).toFixed(2).padStart(6)}  ${(s.dmg / Math.max(1, s.rounds)).toFixed(0).padStart(8)}  ${(s.abilityDmg / Math.max(1, s.rounds)).toFixed(0).padStart(8)}`);
console.log('\nGUN            carried  kills  kills/carried  dmg/carried  headshot%');
for (const [k, s] of Object.entries(guns).sort((a, b) => b[1].kills / Math.max(1, b[1].carried) - a[1].kills / Math.max(1, a[1].carried)))
  console.log(`${k.padEnd(14)} ${String(s.carried).padStart(6)} ${String(s.kills).padStart(6)}  ${(s.kills / Math.max(1, s.carried)).toFixed(2).padStart(12)}  ${(s.dmg / Math.max(1, s.carried)).toFixed(0).padStart(10)}  ${pct(s.hs, s.kills).padStart(8)}`);
console.log('\nKILLS AND DAMAGE BY SOURCE (non-gun)');
for (const [k, s] of Object.entries(src).filter(([k]) => !Object.values(WEAPONS).some(w => w.name === k)).sort((a, b) => b[1].dmg - a[1].dmg))
  console.log(`  ${k.padEnd(20)} dmg ${String(s.dmg).padStart(5)}  kills ${s.kills}`);
