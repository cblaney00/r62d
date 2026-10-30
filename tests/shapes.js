// Angled and curved walls: sight, bullets and bodies must stop at the real slope or curve, with no gaps
// between the pieces in neighbouring cells. Run: node tests/shapes.js
import './_tmpdata.js';
import { CELL, T, CELL_HP } from '../shared/constants.js';
import { buildMap } from '../shared/map.js';
import { castSight, moveCircle } from '../shared/physics.js';
import { Game } from '../server/game.js';

let bad = 0;
const fail = (...a) => { bad++; if (bad < 15) console.log('  FAIL', ...a); };
const m = buildMap('harbor');
// building frame (cell units) -> world px on floor i
const W = (i, u, v) => { const F = m.floors[i]; return { x: (F.gx + u - F.x0) * CELL, y: (v - F.y0) * CELL }; };
const back = (i, x, y) => { const F = m.floors[i]; return { u: x / CELL - F.gx + F.x0, v: y / CELL + F.y0 }; };

// 1. the cut corners: nothing from inside reaches past the angled facade (u - v = 55 north-east, v - u = 31 south-west)
for (const i of [0, 1]) for (const [u0, v0, a0, a1, out] of [[66, 14.5, -80, 10, p => p.u - p.v > 55.9], [16, 45, 100, 170, p => p.v - p.u > 31.9]]) {
  for (let s = 0; s < 400; s++) {
    const o = W(i, u0 + (s % 5) * 0.3 - 0.6, v0 + Math.floor(s / 80) * 0.3), a = (a0 + (a1 - a0) * (s % 80) / 79) * Math.PI / 180;
    const d = castSight(m, o.x, o.y, a, 400, null), e = back(i, o.x + Math.cos(a) * (d - 0.01), o.y + Math.sin(a) * (d - 0.01));
    if (out(e)) fail(`floor ${i}: sight leaked through the angled corner from ${u0},${v0} at ${(a * 180 / Math.PI).toFixed(1)}°`);
  }
  // a body pushed hard at the corner stays inside
  for (const [u, v, dx, dy, out] of [[67, 13, 1, -1, p => p.u - p.v > 55.2], [69, 15, 1, 0, p => p.u - p.v > 55.2], [15, 46, -1, 1, p => p.v - p.u > 31.2], [14, 44, 0, 1, p => p.v - p.u > 31.2]]) {
    const o = W(i, u, v); for (let k = 0; k < 120; k++) moveCircle(m, o, dx * 3, dy * 3, 7);
    if (out(back(i, o.x, o.y))) fail(`floor ${i}: a body walked out through the corner from ${u},${v}`);
  }
}
// 2. the curved booth on 2F (centre 24, 46.5, radius 5): every ray from inside upwards stops at the curve
for (let s = 0; s <= 360; s++) {
  const o = W(1, 24, 46), a = Math.PI + Math.PI * s / 360, d = castSight(m, o.x, o.y, a, 400, null);
  const e = back(1, o.x + Math.cos(a) * d, o.y + Math.sin(a) * d), r = Math.hypot(e.u - 24, e.v - 46.5);
  if (r > 5.5 && e.v < 46.2) fail(`2F booth: sight leaked out at ${(a * 180 / Math.PI).toFixed(1)}° (reached radius ${r.toFixed(2)})`);
  if (r < 4.5) fail(`2F booth: sight stopped early at radius ${r.toFixed(2)}`);
}
// 3. bullets: from the 1F Meeting Room into its angled plastered corner (hard) they stop at the slope;
//    from the 2F booth out through the curve (made soft here: the map may harden it) they go through and chip the wall
{
  const g = new Game(); g.map = buildMap('harbor'); const gm = g.map;
  const src = { id: 'x', team: 'atk', ms: null };
  const o = W(0, 56, 32), r = g.hitscan(src, o.x, o.y, Math.atan2(-1, -1), 300, 30, 'test', 'AR'), e = back(0, r.x, r.y);
  if (r.k !== 'hard' || e.u + e.v > 85.6 || e.u + e.v < 84.5) fail(`bullet into the Meeting Room's angled corner ended at ${e.u.toFixed(2)},${e.v.toFixed(2)} (${r.k})`);
  for (let k = 0; k < gm.tiles.length; k++) if (gm.hardened[k] && gm.shape[k]) { gm.tiles[k] = T.SOFT; gm.hp[k] = CELL_HP[T.SOFT]; }
  const b = W(1, 24, 46), r2 = g.hitscan(src, b.x, b.y, -Math.PI / 2, 300, 30, 'test', 'Shotgun');
  if (!Object.keys(g.changed ? Object.fromEntries([...g.changed].map(k => [k, 1])) : {}).length && !(gm.hp.some((h, k) => gm.shape[k] && h < 60 && h > 0))) fail('shotgun pellet did not chip the curved booth wall');
}
// 4. drawing info: the piece edges match up — every shaped cell's pieces lie inside its own cell
for (const k of Object.keys(m.shape)) {
  const x0 = (k % m.W) * CELL, y0 = Math.floor(k / m.W) * CELL;
  for (const P of m.shape[k]) for (let j = 0; j < P.length; j += 2)
    if (P[j] < x0 - 1e-6 || P[j] > x0 + CELL + 1e-6 || P[j + 1] < y0 - 1e-6 || P[j + 1] > y0 + CELL + 1e-6) fail(`piece outside its cell at ${k}`);
}
console.log(`${Object.keys(m.shape).length} sloped wall cells on Harbor Office`);
console.log(bad ? `FAIL (${bad})` : 'PASS');
process.exit(bad ? 1 : 0);
