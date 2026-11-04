// Outside cameras and looking over the roof's edge (he asked): 4 cameras per map under the roof's edge; from the roof
// an attacker can see and shoot one, from the ground below too; the camera shows defenders the yard below (and the
// climbers there); someone at the roof's edge sees the ground below and can be seen and shot from there.
// Run: node tests/outcams.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, windowViews, windowSees, windowFoot, wallGhost, peekSeen, floorAt, floorOff, OUTCAM_N } from '../shared/map.js';
import { T, CELL, TEAM, PHASE } from '../shared/constants.js';
import { los, angDiff } from '../shared/physics.js';

let fails = 0, checks = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game({ free: true });
  const atk = g.addPlayer('Atk', false), def = g.addPlayer('Def', false);
  g.mapId = id; g.map = buildMap(id); g.handle(atk, { t: 'free', a: 'start', map: id, bots: 0 });
  const m = g.map, gi = m.groundFloor, rf = m.roofFloor;
  const cams = g.ents.filter(e => e.type === 'cam' && e.oc !== undefined);
  if (cams.length !== OUTCAM_N) fail(id, 'outside cameras:', cams.length);
  if (g.side(atk) !== TEAM.ATK) { /* free play: make sure the shooter is an attacker */ atk.squad = g.squadOf ? g.squadOf(TEAM.ATK) : atk.squad; }
  const team = g.side(atk); for (const c of cams) c.team = team === TEAM.ATK ? TEAM.DEF : TEAM.ATK; // the other side's cameras
  const reset = () => { for (const q of [atk, def]) Object.assign(q, { alive: true, downed: false, ctrl: 'body', viewTime: null, staged: false, hp: 999, maxHp: 999, rope: null }); };
  const shoot = (p, x, y) => {
    const a = Math.atan2(y - p.y, x - p.x); g.shotAim = { x, y };
    const e = g.hitscan(p, p.x, p.y, a, 2000, 30, 'Test', 'AR');
    if (g.winCarry && e.k === 'none') g.shotOutWindow(p, p, a, 2000, 30, 'Test', 'AR');
    g.winCarry = null; g.shotAim = null; return e;
  };
  const walk = (x, y, f) => { const k = Math.floor(y / CELL) * m.W + Math.floor(x / CELL); return m.flAt[k] === f && (m.tiles[k] === T.FLOOR || m.tiles[k] === T.GROUND) && !m.shape[k]; };
  for (const c of cams) {
    const oc = m.outCams[c.oc], e = m.roofEdges[oc.e], ox = Math.cos(oc.n), oy = Math.sin(oc.n);
    // from the roof, 1-3 m back from the edge above it: seen, and one shot breaks it
    let rx = 0, ry = 0; for (const d of [30, 45, 60, 80, 100]) { const x = oc.x - ox * d, y = oc.y - oy * d; if (walk(x, y, rf)) { rx = x; ry = y; break; } }
    if (!rx) { fail(id, 'cam', c.oc, 'no roof spot behind it'); continue; }
    reset(); Object.assign(atk, { x: rx, y: ry }); checks++;
    if (!los(m, rx, ry, c.x, c.y)) fail(id, 'cam', c.oc, 'not visible from the roof');
    c.hp = 1; shoot(atk, c.x, c.y); if (c.hp > 0) fail(id, 'cam', c.oc, 'roof shot did not break it');
    // the edge view: right at the edge you see down
    const ex = oc.x - ox * 12, ey = oc.y - oy * 12;
    if (walk(ex, ey, rf) && !windowViews(m, ex, ey).length) fail(id, 'cam', c.oc, 'no view down from the roof edge');
    // from the ground, 5-9 m out in front of it: shot down
    let gx = 0, gy = 0; for (const d of [6, 8, 5, 9, 4]) for (const sd of [0, 1, -1, 2, -2]) { if (gx) break; const x = oc.gx + ox * d * 36 + Math.abs(oy) * sd * 16, y = oc.gy + oy * d * 36 + Math.abs(ox) * sd * 16; if (walk(x, y, gi) && los(m, x, y, oc.gx, oc.gy)) { gx = x; gy = y; } }
    if (!gx) { console.log('skip', id, 'cam', c.oc, '(no clear ground in front)'); continue; }
    reset(); Object.assign(atk, { x: gx, y: gy }); checks++;
    c.hp = 1; shoot(atk, oc.gx, oc.gy); if (c.hp > 0) fail(id, 'cam', c.oc, 'ground shot did not break it');
    c.hp = 1;
    // someone at the roof's edge right above is seen from that ground spot (if their view takes it in) and can be shot
    if (walk(ex, ey, rf)) {
      reset(); Object.assign(def, { x: ex, y: ey });
      const gh = wallGhost(m, ex, ey);
      if (!gh) fail(id, 'cam', c.oc, 'roof peeker has no copy below');
      else if (peekSeen(m, gh, gx, gy)) { checks++; c.hp = 0; const pv = peekSeen(m, gh, gx, gy); shoot(atk, pv.x, pv.y); c.hp = 1; if (def.hp >= 999) fail(id, 'cam', c.oc, 'could not shoot the roof peeker from below', JSON.stringify({ gh: [gh.x | 0, gh.y | 0], from: [gx | 0, gy | 0], foot: [oc.gx | 0, oc.gy | 0] })); }
      // and the peeker shoots back down at the ground spot
      if (windowViews(m, ex, ey).some(v => windowSees(m, v, gx, gy))) { reset(); Object.assign(def, { x: ex, y: ey }); checks++; c.hp = 0; const o = floorOff(m, gi, rf); shoot(def, gx + o.x, gy + o.y); c.hp = 1; if (atk.hp >= 999) fail(id, 'cam', c.oc, 'roof peeker could not shoot down'); }
    }
  }
}
console.log(fails ? `FAIL ${fails}` : `PASS (${checks} checks)`);
process.exit(fails ? 1 : 0);
