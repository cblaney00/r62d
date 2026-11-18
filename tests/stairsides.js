// Stair rails (he asked 2026-11-18): going up, a staircase is entered only at its bottom step; nobody walks on or off
// its sides partway (a jump crosses them); the upper floor's flight is entered only from the top. For every staircase
// on every map, with the real movement (shared/physics.js stepMove). Run: node tests/stairsides.js
import { CELL, T, blocksMove } from '../shared/constants.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { stepMove } from '../shared/physics.js';

let fails = 0, tries = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const KEY = { n: { up: true }, s: { down: true }, w: { left: true }, e: { right: true } };
const UV = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
// walk one way for `secs` (jumping at the start if asked); where the body ends up
function walk(m, x, y, dir, secs, jump = false) {
  const o = { x, y, vx: 0, vy: 0 };
  for (let t = 0; t < secs; t += 1 / 30) stepMove(m, o, { ...KEY[dir], jump: jump && t < 0.1 }, 1 / 30, {});
  return o;
}
const onStair = (m, o) => m.tiles[Math.floor(o.y / CELL) * m.W + Math.floor(o.x / CELL)] === T.STAIR;
const free = (m, cx, cy) => cx >= 0 && cy >= 0 && cx < m.W && cy < m.H && !blocksMove(m.tiles[cy * m.W + cx]) && m.tiles[cy * m.W + cx] !== T.OPEN; // (a window or doorway beside a flight: a vault, not a walk or a hop)
for (const id of MAP_LIST) {
  const m = buildMap(id), W = m.W;
  for (const [si, s] of m.stairs.entries()) {
    const [ux, uy] = UV[s.dir], side = ux ? ['n', 's'] : ['w', 'e'];
    for (const [g, lower] of [[s.ga, true], [s.gb, false]]) {
      const x0 = g % W, y0 = Math.floor(g / W), x1 = x0 + s.w - 1, y1 = y0 + s.h - 1, name = `${id} stair ${si} (${lower ? 'lower' : 'upper'} floor)`;
      const mx = (x0 + x1 + 1) / 2, my = (y0 + y1 + 1) / 2; // the middle of the flight, in cells
      for (const sd of side) { // from beside the middle step, walking in; from the middle step, walking out
        const [sx, sy] = UV[sd], ox = sd === 'w' ? x0 - 1 : sd === 'e' ? x1 + 1 : Math.floor(mx), oy = sd === 'n' ? y0 - 1 : sd === 's' ? y1 + 1 : Math.floor(my);
        const inward = { n: 's', s: 'n', w: 'e', e: 'w' }[sd];
        if (free(m, ox, oy) && free(m, ox - sx, oy - sy) || free(m, ox, oy)) {
          tries++;
          const a = walk(m, (ox + 0.5) * CELL, (oy + 0.5) * CELL, inward, 1.2);
          if (onStair(m, a)) fail(name, `walked on from the ${sd} side`);
          if (free(m, ox, oy) && free(m, ox + sx, oy + sy)) { const j = walk(m, (ox + 0.5) * CELL + sx * 4, (oy + 0.5) * CELL + sy * 4, inward, 0.35, true); if (!onStair(m, j)) fail(name, `a jump from the ${sd} side didn't land on it`); }
        }
        tries++;
        const b = walk(m, mx * CELL, my * CELL, sd, 1.2);
        if (!onStair(m, b)) fail(name, `walked off the ${sd} side`);
      }
      // the closed end: beyond the top on the lower floor, beyond the bottom on the upper floor
      const out = lower ? s.dir : { n: 's', s: 'n', w: 'e', e: 'w' }[s.dir], [ex, ey] = UV[out];
      const cx = out === 'w' ? x0 - 1 : out === 'e' ? x1 + 1 : Math.floor(mx), cy = out === 'n' ? y0 - 1 : out === 's' ? y1 + 1 : Math.floor(my);
      if (free(m, cx, cy)) {
        tries++;
        const c = walk(m, (cx + 0.5) * CELL + ex * 4, (cy + 0.5) * CELL + ey * 4, { n: 's', s: 'n', w: 'e', e: 'w' }[out], 1.2);
        if (onStair(m, c) || Math.abs(c.x - (cx + 0.5) * CELL) > CELL * 3 || Math.abs(c.y - (cy + 0.5) * CELL) > CELL * 3) fail(name, `got on from the closed ${lower ? 'top' : 'bottom'} end`);
      }
    }
  }
}
console.log(`${tries} tries on every staircase of ${MAP_LIST.length} maps`);
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
