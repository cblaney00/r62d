// 1V1 meta test (he asked 2026-11-20: "a meta test for the 1v1 mode ... characters that are just significantly better
// than others to the point where they should probably be perma banned. Wraith is an example").
// Bot-only 1V1 rounds on the small maps. Before every round each side is given the operator of its side that has played
// the fewest rounds so far (ties at random), so every operator plays about as often and against a mix of opponents.
// Bans are skipped (they would stop some operators being tested). Win rate is judged against its own side's average,
// because attack and defence do not win equally often.
// Run: node tests/duelmeta.js [rounds] [bot level] [workers] [--save f.json] [--add a.json,b.json]
//   (default 1200 rounds, level 5 = pros' play, 12 workers; 0 rounds with --add just prints earlier runs)
import './_tmpdata.js';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game } from '../server/game.js';
import { PHASE, DUR } from '../shared/constants.js';
import { MAPS, MAP_LIST, buildMap } from '../shared/map.js';
import { OPERATORS, OP_LIST, jobOf, LOADOUTS } from '../shared/operators.js';

const SMALL = MAP_LIST.filter(k => MAPS[k].small);
const blank = () => ({ n: 0, won: 0, kills: 0, deaths: 0, dmg: 0 });

function play(rounds, lvl, seedOff) {
  DUR.select = 2; // nobody is choosing: waste no time in operator select
  const ops = {}, O = k => ops[k] || (ops[k] = blank());
  const side = { atk: { n: 0, won: 0 } };
  const pick = sd => { // the least played operator of that side, ties at random
    const all = OP_LIST.filter(k => OPERATORS[k].team === sd);
    const lo = Math.min(...all.map(k => O(k).n));
    const c = all.filter(k => O(k).n === lo); return c[Math.floor(Math.random() * c.length)];
  };
  let done = 0, m = seedOff, bad = 0;
  while (done < rounds) {
    const g = new Game(); g.mode = 'duel'; g.mapId = SMALL[m++ % SMALL.length]; g.map = buildMap(g.mapId); g.botLevel = lvl;
    g.rules.bans = false; // (changes this worker's copy of the 1V1 rules only)
    g.addBot(0); g.addBot(1);
    const dmg0 = g.damage.bind(g);
    g.damage = (q, amount, s, w, a) => { const b = Math.max(0, q.hp); dmg0(q, amount, s, w, a); if (s && s !== q && s.op) O(s.op).dmg += Math.min(Math.round(amount), b); };
    g.startMatch();
    let t = 0, last = null, atk = null, forced = false;
    while (t < 60 * 30 && done < rounds) {
      if (g.phase === PHASE.SELECT && !forced) {
        atk = g.atkSquad();
        for (const p of g.players.values()) { const sd = p.squad === atk ? 'atk' : 'def', o = pick(sd); p.op = o; p._forced = o; p.job = jobOf(o); O(o).n++; }
        forced = true;
      }
      g.tick(1 / 30); t += 1 / 30;
      for (const e of g.events) if (e.e === 'kill') {
        const k = g.players.get(e.killer), v = g.players.get(e.victim);
        if (v && v.op) O(v.op).deaths++;
        if (k && v && k !== v && k.op) O(k.op).kills++;
      }
      g.events.length = 0;
      if (g.phase !== last) {
        if (g.phase === PHASE.ACTION) for (const p of g.players.values()) { // the given operator kept, with its own gear
          const L = LOADOUTS[p.op], ok = !L || !p.guns || p.guns.every(gn => L.primaries.includes(gn.w) || L.secondaries.includes(gn.w)); if (p.op !== p._forced || !ok) { bad++; if (bad < 4) console.error("mismatch", p._forced, p.op, (p.guns || []).map(gn => gn.w).join(" ")); }
        }
        if (g.phase === PHASE.ROUND_END) {
          const atkWon = g.winner === atk; side.atk.n++; if (atkWon) side.atk.won++;
          for (const p of g.players.values()) if (p.op && (p.squad === atk) === atkWon) O(p.op).won++;
          done++; forced = false;
        }
        last = g.phase;
      }
      if (g.phase === PHASE.LOBBY && t > 5) break;
    }
  }
  return { ops, side, bad };
}

const self = fileURLToPath(import.meta.url);
if (process.argv[2] === '--child') {
  const [, , , n, lvl, off] = process.argv;
  process.send(play(+n, +lvl, +off)); process.exit(0);
}

const total = process.argv[2] !== undefined && !process.argv[2].startsWith('--') ? +process.argv[2] : 1200, lvl = process.argv[3] !== undefined ? +process.argv[3] : 5, W = +process.argv[4] || 12;
const t0 = Date.now();
const parts = total <= 0 ? [] : await Promise.all([...Array(W)].map((_, i) => new Promise((res, rej) => {
  const c = fork(self, ['--child', Math.ceil(total / W), lvl, i]);
  c.on('message', res); c.on('exit', code => code && rej(new Error('worker ' + i + ' failed')));
})));
// --save file.json keeps this run's numbers; --add a.json,b.json adds earlier runs (same bot level) to it
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
if (arg('--save')) (await import('node:fs')).writeFileSync(arg('--save'), JSON.stringify(parts));
if (arg('--add')) for (const f of arg('--add').split(',')) parts.push(...JSON.parse((await import('node:fs')).readFileSync(f, 'utf8')));
const ops = {}, side = { n: 0, won: 0 }; let bad = 0;
for (const p of parts) {
  bad += p.bad; side.n += p.side.atk.n; side.won += p.side.atk.won;
  for (const [k, v] of Object.entries(p.ops)) { const o = ops[k] || (ops[k] = blank()); for (const f in o) o[f] += v[f]; }
}
const atkRate = side.won / side.n, base = { atk: atkRate, def: 1 - atkRate };
// strength = win rate moved onto a 50% scale for its side; ± is a 90% range from the number of rounds
const rows = Object.entries(ops).filter(([, v]) => v.n).map(([k, v]) => {
  const sd = OPERATORS[k].team, w = v.won / v.n, z = 1.645, shift = 0.5 - base[sd];
  const mid = (w + z * z / (2 * v.n)) / (1 + z * z / v.n), err = z * Math.sqrt(w * (1 - w) / v.n + z * z / (4 * v.n * v.n)) / (1 + z * z / v.n); // Wilson range
  const adj = w + shift, lo = mid - err + shift, hi = mid + err + shift;
  const tag = lo > 0.55 && adj > 0.6 ? 'PERMA-BAN?' : lo > 0.5 && adj > 0.56 ? 'strong' : hi < 0.5 && adj < 0.4 ? 'WEAK' : hi < 0.5 && adj < 0.44 ? 'weak' : '';
  return { k, sd, v, w, adj, err, tag };
}).sort((a, b) => b.adj - a.adj);
const P = x => (100 * x).toFixed(0).padStart(3) + '%';
console.log(`${side.n} rounds on ${SMALL.join(', ')}, bot level ${lvl}, attackers won ${P(atkRate)}, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
if (bad) console.log(`!! ${bad} times an operator was not the one given, or had the wrong gun`);
console.log('strength = win rate as if its side won half the time; 60%+ for sure = perma-ban candidate\n');
console.log('OPERATOR   side rounds  win%  strength  (±90%)  K/rd  D/rd  dmg/rd');
for (const r of rows) console.log(`${OPERATORS[r.k].name.padEnd(10)} ${r.sd}  ${String(r.v.n).padStart(5)}  ${P(r.w)}   ${P(r.adj)}    ±${(100 * r.err).toFixed(0).padStart(2)}   ${(r.v.kills / r.v.n).toFixed(2)}  ${(r.v.deaths / r.v.n).toFixed(2)}  ${(r.v.dmg / r.v.n).toFixed(0).padStart(5)}  ${r.tag}`);
