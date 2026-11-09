// The defuser drop everyone notices (he asked) and your side's map changes reaching your map at once (he asked).
// Run: node tests/defdrop.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, TEAM, T, CELL } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game(); for (let i = 0; i < 10; i++) g.addBot(); g.startMatch();
const snaps = [], watcher = [...g.players.values()][0];
watcher.sock = { open: true, send: s => { const m = JSON.parse(s); if (m.t === 'snap') snaps.push(m); } };
// 1. map changes are tagged with the side that made them: defenders' boards and reinforcements in preparation
while (g.phase !== PHASE.ACTION) { g.tick(1 / 30); if (g.time % 0.05 < 1 / 30) g.broadcast(); }
let built = 0, tagged = 0;
for (const s of snaps) for (let i = 0; i < s.cells.length; i += 3) if (s.cells[i + 1] === T.BARRI || s.cells[i + 1] === T.REINF) { built++; if (s.cb[i / 3] === 2) tagged++; }
if (!built) fail('no boards or reinforcements made in preparation');
else if (tagged / built < 0.95) fail(`only ${tagged} of ${built} built cells tagged as the defenders'`);
// an attacker's blast is the attackers'
const atk = [...g.players.values()].find(p => g.side(p) === TEAM.ATK && p.alive && !p.staged);
const soft = g.map.tiles.findIndex((t, k) => t === T.SOFT && g.map.tiles[k + 1] === T.SOFT);
snaps.length = 0; const W = g.map.W;
g.explode({ x: (soft % W + 0.5) * CELL, y: (Math.floor(soft / W) + 0.5) * CELL, team: TEAM.ATK, owner: atk.id }, { r: 40, dmg: 0, cellR: 21, cells: [T.SOFT], kind: 'breach' });
g.broadcast(); const s1 = snaps[0];
if (!s1.cells.length) fail('blast changed nothing'); else if (s1.cb.some(v => v !== 1)) fail('blast cells not tagged as the attackers\'', s1.cb);
// 2. the defuser: dropping it tells both sides, with an event and a ground marker
const carrier = [...g.players.values()].find(p => p.hasDefuser);
if (!carrier) fail('nobody carries the defuser');
else {
  g.events = []; g.kill(carrier, null, 'Test');
  const ev = g.events;
  if (!ev.some(e => e.e === 'defdrop')) fail('no defdrop event');
  if (!ev.some(e => e.e === 'msg' && e.team === TEAM.DEF && /dropped the defuser/.test(e.text))) fail('defenders not told');
  if (!ev.some(e => e.e === 'msg' && e.team === TEAM.ATK && /dropped the defuser/.test(e.text))) fail('attackers not told');
  if (!ev.some(e => e.e === 'kill' && e.df)) fail('kill feed does not say they carried it');
  const d = g.ents.find(e => e.type === 'defuser'); if (!d) fail('no defuser on the ground');
  const mate = [...g.players.values()].find(p => p.alive && g.side(p) === TEAM.ATK && p !== carrier);
  if (d && mate) { mate.x = d.x; mate.y = d.y; mate.staged = false; g.events = []; g.tickPlayer(mate, 1 / 30);
    if (!mate.hasDefuser) fail('not picked up'); else if (!g.events.some(e => e.e === 'msg' && e.team === TEAM.DEF && /picked/.test(e.text))) fail('defenders not told of the pick-up'); }
}
console.log(`built ${built}, tagged ${tagged}`);
console.log(fails ? `${fails} failure(s)` : 'PASS defdrop'); process.exit(fails ? 1 : 0);
