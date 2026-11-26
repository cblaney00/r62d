// Shooting through open hatches both ways, for both teams (he asked 2026-11-26: players on both sides must be able to
// shoot up and down through hatches, including DEADFALL's). Every hatch on every map, opened, plus a fresh DEADFALL
// drop-charge hole on each upper floor: an attacker and a defender each shoot DOWN at an enemy under it and UP at an
// enemy standing at its edge. Run: node tests/hatchshots.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, floorAt } from '../shared/map.js';
import { PHASE, T, CELL, TEAM } from '../shared/constants.js';
import { WEAPONS } from '../shared/operators.js';

let fails = 0, checks = 0, drops = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const wk = Object.keys(WEAPONS).find(k => WEAPONS[k].cls === 'AR');
for (const id of MAP_LIST) {
  const g = new Game();
  for (let i = 0; i < 4; i++) g.addBot();
  g.mapId = id; g.map = buildMap(id); g.startMatch();
  while (g.phase !== PHASE.ACTION || g.introT > 0) g.tick(1 / 30);
  for (const q of g.players.values()) q.bot = false; // moved by hand
  const ps = [...g.players.values()], def = ps.find(q => g.side(q) === TEAM.DEF), atk = ps.find(q => g.side(q) === TEAM.ATK);
  const ready = q => { if (q.op === 'bulwark') q.op = 'ember'; q.bracing = false; q.alive = true; q.downed = false; q.hp = 100; q.ctrl = 'body'; q.busy = null; q.stunUntil = 0; q.pr = 0; q.rope = null; q.vault = null; q.input = { ...q.input, up: 0, down: 0, left: 0, right: 0, fire: 0, crouch: 0 }; q.rc = 0; q.adsT = 1; q.bloom = 0; q.vx = q.vy = 0; q.shots = 0; q.lastShot = -99; q.viewTime = null; };
  // a DEADFALL hole on each upper floor that has room for one
  const before = g.map.hatches.length;
  const done = new Set();
  for (let y = 3; y < g.map.H - 3; y += 3) for (let x = 3; x < g.map.W - 3; x += 3) {
    const k = y * g.map.W + x, wx = (x + 0.5) * CELL, wy = (y + 0.5) * CELL, f = floorAt(g.map, wx, wy);
    if (g.map.tiles[k] !== T.FLOOR || done.has(f)) continue;
    if (g.blowFloor(wx, wy)) { done.add(f); drops++; }
  }
  const open = h => h.cells.every(k => g.map.tiles[k] === T.HOLE);
  for (const h of g.map.hatches) {
    for (const c of h.cells) { g.map.tiles[c] = T.HOLE; }
    if (!open(h)) continue;
    const kind = g.map.hatches.indexOf(h) >= before ? 'DEADFALL hole' : 'hatch';
    for (const [shooter, target] of [[atk, def], [def, atk]]) {
      const tag = `${id} ${kind} ${h.id} ${g.side(shooter)} shooting`;
      const gun = { w: wk, ammo: 30, reserve: 0, att: {}, m: null };
      // down: the shooter beside the hole upstairs, aiming into it; the enemy right under it
      ready(shooter); shooter.x = h.x - 22; shooter.y = h.y; shooter.aim = 0; shooter.aimX = h.x; shooter.aimY = h.y;
      ready(target); target.x = h.bx; target.y = h.by;
      let hp = target.hp; for (let i = 0; i < 3 && target.hp === hp; i++) g.fire(shooter, gun, WEAPONS[wk]);
      checks++; if (target.hp === hp) fail(tag, 'down: did not hit the enemy under it');
      // up: the shooter below, aiming at the hole; the enemy at its edge upstairs
      ready(shooter); shooter.x = h.bx - 30; shooter.y = h.by; shooter.aim = 0; shooter.aimX = h.bx; shooter.aimY = h.by;
      ready(target); target.x = h.x; target.y = h.y - 2;
      hp = target.hp; for (let i = 0; i < 3 && target.hp === hp; i++) g.fire(shooter, gun, WEAPONS[wk]);
      checks++; if (target.hp === hp) fail(tag, 'up: did not hit the enemy above it');
    }
  }
}
console.log(`${checks} shots checked, ${drops} DEADFALL holes made`);
console.log(fails ? `FAIL ${fails}` : 'PASS');
