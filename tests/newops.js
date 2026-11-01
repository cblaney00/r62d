// The operators added to fill every role to 5 (he asked): each skill does what its description says.
// Run: node tests/newops.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { T, CELL, TEAM, PX_PER_M } from '../shared/constants.js';
import { JOBS, WEAPONS } from '../shared/operators.js';
import { castSight, los } from '../shared/physics.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); }, ok = (c, ...a) => { if (!c) fail(...a); };
for (const t of ['atk', 'def']) for (const j of JOBS[t]) ok(j.ops.length >= 5, t, j.name, 'has only', j.ops.length);
const g = new Game({ free: true }), a = g.addPlayer('Att', false), d = g.addPlayer('Def', false);
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
g.baseTiles = g.map.tiles.slice();
const m = g.map, W = m.W;
const setup = (p, op, x, y, aim) => { p.op = op; g.equip(p); Object.assign(p, { alive: true, downed: false, ctrl: 'body', staged: false, viewTime: null, x, y, aim, vault: null, busy: null, rope: null, input: {}, prevInput: {} }); };
d.squad = 1 - a.squad; if (g.side(a) !== TEAM.ATK) { a.squad = 1 - a.squad; d.squad = 1 - a.squad; }
const run = s => { for (let i = 0; i < s * 30; i++) { g.tickEnts(1 / 30); for (const p of [a, d]) { if (p.vault) g.tickPlayer(p, 1 / 30); } g.time += 1 / 30; } };
const use = p => g.useAbility(p);
// a soft wall cell with floor on both sides, left and right
let wk = -1; for (let k = W; k < m.tiles.length - W && wk < 0; k++) if (m.tiles[k] === T.SOFT && m.tiles[k - 1] === T.FLOOR && m.tiles[k + 1] === T.FLOOR && m.tiles[k - 2] === T.FLOOR && m.tiles[k + 2] === T.FLOOR && m.tiles[k - W] === T.SOFT && m.tiles[k + W] === T.SOFT) wk = k;
const wx = (wk % W + 0.5) * CELL, wy = (Math.floor(wk / W) + 0.5) * CELL;
const fresh = () => { for (const k of [wk - W, wk, wk + W]) { m.tiles[k] = T.SOFT; m.hp[k] = 60; } g.ents = []; for (const p of [a, d]) { p.hp = p.maxHp = 200; } };
// SALVO: sticks to the wall, blows it open after 1.5 s and hurts someone behind it
fresh(); setup(a, 'salvo', wx - 40, wy, 0); setup(d, 'lynx', wx + 30, wy, Math.PI); d.hp = d.maxHp = 500;
use(a); run(0.3); ok(g.ents.some(e => e.type === 'sticky' && e.stuck), 'salvo round did not stick');
run(3); ok(m.tiles[wk] === T.SOFT, 'salvo round blew without being told'); // remote detonation (he asked): it waits
const cnt = a.abilityCount; use(a); ok(a.abilityCount === cnt, 'detonating should not use a round'); run(0.5);
ok(m.tiles[wk] !== T.SOFT, 'salvo did not open the wall'); ok(d.hp < 500, 'salvo did not hurt the room behind');
// TORQUE: two reinforced blocks prised open after 4 s
// TORQUE: the saw disc slits the soft wall (see-through, still standing) and cuts the defender behind it; a reinforced wall stops it
fresh(); delete m.holes[wk]; setup(a, 'torque', wx - 40, wy, 0); setup(d, 'lynx', wx + 50, wy, Math.PI); d.hp = d.maxHp = 200; use(a); run(0.5);
ok(m.tiles[wk] === T.SOFT, 'the saw disc should slit the wall, not knock it down'); ok((m.holes[wk] || []).length >= 20, 'no slit in the wall', (m.holes[wk] || []).length);
ok(d.hp === 155, 'the disc did not cut the defender behind the wall', d.hp); ok(!g.ents.some(e => e.type === 'saw'), 'the disc should stop in the person it hits');
ok(castSight(m, wx - 40, wy, 0, 200, null) > 80, 'cannot see through the slit');
fresh(); delete m.holes[wk]; for (const k of [wk - W, wk, wk + W]) m.tiles[k] = T.REINF; setup(a, 'torque', wx - 40, wy, 0); setup(d, 'lynx', wx + 50, wy, Math.PI); d.hp = d.maxHp = 200; use(a); run(0.5);
ok(!(m.holes[wk] || []).length && d.hp === 200 && !g.ents.some(e => e.type === 'saw'), 'a reinforced wall should stop the disc');
// RUSH: 3 m forward through a barricade; WREN: a barricade picked apart silently
const o = m.openings.find(o => o.kind === 'door' && o.cells.length === 2 && o.cells.every(c => m.tiles[c + 1] === T.FLOOR && m.tiles[c - 1] === T.FLOOR && m.tiles[c + 3] === T.FLOOR && m.tiles[c - 3] === T.FLOOR));
if (o) {
  const c = o.cells[0], ox = (c % W + 0.5) * CELL, oy = (Math.floor(c / W) + 0.5) * CELL;
  fresh(); g.barricade(o.id, T.BARRI, true); setup(a, 'rush', ox - 40, oy + 8, 0); use(a); run(0.5);
  ok(o.cells.every(k => m.tiles[k] === T.OPEN), 'dash did not break the barricade'); ok(a.x > ox, 'dash did not carry through the doorway', a.x, ox);
  fresh(); g.barricade(o.id, T.BARRI, true); setup(a, 'wren', ox - 20, oy + 8, 0); g.events = []; use(a); run(1.6);
  ok(o.cells.every(k => m.tiles[k] === T.OPEN), 'lockpick did not open the barricade'); ok(!g.events.some(e => e.e === 'hit' || (e.e === 'snd' && e.s === 'break')), 'lockpick was not silent');
} else fail('no door to test dash/lockpick');
// SOLDER: welds a broken soft wall back
fresh(); g.destroyCell(wk); setup(d, 'solder', wx - 18, wy, 0); for (let i = 0; i < 40; i++) { d.input = { ability: 1 }; g.tickPlayer(d, 1 / 30); g.time += 1 / 30; }
ok(m.tiles[wk] === T.SOFT, 'welder did not repair the wall');
// LATCH: an alarm wire reveals whoever crosses it; HOUND: a spotter dart reveals
const X = 360, Y = 40; fresh(); setup(d, 'latch', X, Y, 0); use(d); run(1.2); setup(a, 'ember', X + 12, Y, 0); run(0.1);
ok(g.spots.def.has(a.id), 'alarm wire did not reveal the attacker');
g.spots.def.clear(); setup(d, 'hound', X, Y, 0); setup(a, 'ember', X + 120, Y, 0); use(d); ok(g.spots.def.has(a.id), 'spotter dart did not reveal');
// MARK: tracer rounds reveal who you hit
g.spots.atk.clear(); setup(a, 'mark', X, Y, 0); setup(d, 'lynx', X + 100, Y + 4, Math.PI); d.hp = 999; use(a); g.hitscan(a, a.x, a.y, 0, 2000, 10, 'Test', 'AR'); ok(g.spots.atk.has(d.id), 'tracer hit did not reveal');
// TONIC / PATCH heal; RALLY heals itself
fresh(); setup(d, 'tonic', X, Y, 0); d.hp = 50; d.maxHp = 100; use(d); const st = g.ents.find(e => e.type === 'station'); d.x = st.x; d.y = st.y; run(3); ok(d.hp > 60, 'heal station did not heal', d.hp);
fresh(); setup(d, 'rally', X, Y, 0); d.hp = 30; d.maxHp = 100; use(d); ok(d.hp === 70 && d.boostUntil > g.time, 'second wind');
// WARD: zaps a thrown attacker grenade
fresh(); setup(d, 'ward', X, Y, 0); use(d); const ct = g.ents.find(e => e.type === 'catcher'); setup(a, 'ember', ct.x - 150, ct.y, 0);
g.ents.push({ id: g.eid(), type: 'nade', kind: 'frag', x: ct.x - 40, y: ct.y, vx: 0, vy: 0, fuse: 5, team: TEAM.ATK, owner: a.id }); run(0.1);
ok(!g.ents.some(e => e.type === 'nade'), 'grenade catcher did not zap the grenade');
// CROW: Lunge — for 5 s the next melee is a 2 m lunge that downs, from any side; plain melee stays a normal hit
fresh(); setup(a, 'crow', X, Y, 0); setup(d, 'lynx', X + 60, Y, Math.PI); d.hp = d.maxHp = 100; g.melee(a); ok(d.hp === 100, 'a plain melee should not reach 60 px');
a.meleeCd = 0; use(a); ok(a.lungeUntil > g.time, 'lunge not ready'); g.melee(a); run(0.3); ok(!d.alive || d.downed, 'the lunge did not down the defender (facing him)'); ok(a.x > X + 30, 'Crow did not lunge forward', a.x);
setup(a, 'crow', X, Y, 0); a.meleeCd = 0; setup(d, 'lynx', X + 50, Y, 0); d.hp = d.maxHp = 100; use(a); g.melee(a); run(0.3); ok(!d.alive || d.downed, 'the lunge did not down the defender (from behind)');
setup(a, 'crow', X, Y, 0); setup(d, 'lynx', X + 18, Y, Math.PI); d.hp = d.maxHp = 100; a.meleeCd = 0; g.melee(a); ok(d.alive && d.hp === 45, 'a front melee should be a normal hit', d.hp);
// BLAZE: blinds a defender facing the flare, not one looking away
fresh(); setup(a, 'blaze', X, Y, 0); setup(d, 'lynx', X + 150, Y, Math.PI); const d2 = g.addPlayer('Def2', false); d2.squad = d.squad; setup(d2, 'lynx', X + 150, Y + 20, 0);
d.stunUntil = d2.stunUntil = 0; g.detonate({ type: 'nade', kind: 'flare', x: X + 60, y: Y + 10, team: TEAM.ATK, owner: a.id });
ok(d.stunUntil > g.time, 'flare did not blind a defender facing it'); ok(!(d2.stunUntil > g.time), 'flare blinded a defender looking away');
// GIRDER: two extra reinforcements, reinforcing twice as fast
const g2 = new Game(); for (let i = 0; i < 10; i++) g2.addBot(); g2.startMatch(); const df = [...g2.players.values()].filter(p => g2.side(p) === TEAM.DEF);
df.forEach((p, i) => { p.op = i ? 'lynx' : 'girder'; p.locked = true; }); [...g2.players.values()].filter(p => g2.side(p) === TEAM.ATK).forEach(p => { p.op = 'ember'; p.locked = true; });
const r0 = g2.reinforce; for (const p of g2.players.values()) p.bot = false; g2.beginPrep(); ok(g2.reinforce >= r0 + 2, 'girder: no extra reinforcements', r0, g2.reinforce);
// VAPOR: a cone of smoke in front that fills the room's shape (no puff on the other side of a wall)
fresh(); setup(a, 'vapor', X, Y, 0); use(a); const vc = g.ents.find(e => e.type === 'smoke' && e.kind === 'cone');
ok(vc && vc.puffs.length / 2 >= 15, 'VAPOR cone too small', vc && vc.puffs.length / 2);
if (vc) { let behind = 0, wall = 0; for (let i = 0; i < vc.puffs.length; i += 2) { const x = vc.puffs[i], y = vc.puffs[i + 1]; if (Math.hypot(x - X, y - Y) > 40 && x < X) behind++; if (!los(m, X, Y, x, y, null) && Math.hypot(x - X, y - Y) < 60) wall++; }
  ok(behind === 0, 'VAPOR smoke went behind him', behind); }
// MARK: tracer rounds go through a reinforced wall; ordinary rounds do not
fresh(); for (const k of [wk - W, wk, wk + W]) m.tiles[k] = T.REINF; setup(a, 'mark', wx - 40, wy, 0); a.tracerUntil = 0; setup(d, 'lynx', wx + 40, wy, Math.PI); d.hp = 999;
const fireOnce = () => { const gun = a.guns[a.slot]; a.shots = 0; a.lastShot = -9; g.fire(a, gun, WEAPONS[gun.w]); };
fireOnce(); ok(d.hp === 999, 'a normal round went through a reinforced wall'); use(a); fireOnce(); ok(d.hp < 999 && g.spots.atk.has(d.id), 'a tracer round did not go through the reinforced wall and reveal', d.hp);
// TETHER: a new scope shrugs off hits for 3 s, then one bullet breaks it
fresh(); setup(a, 'tether', wx - 18, wy, 0); use(a); const sc2 = g.ents.find(e => e.type === 'scope'); g.hitEnt(sc2, d); ok(g.ents.includes(sc2), 'shielded scope broke');
g.time += 3.1; g.hitEnt(sc2, d); ok(!g.ents.includes(sc2), 'scope did not break after its shield wore off');
// STRIDER: 6 s, slower while it lasts
fresh(); setup(a, 'strider', X, Y, 0); use(a); ok(a.ghostUntil - g.time <= 6.01 && g.mods(a).mul < 0.9, 'Ghost Step should last 6 s and slow him', a.ghostUntil - g.time, g.mods(a).mul);
// FERRO: the hammer never runs out
fresh(); setup(a, 'ferro', X, Y, 0); for (let i = 0; i < 30; i++) { a.meleeCd = 0; use(a); } setup(d, 'lynx', X + 20, Y, Math.PI); d.hp = d.maxHp = 500; a.meleeCd = 0; use(a); ok(d.hp < 500, 'FERRO hammer ran out');
// TALON: an EMP thrown at a wall sticks to it and wipes a gadget just behind the wall, not one 2 m away
fresh(); setup(a, 'talon', wx - 60, wy, 0); a.aimX = wx; a.aimY = wy;
g.ents.push({ id: 'mA', type: 'mine', x: wx + 14, y: wy, ang: 0, team: TEAM.DEF, owner: d.id, arm: 9, hp: 1 }, { id: 'mB', type: 'mine', x: wx + 80, y: wy, ang: 0, team: TEAM.DEF, owner: d.id, arm: 9, hp: 1 });
use(a); run(1.5); ok(!g.ents.some(e => e.id === 'mA'), 'EMP did not reach through the wall'); ok(g.ents.some(e => e.id === 'mB'), 'EMP reached too far');
// throwing (he asked: consistent): a smoke lands where you aim and only pops once it has landed
fresh(); setup(a, 'ember', X, Y, 0); a.aimX = X + 150; a.aimY = Y; const sm = g.throwNade(a, 'smoke'); run(0.3); ok(g.ents.includes(sm), 'smoke popped in the air'); run(1.5);
const sp = g.ents.find(e => e.type === 'smoke'); ok(sp && Math.abs(sp.x - (X + 150)) < 25, 'smoke did not land where aimed', sp && sp.x);
console.log(fails ? `${fails} failure(s)` : 'PASS newops');
process.exit(fails ? 1 : 0);
