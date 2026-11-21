// Pings in a live match (he asked 2026-11-18: bots really do what a ping asks): a pinged enemy camera gets shot, a pinged
// soft wall gets opened. Every map, attack side. Run: node tests/pinglive.js [map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, TEAM, PX_PER_M, CELL, T, blocksMove } from '../shared/constants.js';
import { los } from '../shared/physics.js';
import { floorAt } from '../shared/map.js';
let bad = 0; const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; return ok; };
const only = process.argv[2];
function make(id) {
  const g = new Game({}); g.mapId = id; g.map = buildMap(id); g.botLevel = 3;
  for (let i = 0; i < 6; i++) g.addBot(i % 2);
  g.startMatch(); let n = 0; while ((g.phase !== PHASE.ACTION || g.introT > 0) && n++ < 8000) g.tick(1 / 30);
  g.free = true; g.ranked = false;
  const mine = [...g.players.values()].filter(q => g.side(q) === TEAM.ATK);
  for (const q of [...g.players.values()]) if (g.side(q) !== TEAM.ATK) g.players.delete(q.id);
  const me = mine[0]; me.bot = false; me.ai = null; me.hold = {};
  return { g, me, bots: mine.slice(1) };
}
const clearWalk = (m, x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (blocksMove(m.tiles[Math.floor(y / CELL) * m.W + Math.floor(x / CELL)])) return false; } return true; }; // (nothing a bullet stops on the way)
const run = (g, secs, stop) => { for (let i = 0; i < secs * 30; i++) { g.timer = 150; g.tick(1 / 30); if (stop()) return i / 30; } return null; };
const ping = (g, me, x, y, w, pk, id) => { me.pingReady = 0; me.markT = -99; g.event(me, { k: 'mark', x, y, w, pk, id }); };
// bots are random (who is nearest, what they carry, teammates in the line), so each check gets two tries
const tries = (n, f) => { let r = null; for (let i = 0; i < n && !(r && r.ok); i++) r = f(); return r; };
for (const id of MAP_LIST) {
  if (only && id !== only) continue;
  { const r = tries(2, () => { // a camera 5 m from a bot, in sight but behind its back
    const { g, me, bots } = make(id), m = g.map, b = bots[0];
    let spot = null;
    for (let a = 0; a < 16 && !spot; a++) { const x = b.x + Math.cos(a / 16 * Math.PI * 2) * 5 * PX_PER_M, y = b.y + Math.sin(a / 16 * Math.PI * 2) * 5 * PX_PER_M; if (floorAt(m, x, y) === floorAt(m, b.x, b.y) && !blocksMove(m.tiles[Math.floor(y / CELL) * m.W + Math.floor(x / CELL)]) && los(m, b.x, b.y, x, y) && clearWalk(m, b.x, b.y, x, y)) spot = { x, y }; }
    if (!spot) return { ok: true, msg: 'skip ' + id + ' camera: no open spot' };
    {
      const cam = { id: 'pc' + id, type: 'cam', team: TEAM.DEF, hp: 1, x: spot.x, y: spot.y, ag: 0, owner: 'x' }; g.ents.push(cam);
      for (const q of bots) q.aim = Math.atan2(b.y - spot.y, b.x - spot.x); // facing away
      ping(g, me, cam.x, cam.y, 'CAMERA', null, cam.id);
      const t = run(g, 8, () => !(cam.hp > 0) || !g.ents.includes(cam));
      return { ok: t !== null, msg: `${id}: pinged camera shot` + (t !== null ? ` in ${t.toFixed(1)} s` : '') };
    }
  }); check(r.ok, r.msg); }
  { const r = tries(2, () => { // the soft wall nearest a bot that has floor both sides
    const { g, me, bots } = make(id), m = g.map, b = bots[0], W = m.W, fl = floorAt(m, b.x, b.y);
    let best = -1, bd = Infinity;
    for (let k = W; k < m.tiles.length - W; k++) { if (m.tiles[k] !== T.SOFT || m.shape[k]) continue; const x = (k % W + 0.5) * CELL, y = (Math.floor(k / W) + 0.5) * CELL; if (floorAt(m, x, y) !== fl) continue; if (![1, W].some(d => !blocksMove(m.tiles[k + d]) && !blocksMove(m.tiles[k - d]))) continue; const d = Math.hypot(x - b.x, y - b.y); if (d < bd) { bd = d; best = k; } }
    if (best < 0) return { ok: true, msg: 'skip ' + id + ' wall: none' };
    const x = (best % W + 0.5) * CELL, y = (Math.floor(best / W) + 0.5) * CELL;
    ping(g, me, x, y, 'WALL', 'open');
    const who = bots.find(q => q.ai && q.ai.cmd && q.ai.cmd.k === 'open');
    const t = run(g, 30, () => m.tiles[best] !== T.SOFT || (m.holes && m.holes[best]));
    return { ok: !!who && t !== null, msg: `${id}: pinged wall opened (${who ? who.op : 'nobody went'}, ${Math.round(bd / PX_PER_M)} m away)` + (t !== null ? ` in ${t.toFixed(1)} s` : '') };
  }); check(r.ok, r.msg); }
}
console.log(bad ? bad + ' FAILED' : 'PASS'); process.exit(bad ? 1 : 0);
