// Bots that get stuck (he saw Dusty hit a boarded window for a minute and a half, and two pros stand in one spot doing
// nothing for over a minute): plays bot matches on every map and reports any bot that swings at the same spot for
// 15 s, or an attacker that stands in one place for 40 s of the action phase with nothing in sight.
// Run: node tests/stuckbots.js [--level 2] [--only <map>]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, roomAt } from '../shared/map.js';
import { PHASE, TEAM, CELL } from '../shared/constants.js';
import { OPERATORS } from '../shared/operators.js';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const level = Number(arg('--level') ?? 2);
let problems = 0;
for (const id of arg('--only') ? [arg('--only')] : MAP_LIST) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = level;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  const swings = new Map(), still = new Map(), said = new Set();
  const melee = g.melee.bind(g); g.melee = p => { const before = p.meleeCd; melee(p); if (p.meleeCd > before) (swings.get(p.id) || swings.set(p.id, []).get(p.id)).push({ t: g.time, x: p.x, y: p.y }); };
  const dt = 1 / 30; let t = 0;
  while (t < 60 * 20) {
    g.tick(dt); t += dt; g.events = [];
    if (g.phase === PHASE.LOBBY && t > 5) break;
    if (g.phase !== PHASE.ACTION) { still.clear(); swings.clear(); continue; }
    for (const p of g.players.values()) {
      if (!p.alive || p.downed) continue;
      const sw = (swings.get(p.id) || []).filter(s => g.time - s.t < 15 && Math.hypot(s.x - p.x, s.y - p.y) < 30);
      swings.set(p.id, sw);
      if (sw.length >= 12 && !said.has('m' + p.id + g.round)) { said.add('m' + p.id + g.round); problems++;
        const fx = p.x + Math.cos(p.aim) * 18, fy = p.y + Math.sin(p.aim) * 18, k = Math.floor(fy / CELL) * g.map.W + Math.floor(fx / CELL);
        console.log(`${id} r${g.round}: ${p.name} (${OPERATORS[p.op].name}, ${g.side(p) === TEAM.ATK ? 'atk' : 'def'}) swung ${sw.length} times in 15 s at ${roomAt(g.map, p.x, p.y) || 'outside'}, facing tile ${g.map.tiles[k]} win ${g.map.win[k]}; swing reaches ${JSON.stringify(g.facingCell(p, 20))}; path next ${p.ai.path && p.ai.path[0]} tile ${p.ai.path && g.map.tiles[p.ai.path[0]]} dist ${p.ai.path && p.ai.path[0] !== undefined ? Math.round(Math.hypot((p.ai.path[0] % g.map.W + 0.5) * CELL - p.x, (Math.floor(p.ai.path[0] / g.map.W) + 0.5) * CELL - p.y)) : "-"}`); }
      const s = still.get(p.id);
      if (!s || Math.hypot(s.x - p.x, s.y - p.y) > 40) still.set(p.id, { x: p.x, y: p.y, t: g.time });
      else if (g.side(p) === TEAM.ATK && !g.planted && g.time - s.t > 40 && !said.has('s' + p.id + g.round)) { said.add('s' + p.id + g.round); problems++;
        console.log(`${id} r${g.round}: ${p.name} (${OPERATORS[p.op].name}, atk, ctrl ${p.ctrl}) stood still 40 s at ${roomAt(g.map, p.x, p.y) || 'outside'} (timer ${Math.round(g.timer)})`); }
    }
  }
}
console.log(problems ? `${problems} stuck bot(s)` : 'PASS no stuck bots');
