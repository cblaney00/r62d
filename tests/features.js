// Map knowledge and features by rank (he asked: the pros use everything the game offers, and map sense climbs with
// rank): plays bot-only matches at a few ranks and counts, per round, what the bots did (bots.js `feat`): cameras and
// gadgets shot, off-angle holds, other ways in, leaning, lying down, power slides, vaults, wallbangs, roof plays,
// camera feeds, sniper glints dodged, plus map cameras still working at the end of the round.
// PASS: the pros use every feature in MUST, and the knowledge counts climb from Copper to the pros.
// Run: node tests/features.js [matches per rank, default 1] [--levels 0,3,5,7]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE } from '../shared/constants.js';

const per = +process.argv[2] || 1, la = process.argv.indexOf('--levels');
const levels = la >= 0 ? process.argv[la + 1].split(',').map(Number) : [0, 3, 5, 7];
const NAMES = ['Copper', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion', 'Pro'];
const MUST = ['cams', 'offAngle', 'clever', 'lean', 'prone', 'slide', 'vault', 'wallbang', 'roof', 'feeds'];
const CLIMB = ['cams', 'offAngle', 'lean']; // must grow with rank
const out = {};
let mi = 0;
for (const lvl of levels) {
  const R = out[lvl] = { rounds: 0, f: {}, camsLeft: 0, cams: 0 };
  for (let n = 0; n < per; n++) {
    const id = MAP_LIST[mi++ % MAP_LIST.length];
    const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = lvl; if (lvl === 7) g.proExplore = true;
    for (let i = 0; i < 10; i++) g.addBot();
    g.startMatch();
    let t = 0, last = g.phase;
    while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
      g.tick(1 / 30); t += 1 / 30; g.events = [];
      if (g.phase !== last) {
        if (g.phase === PHASE.PREP) for (const p of g.players.values()) p.feat = {};
        if (g.phase === PHASE.ROUND_END && g.winner != null) {
          R.rounds++;
          for (const p of g.players.values()) for (const [k, v] of Object.entries(p.feat || {})) R.f[k] = (R.f[k] || 0) + v;
          for (const e of g.ents) if (e.type === 'cam' && !e.owner) { R.cams++; if (e.hp > 0) R.camsLeft++; }
        }
        last = g.phase;
      }
    }
  }
}
const keys = [...new Set(Object.values(out).flatMap(R => Object.keys(R.f)).concat(MUST))].sort();
const rate = (R, k) => (R.f[k] || 0) / Math.max(1, R.rounds);
console.log('per round'.padEnd(10), keys.map(k => k.padStart(9)).join(''), '  map cams left');
for (const lvl of levels) { const R = out[lvl]; console.log(NAMES[lvl].padEnd(10), keys.map(k => rate(R, k).toFixed(2).padStart(9)).join(''), `   ${Math.round(R.camsLeft / Math.max(1, R.cams) * 100)}% (${R.rounds} rounds)`); }
let ok = true;
const top = out[7];
if (top) for (const k of MUST) if (!top.f[k]) { ok = false; console.log(`FAIL: the pros never used ${k}`); }
const lo = out[Math.min(...levels)], hi = out[Math.max(...levels)];
if (lo !== hi) for (const k of CLIMB) if (rate(lo, k) >= rate(hi, k)) { ok = false; console.log(`FAIL: ${k} does not climb with rank (${rate(lo, k).toFixed(2)} vs ${rate(hi, k).toFixed(2)})`); }
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
