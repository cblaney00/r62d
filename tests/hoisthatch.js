// HOIST's grapple under a shut hatch (he asked 2026-11-18): it blows the hatch open, as loud as a grenade, and he climbs
// up through it; a hatch the defenders reinforced stays shut (and costs nothing); an open hatch is climbed as before.
// Run: node tests/hoisthatch.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, floorAt, hatchOpen } from '../shared/map.js';
import { PHASE, T } from '../shared/constants.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
function setup(mapId) {
  let g, p;
  do {
    g = new Game(); g.mapId = mapId; g.map = buildMap(mapId);
    for (let i = 0; i < 10; i++) g.addBot();
    g.startMatch();
    while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
    p = [...g.players.values()].find(q => g.side(q) === 'atk' && q.alive);
  } while (!p);
  p.op = 'hoist'; g.equip(p); p.bot = false; p.ctrl = 'body'; // (a bot may have been flying its drone)
  return { g, p };
}
const still = p => { p.input = { up: 0, down: 0, left: 0, right: 0, fire: 0, ads: 0 }; };
let tried = 0;
for (const mapId of ['harbor', 'embassy', 'school']) {
  for (const kind of ['shut', 'reinforced', 'open']) {
    const { g, p } = setup(mapId), m = g.map;
    const h = m.hatches.find(x => !x.peep && !x.roof && m.tiles[x.cells[0]] === T.HATCH); if (!h) continue;
    if (kind === 'reinforced') g.reinforceHatch(h.id);
    if (kind === 'open') g.breakHatch(h.id);
    p.x = h.bx; p.y = h.by; p.vx = p.vy = 0; still(p);
    const fl0 = floorAt(m, p.x, p.y), n0 = p.abilityCount; let boom = 0, deny = '';
    g.event(p, { k: 'ability' });
    for (let i = 0; i < 90; i++) { still(p); g.tick(1 / 30); for (const e of g.events) { if (e.e === 'boom' && e.kind === 'frag') boom++; if (e.e === 'deny' && e.id === p.id) deny = e.why; } g.events.length = 0; }
    const up = floorAt(m, p.x, p.y) !== fl0, open = hatchOpen(m, h), used = n0 - p.abilityCount; tried++;
    const line = `${mapId} ${kind}: blast ${boom}, hatch open ${open}, climbed ${up}, charges used ${used}${deny ? ', told: ' + deny : ''}`;
    const ok = kind === 'shut' ? boom > 0 && open && up && used === 1 : kind === 'reinforced' ? !boom && !open && !up && used === 0 && /reinforced/.test(deny) : !boom && up && used === 1;
    console.log((ok ? 'ok   ' : 'FAIL ') + line); if (!ok) fails++;
  }
}
if (!tried) fail('no hatch to try');
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
