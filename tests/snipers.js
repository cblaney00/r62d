// The four sniper attackers (he asked 2026-11-10, he chose all four): PERCH's bipod (only crouched/lying and still;
// faster bolt, half the kick, barely moves, folds when you stand), MOSS's ghillie (no glint flag while it lasts),
// OSPREY's spotting scope (aimed in, enemies in view are spotted for the team; not through walls), NAIL's piercing
// round (one shot through reinforced wall at 40% damage, no one-shot kill through it). Run: node tests/snipers.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { T, CELL, TEAM } from '../shared/constants.js';
import { WEAPONS, JOBS, gunMods, jobOf } from '../shared/operators.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); }, ok = (c, ...a) => { if (!c) fail(...a); };
for (const op of ['perch', 'moss', 'osprey', 'nail']) ok(jobOf(op), op, 'has no role');
const g = new Game({ free: true }), a = g.addPlayer('Att', false), d = g.addPlayer('Def', false);
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
const m = g.map, W = m.W;
d.squad = 1 - a.squad; if (g.side(a) !== TEAM.ATK) { a.squad = 1 - a.squad; d.squad = 1 - a.squad; }
const setup = (p, op, x, y, aim) => { p.op = op; g.equip(p); Object.assign(p, { alive: true, downed: false, ctrl: 'body', staged: false, viewTime: null, x, y, aim, vault: null, busy: null, rope: null, input: {}, prevInput: {}, vx: 0, vy: 0, pr: 0 }); };
let wk = -1; for (let k = W; k < m.tiles.length - W && wk < 0; k++) if (m.tiles[k] === T.SOFT && [1, 2, 3].every(i => m.tiles[k - i] === T.FLOOR && m.tiles[k + i] === T.FLOOR) && m.tiles[k - W] === T.SOFT && m.tiles[k + W] === T.SOFT) wk = k;
const wx = (wk % W + 0.5) * CELL, wy = (Math.floor(wk / W) + 0.5) * CELL;
const shoot = (p, q) => { // one aimed shot straight at q's body
  const gun = p.guns[0]; p.slot = 0; gun.ammo = 5; p.adsT = 1; p.aim = Math.atan2(q.y - p.y, q.x - p.x); p.aimX = q.x; p.aimY = q.y + 5; p.rc = 0; p.shots = 0; p.lastShot = -9; p.fireCd = 0;
  g.fire(p, gun, WEAPONS[gun.w]);
};

// PERCH
setup(a, 'perch', wx - 200, wy, 0);
g.useAbility(a); ok(!a.bipodSet, 'bipod set standing up');
a.input = { crouch: 1 }; g.useAbility(a); ok(a.bipodSet, 'bipod not set crouched and still');
ok(g.mods(a).mul < 0.2, 'bipod down: should barely move', g.mods(a).mul);
a.guns[0] = { w: 'pike', ammo: 5, reserve: 10, att: { sight: 'sniper' }, m: gunMods('pike', { sight: 'sniper' }) };
const cdOf = () => { a.fireCd = 0; a.lastShot = -9; a.rc = 0; a.shots = 0; g.fire(a, a.guns[0], WEAPONS.pike); return { cd: a.fireCd, rc: Math.abs(a.rc) }; };
const down = cdOf(); a.input = {}; g.tickSnipers(a); ok(!a.bipodSet, 'bipod did not fold when standing'); const up = cdOf();
ok(down.cd < up.cd * 0.75, 'bipod: bolt not faster', down.cd, up.cd); ok(down.rc < up.rc * 0.6, 'bipod: kick not halved', down.rc, up.rc);
a.input = { crouch: 1 }; g.useAbility(a); a.x += 30; g.tickSnipers(a); ok(!a.bipodSet, 'bipod did not fold after moving off');

// MOSS
setup(a, 'moss', wx - 200, wy, 0); g.useAbility(a); ok(a.ghillieUntil > g.time, 'ghillie not on');

// OSPREY: sees the defender in the open, not the one behind the wall (the wall put back: PERCH shot it)
for (const k of [wk - W, wk, wk + W]) { m.tiles[k] = T.SOFT; m.hp[k] = 60; delete m.holes[k]; }
setup(a, 'osprey', wx - 3 * CELL, wy, 0); setup(d, 'lynx', wx + 3 * CELL, wy, Math.PI);
for (const t in g.spots) g.spots[t].clear(); g.useAbility(a); a.adsT = 1; a.spotT = -9; g.tickSnipers(a);
const spotted = () => Object.values(g.spots || {}).some(v => v && (v instanceof Map ? v.has(d.id) : Array.isArray(v) ? v.includes(d.id) : typeof v === 'object' && (d.id in v)));
ok(!spotted(), 'OSPREY spotted through a wall');
d.x = wx - 1.5 * CELL; d.y = wy + 0; a.spotT = -9; g.tickSnipers(a); ok(spotted(), 'OSPREY did not spot the defender in view');

// NAIL: a piercing round through reinforced wall at 40%; not a one-shot even with a sniper scope
for (const k of [wk - W, wk, wk + W]) m.tiles[k] = T.REINF;
setup(a, 'nail', wx - 2 * CELL, wy, 0); setup(d, 'lynx', wx + 2 * CELL, wy, Math.PI); d.hp = d.maxHp = 500;
a.guns[0] = { w: 'saker', ammo: 5, reserve: 10, att: { sight: 'sniper' }, m: gunMods('saker', { sight: 'sniper' }) };
shoot(a, d); ok(d.hp === 500, 'a normal round went through reinforced wall', d.hp);
g.useAbility(a); ok(a.pierceShot === 1, 'round not loaded'); shoot(a, d);
const dmg = 500 - d.hp; ok(dmg > 0 && dmg < WEAPONS.saker.dmg * 0.5, 'piercing round damage', dmg); ok(!a.pierceShot, 'piercing round not used up');
a.guns[0] = { w: 'mammoth', ammo: 5, reserve: 10, att: { sight: 'sniper' }, m: gunMods('mammoth', { sight: 'sniper' }) };
d.hp = d.maxHp = 150; g.useAbility(a); shoot(a, d); ok(d.alive && !d.downed, 'the Mammoth one-shot through reinforced wall with a piercing round');
console.log(`PERCH bolt ${down.cd.toFixed(2)} s down vs ${up.cd.toFixed(2)} s up; NAIL through reinforced: ${dmg} damage`);
console.log(fails ? `${fails} failure(s)` : 'PASS snipers');
process.exit(fails ? 1 : 0);
