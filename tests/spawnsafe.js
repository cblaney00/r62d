// Spawn safety (he asked: attackers must not die the moment the round starts; defender bots seemed to leave the
// building in preparation). For every map: how many indoor spots see each attacker spawn (lower = better cover),
// defenders outside (far from their site) during preparation, and spawn kills: attackers downed in the first 10 s of
// the action phase while still within 8 m of their spawn.
// Run: node tests/spawnsafe.js [rounds per map, default 6] [--level N] [--only id]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, floorAt, roomAt } from '../shared/map.js';
import { T, PHASE, CELL } from '../shared/constants.js';
import { los } from '../shared/physics.js';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const rounds = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 6), level = +(arg('--level') ?? 7);
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const INDOOR = new Set([T.FLOOR, T.OPEN, T.STAIR, T.HATCH]);

// indoor cells (same floor, within 45 m) with a clear line to the spawn point: where a defender could shoot from
export function exposure(m, sp) {
  const f = floorAt(m, sp.x, sp.y); let n = 0;
  for (let k = 0; k < m.tiles.length; k++) {
    if (!INDOOR.has(m.tiles[k]) || m.flAt[k] !== f) continue;
    const x = (k % m.W + 0.5) * CELL, y = (Math.floor(k / m.W) + 0.5) * CELL;
    if (Math.hypot(x - sp.x, y - sp.y) > 45 * 36) continue;
    if (los(m, x, y, sp.x, sp.y)) n++;
  }
  return n;
}

for (const id of arg('--only') ? [arg('--only')] : MAP_LIST) {
  const m0 = buildMap(id);
  const ex = m0.atkSpawns.map(s => `${s.name} ${exposure(m0, s)}`);
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = level;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  let outSec = 0, early = 0, atkRounds = 0, actT = -1, last = null, r = 0, t = 0;
  const was = new Map();
  while (r < rounds && t < 60 * 40) {
    g.tick(1 / 30); t += 1 / 30;
    if (g.phase !== last) { if (g.phase === PHASE.ACTION) { actT = t; atkRounds += 5; was.clear(); } if (last === PHASE.ACTION) r++; last = g.phase; }
    if (g.phase === PHASE.PREP) for (const p of g.players.values()) if (p.alive && g.side(p) === 'def' && g.map.tiles[Math.floor(p.y / CELL) * g.map.W + Math.floor(p.x / CELL)] === T.GROUND && g.map.sites[g.site].bombs.every(b => Math.hypot(b.x - p.x, b.y - p.y) > 10 * 36)) { outSec += 1 / 30; if (process.argv.includes('--why') && !(p._ow > t)) { p._ow = t + 5; console.log(`  prep: ${p.name} (${p.op}, ${p.pro ? 'pro ' + (p.pro.job || '') : (p.ai && p.ai.role) || ''}) outside at ${Math.round(p.x / 16)},${Math.round(p.y / 16)}, ${g.timer.toFixed(0)} s left`); } }
    if (g.phase === PHASE.ACTION && t - actT < 10) for (const p of g.players.values()) {
      if (g.side(p) !== 'atk') continue;
      const up = p.alive && !p.downed;
      if (was.get(p.id) && !up) {
        const sp = g.spawnOf(p); const sk = Math.hypot(p.x - sp.x, p.y - sp.y) < 8 * 36; if (sk) early++;
        const e = g.events.find(e => (e.e === 'down' || e.e === 'kill') && (e.id === p.id || e.victim === p.id)), k = e && g.players.get(e.by ?? e.killer);
        if (process.argv.includes('--why')) console.log(`  ${sk ? "SPAWN KILL " : ""}${(t - actT).toFixed(1)} s: ${p.name} (${Math.round(Math.hypot(p.x - sp.x, p.y - sp.y) / 36)} m from ${sp.name}) by ${e && e.w ? e.w + ' of ' : ''}${k ? `${k.name} ${g.side(k)} in ${roomAt(g.map, k.x, k.y) || 'OUTSIDE'} ${Math.round(Math.hypot(k.x - p.x, k.y - p.y) / 36)} m away` : JSON.stringify(e)}`);
      }
      was.set(p.id, up);
    }
  }
  console.log(`${id}: spawn exposure [${ex.join(', ')}] · defenders outside in prep ${outSec.toFixed(1)} bot-s over ${r} rounds · spawn kills ${early} of ${atkRounds}`);
  if (outSec > 0.5 * Math.max(1, r)) fail(id, 'defender bots outside during preparation');
  if (early > 1) fail(id, early, 'spawn kills');
  const worst = m0.atkSpawns.map(s => exposure(m0, s)); if (Math.max(...worst) > 20) fail(id, 'a spawn is seen from', Math.max(...worst), 'spots inside');
}
console.log(fails ? `${fails} failure(s)` : 'PASS spawnsafe');
process.exit(fails ? 1 : 0);
