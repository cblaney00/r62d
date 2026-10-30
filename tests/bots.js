// Smarter bots: plays bot-only matches and counts what the bots get up to (abilities used, walls breached,
// teammates revived, enemies called out, roamers outside the site), then a skill check: an Expert team against
// an Easy team should win clearly more fights.
// Run: node tests/bots.js [--only <map>]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE, TEAM, CELL } from '../shared/constants.js';
import { OPERATORS } from '../shared/operators.js';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const fails = [];
const total = { ability: {}, gadget: {}, breach: 0, revives: 0, callouts: 0, roamSec: 0, roles: {} };

function play(id, levels, minutes = 14) {
  const g = new Game();
  g.mapId = id; g.map = buildMap(id);
  for (let i = 0; i < 10; i++) g.addBot();
  if (levels) for (const p of g.players.values()) p.level = levels[p.squad];
  const ug = g.useGadget.bind(g), mk = g.mark.bind(g);
  const kills = [0, 0];
  g.useGadget = p => { const n = p.gadgetCount; ug(p); if (p.gadgetCount !== n) total.gadget[p.gadget] = (total.gadget[p.gadget] || 0) + 1; };
  g.mark = (...a) => { total.callouts++; return mk(...a); };
  g.startMatch();
  const dt = 1 / 30;
  for (let t = 0; t < 60 * minutes; t += dt) {
    g.tick(dt);
    for (const e of g.events) if (e.e === 'kill') { const k = g.players.get(e.by || e.k || e.killer); if (k) kills[k.squad]++; }
    for (const p of g.players.values()) {
      if (!p.alive || !p.ai) continue;
      // abilities: any count used up (placed in preparation too), or a held one switched on
      const a = p.op && OPERATORS[p.op].ability.id;
      if (a && (p.abilityCount < (p.lastCount ?? p.abilityCount) || p.lancing || p.scanning || p.shrouded || p.bracing)) total.ability[a] = (total.ability[a] || 0) + 1;
      p.lastCount = p.abilityCount;
      if (p.ai.role) total.roles[p.ai.role] = 1;
      if (p.ai.breach && p.ai.breach.used && !p.ai.breach.counted) { p.ai.breach.counted = true; total.breach++; }
      if (p.ai.role === 'roamer' && g.phase === PHASE.ACTION) {
        const site = g.map.sites[g.site], cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
        if (!g.map.rooms.some(r => site.rooms.includes(r.name) && cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h)) total.roamSec += dt;
      }
    }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
  for (const p of g.players.values()) total.revives += p.ms ? p.ms.revives : 0;
  return { g, kills };
}

const maps = arg('--only') ? [arg('--only')] : MAP_LIST;
for (const id of maps) play(id);
const pr = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
console.log('abilities used:', pr(total.ability));
console.log('gadgets used:  ', pr(total.gadget));
console.log(`walls breached by plan: ${total.breach}, revives: ${total.revives}, callouts: ${total.callouts}, roamer seconds outside the site: ${Math.round(total.roamSec)}`);
console.log('roles seen:', Object.keys(total.roles).join(', '));
for (const r of ['entry', 'support', 'flank', 'intel', 'anchor', 'roamer']) if (!total.roles[r]) fails.push('no bot played ' + r);
if (!total.breach) fails.push('no bot breached a wall');
if (!total.roamSec) fails.push('roamers never left the site');
if (Object.keys(total.ability).length < 22) fails.push('only ' + Object.keys(total.ability).length + ' different abilities used');

// skill: Expert (squad 0) against Easy (squad 1), on two maps
let ex = 0, ez = 0;
for (const id of maps.slice(0, 2)) for (let i = 0; i < 2; i++) { const { g } = play(id, [3, 0], 10); for (const p of g.players.values()) { const k = p.ms ? p.ms.kills : 0; if (p.squad === 0) ex += k; else ez += k; } }
console.log(`skill check: Expert team ${ex} kills, Easy team ${ez} kills`);
if (!(ex > ez * 1.3)) fails.push('Expert bots did not clearly beat Easy bots');
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS');
process.exit(fails.length ? 1 : 0);
