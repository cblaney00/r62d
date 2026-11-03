// Where bots look when nobody is in sight (he asked: on Esports TV their view drifted off any angle worth holding,
// then snapped back to a good one at contact). Plays bot matches and reports, per tick of the action phase with no
// enemy in sight: share of time looking into a wall close up, share covering a way in (a doorway, window, stair end
// or open hatch within ±25° of the aim, or a long sightline), and at first sight of an enemy how far the aim had to
// turn. Run: node tests/angles.js [matches] [--level N] [--only map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { visibleEnemy } from '../server/bots.js';
import { buildMap, MAP_LIST, stairEnds } from '../shared/map.js';
import { castSight, los } from '../shared/physics.js';
import { PHASE, CELL, PX_PER_M, T } from '../shared/constants.js';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const per = +process.argv[2] || 1, level = +arg('--level', 7), only = arg('--only', null);
const ad = a => Math.atan2(Math.sin(a), Math.cos(a));
const N = { t: 0, wall: 0, cover: 0, dead: 0 }, contact = [], spin = [], open = [];
for (const id of only ? [only] : MAP_LIST) for (let n = 0; n < per; n++) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = level;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  const m = g.map, W = m.W, pts = [];
  for (const o of m.openings) { const k = o.cells[o.cells.length >> 1]; pts.push({ x: (k % W + 0.5) * CELL, y: (Math.floor(k / W) + 0.5) * CELL }); }
  for (let i = 0; i < (m.stairs || []).length; i++) { const e = stairEnds(m, i, 0); pts.push(e.top, e.bottom); }
  const prev = new Map();
  let t = 0;
  while (t < 60 * 25 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30; g.events = [];
    if (g.phase !== PHASE.ACTION) { prev.clear(); continue; }
    for (const p of g.players.values()) {
      if (!p.alive || p.downed || p.ctrl !== 'body' || !p.ai) continue;
      const e = visibleEnemy(g, p, 700), pr = prev.get(p.id) || {};
      // the moment an enemy on this floor first has a clear line to this bot, in view cone or not: how far off was the aim?
      let cl = null, cd = 700; for (const q of g.players.values()) { if (!q.alive || q.staged || g.side(q) === g.side(p)) continue; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < cd && los(m, p.x, p.y, q.x, q.y)) { cd = d; cl = q; } }
      if (cl && !pr.cl) { const off = Math.abs(ad(Math.atan2(cl.y - p.y, cl.x - p.x) - (pr.aim ?? p.aim))) * 180 / Math.PI; open.push(off); }
      if (e && !pr.e) contact.push(Math.abs(ad(Math.atan2(e.y - p.y, e.x - p.x) - (pr.aim ?? p.aim))) * 180 / Math.PI);
      if (!e && pr.aim !== undefined) spin.push(Math.abs(ad(p.aim - pr.aim)) * 30);
      prev.set(p.id, { e: !!e, aim: p.aim, cl: !!cl });
      if (e || p.vt || g.time < (p.recoverUntil || 0)) continue;
      N.t++;
      const sl = castSight(m, p.x, p.y, p.aim, 15 * PX_PER_M, null);
      let cov = sl > 8 * PX_PER_M;
      if (!cov) for (const q of pts) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 1.5 * PX_PER_M || d > 14 * PX_PER_M) continue; if (Math.abs(ad(Math.atan2(q.y - p.y, q.x - p.x) - p.aim)) < 0.44 && los(m, p.x, p.y, q.x, q.y)) { cov = true; break; } }
      const k = sl < 1.5 * PX_PER_M ? 'wall' : cov ? 'cover' : 'dead'; N[k]++;
    }
  }
}
const pc = x => (100 * x / N.t).toFixed(1) + '%';
contact.sort((a, b) => a - b); spin.sort((a, b) => a - b);
const q = (a, f) => a.length ? a[Math.floor(a.length * f)].toFixed(0) : '-';
console.log(`level ${level}: ${N.t} bot-ticks with nobody in sight: covering ${pc(N.cover)}, into a wall ${pc(N.wall)}, at nothing ${pc(N.dead)}`);
console.log(`first sight: ${contact.length} contacts, turn needed median ${q(contact, 0.5)}°, 75% ${q(contact, 0.75)}°, 90% ${q(contact, 0.9)}°; over 60°: ${(100 * contact.filter(x => x > 60).length / (contact.length || 1)).toFixed(0)}%`);
console.log(`turning with nobody in sight: median ${q(spin, 0.5)}°/s, 90% ${q(spin, 0.9)}°/s, 99% ${q(spin, 0.99)}°/s`);
open.sort((a, b) => a - b);
console.log(`clear line first opens: ${open.length}, aim off by median ${q(open, 0.5)}°, 75% ${q(open, 0.75)}°, 90% ${q(open, 0.9)}°; within 25°: ${(100 * open.filter(x => x <= 25).length / (open.length || 1)).toFixed(0)}%, over 60°: ${(100 * open.filter(x => x > 60).length / (open.length || 1)).toFixed(0)}%`);
