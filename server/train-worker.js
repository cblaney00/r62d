// Practice matches for the pro teams, run in the background (a worker thread, so the game server doesn't slow down).
// Every plan and operator gets tried (exploring, not just the favourites); each round's result is sent back.
import { parentPort, workerData } from 'node:worker_threads';
import { Game } from './game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { OPERATORS, WEAPONS } from '../shared/operators.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { planKey, opKey } from './training.js';

const until = Date.now() + (workerData.minutes || 15) * 60 * 1000, dt = 1 / 30;
// Gently (he asked: Lando's server sounded like a jet taking off): work DUTY of the time, rest the rest, so practice
// uses about a third of one core (measured 38%) instead of 160% flat out; 200 rounds still take only ~15 minutes. Rounds left over carry on the next time it runs.
const DUTY = Math.min(1, Math.max(0.05, Number(process.env.R62D_TRAIN_DUTY) || 0.15)), WORK_MS = 20;
const rest = ms => new Promise(r => setTimeout(r, ms));
let workT = performance.now();
const breather = async () => { const w = performance.now() - workT; if (w >= WORK_MS) { await rest(w * (1 - DUTY) / DUTY); workT = performance.now(); } };
let left = workerData.rounds || 200;
let mi = Math.floor(Math.random() * MAP_LIST.length);
while (Date.now() < until && left > 0) {
  const id = MAP_LIST[mi++ % MAP_LIST.length];
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = 7; g.proExplore = true;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  let t = 0, last = null, rs = null; // rs: this round's per-operator numbers (for BALL KNOWLEDGE)
  const GUNS = new Set(Object.values(WEAPONS).map(w => w.name).concat('Melee'));
  while (t < 60 * 30 && Date.now() < until && left > 0) {
    g.tick(dt); t += dt; await breather();
    if (rs) for (const e of g.events) if (e.e === 'kill' && e.killer && e.killer !== e.victim) {
      const k = g.players.get(e.killer), v = g.players.get(e.victim); if (!k || !v || !k.op || g.side(k) === g.side(v)) continue;
      const a = rs[k.id], b = rs[v.id]; if (a) { a.k++; if (!GUNS.has(e.w)) a.sk++; if (e.hs) a.hs++; if (!rs.first) { rs.first = 1; a.fk++; } } if (b) b.d++;
    }
    g.events = [];
    if (g.phase !== last) {
      if (g.phase === PHASE.PREP) { rs = {}; for (const p of g.players.values()) if (p.op) rs[p.id] = { op: p.op, sq: p.squad, ab: OPERATORS[p.op].ability.count, k: 0, d: 0, sk: 0, hs: 0, fk: 0 }; }
      if (g.phase === PHASE.ROUND_END && g.winner !== null && g.winner !== undefined) {
        const res = { plans: {}, ops: {}, rounds: 1 };
        for (const sq of [0, 1]) {
          const st = (g.proState || {})[sq], win = g.winner === sq ? 1 : 0, mate = [...g.players.values()].find(p => p.squad === sq);
          const side = mate && g.side(mate) === TEAM.ATK ? 'atk' : 'def';
          if (st && st.plan) res.plans[planKey(id, st.site, side, st.plan.id)] = [1, win];
          for (const p of g.players.values()) if (p.squad === sq && p.op) { const k = opKey(id, side, p.op), o = res.ops[k] || (res.ops[k] = [0, 0]); o[0]++; o[1] += win; }
        }
        if (rs) { res.opx = {}; for (const [id, r] of Object.entries(rs)) { if (id === 'first') continue; const p = g.players.get(id), u = p && OPERATORS[r.op].ability.count ? Math.max(0, r.ab - p.abilityCount) : 0;
          const x = res.opx[r.op] || (res.opx[r.op] = [0, 0, 0, 0, 0, 0, 0, 0, 0]); x[0]++; x[8]++; x[1] += g.winner === r.sq ? 1 : 0; x[2] += r.k; x[3] += r.d; x[4] += r.sk; x[5] += u; x[6] += r.hs; x[7] += r.fk; } } // rounds, wins, kills, deaths, skill kills, skill uses, headshots, opening kills, rounds the uses were counted in
        rs = null;
        parentPort.postMessage(res); left--;
      }
      last = g.phase;
    }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
}
parentPort.postMessage({ done: true });
