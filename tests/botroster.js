// Every everyday bot is its own person (he asked 2026-11-18): ten per rank, no name twice, the lobby gets their rank
// and how they play; changing the bot rank brings in that rank's bots. Also WRAITH's scan: one scan from a full
// charge, then 50 s back to 100%. Run: node tests/botroster.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { ROSTER } from '../shared/botroster.js';
import { OPERATORS, WEAPONS } from '../shared/operators.js';
import { PRO_TEAMS } from '../shared/pros.js';
import { PHASE } from '../shared/constants.js';
let fails = 0; const bad = m => { fails++; console.log('FAIL', m); };
const all = ROSTER.flat().map(e => e.n.toLowerCase());
if (ROSTER.length !== 7 || ROSTER.some(r => r.length !== 10)) bad('not 10 per rank');
if (new Set(all).size !== all.length) bad('a name is used twice');
const taken = new Set([...Object.values(OPERATORS).map(o => o.name.toLowerCase()), ...Object.values(WEAPONS).flatMap(w => w.name.toLowerCase().split(/[\s-]/)), ...PRO_TEAMS.flatMap(t => t.players.map(p => p.name.toLowerCase()))]);
for (const n of all) if (taken.has(n)) bad('name clashes with an operator, gun or pro: ' + n);
for (const e of ROSTER.flat()) for (const o of e.o) if (!OPERATORS[o]) bad(e.n + ' favourite is not an operator: ' + o);
for (let lv = 0; lv < 7; lv++) {
  const g = new Game(); g.botLevel = lv; for (let i = 0; i < 10; i++) g.addBot();
  const bots = [...g.players.values()], names = bots.map(b => b.name);
  if (new Set(names).size !== 10) bad(`rank ${lv}: repeated names ${names}`);
  if (!bots.every(b => b.bio && ROSTER[lv].includes(b.bio))) bad(`rank ${lv}: a bot not from its rank`);
  const snap = g.snapshot ? null : null; void snap;
  console.log(`rank ${lv}: ${names.map(n => n.replace('[BOT] ', '')).join(', ')}`);
  if (lv === 2) { g.botLevel = 5; for (const b of bots) delete b.pro; (await import('../server/bots.js')).assignPros(g);
    if (!bots.every(b => ROSTER[5].includes(b.bio))) bad('rank change kept the old bots'); else console.log('rank change: now ' + bots.map(b => b.name.replace('[BOT] ', '')).join(', ')); }
}
{ // WRAITH
  const g = new Game(); for (let i = 0; i < 10; i++) g.addBot(); g.startMatch(); while ((g.phase !== PHASE.ACTION || g.introT > 0)) g.tick(1 / 30);
  const p = [...g.players.values()].find(q => g.side(q) === 'def' && q.alive); for (const q of g.players.values()) { q.bot = false; q.input = {}; }
  p.op = 'wraith'; g.equip(p); const full = OPERATORS.wraith.ability.battery;
  const tap = () => { p.input = { ability: 1 }; g.tick(1 / 30); p.input = {}; g.tick(1 / 30); };
  tap(); for (let i = 0; i < 30; i++) g.tick(1 / 30); const scanning = p.scanning; tap(); // stop after 1 s
  for (let i = 0; i < 5; i++) g.tick(1 / 30); const after = p.battery;
  tap(); const blocked = !p.scanning;
  for (let i = 0; i < 30 * 49; i++) g.tick(1 / 30); const at49 = p.battery;
  for (let i = 0; i < 30 * 2; i++) g.tick(1 / 30); const at51 = p.battery;
  tap(); const again = p.scanning;
  const ok = scanning && after < 0.05 && blocked && at49 < full && at51 >= full - 1e-6 && again;
  if (!ok) bad(`wraith scanning ${scanning} after-stop ${after} blocked ${blocked} 49s ${at49} 51s ${at51} again ${again}`);
  else console.log(`wraith: scans from full, empty after a scan, ${(at49 / full * 100).toFixed(0)}% at 49 s, full by 51 s`);
}
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0);
