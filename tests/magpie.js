// MAGPIE (he asked): a parasite swarm chases an attacker drone; caught, it reshapes into a bird she flies over furniture
// and lands on walls; a landed bird on AUTO pings the first attacker it sees, then flashes and destroys itself.
// Defender bots leave drones near a MAGPIE (with swarms left) for her. Run: node tests/magpie.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { T, CELL, TEAM, PHASE, PX_PER_M, SWARM, blocksDrone, blocksSight } from '../shared/constants.js';
import { stepMove, los } from '../shared/physics.js';
import { floorAt } from '../shared/map.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); }, ok = (c, ...a) => { if (!c) fail(...a); };
const g = new Game({ free: true }), a = g.addPlayer('Att', false), d = g.addPlayer('Def', false);
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
const m = g.map, W = m.W;
const setup = (p, op, x, y, aim) => { p.op = op; g.equip(p); Object.assign(p, { alive: true, downed: false, ctrl: 'body', staged: false, viewTime: null, x, y, aim, vault: null, busy: null, rope: null, input: {}, prevInput: {}, stunUntil: 0 }); };
d.squad = 1 - a.squad; if (g.side(a) !== TEAM.ATK) { a.squad = 1 - a.squad; d.squad = 1 - a.squad; }
// a long clear run of cells (drone-passable, 3 rows high) for chases
let run0 = -1;
for (let k = W * 3; k < m.tiles.length - W * 3 && run0 < 0; k++) {
  let good = true;
  for (let i = 0; i < 40 && good; i++) for (const r of [-W, 0, W]) { const t = m.tiles[k + i + r]; if (t !== T.FLOOR && t !== T.GROUND) good = false; }
  const x = (k % W + 0.5) * CELL, y = (Math.floor(k / W) + 0.5) * CELL;
  if (good && k % W > 3 && Math.floor(k / W) === Math.floor((k + 40) / W) && floorAt(m, x, y) >= 0 && los(m, x, y, x + 39 * CELL, y)) run0 = k;
}
ok(run0 >= 0, 'no clear 40-cell run on harbor'); if (process.env.DBG) console.log('run', run0 % W, Math.floor(run0 / W));
const X0 = (run0 % W + 0.5) * CELL, Y0 = (Math.floor(run0 / W) + 0.5) * CELL;
const drone = (x, y) => { const e = { id: g.eid(), type: 'drone', owner: a.id, team: TEAM.ATK, x, y, hp: 1, ang: 0 }; g.ents.push(e); a.droneId = e.id; a.ctrl = 'drone'; return e; };
const tick = (s, each) => { for (let i = 0; i < s * 30; i++) { if (each) each(); g.tickEnts(1 / 30); g.time += 1 / 30; } };
const fresh = () => { g.ents = []; g.phase = PHASE.ACTION; };
const birds = () => g.ents.filter(e => e.type === 'bird');

// 1. a drone that doesn't notice is caught and becomes her bird; the attacker is put back in their body
fresh(); setup(d, 'magpie', X0, Y0, 0); setup(a, 'ember', X0 - 60, Y0 + 300, 0);
let dr = drone(X0 + 6 * PX_PER_M, Y0); const n0 = d.abilityCount; g.useAbility(d);
ok(d.abilityCount === n0 - 1 && g.ents.some(e => e.type === 'swarm'), 'no swarm released');
tick(3);
ok(!g.ents.includes(dr) && birds().length === 1 && birds()[0].owner === d.id, 'a still drone was not captured');
ok(a.droneId === null && a.ctrl === 'body', 'the attacker was not put back in their body');
// 2. a drone that sprints away at once escapes
fresh(); setup(d, 'magpie', X0, Y0, 0); dr = drone(X0 + 5 * PX_PER_M, Y0); g.useAbility(d);
let t = 0; tick(8, () => { if (!g.ents.includes(dr) || dr.grab) return; t += 1 / 30; stepMove(m, dr, { right: 1 }, 1 / 30, { drone: true, sprint: t < 3 }); });
ok(g.ents.includes(dr) && !birds().length && !g.ents.some(e => e.type === 'swarm'), 'a sprinting drone should escape');
// 3. one that only drives away (no sprint) a second late is caught
fresh(); setup(d, 'magpie', X0, Y0, 0); dr = drone(X0 + 5 * PX_PER_M, Y0); g.useAbility(d); t = 0;
tick(8, () => { if (!g.ents.includes(dr) || dr.grab) return; t += 1 / 30; if (t > 1) stepMove(m, dr, { right: 1 }, 1 / 30, { drone: true }); });
ok(birds().length === 1, 'a slow, late drone should be caught');
// 4. no drone in sight: nothing used
fresh(); setup(d, 'magpie', X0, Y0, 0); const n1 = d.abilityCount; g.useAbility(d); ok(d.abilityCount === n1, 'swarm used with no drone in sight');
// 5. the bird flies over low furniture, a drone does not
let lk = -1; for (let k = W; k < m.tiles.length - W && lk < 0; k++) if (m.tiles[k] === T.LOW && !(m.under && m.under[k]) && m.tiles[k - 1] === T.FLOOR && m.tiles[k + 1] === T.FLOOR && m.tiles[k - 2] === T.FLOOR && m.tiles[k + 2] === T.FLOOR) lk = k;
if (lk >= 0) {
  const lx = (lk % W + 0.5) * CELL, ly = (Math.floor(lk / W) + 0.5) * CELL;
  const b = { x: lx - 24, y: ly }, q = { x: lx - 24, y: ly };
  for (let i = 0; i < 30; i++) { stepMove(m, b, { right: 1 }, 1 / 30, { drone: true, bird: true }); stepMove(m, q, { right: 1 }, 1 / 30, { drone: true }); }
  ok(b.x > lx + 8, 'the bird did not fly over low furniture', b.x - lx); ok(q.x < lx, 'a drone should not pass low furniture');
} else fail('no low furniture found');
// 6. flying her bird: E lands it on a wall (AUTO on), R switches AUTO; on AUTO the first attacker seen is pinged, then it flashes and is gone
fresh(); setup(d, 'magpie', X0, Y0, 0);
let pk = -1; // a floor cell with a wall on its left and clear floor to its right, for landing the bird
for (let k = W * 3; k < m.tiles.length - W * 3 && pk < 0; k++) {
  const x = (k % W + 0.5) * CELL, y = (Math.floor(k / W) + 0.5) * CELL;
  if (blocksSight(m.tiles[k - 1]) && m.tiles[k - W] === T.FLOOR && m.tiles[k + W] === T.FLOOR && floorAt(m, x, y) >= 0 && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(i => m.tiles[k + i] === T.FLOOR) && los(m, x, y, x + 10 * CELL, y)) pk = k;
}
ok(pk >= 0, 'no wall to land on');
const bx = (pk % W) * CELL + 6, by = (Math.floor(pk / W) + 0.5) * CELL; // just off the wall
const b = { id: g.eid(), type: 'bird', owner: d.id, team: TEAM.DEF, x: bx, y: by, hp: 1, ang: 0, vx: 0, vy: 0, perch: null, auto: false }; g.ents.push(b);
g.watch(d, b); ok(d.ctrl === 'drone' && d.droneId === b.id, 'she cannot fly her bird');
ok(g.mods(d).bird, 'bird movement not used');
d.input = { interact: 1 }; d.prevInput = {}; g.tickPlayer(d, 1 / 30);
ok(b.perch && b.auto, 'E next to a wall did not land the bird with AUTO on'); ok(g.mods(d).frozen, 'a landed bird should not move');
g.event(d, { k: 'reload' }); ok(!b.auto, 'R did not switch AUTO off');
setup(a, 'ember', b.x + 120, b.y, Math.PI); a.ctrl = 'body'; g.spots.def.clear(); tick(0.5);
ok(g.ents.includes(b) && !g.spots.def.has(a.id), 'AUTO off should only watch');
g.event(d, { k: 'reload' }); ok(b.auto, 'R did not switch AUTO back on');
tick(0.5);
ok(!g.ents.includes(b), 'AUTO bird did not destroy itself'); ok(g.spots.def.has(a.id), 'AUTO bird did not ping the attacker');
ok(a.stunUntil > g.time, 'the flash did not blind the attacker looking at it'); ok(d.ctrl === 'body', 'she was not put back in her body');
// 7. a bullet breaks a bird
fresh(); const b2 = { id: g.eid(), type: 'bird', owner: d.id, team: TEAM.DEF, x: X0 + 160, y: Y0, hp: 1, ang: 0 }; g.ents.push(b2);
setup(a, 'ember', X0 + 40, Y0, 0); setup(d, 'magpie', X0 + 400, Y0 + 200, 0); g.hitscan(a, a.x, a.y, 0, 2000, 10, 'Test', 'AR'); ok(!g.ents.includes(b2), 'a bullet did not break the bird');

// 8. bots: in a real match, a defender bot holds fire on a drone near a MAGPIE with swarms left, and shoots it once she has none
const match = (lv) => {
  const G = new Game(); G.botLevel = lv; for (let i = 0; i < 10; i++) G.addBot();
  G.mapId = 'harbor'; G.map = buildMap('harbor'); G.startMatch();
  while (G.phase !== PHASE.PREP) G.tick(1 / 30);
  return G;
};
{
  const G = match(4); while (G.phase !== PHASE.ACTION) G.tick(1 / 30);
  const ps = [...G.players.values()], defs = ps.filter(q => G.side(q) === TEAM.DEF), atks = ps.filter(q => G.side(q) === TEAM.ATK);
  const [shooter, mag] = defs, owner = atks[0];
  for (const q of ps) if (q !== shooter && q !== mag && q !== owner) { q.alive = false; }
  mag.op = 'magpie'; G.equip(mag); Object.assign(mag, { bot: false, x: X0 + 3 * PX_PER_M, y: Y0 + 20, abilityCount: 3, input: {}, prevInput: {} });
  Object.assign(owner, { bot: false, x: X0 + 30 * PX_PER_M, y: Y0 + 30 * PX_PER_M, input: {}, prevInput: {} });
  const dr = { id: G.eid(), type: 'drone', owner: owner.id, team: TEAM.ATK, x: X0 + 4 * PX_PER_M, y: Y0, hp: 1, ang: 0 }; G.ents.push(dr);
  const hold = () => { Object.assign(shooter, { x: X0, y: Y0, aim: 0 }); };
  for (let i = 0; i < 60; i++) { hold(); G.tick(1 / 30); }
  ok(G.ents.includes(dr), 'a defender bot shot a drone right next to MAGPIE');
  mag.abilityCount = 0;
  for (let i = 0; i < 120 && G.ents.includes(dr); i++) { hold(); G.tick(1 / 30); }
  ok(!G.ents.includes(dr), 'with MAGPIE out of swarms the defender bot did not shoot the drone');
}
// 9. attacker bots dodge the swarm better the higher their rank (swarm 6 m away, chasing a bot's drone in preparation)
const escapes = {};
for (const lv of [0, 6]) {
  let got = 0, n = 0;
  for (let k = 0; k < 10; k++) {
    const G = match(lv), ps = [...G.players.values()];
    const mag = ps.find(q => G.side(q) === TEAM.DEF), att = ps.find(q => G.side(q) === TEAM.ATK && G.ent(q.droneId));
    if (!att) continue;
    for (const q of ps) if (q !== mag && q !== att && G.side(q) === TEAM.DEF) q.alive = false;
    mag.op = 'magpie'; G.equip(mag); Object.assign(mag, { bot: false, x: X0, y: Y0, aim: 0, abilityCount: 3, input: {}, prevInput: {} });
    const dr = G.ent(att.droneId); Object.assign(dr, { x: X0 + 6 * PX_PER_M, y: Y0, vx: 0, vy: 0 });
    att.ai.droneGoal = { x: dr.x, y: dr.y }; att.ai.droneGoalT = 99; att.ai.dPath = null; att.ai.dHide = true;
    G.releaseSwarm(mag, mag); if (!G.ents.some(e => e.type === 'swarm')) continue;
    n++; for (let i = 0; i < 9 * 30; i++) G.tick(1 / 30);
    if (G.ents.some(e => e.type === 'bird')) got++;
  }
  escapes[lv] = n ? 1 - got / n : 0;
  console.log(`rank ${lv}: ${n - got}/${n} drones escaped the swarm`);
}
ok(escapes[6] > escapes[0], 'Champion bots should escape the swarm more often than Copper', escapes);

console.log(fails ? `${fails} FAILED` : 'PASS');
process.exit(fails ? 1 : 0);
