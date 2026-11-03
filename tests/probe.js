// Quick bot-match probe (no saving): side win rates, headshot share, kills by weapon kind, per operator results.
// Run: node tests/probe.js <level 0-7, 7 = pro teams> <matches> [mapId] [--json]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { OPERATORS, WEAPONS } from '../shared/operators.js';

const lvl = +(process.argv[2] ?? 7), per = +process.argv[3] || 2, only = process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : null;
const GUNS = new Set(Object.values(WEAPONS).map(w => w.name));
const R = { rounds: 0, atk: 0, kills: 0, hs: 0, skill: 0, melee: 0, plant: 0, defuse: 0, wipe: 0, time: 0, rlen: 0, ops: {}, plans: {}, why: {} };
const O = k => R.ops[k] || (R.ops[k] = { r: 0, w: 0, k: 0, d: 0, hs: 0, sk: 0 });
const maps = only ? [only] : MAP_LIST;
for (let n = 0; n < per; n++) for (const id of maps) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = lvl; if (lvl === 7) g.proExplore = true;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  let t = 0, last = g.phase, actT = 0;
  while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30; if (g.phase === PHASE.ACTION) actT += 1 / 30;
    for (const e of g.events) {
      if (e.e === 'kill') {
        const k = g.players.get(e.killer), v = g.players.get(e.victim);
        if (v && v.op) O(v.op).d++;
        if (k && v && k.op && g.side(k) !== g.side(v)) { R.kills++; O(k.op).k++; if (e.hs) { R.hs++; O(k.op).hs++; } if (e.w === 'Melee') R.melee++; else if (!GUNS.has(e.w)) { R.skill++; O(k.op).sk++; } }
      }
      if (e.e === 'plant' || e.e === 'planted') R.plant++;
    }
    g.events = [];
    if (g.phase !== last) {
      if (g.phase === PHASE.ROUND_END && g.winner != null) {
        R.rounds++; R.rlen += actT; actT = 0;
        const atkSq = [...g.players.values()].find(p => g.side(p) === TEAM.ATK).squad;
        if (g.winner === atkSq) R.atk++;
        const why = g.roundWhy || g.endWhy || ''; R.why[why] = (R.why[why] || 0) + 1;
        for (const p of g.players.values()) if (p.op) { const o = O(p.op); o.r++; if (p.squad === g.winner) o.w++; }
        for (const sq of [0, 1]) { const st = (g.proState || {})[sq]; if (st && st.plan) { const side = sq === atkSq ? 'atk' : 'def', key = side + ':' + st.plan.id, x = R.plans[key] || (R.plans[key] = [0, 0]); x[0]++; if (g.winner === sq) x[1]++; } }
      }
      last = g.phase;
    }
  }
}
if (process.argv.includes('--json')) { console.log(JSON.stringify(R)); process.exit(0); }
const pc = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
console.log(`level ${lvl}: ${R.rounds} rounds, attack wins ${pc(R.atk, R.rounds)}, avg action ${(R.rlen / Math.max(1, R.rounds)).toFixed(0)} s, ${R.kills} kills: headshots ${pc(R.hs, R.kills)}, skill ${pc(R.skill, R.kills)}, melee ${pc(R.melee, R.kills)}`);
console.log('round ends:', JSON.stringify(R.why));
for (const side of ['atk', 'def']) {
  const rows = Object.entries(R.ops).filter(([o]) => OPERATORS[o].team === side).sort((a, b) => b[1].w / b[1].r - a[1].w / a[1].r);
  console.log(side, rows.map(([o, s]) => `${o} ${pc(s.w, s.r)}/${s.r} k${s.k} d${s.d} hs${s.hs}`).join(' | '));
}
console.log('plans', Object.entries(R.plans).map(([k, [n, w]]) => `${k} ${w}/${n}`).join(' | '));
