// Bots on the roof (he asked): when the objective is on the floor under the roof, attackers sometimes climb a rope to
// the roof, open the hatch over the site, throw utility down it, watch below and drop in. Plays bot-only matches and
// counts how far each roof play got. Run: node tests/roofbots.js <level 0-7, 7 = pro teams> <matches> [mapId]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, floorAt } from '../shared/map.js';
import { PHASE, TEAM, T } from '../shared/constants.js';

const lvl = +(process.argv[2] ?? 7), per = +process.argv[3] || 1, only = process.argv[4] || null;
const C = { rounds: 0, eligible: 0, plans: 0, bots: 0, rope: 0, roof: 0, open: 0, util: 0, drop: 0, back: 0, killsFromRoof: 0, diedOnRoof: 0, stuck: 0 };
for (let n = 0; n < per; n++) for (const id of only ? [only] : MAP_LIST) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = lvl;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  const m = g.map; let t = 0, last = g.phase, track = new Map();
  while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30;
    if (g.phase === PHASE.ACTION && g._roof && g._roof.round === g.round) {
      for (const [sq, plan] of Object.entries(g._roof.sq)) if (plan) for (const pid of plan.ids) {
        const p = g.players.get(pid); if (!p) continue;
        const k = g.round + ':' + pid; let s = track.get(k);
        if (!s) { s = { rope: 0, roof: 0, open: 0, util: 0, drop: 0, back: 0, onRoofT: 0 }; track.set(k, s); }
        const f = floorAt(m, p.x, p.y);
        if (p.rope) s.rope = 1;
        if (f === m.roofFloor) { s.roof = 1; s.onRoofT += 1 / 30; }
        if (m.tiles[plan.h.cells[0]] === T.HOLE && s.roof) s.open = 1;
        if (p.ai.roofSt && p.ai.roofSt.thrown) s.util = 1;
        if (s.roof && p.alive && f === floorAt(m, plan.h.bx, plan.h.by) && !p.rope) s.drop = 1;
        if (s.roof && p.alive && f === m.groundFloor && f !== floorAt(m, plan.h.bx, plan.h.by)) s.back = 1;
        s.alive = p.alive;
      }
    }
    for (const e of g.events) if (e.e === 'kill') {
      const k = g.players.get(e.killer), v = g.players.get(e.victim);
      if (k && floorAt(m, k.x, k.y) === m.roofFloor && v && g.side(k) !== g.side(v)) C.killsFromRoof++;
      if (v && floorAt(m, v.x, v.y) === m.roofFloor) C.diedOnRoof++;
    }
    g.events = [];
    if (g.phase !== last) {
      if (g.phase === PHASE.ROUND_END) {
        C.rounds++;
        const site = m.sites[g.site], bf = floorAt(m, site.bombs[0].x, site.bombs[0].y);
        if (bf === m.roofFloor - 1 || (m.hatches || []).some(h => h.roof && floorAt(m, h.bx, h.by) === bf)) C.eligible++;
        if (g._roof && g._roof.round === g.round) for (const plan of Object.values(g._roof.sq)) if (plan) C.plans++;
      }
      last = g.phase;
    }
  }
  for (const s of track.values()) { C.bots++; for (const k of ['rope', 'roof', 'open', 'util', 'drop', 'back']) C[k] += s[k]; if (s.onRoofT > 60 && !s.drop && !s.back && s.alive) C.stuck++; }
}
console.log(`level ${lvl}: ${C.rounds} rounds, ${C.eligible} with the site under the roof, ${C.plans} roof plays (${C.bots} bots): on a rope ${C.rope}, on the roof ${C.roof}, hatch open ${C.open}, utility down ${C.util}, dropped in ${C.drop}, went back down ${C.back}; kills from the roof ${C.killsFromRoof}, died on the roof ${C.diedOnRoof}, stuck up there ${C.stuck}`);
const ok = C.plans > 0 && C.roof >= C.bots * 0.5 && C.stuck === 0;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
