// The first 30 operators: each skill does what its description says (tests/newops.js does the same for the 21
// added later, tests/shield.js covers BULWARK in depth). Run: node tests/oldops.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { T, CELL, TEAM, PHASE } from '../shared/constants.js';
let fails = 0, n = 0; const ok = (c, ...a) => { n++; if (!c) { fails++; console.log('FAIL', ...a); } };
const g = new Game({ free: true }), a = g.addPlayer('Att', false), d = g.addPlayer('Def', false), d2 = g.addPlayer('Def2', false);
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
g.baseTiles = g.map.tiles.slice();
const m = g.map, W = m.W;
d.squad = 1 - a.squad; d2.squad = d.squad; if (g.side(a) !== TEAM.ATK) { a.squad = 1 - a.squad; d.squad = d2.squad = 1 - a.squad; }
const setup = (p, op, x, y, aim) => { p.op = op; g.equip(p); Object.assign(p, { alive: true, downed: false, ctrl: 'body', staged: false, viewTime: null, x, y, aim, vault: null, busy: null, rope: null, input: {}, prevInput: {}, hp: 100, maxHp: 100, moving: 0 }); };
const away = p => { p.x = -9000; p.y = -9000; };
const ticks = (s, ...ps) => { for (let i = 0; i < s * 30; i++) { for (const p of ps) { p.prevInput = p.input; p.input = { ...(p.hold || {}) }; g.applyMove(p, 1 / 30); g.tickPlayer(p, 1 / 30); } g.tickEnts(1 / 30); g.time += 1 / 30; } };
const use = p => g.useAbility(p);
const fresh = () => { g.ents = []; for (const k of [wk - W, wk, wk + W]) { m.tiles[k] = T.SOFT; m.hp[k] = 60; } for (const p of [a, d, d2]) { away(p); p.hold = null; p.ghostUntil = 0; p.boostUntil = 0; } g.spots = { atk: new Map(), def: new Map() }; };
// a soft wall with floor on both sides (left/right), and the open street north of the building
let wk = -1; for (let k = W; k < m.tiles.length - W && wk < 0; k++) if (m.tiles[k] === T.SOFT && [1, 2, 3].every(i => m.tiles[k - i] === T.FLOOR && m.tiles[k + i] === T.FLOOR) && m.tiles[k - W] === T.SOFT && m.tiles[k + W] === T.SOFT) wk = k;
const wx = (wk % W + 0.5) * CELL, wy = (Math.floor(wk / W) + 0.5) * CELL, X = 360, Y = 40;
const door = m.openings.find(o => o.kind === 'door' && o.cells.length === 2 && o.cells.every(c => m.tiles[c] === T.OPEN && m.tiles[c + 1] === T.FLOOR && m.tiles[c - 1] === T.FLOOR));
const sees = (team, p) => g.spots[team].has(p.id);

// ---------- attack ----------
fresh(); m.tiles[wk] = T.REINF; setup(a, 'ember', wx - 22, wy, 0); use(a); ticks(5.3); ok(m.tiles[wk] !== T.REINF, 'EMBER cutter did not burn through a reinforced wall');
fresh(); setup(a, 'kestrel', wx - 30, wy, 0); setup(d, 'lynx', wx + 40, wy, Math.PI); use(a); ticks(2); ok(sees('atk', d), 'KESTREL dart did not reveal the defender behind the wall');
fresh(); setup(a, 'hammer', wx - 60, wy, 0); use(a); ticks(0.5); ok(m.tiles[wk] !== T.SOFT, 'HAMMER breaching round did not open the soft wall');
fresh(); setup(a, 'talon', X, Y, 0); g.ents.push({ id: g.eid(), type: 'jammer', x: X + 60, y: Y, team: TEAM.DEF, owner: d.id, hp: 1 });
g.detonate({ type: 'nade', kind: 'emp', x: X + 50, y: Y, team: TEAM.ATK, owner: a.id }); ok(!g.ents.some(e => e.type === 'jammer'), 'TALON EMP did not destroy a jammer');
fresh(); setup(a, 'rivet', wx - 18, wy, 0); a.hold = { ability: 1 }; ticks(1.6, a); ok(m.tiles[wk] !== T.SOFT, 'RIVET lance did not burn the wall');
fresh(); setup(a, 'haze', X, Y, 0); use(a); ok(g.ents.filter(e => e.type === 'smoke').length >= 2, 'HAZE barrage: no wall of smoke');
fresh(); setup(a, 'glint', X, Y, 0); setup(d, 'lynx', X + 150, Y, 0); g.detonate({ type: 'nade', kind: 'sonar', x: X + 40, y: Y, team: TEAM.ATK, owner: a.id }); ok(sees('atk', d), 'GLINT sonar did not reveal a defender nearby');
fresh(); setup(a, 'brisk', X, Y, 0); const m0 = g.mods(a).mul; use(a); ok(g.mods(a).mul > m0, 'BRISK adrenal did not make her faster');
fresh(); setup(a, 'onyx', wx - 20, wy, 0); setup(d, 'lynx', wx + 40, wy, Math.PI); d.hp = d.maxHp = 500; use(a); ticks(3.3); ok(d.hp < 500, 'ONYX cluster did not hurt the room behind the wall');
fresh(); setup(a, 'prism', X, Y, 0); use(a); const dc = g.ents.find(e => e.type === 'decoy'); const dx0 = dc && dc.x; ticks(1); ok(dc && dc.x > dx0 + 20, 'PRISM decoy did not run ahead');
fresh(); setup(a, 'volt', X, Y, 0); g.ents.push({ id: g.eid(), type: 'jammer', x: X + 80, y: Y, team: TEAM.DEF, owner: d.id, hp: 1 }); use(a); ok(!g.ents.some(e => e.type === 'jammer'), 'VOLT arc gun did not destroy the gadget in line');
fresh(); setup(a, 'tether', wx - 18, wy, 0); use(a); const sc = g.ents.find(e => e.type === 'scope'); ok(sc && sc.x > wx && g.feeds(TEAM.ATK).includes(sc), 'TETHER scope not through the wall or not in the feeds');
fresh(); setup(a, 'strider', X, Y, 0); use(a); g.ents.push({ id: g.eid(), type: 'mine', x: X + 4, y: Y, ang: 0, team: TEAM.DEF, owner: d.id, arm: 0, hp: 1 }); ticks(0.3); ok(g.ents.some(e => e.type === 'mine'), 'STRIDER ghost step set off a mine');
fresh(); setup(a, 'ferro', wx - 18, wy, 0); use(a); ok(m.tiles[wk] !== T.SOFT, 'FERRO hammer did not smash the soft wall');

// ---------- defence ----------
if (door) { const c = door.cells[0], cx = (c % W + 0.5) * CELL, cy = (Math.floor(c / W) + 0.5) * CELL;
  fresh(); setup(d, 'mason', cx - 20, cy, 0); use(d); ok(door.cells.every(k => m.tiles[k] === T.PANEL), 'MASON panel did not seal the doorway');
  for (const k of door.cells) m.tiles[k] = T.OPEN; } else ok(false, 'no door to test MASON');
fresh(); m.tiles[wk] = T.REINF; setup(d, 'veil', wx + 30, wy, 0); use(d); setup(a, 'ember', wx - 22, wy, 0); use(a); ticks(6); ok(m.tiles[wk] === T.REINF, 'VEIL jammer did not stop a cutter'); m.tiles[wk] = T.SOFT;
fresh(); setup(d, 'lynx', X, Y, 0); use(d); ticks(1.6); setup(a, 'ember', X + 10, Y, 0); ticks(0.2); ok(a.slowUntil > g.time && sees('def', a), 'LYNX mine did not slow and reveal');
fresh(); setup(d, 'solace', X, Y, 0); setup(d2, 'lynx', X + 100, Y, 0); d2.hp = 40; use(d); ok(d2.hp > 40, 'SOLACE stim did not heal a teammate'); d2.downed = true; use(d); ok(!d2.downed, 'SOLACE stim did not revive');
fresh(); setup(d, 'wraith', X, Y, 0); d.hold = { ability: 1 }; ticks(0.5, d); ok(d.scanning, 'WRAITH did not scan while holding');
fresh(); setup(d, 'bramble', X, Y, 0); use(d); ticks(1.6); setup(a, 'ember', X + 30, Y, 0); a.hp = a.maxHp = 500; ticks(1.2); ok(a.hp < 500, 'BRAMBLE proximity charge did not go off');
fresh(); setup(d, 'kite', X, Y, 0); use(d); ok(g.ents.some(e => e.type === 'cam' && e.tu), 'KITE did not place a turret camera');
fresh(); setup(d, 'gravel', X, Y, 0); use(d); ticks(1.6); setup(a, 'ember', X + 20, Y, 0); ticks(0.2); ok(a.dazeUntil > g.time, 'GRAVEL daze mine did not daze');
fresh(); setup(d, 'shunt', wx + 18, wy, Math.PI); use(d); setup(a, 'ember', wx - 22, wy, 0); use(a); ticks(0.3); ok(!g.ents.some(e => e.type === 'cutter'), 'SHUNT grid did not fry a cutter on its wall');
fresh(); setup(d, 'hush', X, Y, 0); d.hold = { ability: 1 }; ticks(0.1, d); d.hold = null; ticks(0.1, d); ok(d.shrouded, 'HUSH shroud did not switch on'); d.hold = { right: 1 }; const n0 = (g.noises || []).length; ticks(1, d); ok((g.noises || []).length === n0, 'HUSH made noise while shrouded');
fresh(); setup(d, 'shade', X, Y, 0); use(d); setup(a, 'ember', X + 120, Y, 0); a.moving = 2; ticks(0.6); ok(sees('def', a), 'SHADE sensor did not hear a running attacker');
fresh(); setup(d, 'rampart', X, Y, 0); use(d); const pb = g.ents.find(e => e.type === 'plates'); setup(d2, 'lynx', pb.x, pb.y, 0); d2.plated = false; ticks(0.1); ok(d2.maxHp === 115, 'RAMPART plates did not add health', d2.maxHp);
fresh(); setup(d, 'miasma', X, Y, 0); setup(a, 'ember', X + 60, Y, 0); a.hp = a.maxHp = 500; g.detonate({ type: 'nade', kind: 'gas', x: X + 60, y: Y, team: TEAM.DEF, owner: d.id }); ticks(1.5); ok(a.hp < 500, 'MIASMA gas did not hurt');
fresh(); setup(d, 'snare', X, Y, 0); use(d); ticks(1.6); const cl = g.ents.find(e => e.type === 'clamp'); setup(a, 'ember', cl.x, cl.y, 0); ticks(0.1); ok(a.clampUntil > g.time, 'SNARE clamp did not hold');
fresh(); setup(d, 'argus', X, Y, 0); g.detonate({ type: 'nade', kind: 'cam', x: X + 40, y: Y, vx: 1, vy: 0, team: TEAM.DEF, owner: d.id }); ok(g.feeds(TEAM.DEF).some(e => e.type === 'cam'), 'ARGUS sticky cam is not in the camera feeds');
console.log(fails ? `${fails} of ${n} checks failed` : `PASS oldops (${n} checks)`);
process.exit(fails ? 1 : 0);
