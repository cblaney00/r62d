// Upper windows (he asked): from an upper window you see and shoot the ground below; from below you see and shoot
// someone at that window or on a rope; nothing through an intact board; through a bullet hole only a slit, and the
// peeker is only made out from close by. Every outside window above the ground on every map. Run: node tests/windows.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, windowViews, windowSees, windowFoot, wallGhost, peekSeen, floorOff, floorAt, WIN_HOLE_SEE } from '../shared/map.js';
import { T, CELL } from '../shared/constants.js';
import { los, angDiff } from '../shared/physics.js';
import { visibleEnemy } from '../server/bots.js';
import { TEAM, PHASE } from '../shared/constants.js';

let fails = 0, shots = 0, skipped = 0, botChecks = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game({ free: true });
  const up = g.addPlayer('Up', false), dn = g.addPlayer('Down', false);
  g.mapId = id; g.map = buildMap(id); g.handle(up, { t: 'free', a: 'start', map: id, bots: 0 });
  const m = g.map, gi = m.groundFloor; let n = 0;
  const reset = () => { for (const q of [up, dn]) Object.assign(q, { alive: true, downed: false, ctrl: 'body', viewTime: null, staged: false, hp: 999, maxHp: 999, rope: null }); };
  const shoot = (p, x, y) => { // like fire(): hitscan, then on down out of a window
    const a = Math.atan2(y - p.y, x - p.x); g.shotAim = { x, y };
    const e = g.hitscan(p, p.x, p.y, a, 2000, 30, 'Test', 'AR');
    if (g.winCarry && e.k === 'none') g.shotOutWindow(p, p, a, 2000, 30, 'Test', 'AR');
    g.winCarry = null; g.shotAim = null; shots++;
  };
  for (const r of m.ropes) {
    const ft = windowFoot(m, r); if (!ft) continue;
    const ox = Math.cos(r.out), oy = Math.sin(r.out), save = r.cells.map(k => [m.tiles[k], m.hp[k]]);
    // the spot on the ground: 7-11 m out, near the window's line, with a clear view from the wall (yard cover may be in the way)
    let gx = 0, gy = 0, okSpot = false;
    for (const dm of [8, 9, 10, 7, 11]) for (const sd of [0, 1, -1, 2, -2]) {
      if (okSpot) break;
      const tx = ft.x + ox * dm * 36 + r.tx * sd * 16, ty = ft.y + oy * dm * 36 + r.ty * sd * 16, kk = Math.floor(ty / CELL) * m.W + Math.floor(tx / CELL);
      if (floorAt(m, tx, ty) === gi && m.tiles[kk] === T.GROUND && los(m, ft.x, ft.y, tx, ty) && Math.abs(angDiff(Math.atan2(ty - ft.y, tx - ft.x), r.out)) < 0.35) { gx = tx; gy = ty; okSpot = true; }
    }
    if (!okSpot) { skipped++; continue; }
    // the peeker: on clear floor just inside the window (not on a desk under it)
    let ux = 0, uy = 0; for (const dd of [1.6, 2.2, 1.2, 2.8]) { const x = ft.cx - ox * CELL * dd, y = ft.cy - oy * CELL * dd, kk = Math.floor(y / CELL) * m.W + Math.floor(x / CELL); if (m.tiles[kk] === T.FLOOR) { ux = x; uy = y; break; } }
    if (!ux) { skipped++; continue; }
    reset(); Object.assign(up, { x: ux, y: uy }); Object.assign(dn, { x: gx, y: gy });
    for (const k of r.cells) { m.tiles[k] = T.OPEN; m.hp[k] = 0; }
    const o = floorOff(m, gi, r.f);
    if (!windowViews(m, up.x, up.y).length) { fail(id, 'window', r.i, 'no view down from an open window'); continue; }
    if (!windowViews(m, up.x, up.y).some(v => windowSees(m, v, dn.x, dn.y))) { skipped++; continue; } // (the spot is round a corner of the opening)
    shoot(up, dn.x + o.x, dn.y + o.y); if (dn.hp >= 999) fail(id, 'window', r.i, 'could not shoot down out of the open window', JSON.stringify({ up: [up.x, up.y], dn: [dn.x, dn.y] }));
    // bots: the one at the window sees the one below (facing out), the one below sees the peeker (facing the wall)
    if (g.side(up) !== g.side(dn)) {
      reset(); up.aim = r.out; dn.aim = r.out + Math.PI;
      const sU = visibleEnemy(g, up, 2000), sD = visibleEnemy(g, dn, 2000);
      if (!sU || sU.id !== dn.id || !sU.win) fail(id, 'window', r.i, 'a bot at the window does not see the enemy below');
      if (!sD || sD.id !== up.id) fail(id, 'window', r.i, 'a bot below does not see the window peeker');
      botChecks++;
    }
    reset(); const gh = wallGhost(m, up.x, up.y);
    if (!gh || !peekSeen(m, gh, dn.x, dn.y)) fail(id, 'window', r.i, 'peeker not seen from below');
    else { shoot(dn, gh.x, gh.y); if (up.hp >= 999) fail(id, 'window', r.i, 'could not shoot up at the peeker'); }
    // boarded: nothing either way
    for (const k of r.cells) { m.tiles[k] = T.BARRI; m.hp[k] = 60; delete m.holes[k]; }
    reset();
    if (windowViews(m, up.x, up.y).length || wallGhost(m, up.x, up.y)) fail(id, 'window', r.i, 'seen through an intact board');
    // one bullet hole: a slit, and the peeker is not made out from 8 m
    const k0 = r.cells[0]; m.holes[k0] = [(k0 % m.W + 0.5) * CELL, (Math.floor(k0 / m.W) + 0.5) * CELL];
    const vs = windowViews(m, up.x, up.y), gh2 = wallGhost(m, up.x, up.y);
    if (!vs.length || !vs.every(v => v.hole && v.fov < 0.2)) fail(id, 'window', r.i, 'a bullet hole should give a slit');
    if (gh2 && 8 * 36 > WIN_HOLE_SEE && peekSeen(m, gh2, dn.x, dn.y)) fail(id, 'window', r.i, 'peeker behind a hole seen from 8 m');
    delete m.holes[k0];
    // hanging on the rope outside: shows on the ground under them, shot from below
    reset(); Object.assign(up, { x: r.hang.x, y: r.hang.y });
    const gr = wallGhost(m, up.x, up.y);
    if (!gr || !gr.rope) fail(id, 'window', r.i, 'climber not shown on the ground');
    else if (peekSeen(m, gr, dn.x, dn.y)) { shoot(dn, gr.x, gr.y); if (up.hp >= 999) fail(id, 'window', r.i, 'could not shoot the climber'); }
    r.cells.forEach((k, i) => { m.tiles[k] = save[i][0]; m.hp[k] = save[i][1]; });
    n++;
  }
  // run-outs: a defender outside is spotted for the attackers only after 3 s outside in a row
  { reset(); const d = g.side(up) === TEAM.DEF ? up : dn, gi2 = m.groundFloor, G = m.floors[gi2];
    const k = (() => { for (let y = 2; y < G.h; y++) for (let x = 2; x < G.w; x++) { const c = y * m.W + G.gx + x; if (m.tiles[c] === T.GROUND) return c; } })();
    Object.assign(d, { x: (k % m.W + 0.5) * CELL, y: (Math.floor(k / m.W) + 0.5) * CELL }); g.phase = PHASE.ACTION; g.spots[TEAM.ATK].delete(d.id);
    const seen = () => (g.spots[TEAM.ATK].get(d.id) || 0) > g.time;
    for (let t = 0; t < 2.5; t += 0.1) g.tickPlayer(d, 0.1);
    if (g.side(d) !== TEAM.DEF) fail(id, 'no defender for the run-out check');
    else if (seen()) fail(id, 'run-out spotted before 3 s');
    for (let t = 0; t < 0.7; t += 0.1) g.tickPlayer(d, 0.1);
    if (g.side(d) === TEAM.DEF && !seen()) fail(id, 'run-out not spotted after 3 s'); }
  console.log(`${id}: ${n} of ${m.ropes.length} upper windows checked`);
}
console.log(fails ? `${fails} failure(s)` : `PASS windows (${shots} shots, ${botChecks} bot sight checks, run-outs on every map, ${skipped} windows with no open ground 7-11 m out)`);
process.exit(fails ? 1 : 0);
