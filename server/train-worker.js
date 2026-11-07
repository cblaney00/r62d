// Practice matches for the pro teams, run in the background (a worker thread, so the game server doesn't slow down).
// Every plan and operator gets tried (exploring, not just the favourites); each round's result is sent back.
import { parentPort, workerData } from 'node:worker_threads';
import { Game } from './game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { OPERATORS, WEAPONS } from '../shared/operators.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { planKey, opKey, gunKey, attKey } from './training.js';

const PTS_FEAT = { 'DEFUSER PLANTED': 'plant', 'DEFUSER DISABLED': 'defuse', 'REVIVE': 'revive', 'ENEMY SPOTTED': 'spot', 'DRONE DESTROYED': 'droneKill', 'CAMERA DESTROYED': 'camKill', 'GADGET DESTROYED': 'gadgetKill', 'DRONE CAPTURED': 'droneKill', 'WALL REINFORCED': 'reinforce', 'HATCH REINFORCED': 'reinforce' };
const until = Date.now() + (workerData.minutes || 15) * 60 * 1000, dt = 1 / 30;
// Gently (he asked: Lando's server sounded like a jet taking off): work DUTY of the time, rest the rest, so practice
// uses about a third of one core (measured 38%) instead of 160% flat out; 200 rounds still take only ~15 minutes. Rounds left over carry on the next time it runs.
// He asked later (2026-11-04) for much faster practice and allowed more power: server.js runs several threads at duty 1.
const DUTY = Math.min(1, Math.max(0.05, Number(process.env.R62D_TRAIN_DUTY) || workerData.duty || 0.15)), WORK_MS = 20;
const rest = ms => new Promise(r => setTimeout(r, ms));
let workT = performance.now();
const breather = async () => { if (DUTY >= 1) return; const w = performance.now() - workT; if (w >= WORK_MS) { await rest(w * (1 - DUTY) / DUTY); workT = performance.now(); } };
let left = workerData.rounds || 200;
let mi = Math.floor(Math.random() * MAP_LIST.length);
while (Date.now() < until && left > 0) {
  const id = MAP_LIST[mi++ % MAP_LIST.length];
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = 7; g.proExplore = true;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  // what each pro gets up to (the PLAYBOOK player pages: tendencies): bots.js counts features in p.feat, points add the rest
  const pts0 = g.pts.bind(g); g.pts = (q, n, why) => { const k = PTS_FEAT[why]; if (k && q && q.feat) q.feat[k] = (q.feat[k] || 0) + 1; return pts0(q, n, why); };
  let t = 0, last = null, rs = null; // rs: this round's per-operator numbers (for BALL KNOWLEDGE)
  const GUNS = new Set(Object.values(WEAPONS).map(w => w.name).concat('Melee'));
  while (t < 60 * 30 && Date.now() < until && left > 0) {
    g.tick(dt); t += dt; await breather();
    if (rs) for (const e of g.events) if (e.e === 'kill' && e.killer && e.killer !== e.victim) {
      const k = g.players.get(e.killer), v = g.players.get(e.victim); if (!k || !v || !k.op || g.side(k) === g.side(v)) continue;
      const a = rs[k.id], b = rs[v.id]; if (a) { a.dist += Math.hypot(k.x - v.x, k.y - v.y); if (!rs.first && b) b.fd++; a.k++; if (a.g2 && e.w === a.g2n) a.k2++; if (!GUNS.has(e.w)) a.sk++; if (e.hs) a.hs++; if (!rs.first) { rs.first = 1; a.fk++; } } if (b) b.d++;
    }
    g.events = [];
    if (g.phase !== last) {
      if (g.phase === PHASE.PREP) { rs = {}; for (const p of g.players.values()) if (p.op) { const g1 = p.guns[0], g2 = p.guns[1]; p.feat = {}; rs[p.id] = { dist: 0, fd: 0, op: p.op, sq: p.squad, ab: OPERATORS[p.op].ability.count, k: 0, d: 0, sk: 0, hs: 0, fk: 0, k2: 0, pro: p.pro && p.pro.pl.name, g1: p.riot || (g1 && g1.w), a1: !p.riot && g1 && g1.att, g2: g2 && g2.w, a2: g2 && g2.att, g2n: g2 && WEAPONS[g2.w].name }; } }
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
        if (rs) { // guns and attachments (all pros, and per pro): [rounds, wins, kills, deaths]; the main gun gets the kills not made with the sidearm
          Object.assign(res, { guns: {}, att: {}, pro: {} });
          const add = (tbl, k, a) => { const x = tbl[k] || (tbl[k] = [0, 0, 0, 0]); a.forEach((v, i) => { x[i] += v; }); };
          for (const [id, r] of Object.entries(rs)) { if (id === 'first') continue;
            const win = g.winner === r.sq ? 1 : 0, P = r.pro && (res.pro[r.pro] || (res.pro[r.pro] = { ops: {}, guns: {}, att: {} }));
            const rec1 = [1, win, r.k - r.k2, r.d], rec2 = [1, win, r.k2, 0];
            if (P) add(P.ops, r.op, [1, win, r.k, r.d]);
            if (P) { // tendencies, per side: rounds, wins, kills, deaths, headshots, opening kills / deaths, clutches, survived, kill distance (px), and every feature count
              const pl = g.players.get(id), side = pl && g.side(pl) === TEAM.ATK ? 'atk' : 'def', T = (P.tend || (P.tend = {}))[side] || (P.tend[side] = {});
              const mates = [...g.players.values()].filter(q => q.squad === r.sq), up = mates.filter(q => q.alive && !q.downed);
              const inc = (k, v) => { if (v) T[k] = (T[k] || 0) + v; };
              inc('r', 1); inc('w', win); inc('k', r.k); inc('d', r.d); inc('hs', r.hs); inc('fk', r.fk); inc('fd', r.fd); inc('dist', Math.round(r.dist));
              inc('sv', pl && pl.alive && !pl.downed ? 1 : 0); inc('cl', win && up.length === 1 && up[0] === pl && mates.length - 1 >= 3 ? 1 : 0);
              for (const [f, v] of Object.entries((pl && pl.feat) || {})) inc(f, v);
            }
            for (const [w, a, rec] of [[r.g1, r.a1, rec1], [r.g2, r.a2, rec2]]) if (w) {
              add(res.guns, gunKey(r.op, w), rec); if (P) add(P.guns, w, rec);
              if (a) for (const slot of ['barrel', 'grip', 'sight']) { const k = attKey(w, slot, a[slot]); add(res.att, k, rec); if (P) add(P.att, k, rec); }
            } } }
        rs = null;
        parentPort.postMessage(res); left--;
      }
      last = g.phase;
    }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
}
parentPort.postMessage({ done: true });
