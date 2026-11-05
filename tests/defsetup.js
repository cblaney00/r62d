// Defender bots' preparation and positions (he asked: fewer right on the site, the rooms leading to it set up, no
// boarding themselves in, rotation holes, busy all preparation instead of waiting for drones).
// Run: node tests/defsetup.js [level 0-7] [rounds per map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, roomAt } from '../shared/map.js';
import { PHASE, T, TEAM, CELL } from '../shared/constants.js';

const level = +(process.argv[2] ?? 4), rounds = +(process.argv[3] ?? 2);
let fails = 0; const tot = { busy: 0, all: 0, site: 0, out: 0, holes: 0, hRounds: 0, boardSite: 0, boardOut: 0, reinf: 0, rounds: 0 };
for (const id of MAP_LIST) for (let r = 0; r < rounds; r++) {
  const g = new Game();
  for (let i = 0; i < 10; i++) g.addBot();
  g.botLevel = level; g.mapId = id; g.map = buildMap(id); g.startMatch();
  while (g.phase !== PHASE.PREP) g.tick(1 / 30);
  const m = g.map, site = m.sites[g.site], defs = [...g.players.values()].filter(p => g.side(p) === TEAM.DEF);
  const ds = g._ds, r0 = g.reinforce, open0 = m.openings.map(o => m.tiles[o.cells[0]]);
  let busy = 0, all = 0;
  while (g.phase === PHASE.PREP) { g.tick(1 / 30); for (const p of defs) { all++; if (p.ai && (p.ai.task || (p.ai.tasks && p.ai.tasks.length))) busy++; } }
  const reinf = r0 - g.reinforce;
  let bSite = 0, bOut = 0;
  m.openings.forEach((o, i) => { if (open0[i] === T.OPEN && m.tiles[o.cells[0]] === T.BARRI) { if (ds.siteBoards.includes(i)) bSite++; else bOut++; } });
  const holes = ds ? ds.holes.filter(h => h.cells.every(k => m.tiles[k] === T.FLOOR || m.tiles[k] === T.GROUND)).length : 0;
  for (let i = 0; i < 30 * 30 && g.phase === PHASE.ACTION; i++) g.tick(1 / 30);
  const inSite = defs.filter(p => p.alive && site.rooms.includes(roomAt(m, p.x, p.y))).length, alive = defs.filter(p => p.alive).length;
  console.log(`${id.padEnd(8)} busy in prep ${Math.round(busy / all * 100)}%  reinforced ${reinf}  boards: site ${bSite} outer ${bOut}  rotation holes ${holes}/${ds ? ds.holes.length : 0}  held rooms ${ds ? ds.held.map(r => r.name).join(', ') : '-'}  30 s in: ${inSite} of ${alive} alive on site`);
  Object.assign(tot, { busy: tot.busy + busy, all: tot.all + all, site: tot.site + inSite, out: tot.out + alive - inSite, holes: tot.holes + holes, hRounds: tot.hRounds + (ds && ds.holes.length ? 1 : 0), boardSite: tot.boardSite + bSite, boardOut: tot.boardOut + bOut, reinf: tot.reinf + reinf, rounds: tot.rounds + 1 });
}
const n = tot.rounds;
console.log(`\nlevel ${level}: busy ${Math.round(tot.busy / tot.all * 100)}% of prep, reinforced ${(tot.reinf / n).toFixed(1)}/round, site boards ${(tot.boardSite / n).toFixed(1)} outer ${(tot.boardOut / n).toFixed(1)}, holes opened ${tot.holes} in ${tot.hRounds} rounds with one planned, on site 30 s in ${(tot.site / n).toFixed(1)} (outside ${(tot.out / n).toFixed(1)})`);
if (tot.site / n > 3) { fails++; console.log('FAIL: too many on the site'); }
if (tot.busy / tot.all < 0.4) { fails++; console.log('FAIL: idle in preparation'); }
console.log(fails ? `${fails} FAILED` : 'PASS');
process.exit(fails ? 1 : 0);
