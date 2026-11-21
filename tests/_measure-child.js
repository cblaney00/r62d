// one worker of tests/_measure.js (run with its settings in the environment)
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, DUR, TEAM } from '../shared/constants.js';
import { MAPS, MAP_LIST, buildMap } from '../shared/map.js';
import { OPERATORS, jobOf } from '../shared/operators.js';

const { focus, rounds, mode, off } = JSON.parse(process.argv[2]);
const maps = mode === '1v1' ? MAP_LIST.filter(k => MAPS[k].small) : MAP_LIST;
const ops = {}, O = k => ops[k] || (ops[k] = { n: 0, won: 0, kills: 0, deaths: 0, uses: 0 }), atk = { n: 0, won: 0 };
if (mode === '1v1') DUR.select = 2;
let done = 0, m = off, fi = off;
while (done < rounds) {
  const g = new Game(); g.mapId = maps[m++ % maps.length]; g.map = buildMap(g.mapId);
  if (mode === '1v1') { g.mode = 'duel'; g.botLevel = 5; g.rules.bans = false; g.addBot(0); g.addBot(1); }
  else { g.botLevel = 7; g.proExplore = true; for (let i = 0; i < 10; i++) g.addBot(); }
  g.startMatch();
  let t = 0, last = null, forced = null, atkSq = null;
  while (t < 60 * 30 && done < rounds) {
    if (g.phase === PHASE.SELECT && !forced) {
      atkSq = g.atkSquad();
      const op = focus[fi++ % focus.length], wantAtk = OPERATORS[op].team === TEAM.ATK;
      const mine = [...g.players.values()].filter(p => (p.squad === atkSq) === wantAtk);
      for (const p of mine) if (p.op === op) p.op = null;
      forced = mine[0]; forced.op = op; forced._forced = op; forced.job = jobOf(op); forced.abAt = forced.abUsed || 0;
      if (mode === '1v1') { const other = [...g.players.values()].find(p => p !== forced), c = Object.keys(OPERATORS).filter(k => OPERATORS[k].team !== OPERATORS[op].team); other.op = c[Math.floor(Math.random() * c.length)]; other.job = jobOf(other.op); }
    }
    if (forced && g.phase === PHASE.PREP && forced.op !== forced._forced) { forced.op = forced._forced; g.equip(forced); }
    g.tick(1 / 30); t += 1 / 30;
    for (const e of g.events) if (e.e === 'kill' && forced) { if (e.killer === forced.id && e.victim !== forced.id) O(forced._forced).kills++; if (e.victim === forced.id) O(forced._forced).deaths++; }
    g.events.length = 0;
    if (g.phase !== last) {
      if (g.phase === PHASE.ROUND_END && forced) {
        const won = g.winner === forced.squad ? 1 : 0, o = O(forced._forced); o.n++; o.won += won; o.uses += Math.max(0, (forced.abUsed || 0) - (forced.abAt || 0));
        atk.n++; if (g.winner === atkSq) atk.won++;
        done++; forced = null;
      }
      last = g.phase;
    }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
}
process.send({ ops, atk }); process.exit(0);
