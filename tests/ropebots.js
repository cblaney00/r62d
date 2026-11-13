// Bots rappelling (he asked 2026-11-13: bots test-run the new rope play and find what's wrong). Every attacking team
// sends someone up a rope to a site window each round (game.windowChance = 1); this plays bot matches and reports what
// happened on the ropes: plans, climbs, hangs, peeks, sightings, shots, kills from the rope, deaths on it, entries
// through windows, and anything stuck. Run: node tests/ropebots.js [matches] [map] [level]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, floorAt } from '../shared/map.js';
import { PHASE } from '../shared/constants.js';

const n = +process.argv[2] || 3, only = process.argv[3], lv = process.argv[4] !== undefined ? +process.argv[4] : 4;
let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const tot = {};
const maps = only ? [only] : MAP_LIST;
for (const id of maps) for (let i = 0; i < n; i++) {
  const g = new Game(); g.mapId = id; for (let j = 0; j < 10; j++) g.addBot(j % 2); g.botLevel = lv; g.windowChance = 1; g.winLog = [];
  const kills = []; g.startMatch();
  let t = 0, maxHang = 0, hitsOnRope = 0; const hangSince = new Map();
  while (g.phase !== PHASE.MATCH_END && t < 1500) {
    const onRope = new Set([...g.players.values()].filter(p => p.rope).map(p => p.id)), hpBefore = new Map([...g.players.values()].filter(p => p.rope).map(p => [p.id, p.hp]));
    g.tick(1 / 30); t += 1 / 30;
    for (const e of g.events) { if (e.e === 'kill') { kills.push({ fromRope: onRope.has(e.killer), onRope: onRope.has(e.victim) }); } if (e.e === 'down' && onRope.has(e.id)) kills.push({ downOnRope: true }); }
    for (const [id, hp] of hpBefore) { const p = g.players.get(id); if (p && p.hp < hp && !p.downed) hitsOnRope++; }
    g.events = [];
    for (const p of g.players.values()) { if (p.rope && p.rope.st === 'hang') { if (!hangSince.has(p.id)) hangSince.set(p.id, t); maxHang = Math.max(maxHang, t - hangSince.get(p.id)); } else hangSince.delete(p.id); }
  }
  const c = {}; for (const e of g.winLog) c[e.e] = (c[e.e] || 0) + 1;
  c.killsFromRope = kills.filter(k => k.fromRope).length; c.killedOnRope = kills.filter(k => k.onRope).length; c.downedOnRope = kills.filter(k => k.downOnRope).length; c.hitsOnRope = hitsOnRope; c.entries = g.winLog.filter(e => e.e === 'off' && e.fl !== g.map.groundFloor).length;
  for (const [k, v] of Object.entries(c)) tot[k] = (tot[k] || 0) + v;
  console.log(`${id} #${i + 1}: ${Object.entries(c).map(([k, v]) => k + ' ' + v).join(', ')}; longest hang ${Math.round(maxHang)} s`);
  if (maxHang > 110) fail(id, 'someone hung on a rope for', Math.round(maxHang), 's');
  for (const e of g.winLog) if (e.e === 'gaveUp' && e.why === 'far') fail(id, 'a bot could not reach its rope in 45 s, still', e.d, 'px away');
}
console.log('all:', Object.entries(tot).map(([k, v]) => k + ' ' + v).join(', '));
console.log(fails ? `FAIL ropebots (${fails})` : 'PASS ropebots');
process.exit(fails ? 1 : 0);
