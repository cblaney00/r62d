// Practice matches for the pro teams, run in the background (a worker thread, so the game server doesn't slow down).
// Every plan and operator gets tried (exploring, not just the favourites); each round's result is sent back.
import { parentPort, workerData } from 'node:worker_threads';
import { Game } from './game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { planKey, opKey } from './training.js';

const until = Date.now() + (workerData.minutes || 15) * 60 * 1000, dt = 1 / 30;
let mi = Math.floor(Math.random() * MAP_LIST.length);
while (Date.now() < until) {
  const id = MAP_LIST[mi++ % MAP_LIST.length];
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = 4; g.proExplore = true;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  let t = 0, last = null;
  while (t < 60 * 30 && Date.now() < until) {
    g.tick(dt); t += dt; g.events = [];
    if (g.phase !== last) {
      if (g.phase === PHASE.ROUND_END && g.winner !== null && g.winner !== undefined) {
        const res = { plans: {}, ops: {}, rounds: 1 };
        for (const sq of [0, 1]) {
          const st = (g.proState || {})[sq], win = g.winner === sq ? 1 : 0, mate = [...g.players.values()].find(p => p.squad === sq);
          const side = mate && g.side(mate) === TEAM.ATK ? 'atk' : 'def';
          if (st && st.plan) res.plans[planKey(id, st.site, side, st.plan.id)] = [1, win];
          for (const p of g.players.values()) if (p.squad === sq && p.op) { const k = opKey(id, side, p.op), o = res.ops[k] || (res.ops[k] = [0, 0]); o[0]++; o[1] += win; }
        }
        parentPort.postMessage(res);
      }
      last = g.phase;
    }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
}
parentPort.postMessage({ done: true });
